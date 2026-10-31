import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parsePscExamMeta } from '@/lib/pscExam';

const db = () =>
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

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: 'A valid exam id is required.' }, { status: 400 });
    }

    const admin = db();
    const { data: test, error } = await admin
      .from('test_series')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!test) {
      return NextResponse.json(
        { error: 'Exam paper not found or no longer published.' },
        { status: 404 }
      );
    }

    const meta = parsePscExamMeta(test);

    return NextResponse.json(
      {
        test: {
          ...test,
          category: meta.category,
          stream: meta.stream,
          display_exam_name: meta.displayExamName,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load examination.' },
      { status: 500 }
    );
  }
}
