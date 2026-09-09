import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function adminOk(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}

export async function PATCH(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const subject = String(body?.subject || '').trim();

    if (!id) return NextResponse.json({ error: 'Test id is required.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'Subject name cannot be empty.' }, { status: 400 });
    if (subject.length > 200) return NextResponse.json({ error: 'Subject name is too long.' }, { status: 400 });

    const client = db();
    const { data: test, error: lookupError } = await client
      .from('test_series')
      .select('id,provider')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 });
    if (test.provider !== 'madeeasy') {
      return NextResponse.json({ error: 'Subject editing is available only for MADE EASY tests.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await client
      .from('test_series')
      .update({ subject })
      .eq('id', id)
      .select('id,subject')
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: updated.id, subject: updated.subject });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update subject.' }, { status: 500 });
  }
}
