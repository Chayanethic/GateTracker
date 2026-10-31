import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildOptionHtml,
  buildQuestionHtml,
  buildSolutionHtml,
  defaultNegativeForMarks,
  extractRawSolutionFields,
  formatPscExamName,
  parsePscExamMeta,
  PscQuestion,
  PscQuestionType,
} from '@/lib/pscExam';

export const runtime = 'nodejs';
export const maxDuration = 60;

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function adminOk(req: Request) {
  return (
    req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD
  );
}

function normalizePscQuestions(
  rawQuestions: any[],
  category: string,
  stream: string
) {
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) {
    throw new Error('At least one question is required in the question paper.');
  }

  const storedQuestions: any[] = [];
  const keyRows: any[] = [];

  rawQuestions.forEach((q: any, index: number) => {
    const number = index + 1;
    const id = String(q?.id || `q${number}`).trim();
    const rawType = String(q?.type || 'MCQ').trim().toUpperCase();
    const type: PscQuestionType =
      rawType === 'NAT' ? 'NAT' : rawType === 'MSQ' ? 'MSQ' : 'MCQ';

    const topic = String(q?.topic || '').trim();
    const questionText = String(q?.questionText ?? q?.question ?? '').trim();
    const questionImageUrl = String(q?.questionImageUrl ?? '').trim();

    if (!questionText && !questionImageUrl) {
      throw new Error(`Question ${number} (${id}) must have question text or a question image URL.`);
    }

    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    const options =
      type === 'NAT'
        ? []
        : rawOptions.map((o: any, oIdx: number) => {
            const optId = String(o?.id ?? o?.key ?? String.fromCharCode(65 + oIdx))
              .trim()
              .toUpperCase();
            const text = String(o?.text ?? '').trim();
            const imageUrl = String(o?.imageUrl ?? '').trim();
            return {
              id: optId,
              key: optId,
              text,
              imageUrl,
              html: buildOptionHtml(text, imageUrl),
            };
          });

    const rawAns = Array.isArray(q?.correctAnswer)
      ? q.correctAnswer.map((x: any) => String(x).trim()).filter(Boolean)
      : String(q?.correctAnswer ?? q?.answer ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    if (!rawAns.length) {
      throw new Error(`Question ${number} (${id}) is missing a correctAnswer.`);
    }

    const answerList =
      type === 'NAT' ? [rawAns.join(',')] : rawAns.map((a) => a.toUpperCase());

    const marks = Number(q?.marks);
    if (!Number.isFinite(marks) || marks <= 0) {
      throw new Error(`Question ${number} (${id}) must have positive marks.`);
    }

    const negRaw = Number(q?.negativeMarks);
    const negativeMarks =
      q?.negativeMarks !== undefined && q?.negativeMarks !== null && q?.negativeMarks !== '' && Number.isFinite(negRaw) && negRaw >= 0
        ? negRaw
        : defaultNegativeForMarks(type, marks);

    // Explanation & solutionImageUrl are optional
    const explanation = String(q?.explanation ?? '').trim();
    const solutionImageUrl = String(q?.solutionImageUrl ?? '').trim();
    const solutionHtml = buildSolutionHtml(explanation, solutionImageUrl);

    storedQuestions.push({
      id,
      number,
      type,
      topic,
      questionText,
      questionImageUrl,
      questionHtml: buildQuestionHtml(questionText, questionImageUrl),
      options,
      marks: Number(marks.toFixed(2)),
      negativeMarks: Number(negativeMarks.toFixed(2)),
      hasExplanation: Boolean(explanation || solutionImageUrl),
      pscJson: true,
      metaCategory: category,
      metaStream: stream,
    });

    keyRows.push({
      id_in_test: id,
      number,
      answer: answerList,
      solution_html: solutionHtml,
      video_url: null,
      question_type: type,
      marks: Number(marks.toFixed(2)),
      negative_marks: Number(negativeMarks.toFixed(2)),
    });
  });

  const calculatedMarks = Number(
    storedQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0).toFixed(2)
  );

  return { storedQuestions, keyRows, calculatedMarks };
}

async function insertKeysResilient(client: any, testId: string, keyRows: any[]) {
  const fullRows = keyRows.map((k) => ({
    test_series_id: testId,
    id_in_test: k.id_in_test,
    number: k.number,
    answer: k.answer,
    solution_html: k.solution_html,
    video_url: k.video_url,
    question_type: k.question_type,
    marks: k.marks,
    negative_marks: k.negative_marks,
  }));

  const { error: richError } = await client.from('test_series_keys').insert(fullRows);
  if (!richError) return;

  // Fallback to base columns from supabase_test_series.sql
  const baseRows = keyRows.map((k) => ({
    test_series_id: testId,
    id_in_test: k.id_in_test,
    number: k.number,
    answer: k.answer,
    solution_html: k.solution_html,
    video_url: k.video_url,
  }));

  const { error: baseError } = await client.from('test_series_keys').insert(baseRows);
  if (baseError) {
    throw new Error(`Failed to save answer keys: ${baseError.message}`);
  }
}

export async function GET(req: Request) {
  if (!adminOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const singleId = searchParams.get('id')?.trim();
    const client = db();

    if (singleId) {
      const { data: test, error: testErr } = await client
        .from('test_series')
        .select('*')
        .eq('id', singleId)
        .maybeSingle();

      if (testErr || !test) {
        return NextResponse.json({ error: 'Exam paper not found.' }, { status: 404 });
      }

      const { data: keys, error: keyErr } = await client
        .from('test_series_keys')
        .select('*')
        .eq('test_series_id', singleId)
        .order('number');

      if (keyErr) {
        return NextResponse.json({ error: keyErr.message }, { status: 500 });
      }

      const keyMap = new Map<string, any>(
        (keys || []).map((k: any) => [String(k.id_in_test), k])
      );
      const meta = parsePscExamMeta(test);

      const questions: PscQuestion[] = (
        Array.isArray(test.questions) ? test.questions : []
      ).map((q: any, idx: number) => {
        const k = keyMap.get(String(q.id)) || {};
        const sol = extractRawSolutionFields(k.solution_html || '');
        const rawType = String(q.type || k.question_type || 'MCQ').toUpperCase();
        const type: PscQuestionType =
          rawType === 'NAT' ? 'NAT' : rawType === 'MSQ' ? 'MSQ' : 'MCQ';

        const ansArr = Array.isArray(k.answer) ? k.answer.map(String) : [];
        const correctAnswer = ansArr.join(',') || 'A';

        const options =
          type === 'NAT'
            ? []
            : (Array.isArray(q.options) ? q.options : []).map((o: any, oIdx: number) => ({
                id: String(o.id ?? o.key ?? String.fromCharCode(65 + oIdx)).toUpperCase(),
                text: String(
                  o.text ??
                    String(o.html || '')
                      .replace(/<div class="mt-2">[\s\S]*?<\/div>/gi, '')
                      .replace(/<[^>]+>/g, '')
                ).trim(),
                imageUrl: String(o.imageUrl || '').trim(),
              }));

        const questionText =
          q.questionText !== undefined
            ? String(q.questionText)
            : String(q.questionHtml || '')
                .replace(/<div class="psc-question-image[\s\S]*?<\/div>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .trim();

        const marks = Number(q.marks ?? k.marks ?? 1);
        const negativeMarks = Number(
          q.negativeMarks ?? k.negative_marks ?? defaultNegativeForMarks(type, marks)
        );

        return {
          id: String(q.id || `q${idx + 1}`),
          type,
          topic: String(q.topic || ''),
          questionText,
          questionImageUrl: String(q.questionImageUrl || ''),
          options,
          correctAnswer,
          marks,
          negativeMarks,
          explanation: sol.explanation,
          solutionImageUrl: sol.solutionImageUrl,
        };
      });

      return NextResponse.json({
        exam: {
          id: test.id,
          title: test.title,
          category: meta.category,
          stream: meta.stream,
          durationMinutes: Number(test.duration_minutes || 45),
          totalMarks: Number(test.max_marks || 0),
          questions,
        },
      });
    }

    // List all PSC / JSON exams
    let rows: any[] = [];
    const rich = await client
      .from('test_series')
      .select(
        'id,title,exam_name,duration_minutes,max_marks,question_count,questions,is_published,created_at,provider,test_category,subject,stream'
      )
      .order('created_at', { ascending: false });

    if (!rich.error) {
      rows = rich.data || [];
    } else {
      const legacy = await client
        .from('test_series')
        .select(
          'id,title,exam_name,duration_minutes,max_marks,question_count,questions,is_published,created_at'
        )
        .order('created_at', { ascending: false });
      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      rows = legacy.data || [];
    }

    const pscExams = rows
      .map((t: any) => {
        const meta = parsePscExamMeta(t);
        if (!meta.isPsc) return null;
        return {
          id: t.id,
          title: t.title,
          category: meta.category,
          stream: meta.stream,
          durationMinutes: Number(t.duration_minutes || 45),
          totalMarks: Number(t.max_marks || 0),
          questionCount: Number(t.question_count || (Array.isArray(t.questions) ? t.questions.length : 0)),
          isPublished: Boolean(t.is_published),
          createdAt: t.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ exams: pscExams });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load PSC exams.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!adminOk(req)) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const category = String(body.category || 'Subject Wise').trim() || 'Subject Wise';
    const stream = String(body.stream || 'CS').trim().toUpperCase() || 'CS';
    const durationMinutes = Number(body.durationMinutes || 45);

    if (!title) {
      return NextResponse.json({ error: 'Exam title is required.' }, { status: 400 });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'Duration (minutes) must be greater than 0.' },
        { status: 400 }
      );
    }

    const { storedQuestions, keyRows, calculatedMarks } = normalizePscQuestions(
      body.questions,
      category,
      stream
    );

    const maxMarks =
      calculatedMarks > 0
        ? calculatedMarks
        : Math.max(1, Number(body.totalMarks || storedQuestions.length));
    const examName = formatPscExamName(category, stream);

    const client = db();

    // Try inserting with extended columns first, then fallback to base schema
    let insertedId: string | null = null;

    const richInsert = await client
      .from('test_series')
      .insert({
        title,
        exam_name: examName,
        duration_minutes: Math.round(durationMinutes),
        max_marks: maxMarks,
        question_count: storedQuestions.length,
        questions: storedQuestions,
        is_published: true,
        provider: 'prepfusion',
        test_category: 'standard',
        subject: category,
        stream,
      })
      .select('id')
      .single();

    if (!richInsert.error && richInsert.data?.id) {
      insertedId = richInsert.data.id;
    } else {
      const baseInsert = await client
        .from('test_series')
        .insert({
          title,
          exam_name: examName,
          duration_minutes: Math.round(durationMinutes),
          max_marks: maxMarks,
          question_count: storedQuestions.length,
          questions: storedQuestions,
          is_published: true,
        })
        .select('id')
        .single();

      if (baseInsert.error || !baseInsert.data?.id) {
        throw new Error(baseInsert.error?.message || 'Failed to create exam paper.');
      }
      insertedId = baseInsert.data.id;
    }

    try {
      await insertKeysResilient(client, insertedId!, keyRows);
    } catch (keyErr) {
      await client.from('test_series').delete().eq('id', insertedId!);
      throw keyErr;
    }

    return NextResponse.json({
      ok: true,
      id: insertedId,
      questionCount: storedQuestions.length,
      totalMarks: maxMarks,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to upload exam paper.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  if (!adminOk(req)) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    const title = String(body.title || '').trim();
    const category = String(body.category || 'Subject Wise').trim() || 'Subject Wise';
    const stream = String(body.stream || 'CS').trim().toUpperCase() || 'CS';
    const durationMinutes = Number(body.durationMinutes || 45);

    if (!id) {
      return NextResponse.json({ error: 'Exam paper ID is required.' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: 'Exam title is required.' }, { status: 400 });
    }

    const { storedQuestions, keyRows, calculatedMarks } = normalizePscQuestions(
      body.questions,
      category,
      stream
    );

    const maxMarks =
      calculatedMarks > 0
        ? calculatedMarks
        : Math.max(1, Number(body.totalMarks || storedQuestions.length));
    const examName = formatPscExamName(category, stream);

    const client = db();

    const richUpdate = await client
      .from('test_series')
      .update({
        title,
        exam_name: examName,
        duration_minutes: Math.round(durationMinutes),
        max_marks: maxMarks,
        question_count: storedQuestions.length,
        questions: storedQuestions,
        subject: category,
        stream,
      })
      .eq('id', id);

    if (richUpdate.error) {
      const baseUpdate = await client
        .from('test_series')
        .update({
          title,
          exam_name: examName,
          duration_minutes: Math.round(durationMinutes),
          max_marks: maxMarks,
          question_count: storedQuestions.length,
          questions: storedQuestions,
        })
        .eq('id', id);
      if (baseUpdate.error) {
        throw new Error(baseUpdate.error.message);
      }
    }

    await client.from('test_series_keys').delete().eq('test_series_id', id);
    await insertKeysResilient(client, id, keyRows);

    return NextResponse.json({
      ok: true,
      id,
      questionCount: storedQuestions.length,
      totalMarks: maxMarks,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update exam paper.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!adminOk(req)) {
    return NextResponse.json({ error: 'Admin authorization required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    const questionId = body.questionId ? String(body.questionId).trim() : '';

    if (!id) {
      return NextResponse.json({ error: 'Exam paper ID is required.' }, { status: 400 });
    }

    const client = db();

    // Delete a single question from a published exam paper
    if (questionId) {
      const { data: test, error: readErr } = await client
        .from('test_series')
        .select('id,questions,max_marks')
        .eq('id', id)
        .single();

      if (readErr || !test) {
        return NextResponse.json({ error: 'Exam paper not found.' }, { status: 404 });
      }

      const currentQuestions = Array.isArray(test.questions) ? test.questions : [];
      const remaining = currentQuestions
        .filter((q: any) => String(q.id) !== questionId)
        .map((q: any, idx: number) => ({ ...q, number: idx + 1 }));

      if (!remaining.length) {
        return NextResponse.json(
          {
            error:
              'Cannot delete the only remaining question. Use "Delete Full Paper" to delete the entire exam paper.',
          },
          { status: 400 }
        );
      }

      const newMaxMarks = Math.max(
        1,
        Number(remaining.reduce((sum: number, q: any) => sum + Number(q.marks || 0), 0).toFixed(2))
      );

      const { error: updateErr } = await client
        .from('test_series')
        .update({
          questions: remaining,
          question_count: remaining.length,
          max_marks: newMaxMarks,
        })
        .eq('id', id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 });
      }

      await client
        .from('test_series_keys')
        .delete()
        .eq('test_series_id', id)
        .eq('id_in_test', questionId);

      // Re-number remaining keys
      for (const q of remaining) {
        await client
          .from('test_series_keys')
          .update({ number: q.number })
          .eq('test_series_id', id)
          .eq('id_in_test', String(q.id));
      }

      return NextResponse.json({
        ok: true,
        questionCount: remaining.length,
        totalMarks: newMaxMarks,
      });
    }

    // Delete full question paper
    const { error } = await client.from('test_series').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to delete.' },
      { status: 500 }
    );
  }
}
