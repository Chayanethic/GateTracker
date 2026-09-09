import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gunzipSync } from 'node:zlib';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const clean = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/javascript:/gi, '');

function adminOk(req: Request) {
  return (
    req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') ===
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD
  );
}

async function readJsonBody(req: Request) {
  const bytes = new Uint8Array(await req.arrayBuffer());
  const encoding = String(req.headers.get('content-encoding') || '').toLowerCase();
  if (encoding.includes('gzip')) {
    const inflated = gunzipSync(bytes);
    return JSON.parse(new TextDecoder().decode(inflated));
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    if (!adminOk(req))
      return NextResponse.json(
        { error: 'Admin authorization required.' },
        { status: 403 }
      );

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 500 }
      );

    const b = await readJsonBody(req);
    const provider = String(b.provider || 'prepfusion').toLowerCase() === 'madeeasy' ? 'madeeasy' : 'prepfusion';
    const allowedCategories = new Set(['topicwise', 'subjectwise', 'full_syllabus', 'standard']);
    const testCategory = provider === 'madeeasy' && allowedCategories.has(String(b.testCategory || '')) ? String(b.testCategory) : 'standard';
    const testNumber = b.testNumber == null || b.testNumber === '' ? null : Number(b.testNumber);
    const subject = String(b.subject || '').trim() || null;
    const topic = String(b.topic || '').trim() || null;
    const syllabus = String(b.syllabus || '').trim() || null;
    const examYear = b.examYear == null || b.examYear === '' ? null : Number(b.examYear);
    const stream = String(b.stream || '').trim().toUpperCase() || null;

    const rawTitle = String(b.title || '').trim();
    const rawExamName = String(b.examName || '').trim();
    const effectiveTitle = rawTitle || (provider === 'madeeasy' ? subject : '');
    const effectiveExamName = rawExamName || (provider === 'madeeasy' ? 'MADE EASY' : '');

    if (
      !effectiveTitle ||
      !effectiveExamName ||
      !b.durationMinutes ||
      !b.maxMarks ||
      !Array.isArray(b.questions) ||
      !b.questions.length
    ) {
      return NextResponse.json(
        { error: provider === 'madeeasy' ? 'MADE EASY test title could not be determined from the HTML. Please provide a subject.' : 'All fields and questions are required.' },
        { status: 400 }
      );
    }

    // Keep the candidate-facing question JSON compact. Answers, written/image
    // solutions and video URLs are stored once in test_series_keys and fetched
    // server-side when needed. This is important for large exported HTML files.
    const questions = b.questions.map((q: any) => ({
      id: String(q.id),
      number: Number(q.number),
      type: String(q.type).toUpperCase(),
      questionHtml: clean(String(q.questionHtml || '')),
      options: (q.options || []).map((o: any) => ({
        key: String(o.key),
        html: clean(String(o.html || '')),
      })),
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks || 0),
    }));

    if (questions.some((q: any) => !Number.isFinite(q.marks) || q.marks <= 0)) {
      return NextResponse.json(
        { error: 'Every question must have a valid positive mark value.' },
        { status: 400 }
      );
    }
    if (questions.some((q: any) => !Number.isFinite(q.negativeMarks) || q.negativeMarks < 0)) {
      return NextResponse.json(
        { error: 'Every question must have a valid non-negative negative-mark value.' },
        { status: 400 }
      );
    }

    const keys = b.questions.map((q: any) => ({
      test_series_id: 'TEMP',
      id_in_test: String(q.id),
      number: Number(q.number),
      answer: (q.answer || []).map(String),
      solution_html: clean(String(q.solutionHtml || '')),
      video_url: q.videoUrl ? String(q.videoUrl).trim() : null,
      question_type: String(q.type || 'MCQ').toUpperCase(),
      marks: Number(q.marks),
      negative_marks: Number(q.negativeMarks || 0),
    }));

    const { data, error } = await db()
      .from('test_series')
      .insert({
        title: effectiveTitle,
        exam_name: effectiveExamName,
        duration_minutes: Number(b.durationMinutes),
        max_marks: Number(b.maxMarks),
        question_count: questions.length,
        questions,
        is_published: true,
        provider,
        test_category: testCategory,
        test_number: Number.isFinite(testNumber) ? testNumber : null,
        subject,
        topic,
        syllabus,
        exam_year: Number.isFinite(examYear) ? examYear : null,
        stream,
      })
      .select('id')
      .single();

    if (error) throw error;

    const keyRows = keys.map(
      (
        k: {
          test_series_id: string;
          id_in_test: string;
          number: number;
          answer: string[];
          solution_html: string;
          video_url: string | null;
          question_type: string;
          marks: number;
          negative_marks: number;
        }
      ) => ({ ...k, test_series_id: data.id })
    );

    // Insert in small batches so large 65-question exports (especially ones
    // containing embedded solution images) do not hit a single huge request.
    for (let i = 0; i < keyRows.length; i += 10) {
      const { error: keyError } = await db()
        .from('test_series_keys')
        .insert(keyRows.slice(i, i + 10));
      if (keyError) {
        await db().from('test_series').delete().eq('id', data.id);
        throw keyError;
      }
    }

    return NextResponse.json({
      id: data.id,
      questionCount: questions.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Upload failed.' },
      { status: 500 }
    );
  }
}
