import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chapterId = searchParams.get('chapterId');
  const difficulty = searchParams.get('difficulty');
  const topic = searchParams.get('topic');
  if (!chapterId) return NextResponse.json({ error: 'chapterId is required.' }, { status: 400 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let query = db.from('qb_questions')
    .select('id,external_id,question_number,question_type,question_html,options,explanation_html,difficulty,topic,tags,marks,negative_marks,source,exam_year,image_urls,option_image_urls,raw_data,source_question_type:raw_data->>questionType')
    .eq('chapter_id', chapterId).eq('is_published', true).order('question_number');
  if (difficulty && ['easy','medium','hard'].includes(difficulty)) query = query.eq('difficulty', difficulty);
  if (topic) query = query.ilike('topic', `%${topic}%`);

  const { data: questions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (questions || []).map(q => q.id);
  let progress: any[] = [];
  if (ids.length) {
    const { data } = await db.from('qb_question_progress').select('question_id,attempted_count,correct_count,incorrect_count,last_result,bookmarked,marked_for_review').eq('user_id', user.id).in('question_id', ids);
    progress = data || [];
  }
  const progressMap = new Map(progress.map(p => [p.question_id, p]));
  const orderedQuestions = [...(questions || [])].sort((a:any,b:any) => {
    const ao=Number(a?.raw_data?.order), bo=Number(b?.raw_data?.order);
    const an=Number(a?.question_number), bn=Number(b?.question_number);
    const av=Number.isFinite(ao)?ao:(Number.isFinite(an)?an:Number.MAX_SAFE_INTEGER);
    const bv=Number.isFinite(bo)?bo:(Number.isFinite(bn)?bn:Number.MAX_SAFE_INTEGER);
    if(av!==bv)return av-bv;
    return String(a?.external_id||a?.id||'').localeCompare(String(b?.external_id||b?.id||''));
  });
  const safeQuestions = orderedQuestions.map((q:any, displayIndex:number) => {
    const sourceType = String((q as any).source_question_type || '').trim().toUpperCase();
    const normalizedType = ['NAT','INTEGER','NUMERIC'].includes(sourceType) || q.question_type === 'NAT' ? 'NAT'
      : ['MSQ','MULTI','MULTIPLE','MULTIPLE_CHOICE','MULTI_SELECT','MULTISELECT'].includes(sourceType) || q.question_type === 'MSQ' ? 'MSQ'
      : ['MCQ','SINGLE','SINGLE_CHOICE'].includes(sourceType) || q.question_type === 'MCQ' ? 'MCQ'
      : q.question_type;
    const { source_question_type: _sourceType, raw_data: _rawData, ...publicQuestion } = q as any;
    return {
    ...publicQuestion,
    question_number: displayIndex + 1,
    question_type: normalizedType,
    progress: progressMap.get(q.id) || { attempted_count: 0, correct_count: 0, incorrect_count: 0, last_result: null, bookmarked: false, marked_for_review: false },
  }});

  return NextResponse.json({
    chapter: chapterId,
    questions: safeQuestions,
    totals: {
      count: safeQuestions.length,
      attempted: safeQuestions.filter(q => (q.progress?.attempted_count || 0) > 0).length,
      bookmarked: safeQuestions.filter(q => q.progress?.bookmarked).length,
    }
  });
}
