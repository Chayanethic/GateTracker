import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeType(q: any) {
  const raw = String(q?.raw_data?.questionType || q?.raw_data?.type || '').trim().toUpperCase();
  if (['NAT', 'INTEGER', 'NUMERIC'].includes(raw) || String(q.question_type).toUpperCase() === 'NAT') return 'NAT';
  if (['MSQ', 'MULTI', 'MULTIPLE', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'MULTISELECT'].includes(raw) || String(q.question_type).toUpperCase() === 'MSQ') return 'MSQ';
  if (['MCQ', 'SINGLE', 'SINGLE_CHOICE'].includes(raw) || String(q.question_type).toUpperCase() === 'MCQ') return 'MCQ';
  return q.question_type;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await req.json();
    const chapterIds = Array.isArray(body.chapterIds) ? [...new Set(body.chapterIds.map(String).filter(Boolean))] : [];
    const requestedCount = Math.max(1, Math.min(200, Number(body.count) || 20));
    if (!chapterIds.length) return NextResponse.json({ error: 'Select at least one chapter.' }, { status: 400 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Keep random sets inside the same Question Bank stream as the logged-in user.
    // The service-role client is used below for efficient reads, so validate the
    // selected chapter IDs explicitly before loading questions.
    const { data: profile } = await db.from('user_profiles').select('branch').eq('user_id', user.id).maybeSingle();
    const stream = String(profile?.branch || 'ece').trim().toLowerCase();
    const { data: subjects, error: subjectError } = await db.from('qb_subjects')
      .select('id').eq('stream', stream).eq('is_published', true);
    if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 500 });
    const allowedSubjectIds = (subjects || []).map((s: any) => s.id);
    if (!allowedSubjectIds.length) return NextResponse.json({ error: 'No Question Bank subjects are available for your stream.' }, { status: 404 });
    const { data: allowedChapters, error: chapterError } = await db.from('qb_chapters')
      .select('id').in('id', chapterIds).in('subject_id', allowedSubjectIds).eq('is_published', true);
    if (chapterError) return NextResponse.json({ error: chapterError.message }, { status: 500 });
    const validChapterIds = (allowedChapters || []).map((c: any) => c.id);
    if (!validChapterIds.length) return NextResponse.json({ error: 'The selected chapters are not available in your current stream.' }, { status: 403 });

    const questions: any[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('qb_questions')
        .select('id,chapter_id,external_id,question_number,question_type,question_html,options,explanation_html,difficulty,topic,tags,marks,negative_marks,image_urls,option_image_urls,raw_data')
        .in('chapter_id', validChapterIds)
        .eq('is_published', true)
        .range(from, from + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      questions.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    if (!questions.length) return NextResponse.json({ error: 'No published questions are available in the selected chapters.' }, { status: 404 });

    const selected = shuffle(questions).slice(0, Math.min(requestedCount, questions.length));
    const ids = selected.map(q => q.id);
    const progress: any[] = [];
    for (let from = 0; from < ids.length; from += 500) {
      const batch = ids.slice(from, from + 500);
      const { data, error } = await db.from('qb_question_progress')
        .select('question_id,attempted_count,correct_count,incorrect_count,last_result,bookmarked,marked_for_review')
        .eq('user_id', user.id).in('question_id', batch);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      progress.push(...(data || []));
    }
    const progressMap = new Map(progress.map(p => [p.question_id, p]));

    const safeQuestions = selected.map((q, i) => {
      const { raw_data: _raw, ...publicQuestion } = q;
      return {
        ...publicQuestion,
        question_number: i + 1,
        question_type: normalizeType(q),
        progress: progressMap.get(q.id) || { attempted_count: 0, correct_count: 0, incorrect_count: 0, last_result: null, bookmarked: false, marked_for_review: false },
      };
    });

    return NextResponse.json({ questions: safeQuestions, available: questions.length, count: safeQuestions.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to create random question set.' }, { status: 500 });
  }
}
