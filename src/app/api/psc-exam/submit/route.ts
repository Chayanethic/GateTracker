import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractRawSolutionFields } from '@/lib/pscExam';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function checkAnswerMatch(type: string, selected: string[], expected: string[]): boolean {
  if (!selected.length || !expected.length) return false;

  if (type === 'NAT') {
    const userVal = String(selected[0] || '').trim();
    const expVal = String(expected[0] || '').trim();
    if (!userVal || !expVal) return false;
    if (userVal.toLowerCase() === expVal.toLowerCase()) return true;

    // Range support e.g. "1.95:2.05" or "1.95 to 2.05"
    const rangeMatch = expVal.match(/^(-?\d+(?:\.\d+)?)\s*(?::|to)\s*(-?\d+(?:\.\d+)?)$/i);
    const numUser = Number(userVal);
    if (rangeMatch && Number.isFinite(numUser)) {
      const low = Number(rangeMatch[1]);
      const high = Number(rangeMatch[2]);
      return numUser >= Math.min(low, high) && numUser <= Math.max(low, high);
    }

    const numExp = Number(expVal);
    if (Number.isFinite(numUser) && Number.isFinite(numExp)) {
      return Math.abs(numUser - numExp) <= 1e-6;
    }
    return false;
  }

  const normSel = [...selected].map((s) => String(s).trim().toUpperCase()).sort();
  const normExp = [...expected].map((s) => String(s).trim().toUpperCase()).sort();
  return normSel.length === normExp.length && normSel.join(',') === normExp.join(',');
}

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
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      testId,
      answers,
      timeSpentSeconds,
      questionTimeSeconds,
      markedForReview,
      bookmarked,
    } = body;

    if (!testId) {
      return NextResponse.json({ error: 'Exam id is required.' }, { status: 400 });
    }

    const db = adminDb();

    const { data: test, error: te } = await db
      .from('test_series')
      .select('id,title,max_marks,question_count,questions,is_published')
      .eq('id', testId)
      .eq('is_published', true)
      .single();

    if (te || !test) {
      return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
    }

    const { data: keys, error: ke } = await db
      .from('test_series_keys')
      .select('*')
      .eq('test_series_id', testId)
      .order('number');

    if (ke) return NextResponse.json({ error: ke.message }, { status: 500 });

    const testQuestions = Array.isArray(test.questions) ? test.questions : [];
    const qMap = new Map<string, any>(
      testQuestions.map((q: any) => [String(q.id), q])
    );

    const defaultMarks = test.question_count
      ? Number(test.max_marks) / Number(test.question_count)
      : 1;

    let correct = 0;
    let incorrect = 0;
    let notAnswered = 0;
    let totalScore = 0;

    const review = (keys || []).map((k: any) => {
      const qObj = qMap.get(String(k.id_in_test)) || {};
      const selected = Array.isArray(answers?.[k.id_in_test])
        ? answers[k.id_in_test].map(String).filter((s: string) => s.trim() !== '')
        : [];

      const expected = Array.isArray(k.answer) ? k.answer.map(String) : [];
      const type = String(k.question_type || qObj.type || 'MCQ').toUpperCase();
      const ok = selected.length > 0 && checkAnswerMatch(type, selected, expected);

      const marks =
        k.marks != null && Number(k.marks) > 0
          ? Number(k.marks)
          : qObj.marks != null && Number(qObj.marks) > 0
            ? Number(qObj.marks)
            : defaultMarks;

      const negativeMarks =
        k.negative_marks != null
          ? Math.max(0, Number(k.negative_marks))
          : qObj.negativeMarks != null
            ? Math.max(0, Number(qObj.negativeMarks))
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

      const rawSol = extractRawSolutionFields(k.solution_html || '');

      return {
        id: k.id_in_test,
        number: k.number,
        type,
        topic: qObj.topic || '',
        selected,
        answer: expected,
        correct: ok,
        result,
        marks: questionMarks,
        positiveMarks: marks,
        negativeMarks,
        solutionHtml: k.solution_html || '',
        explanation: rawSol.explanation,
        solutionImageUrl: rawSol.solutionImageUrl,
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
        answers: {
          ...(answers || {}),
          __markedForReview: markedForReview || {},
          __bookmarked: bookmarked || {},
        },
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
    return NextResponse.json(
      { error: e?.message || 'Submission failed.' },
      { status: 500 }
    );
  }
}
