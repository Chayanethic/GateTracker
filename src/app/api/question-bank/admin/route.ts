import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
function ok(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const d = db();
  const { data, error } = await d.from('qb_subjects').select('id,name,description,sort_order,is_published,stream,exam_key,chapters:qb_chapters(id,name,description,sort_order,question_count,is_published)').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subjects: data || [] });
}

export async function PATCH(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await req.json();
  const table = body.kind === 'subject' ? 'qb_subjects' : body.kind === 'chapter' ? 'qb_chapters' : 'qb_questions';
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  const patch: any = {};
  if (body.name != null) patch.name = String(body.name).trim();
  if (body.is_published != null) patch.is_published = Boolean(body.is_published);
  if (body.difficulty != null) patch.difficulty = body.difficulty;
  if (body.topic != null) patch.topic = String(body.topic).trim() || null;
  if (body.question_html != null) patch.question_html = String(body.question_html);
  if (body.explanation_html != null) patch.explanation_html = String(body.explanation_html);
  patch.updated_at = new Date().toISOString();
  const { error } = await db().from(table).update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!ok(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await req.json();
  const kind = body.kind;
  const id = String(body.id || '');
  if (!id || !['subject','chapter','question'].includes(kind)) return NextResponse.json({ error: 'Invalid delete request.' }, { status: 400 });
  const table = kind === 'subject' ? 'qb_subjects' : kind === 'chapter' ? 'qb_chapters' : 'qb_questions';
  const { error } = await db().from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
