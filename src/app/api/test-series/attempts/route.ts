import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () =>
  createClient(
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

    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    if (!testId) return NextResponse.json({ error: 'Test id is required.' }, { status: 400 });

    const database = db();

    const { data: access } = await database
      .from('test_series_access_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (access?.status !== 'approved')
      return NextResponse.json({ error: 'Test-series access is not approved.' }, { status: 403 });

    const { data: test, error: testError } = await database
      .from('test_series')
      .select('id,title,max_marks,question_count,questions')
      .eq('id', testId)
      .eq('is_published', true)
      .single();

    if (testError || !test)
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 });

    const { data: attempts, error } = await database
      .from('test_series_attempts')
      .select('id,answers,correct_count,incorrect_count,not_answered_count,score,time_spent_seconds,question_time_seconds,submitted_at')
      .eq('user_id', user.id)
      .eq('test_series_id', testId)
      .order('submitted_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: keys, error: keyError } = await database
      .from('test_series_keys')
      .select('*')
      .eq('test_series_id', testId)
      .order('number');

    if (keyError) return NextResponse.json({ error: keyError.message }, { status: 500 });

    const defaultMarks = test.question_count ? Number(test.max_marks) / Number(test.question_count) : 0;

    const hydrated = (attempts || []).map((a: any, index: number) => {
      let total = 0;
      const review = (keys || []).map((k: any) => {
        const selected = Array.isArray(a.answers?.[k.id_in_test]) ? a.answers[k.id_in_test].map(String) : [];
        const expected = Array.isArray(k.answer) ? k.answer.map(String) : [];
        const ok = selected.length > 0 && selected.length === expected.length &&
          [...selected].sort().join(',') === [...expected].sort().join(',');
        const type = String(k.question_type || k.type || 'MCQ').toUpperCase();
        const positive = Number(k.marks ?? defaultMarks);
        const negative = k.negative_marks != null ? Number(k.negative_marks) : type === 'MCQ' ? positive / 3 : 0;
        const marks = !selected.length ? 0 : ok ? positive : -negative;
        total += marks;
        return {
          id: k.id_in_test, number: k.number, type, selected, answer: expected,
          correct: ok, result: !selected.length ? 'not_answered' : ok ? 'correct' : 'incorrect',
          marks, positiveMarks: positive, negativeMarks: negative,
          solutionHtml: k.solution_html || '', videoUrl: k.video_url || null,
          timeSpentSeconds: Math.max(0, Math.floor(Number(a.question_time_seconds?.[k.id_in_test] || 0))),
        };
      });
      return {
        attemptId: a.id,
        attemptNumber: (attempts?.length || 0) - index,
        submittedAt: a.submitted_at,
        score: Number(Number(a.score ?? total).toFixed(2)),
        maxMarks: test.max_marks,
        correct: a.correct_count,
        incorrect: a.incorrect_count,
        notAnswered: a.not_answered_count,
        totalTimeSeconds: a.time_spent_seconds,
        review,
      };
    });

    return NextResponse.json({
      test: { id: test.id, title: test.title, maxMarks: test.max_marks, questionCount: test.question_count, questions: test.questions },
      attempts: hydrated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to load attempts.' }, { status: 500 });
  }
}
