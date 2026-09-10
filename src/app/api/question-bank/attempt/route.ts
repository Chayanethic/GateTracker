import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

function equalAnswers(a: any[], b: any[]) {
  const aa = a.map(String).sort();
  const bb = b.map(String).sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function toNumber(value: any) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  try {
    const body = await req.json();
    const questionId = String(body.questionId || '');
    const action = String(body.action || 'answer');
    if (!questionId) return NextResponse.json({ error: 'questionId is required.' }, { status: 400 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: q, error: qError } = await db.from('qb_questions')
      .select('id,chapter_id,correct_answer,options,question_type,marks,negative_marks,metadata,raw_data')
      .eq('id', questionId).single();
    if (qError || !q) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    if (action === 'bookmark' || action === 'review') {
      const field = action === 'bookmark' ? 'bookmarked' : 'marked_for_review';
      const value = Boolean(body.value);
      const { error } = await db.from('qb_question_progress').upsert({
        user_id: user.id, question_id: questionId, [field]: value
      }, { onConflict: 'user_id,question_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, [field]: value });
    }

    const answer = Array.isArray(body.answer) ? body.answer.map(String) : body.answer == null ? [] : [String(body.answer)];
    const rawQuestionType = q.raw_data && typeof q.raw_data === 'object' ? String((q.raw_data as any).questionType || (q.raw_data as any).type || '').trim().toUpperCase() : '';
    const normalizedType = ['MSQ','MULTI','MULTIPLE','MULTIPLE_CHOICE','MULTI_SELECT','MULTISELECT'].includes(rawQuestionType) ? 'MSQ' : (q.question_type as string);
    const isNat = String(q.question_type).toUpperCase() === 'NAT' || rawQuestionType === 'INTEGER' || rawQuestionType === 'NUMERIC' || rawQuestionType === 'NAT';
    let expected: string[] = [];
    let correct = false;

    if (isNat) {
      const source = (q.metadata && typeof q.metadata === 'object' ? q.metadata : {}) as any;
      const raw = (q.raw_data && typeof q.raw_data === 'object' ? q.raw_data : {}) as any;
      const min = toNumber(source.answerMin ?? raw.correctAnswerMin);
      const max = toNumber(source.answerMax ?? raw.correctAnswerMax);
      const value = toNumber(answer[0]);
      if (min != null || max != null) {
        const lo = min != null && max != null ? Math.min(min, max) : (min ?? max!);
        const hi = min != null && max != null ? Math.max(min, max) : (max ?? min!);
        correct = value != null && value >= lo && value <= hi;
        expected = min != null && max != null ? [String(min), String(max)] : [String(lo)];
      } else {
        const expectedNumber = toNumber(Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer);
        correct = value != null && expectedNumber != null && value === expectedNumber;
        expected = expectedNumber != null ? [String(expectedNumber)] : [];
      }
    } else {
      const rawExpected = Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : [];
      const optionList = Array.isArray(q.options) ? q.options : [];
      expected = rawExpected.map((value) => {
        if (/^\d+$/.test(value)) {
          const idx = Number(value);
          const option = optionList[idx];
          if (option?.key != null) return String(option.key);
        }
        return value;
      });
      correct = answer.length > 0 && equalAnswers(answer, expected);
    }

    const result = answer.length ? (correct ? 'correct' : 'incorrect') : 'not_answered';
    const positive = q.marks != null ? Number(q.marks) : 1;
    const negative = q.negative_marks != null ? Number(q.negative_marks) : (q.question_type === 'MCQ' ? Math.floor((positive / 3) * 100) / 100 : 0);
    const score = !answer.length ? 0 : correct ? positive : -negative;

    const { data: previous } = await db.from('qb_question_progress').select('attempted_count,correct_count,incorrect_count,bookmarked,marked_for_review').eq('user_id', user.id).eq('question_id', questionId).maybeSingle();
    const { error } = await db.from('qb_question_progress').upsert({
      user_id: user.id, question_id: questionId,
      attempted_count: Number(previous?.attempted_count || 0) + (answer.length ? 1 : 0),
      correct_count: Number(previous?.correct_count || 0) + (correct ? 1 : 0),
      incorrect_count: Number(previous?.incorrect_count || 0) + (answer.length && !correct ? 1 : 0),
      last_answer: answer,
      last_result: result,
      last_attempted_at: new Date().toISOString(),
      bookmarked: Boolean(previous?.bookmarked),
      marked_for_review: Boolean(previous?.marked_for_review),
    }, { onConflict: 'user_id,question_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true, correct, result, score,
      correctAnswer: expected,
      marks: positive, negativeMarks: negative,
      natRange: isNat ? expected : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to record attempt.' }, { status: 500 });
  }
}
