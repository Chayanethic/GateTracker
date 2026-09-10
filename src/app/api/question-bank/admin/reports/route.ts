import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminOk(req:Request){return req.headers.get('x-admin-email')===process.env.NEXT_PUBLIC_ADMIN_EMAIL&&req.headers.get('x-admin-password')===process.env.NEXT_PUBLIC_ADMIN_PASSWORD}
const db=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req:Request){
  if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:403});
  const c=db();
  const {data,error}=await c.from('qb_question_reports').select('id,user_id,question_id,reason,details,status,created_at,resolved_at,qb_questions(id,external_id,question_number,question_html,options,option_image_urls,chapter_id,qb_chapters(id,name,subject_id,qb_subjects(id,name)))').order('created_at',{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({reports:data||[]});
}

export async function PATCH(req:Request){
  if(!adminOk(req))return NextResponse.json({error:'Unauthorized'},{status:403});
  const body=await req.json(); const id=String(body.id||''); const status=String(body.status||'resolved');
  if(!id||!['open','resolved','dismissed'].includes(status))return NextResponse.json({error:'Invalid request.'},{status:400});
  const {error}=await db().from('qb_question_reports').update({status,resolved_at:status==='open'?null:new Date().toISOString()}).eq('id',id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true});
}
