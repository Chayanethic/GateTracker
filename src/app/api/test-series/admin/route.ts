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
  const [{ data: requests, error: requestError }, { data: tests, error: testError }] = await Promise.all([
    db().from('test_series_access_requests').select('*').order('requested_at', { ascending: false }),
    db().from('test_series').select('id,title,exam_name,duration_minutes,max_marks,question_count,is_published,created_at,provider,test_category,test_number,subject,topic,syllabus,exam_year,stream').order('created_at', { ascending: false }),
  ]);
  if (requestError || testError) return NextResponse.json({ error: (requestError || testError)?.message }, { status: 500 });
  return NextResponse.json({ requests: requests || [], tests: tests || [] });
}

export async function PATCH(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await req.json();
  const { id, status, action } = body;
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
