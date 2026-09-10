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
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { searchParams } = new URL(req.url);
  const type = String(searchParams.get('type') || '').toUpperCase();
  const attempted = searchParams.get('attempted');

  const { data: progress, error: pError } = await db.from('qb_question_progress')
    .select('question_id,attempted_count,correct_count,incorrect_count,last_answer,last_result,bookmarked,marked_for_review,last_attempted_at')
    .eq('user_id', user.id).eq('bookmarked', true);
  if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });
  const pids = (progress || []).map((p:any)=>p.question_id);
  if (!pids.length) return NextResponse.json({ questions: [], totals: { saved:0, attempted:0, unattempted:0, mcq:0, msq:0, nat:0 } });

  const { data: qs, error: qError } = await db.from('qb_questions')
    .select('id,external_id,question_number,question_type,question_html,options,correct_answer,explanation_html,difficulty,topic,tags,marks,negative_marks,source,exam_year,image_urls,option_image_urls,chapter:qb_chapters(id,name,subject:qb_subjects(id,name))')
    .in('id', pids).eq('is_published', true);
  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  const pm = new Map((progress||[]).map((p:any)=>[p.question_id,p]));
  let rows = (qs||[]).map((q:any)=>({...q, progress:pm.get(q.id)||null}));
  if (['MCQ','MSQ','NAT'].includes(type)) rows = rows.filter((q:any)=>String(q.question_type).toUpperCase()===type);
  if (attempted === 'yes') rows = rows.filter((q:any)=>Number(q.progress?.attempted_count||0)>0);
  if (attempted === 'no') rows = rows.filter((q:any)=>Number(q.progress?.attempted_count||0)===0);
  rows.sort((a:any,b:any)=>String(a.chapter?.subject?.name||'').localeCompare(String(b.chapter?.subject?.name||'')) || String(a.chapter?.name||'').localeCompare(String(b.chapter?.name||'')) || Number(a.question_number||0)-Number(b.question_number||0));

  const all = qs || [];
  return NextResponse.json({
    questions: rows,
    totals: {
      saved: all.length,
      attempted: all.filter((q:any)=>Number(pm.get(q.id)?.attempted_count||0)>0).length,
      unattempted: all.filter((q:any)=>Number(pm.get(q.id)?.attempted_count||0)===0).length,
      mcq: all.filter((q:any)=>String(q.question_type).toUpperCase()==='MCQ').length,
      msq: all.filter((q:any)=>String(q.question_type).toUpperCase()==='MSQ').length,
      nat: all.filter((q:any)=>String(q.question_type).toUpperCase()==='NAT').length,
    }
  });
}
