import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');
    const questionId = searchParams.get('questionId');
    const mode = searchParams.get('mode') || 'answer';
    if (!testId || !questionId) return NextResponse.json({ error: 'Test id and question id are required.' }, { status: 400 });
    if (mode !== 'answer' && mode !== 'video') return NextResponse.json({ error: 'Invalid solution mode.' }, { status: 400 });

    const database = db();
    const { data: access } = await database.from('test_series_access_requests').select('status').eq('user_id', user.id).maybeSingle();
    if (access?.status !== 'approved') return NextResponse.json({ error: 'Test-series access is not approved.' }, { status: 403 });

    const { data: test } = await database.from('test_series').select('id').eq('id', testId).eq('is_published', true).maybeSingle();
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 });

    if (mode === 'video') {
      const { data: key, error } = await database
        .from('test_series_keys')
        .select('id_in_test,video_url')
        .eq('test_series_id', testId)
        .eq('id_in_test', questionId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!key) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
      return NextResponse.json({ solution: { videoUrl: key.video_url || null } });
    }

    // Answer/solution mode deliberately does NOT return the video URL.
    // This keeps video URLs out of the initial analysis payload and defers
    // video retrieval until the user explicitly asks for it.
    const { data: key, error } = await database
      .from('test_series_keys')
      .select('id_in_test,solution_html')
      .eq('test_series_id', testId)
      .eq('id_in_test', questionId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!key) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });

    return NextResponse.json({
      solution: {
        solutionHtml: key.solution_html || '',
        hasVideo: false,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to load solution.' }, { status: 500 });
  }
}
