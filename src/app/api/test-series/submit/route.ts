import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Test id is required.' }, { status: 400 });
    }

    const db = adminDb();

    const { data: access, error: accessError } = await db
      .from('test_series_access_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }

    if (access?.status !== 'approved') {
      return NextResponse.json(
        { error: 'Test-series access is not approved.' },
        { status: 403 }
      );
    }

    const { data: test, error } = await db
      .from('test_series')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!test) {
      return NextResponse.json({ error: 'Test not found or not published.' }, { status: 404 });
    }

    return NextResponse.json({ test });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load examination.' },
      { status: 500 }
    );
  }
}
