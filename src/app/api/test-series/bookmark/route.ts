import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminDb = () => createClient(
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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });

    const { attemptId, questionId, bookmarked } = await req.json();
    if (!attemptId || !questionId) return NextResponse.json({ error: 'Attempt id and question id are required.' }, { status: 400 });

    const db = adminDb();
    const { data: attempt, error: ae } = await db
      .from('test_series_attempts')
      .select('id,user_id,answers')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single();
    if (ae || !attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });

    const answers = attempt.answers && typeof attempt.answers === 'object' ? { ...attempt.answers } : {};
    const bookmarks = answers.__bookmarked && typeof answers.__bookmarked === 'object' ? { ...answers.__bookmarked } : {};
    if (Boolean(bookmarked)) bookmarks[String(questionId)] = true;
    else delete bookmarks[String(questionId)];
    answers.__bookmarked = bookmarks;

    const { error: ue } = await db
      .from('test_series_attempts')
      .update({ answers })
      .eq('id', attemptId)
      .eq('user_id', user.id);
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 });

    return NextResponse.json({ bookmarked: Boolean(bookmarked) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to update bookmark.' }, { status: 500 });
  }
}
