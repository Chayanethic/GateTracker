import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global:{headers:{Authorization:`Bearer ${token}`}} });
  const {data,error}=await c.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function POST(req: Request){
  const user=await getUser(req); if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});
  const body=await req.json();
  const questionId=String(body.questionId||''); const reason=String(body.reason||'').trim(); const details=String(body.details||'').trim();
  if(!questionId||!reason)return NextResponse.json({error:'Question and reason are required.'},{status:400});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const {data:q}=await db.from('qb_questions').select('id').eq('id',questionId).maybeSingle();
  if(!q)return NextResponse.json({error:'Question not found.'},{status:404});
  const {data:existing}=await db.from('qb_question_reports').select('id,status').eq('user_id',user.id).eq('question_id',questionId).eq('status','open').maybeSingle();
  if(existing)return NextResponse.json({ok:true,alreadyReported:true});
  const {error}=await db.from('qb_question_reports').insert({user_id:user.id,question_id:questionId,reason,details:details||null,status:'open'});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true});
}

