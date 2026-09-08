import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const same = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });

    const body = await req.json();
    const { testId, answers, timeSpentSeconds, questionTimeSeconds } = body;

    if (!testId) return NextResponse.json({ error: 'Test id is required.' }, { status: 400 });

    const db = adminDb();

    const { data: access } = await db
      .from('test_series_access_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (access?.status !== 'approved')
      return NextResponse.json({ error: 'Test-series access is not approved.' }, { status: 403 });

    const { data: test, error: te } = await db
      .from('test_series')
      .select('id,title,max_marks,question_count,is_published')
      .eq('id', testId)
      .eq('is_published', true)
      .single();

    if (te || !test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 });

    const { data: keys, error: ke } = await db
      .from('test_series_keys')
      .select('*')
      .eq('test_series_id', testId)
      .order('number');

    if (ke) return NextResponse.json({ error: ke.message }, { status: 500 });

    const defaultMarks = test.question_count
      ? Number(test.max_marks) / Number(test.question_count)
      : 0;

    let correct = 0;
    let incorrect = 0;
    let notAnswered = 0;
    let totalScore = 0;

    const review = (keys || []).map((k: any) => {
      const selected = Array.isArray(answers?.[k.id_in_test])
        ? answers[k.id_in_test].map(String)
        : [];

      const expected = Array.isArray(k.answer) ? k.answer.map(String) : [];
      const ok = selected.length > 0 && same(selected, expected);
      const type = String(k.question_type || k.type || 'MCQ').toUpperCase();

      const marks = k.marks !== null && k.marks !== undefined && Number(k.marks) > 0
        ? Number(k.marks)
        : defaultMarks;
      const negativeMarks =
        k.negative_marks !== null && k.negative_marks !== undefined
          ? Math.max(0, Number(k.negative_marks))
          : type === 'MCQ'
            ? Math.floor((marks / 3) * 100) / 100
            : 0;

      let questionMarks = 0;
      let result: 'correct' | 'incorrect' | 'not_answered' = 'not_answered';

      if (!selected.length) {
        notAnswered++;
      } else if (ok) {
        correct++;
        result = 'correct';
        questionMarks = marks;
        totalScore += marks;
      } else {
        incorrect++;
        result = 'incorrect';
        questionMarks = -negativeMarks;
        totalScore -= negativeMarks;
      }

      return {
        id: k.id_in_test,
        number: k.number,
        type,
        selected,
        answer: expected,
        correct: ok,
        result,
        marks: questionMarks,
        positiveMarks: marks,
        negativeMarks,
        solutionHtml: k.solution_html || '',
        videoUrl: k.video_url || null,
        timeSpentSeconds: Math.max(
          0,
          Math.floor(Number(questionTimeSeconds?.[k.id_in_test] || 0))
        ),
      };
    });

    const score = Number(totalScore.toFixed(2));

    const { data: attempt, error } = await db
      .from('test_series_attempts')
      .insert({
        user_id: user.id,
        test_series_id: testId,
        answers: answers || {},
        correct_count: correct,
        incorrect_count: incorrect,
        not_answered_count: notAnswered,
        score,
        time_spent_seconds: Math.max(0, Math.floor(Number(timeSpentSeconds || 0))),
        question_time_seconds: questionTimeSeconds || {},
      })
      .select('id,submitted_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      attemptId: attempt.id,
      submittedAt: attempt.submitted_at,
      correct,
      incorrect,
      notAnswered,
      score,
      maxMarks: test.max_marks,
      totalTimeSeconds: Math.max(0, Math.floor(Number(timeSpentSeconds || 0))),
      review,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Submission failed.' }, { status: 500 });
  }
}
