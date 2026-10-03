import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const clean = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '').replace(/javascript:/gi, '');

function adminOk(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL && req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizeQuestions(rows: any[]) {
  return rows.map((q: any) => ({
    id: String(q.id), number: Number(q.number), type: String(q.type).toUpperCase(),
    questionHtml: clean(String(q.questionHtml || '')),
    options: (q.options || []).map((o: any) => ({ key: String(o.key), html: clean(String(o.html || '')) })),
    marks: Number(q.marks), negativeMarks: Number(q.negativeMarks || 0),
  }));
}

function makeKeys(rows: any[], testId: string) {
  return rows.map((q: any) => ({
    test_series_id: testId, id_in_test: String(q.id), number: Number(q.number),
    answer: Array.isArray(q.answer) ? q.answer.map(String) : [],
    solution_html: clean(String(q.solutionHtml || '')),
    video_url: q.videoUrl ? String(q.videoUrl).trim() : null,
    question_type: String(q.type || 'MCQ').toUpperCase(), marks: Number(q.marks), negative_marks: Number(q.negativeMarks || 0),
  }));
}

function validateQuestions(rows: any[]) {
  if (!rows.length) throw new Error('No questions supplied.');
  const normalized = normalizeQuestions(rows);
  if (normalized.some(q => !Number.isFinite(q.marks) || q.marks <= 0)) throw new Error('Every question must have a valid positive mark value.');
  if (normalized.some(q => !Number.isFinite(q.negativeMarks) || q.negativeMarks < 0)) throw new Error('Every question must have a valid non-negative negative-mark value.');
  return normalized;
}

export async function POST(req: Request) {
  try {
    if (!adminOk(req)) return NextResponse.json({ error: 'Admin authorization required.' }, { status: 403 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' }, { status: 500 });

    const b = await req.json();
    const mode = String(b.mode || 'legacy');

    if (mode === 'start') {
      const provider = String(b.provider || 'prepfusion').toLowerCase() === 'madeeasy' ? 'madeeasy' : 'prepfusion';
      const allowed = new Set(['topicwise', 'subjectwise', 'full_syllabus', 'standard']);
      const testCategory = provider === 'madeeasy' && allowed.has(String(b.testCategory || '')) ? String(b.testCategory) : 'standard';
      const testNumber = b.testNumber == null || b.testNumber === '' ? null : Number(b.testNumber);
      const examYear = b.examYear == null || b.examYear === '' ? null : Number(b.examYear);
      const subject = String(b.subject || '').trim() || null;
      const topic = String(b.topic || '').trim() || null;
      const syllabus = String(b.syllabus || '').trim() || null;
      const stream = String(b.stream || '').trim().toUpperCase() || null;
      const title = String(b.title || '').trim() || (provider === 'madeeasy' ? subject : '');
      const examName = String(b.examName || '').trim() || (provider === 'madeeasy' ? 'MADE EASY' : '');
      if (!title || !examName || !b.durationMinutes || !b.maxMarks || !Number(b.questionCount)) return NextResponse.json({ error: 'All test details and question count are required.' }, { status: 400 });

      const { data, error } = await db().from('test_series').insert({
        title, exam_name: examName, duration_minutes: Number(b.durationMinutes), max_marks: Number(b.maxMarks),
        question_count: 0, questions: [], is_published: false, provider, test_category: testCategory,
        test_number: Number.isFinite(testNumber) ? testNumber : null, subject, topic, syllabus,
        exam_year: Number.isFinite(examYear) ? examYear : null, stream,
      }).select('id').single();
      if (error) throw error;
      return NextResponse.json({ id: data.id });
    }

    if (mode === 'batch') {
      const testId = String(b.testId || '');
      if (!testId) return NextResponse.json({ error: 'Missing test ID.' }, { status: 400 });
      const normalized = validateQuestions(Array.isArray(b.questions) ? b.questions : []);
      const keys = makeKeys(b.questions, testId);
      const { error: keyError } = await db().from('test_series_keys').insert(keys);
      if (keyError) throw new Error(`Answer-key save failed: ${keyError.message}`);

      const { data: current, error: readError } = await db().from('test_series').select('questions, question_count').eq('id', testId).single();
      if (readError) throw readError;
      const currentQuestions = Array.isArray(current?.questions) ? current.questions : [];
      const { error: updateError } = await db().from('test_series').update({ questions: [...currentQuestions, ...normalized], question_count: currentQuestions.length + normalized.length }).eq('id', testId);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true, count: normalized.length });
    }

    if (mode === 'complete') {
      const testId = String(b.testId || '');
      if (!testId) return NextResponse.json({ error: 'Missing test ID.' }, { status: 400 });
      const { data, error } = await db().from('test_series').select('question_count,questions').eq('id', testId).single();
      if (error) throw error;
      const count = Array.isArray(data?.questions) ? data.questions.length : Number(data?.question_count || 0);
      const { error: updateError } = await db().from('test_series').update({ question_count: count, is_published: true }).eq('id', testId);
      if (updateError) throw updateError;
      return NextResponse.json({ id: testId, questionCount: count });
    }

    if (mode === 'abort') {
      const testId = String(b.testId || '');
      if (testId) await db().from('test_series').delete().eq('id', testId);
      return NextResponse.json({ ok: true });
    }

    // Legacy fallback for small payloads / older clients.
    const provider = String(b.provider || 'prepfusion').toLowerCase() === 'madeeasy' ? 'madeeasy' : 'prepfusion';
    const allowed = new Set(['topicwise', 'subjectwise', 'full_syllabus', 'standard']);
    const testCategory = provider === 'madeeasy' && allowed.has(String(b.testCategory || '')) ? String(b.testCategory) : 'standard';
    const title = String(b.title || '').trim() || (provider === 'madeeasy' ? String(b.subject || '').trim() : '');
    const examName = String(b.examName || '').trim() || (provider === 'madeeasy' ? 'MADE EASY' : '');
    if (!title || !examName || !b.durationMinutes || !b.maxMarks || !Array.isArray(b.questions) || !b.questions.length) return NextResponse.json({ error: 'All fields and questions are required.' }, { status: 400 });
    const questions = validateQuestions(b.questions);
    const { data, error } = await db().from('test_series').insert({ title, exam_name: examName, duration_minutes: Number(b.durationMinutes), max_marks: Number(b.maxMarks), question_count: questions.length, questions, is_published: true, provider, test_category: testCategory }).select('id').single();
    if (error) throw error;
    const keys = makeKeys(b.questions, data.id);
    for (let i = 0; i < keys.length; i += 10) {
      const { error: keyError } = await db().from('test_series_keys').insert(keys.slice(i, i + 10));
      if (keyError) { await db().from('test_series').delete().eq('id', data.id); throw new Error(`Answer-key save failed at questions ${i + 1}-${Math.min(i + 10, keys.length)}: ${keyError.message}`); }
    }
    return NextResponse.json({ id: data.id, questionCount: questions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed.' }, { status: 500 });
  }
}
