import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractRawSolutionFields, parsePscExamMeta } from '@/lib/pscExam';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

function checkAnswerMatch(type: string, selected: string[], expected: string[]): boolean {
  if (!selected.length || !expected.length) return false;
  if (type === 'NAT') {
    const userVal = String(selected[0] || '').trim();
    const expVal = String(expected[0] || '').trim();
    if (!userVal || !expVal) return false;
    if (userVal.toLowerCase() === expVal.toLowerCase()) return true;
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
  const normSel = [...selected].map((s: string) => String(s).trim().toUpperCase()).sort();
  const normExp = [...expected].map((s: string) => String(s).trim().toUpperCase()).sort();
  return normSel.length === normExp.length && normSel.join(',') === normExp.join(',');
}

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    if (!testId) {
      return NextResponse.json({ error: 'Exam id is required.' }, { status: 400 });
    }

    const database = db();

    // Run test lookup, user attempts lookup, keys lookup, and score pool lookup in parallel to minimize latency & server wall-clock time
    const [testRes, attemptsRes, allScoresRes, keysRes] = await Promise.all([
      database
        .from('test_series')
        .select('id,title,exam_name,max_marks,question_count,questions')
        .eq('id', testId)
        .eq('is_published', true)
        .single(),
      database
        .from('test_series_attempts')
        .select(
          'id,answers,correct_count,incorrect_count,not_answered_count,score,time_spent_seconds,question_time_seconds,submitted_at'
        )
        .eq('user_id', user.id)
        .eq('test_series_id', testId)
        .order('submitted_at', { ascending: false })
        .limit(20),
      database
        .from('test_series_attempts')
        .select('score')
        .eq('test_series_id', testId)
        .limit(500),
      database
        .from('test_series_keys')
        .select('*')
        .eq('test_series_id', testId)
        .order('number'),
    ]);

    if (testRes.error || !testRes.data) {
      return NextResponse.json({ error: 'Exam not found.' }, { status: 404 });
    }
    if (attemptsRes.error) {
      return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
    }
    if (keysRes.error) {
      return NextResponse.json({ error: keysRes.error.message }, { status: 500 });
    }

    const test = testRes.data;
    const attempts = attemptsRes.data || [];
    const keys = keysRes.data || [];
    const meta = parsePscExamMeta(test);

    const scorePool = (allScoresRes.data || [])
      .map((a: any) => Number(a.score || 0))
      .filter((n: number) => Number.isFinite(n));
    const ranked = (score: number) => {
      const better = scorePool.filter((s: number) => s > score).length;
      return { rank: better + 1, total: scorePool.length };
    };

    const defaultMarks = test.question_count
      ? Number(test.max_marks) / Number(test.question_count)
      : 1;

    const testQuestions = Array.isArray(test.questions) ? test.questions : [];
    const qMap = new Map<string, any>(
      testQuestions.map((q: any) => [String(q.id), q])
    );

    const hydrated = attempts.map((a: any, index: number) => {
      let total = 0;
      let positiveGained = 0;
      let negativeLost = 0;
      const markedMap =
        a.answers?.__markedForReview && typeof a.answers.__markedForReview === 'object'
          ? a.answers.__markedForReview
          : {};
      const bookmarkedMap =
        a.answers?.__bookmarked && typeof a.answers.__bookmarked === 'object'
          ? a.answers.__bookmarked
          : {};

      const review = keys.map((k: any) => {
        const question = qMap.get(String(k.id_in_test)) || {};
        const selected = Array.isArray(a.answers?.[k.id_in_test])
          ? a.answers[k.id_in_test].map(String).filter((s: string) => s.trim() !== '')
          : [];
        const expected = Array.isArray(k.answer) ? k.answer.map(String) : [];
        const type = String(k.question_type || question?.type || 'MCQ').toUpperCase();
        const ok = selected.length > 0 && checkAnswerMatch(type, selected, expected);

        const positive =
          k.marks != null && Number(k.marks) > 0
            ? Number(k.marks)
            : question?.marks != null && Number(question.marks) > 0
              ? Number(question.marks)
              : defaultMarks;

        const negative =
          k.negative_marks != null
            ? Math.max(0, Number(k.negative_marks))
            : question?.negativeMarks != null
              ? Math.max(0, Number(question.negativeMarks))
              : type === 'MCQ'
                ? Math.floor((positive / 3) * 100) / 100
                : 0;

        const marks = !selected.length ? 0 : ok ? positive : -negative;
        total += marks;
        if (ok) positiveGained += positive;
        if (selected.length && !ok) negativeLost += negative;

        const rawSol = extractRawSolutionFields(k.solution_html || '');

        return {
          id: k.id_in_test,
          number: k.number,
          type,
          topic: String(question?.topic || 'General').trim() || 'General',
          selected,
          answer: expected,
          correct: ok,
          result: !selected.length ? 'not_answered' : ok ? 'correct' : 'incorrect',
          marks,
          positiveMarks: positive,
          negativeMarks: negative,
          questionText: question?.questionText || '',
          questionImageUrl: question?.questionImageUrl || '',
          questionHtml: question?.questionHtml || '',
          options: Array.isArray(question?.options) ? question.options : [],
          solutionHtml: k.solution_html || '',
          explanation: rawSol.explanation,
          solutionImageUrl: rawSol.solutionImageUrl,
          hasExplanation: Boolean(rawSol.explanation || rawSol.solutionImageUrl || k.solution_html),
          markedForReview: Boolean(markedMap?.[k.id_in_test]),
          bookmarked: Boolean(bookmarkedMap?.[k.id_in_test]),
          timeSpentSeconds: Math.max(
            0,
            Math.floor(Number(a.question_time_seconds?.[k.id_in_test] || 0))
          ),
        };
      });

      const score = Number(Number(a.score ?? total).toFixed(2));
      const rankInfo = ranked(score);
      const attemptedCount = Number(a.correct_count || 0) + Number(a.incorrect_count || 0);
      const accuracy =
        attemptedCount > 0 ? (Number(a.correct_count || 0) / attemptedCount) * 100 : 0;
      const percentile =
        rankInfo.total > 0 ? ((rankInfo.total - rankInfo.rank) / rankInfo.total) * 100 : 0;

      return {
        attemptId: a.id,
        attemptNumber: attempts.length - index,
        submittedAt: a.submitted_at,
        score,
        maxMarks: test.max_marks,
        correct: Number(a.correct_count || 0),
        incorrect: Number(a.incorrect_count || 0),
        notAnswered: Number(a.not_answered_count || 0),
        totalTimeSeconds: Number(a.time_spent_seconds || 0),
        rank: rankInfo.rank,
        totalRanked: rankInfo.total,
        percentile: Math.max(0, percentile),
        accuracy,
        positiveGained: Number(positiveGained.toFixed(2)),
        negativeLost: Number(negativeLost.toFixed(2)),
        markedCount: review.filter((r: any) => r.markedForReview).length,
        review,
      };
    });

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        category: meta.category,
        stream: meta.stream,
        maxMarks: test.max_marks,
        questionCount: test.question_count,
      },
      attempts: hydrated,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load attempts.' },
      { status: 500 }
    );
  }
}
