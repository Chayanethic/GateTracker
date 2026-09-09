import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function adminOk(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { data: requests, error: requestError } = await db()
    .from('test_series_access_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

  // Keep the existing admin test/access panel working even if the optional
  // MADE EASY metadata migration has not been run yet. In that case we fall
  // back to the original test_series columns and expose old tests as standard
  // PREPFUSION tests instead of hiding every test because one new column is missing.
  let tests: any[] = [];
  const rich = await db()
    .from('test_series')
    .select('id,title,exam_name,duration_minutes,max_marks,question_count,is_published,created_at,provider,test_category,test_number,subject,topic,syllabus,exam_year,stream')
    .order('created_at', { ascending: false });

  if (!rich.error) {
    tests = rich.data || [];
  } else {
    const legacy = await db()
      .from('test_series')
      .select('id,title,exam_name,duration_minutes,max_marks,question_count,is_published,created_at')
      .order('created_at', { ascending: false });
    if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 });
    tests = (legacy.data || []).map((t: any) => ({
      ...t, provider: 'prepfusion', test_category: 'standard', test_number: null,
      subject: null, topic: null, syllabus: null, exam_year: null, stream: null,
    }));
  }

  return NextResponse.json({ requests: requests || [], tests });
}

export async function PATCH(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await req.json();
  const { id, status, action } = body;
  if (action === 'rename') {
    const title = String(body.title || '').trim();
    if (!id) return NextResponse.json({ error: 'Test id is required' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Test title cannot be empty.' }, { status: 400 });
    if (title.length > 200) return NextResponse.json({ error: 'Test title is too long.' }, { status: 400 });
    const { error } = await db().from('test_series').update({ title }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, title });
  }

  if (action === 'rename_subject') {
    const subject = String(body.subject || '').trim();
    if (!id) return NextResponse.json({ error: 'Test id is required' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'Subject name cannot be empty.' }, { status: 400 });
    if (subject.length > 200) return NextResponse.json({ error: 'Subject name is too long.' }, { status: 400 });
    const { error } = await db().from('test_series').update({ subject }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, subject });
  }

  if (action === 'rename_subject') {
    const subject = String(body.subject || '').trim();
    if (!id) return NextResponse.json({ error: 'Test id is required' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'Subject name cannot be empty.' }, { status: 400 });
    if (subject.length > 200) return NextResponse.json({ error: 'Subject name is too long.' }, { status: 400 });
    const { error } = await db().from('test_series').update({ subject }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, subject });
  }

  if (action === 'delete_syllabus') {
    if (!id) return NextResponse.json({ error: 'Test id is required' }, { status: 400 });
    const { error } = await db().from('test_series').update({ syllabus: null }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (!id || !['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { error } = await db().from('test_series_access_requests').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Test id is required' }, { status: 400 });
  const { error } = await db().from('test_series').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
