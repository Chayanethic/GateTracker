import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });

    const admin = db();
    const { data: access } = await admin.from('test_series_access_requests')
      .select('status').eq('user_id', user.id).maybeSingle();
    if (access?.status !== 'approved') return NextResponse.json({ error: 'Test-series access is not approved.' }, { status: 403 });

    const { data: tests, error: testsError } = await admin
      .from('test_series')
      .select('id,title,exam_name,questions,is_published')
      .eq('is_published', true);
    if (testsError) return NextResponse.json({ error: testsError.message }, { status: 500 });

    const testIds = (tests || []).map((t: any) => t.id);
    if (!testIds.length) return NextResponse.json({ markedQuestions: [] }, { headers: { 'Cache-Control': 'no-store' } });

    const { data: attempts, error: attemptsError } = await admin
      .from('test_series_attempts')
      .select('id,test_series_id,answers,submitted_at')
      .eq('user_id', user.id)
      .in('test_series_id', testIds)
      .order('submitted_at', { ascending: false });
    if (attemptsError) return NextResponse.json({ error: attemptsError.message }, { status: 500 });

    const testMap = new Map<string, any>((tests || []).map((t: any) => [String(t.id), t]));
    const attemptNumberMap = new Map<string, number>();
    const perTestCounts: Record<string, number> = {};
    // Attempts are newest first. Number them from oldest to newest to match Analysis.
    const grouped: Record<string, any[]> = {};
    for (const a of attempts || []) {
      const key = String(a.test_series_id);
      (grouped[key] ||= []).push(a);
    }
    for (const [testId, list] of Object.entries(grouped)) {
      const chronological = [...list].sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
      chronological.forEach((a: any, i: number) => attemptNumberMap.set(String(a.id), i + 1));
      perTestCounts[testId] = list.length;
    }

    // Keep one card per test/question, using the most recent attempt that marked it.
    const seen = new Set<string>();
    const markedQuestions: any[] = [];
    for (const a of attempts || []) {
      const marked = a.answers?.__markedForReview;
      if (!marked || typeof marked !== 'object') continue;
      const test = testMap.get(String(a.test_series_id));
      if (!test) continue;
      const questions = Array.isArray(test.questions) ? test.questions : [];
      for (const [qid, value] of Object.entries(marked)) {
        if (!value) continue;
        const unique = `${test.id}:${qid}`;
        if (seen.has(unique)) continue;
        const q = questions.find((item: any) => String(item.id) === String(qid));
        if (!q) continue;
        seen.add(unique);
        markedQuestions.push({
          key: unique,
          testId: test.id,
          testTitle: test.title,
          examName: test.exam_name,
          attemptId: a.id,
          attemptNumber: attemptNumberMap.get(String(a.id)) || 1,
          totalAttempts: perTestCounts[String(test.id)] || 1,
          number: q.number,
          type: String(q.type || 'MCQ').toUpperCase(),
          questionHtml: q.questionHtml || '',
          options: Array.isArray(q.options) ? q.options : [],
          markedAt: a.submitted_at,
        });
      }
    }

    return NextResponse.json({ markedQuestions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to load marked questions.' }, { status: 500 });
  }
}
