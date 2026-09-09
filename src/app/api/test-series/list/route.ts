import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () => createClient(
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });
    }

    const admin = db();

    const { data: access, error: accessError } = await admin
      .from('test_series_access_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }

    if (access?.status !== 'approved') {
      return NextResponse.json({ error: 'Test-series access is not approved.' }, { status: 403 });
    }

    // Test-series visibility follows the branch selected by the user.
    // ECE users see EC/ECE tests; CSE users see CS/CSE and DA tests.
    // Keep this filtering server-side so a user never receives another
    // branch's test-series data from this endpoint.
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('branch')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const branch = String(profile?.branch || '').toLowerCase().trim();
    if (!branch) {
      return NextResponse.json({ error: 'Please select your branch first.' }, { status: 400 });
    }

    const allowedStreams = branch === 'ece'
      ? new Set(['ec', 'ece'])
      : branch === 'cse'
        ? new Set(['cs', 'cse', 'da'])
        : new Set<string>();

    if (!allowedStreams.size) {
      return NextResponse.json({ error: 'Unsupported branch selected.' }, { status: 400 });
    }

    // Only published tests are returned. The extra MADE EASY metadata columns
    // are optional until the migration is run. Fall back to the legacy shape so
    // existing published tests never disappear from the user page.
    let tests: any[] = [];
    const rich = await admin
      .from('test_series')
      .select('id,title,exam_name,duration_minutes,max_marks,question_count,created_at,is_published,provider,test_category,test_number,subject,topic,syllabus,exam_year,stream')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!rich.error) {
      tests = rich.data || [];
    } else {
      const legacy = await admin
        .from('test_series')
        .select('id,title,exam_name,duration_minutes,max_marks,question_count,created_at,is_published')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      tests = (legacy.data || []).map((t: any) => ({
        ...t, provider: 'prepfusion', test_category: 'standard', test_number: null,
        subject: null, topic: null, syllabus: null, exam_year: null, stream: null,
      }));
    }

    // MADE EASY tests use the new stream metadata for branch filtering.
    // Standard/PREPFUSION tests keep the existing visibility behavior: they
    // remain visible even when the newer MADE EASY stream metadata is absent.
    // This is important for older Standard tests that were published before
    // the MADE EASY structure was introduced.
    tests = tests.filter((t: any) => {
      if (String(t.provider || 'prepfusion').toLowerCase() !== 'madeeasy') {
        return true;
      }
      const stream = String(t.stream || '').toLowerCase().trim();
      return allowedStreams.has(stream);
    });

    const ids = tests.map((t: any) => t.id);
    if (!ids.length) return NextResponse.json({ tests: [] }, { headers: { 'Cache-Control': 'no-store' } });

    const { data: attempts, error: attemptError } = await admin
      .from('test_series_attempts')
      .select('test_series_id,score,submitted_at')
      .eq('user_id', user.id)
      .in('test_series_id', ids)
      .order('submitted_at', { ascending: false });

    if (attemptError) {
      return NextResponse.json({ error: attemptError.message }, { status: 500 });
    }

    const byTest: Record<string, any[]> = {};
    for (const a of attempts || []) {
      if (!byTest[a.test_series_id]) byTest[a.test_series_id] = [];
      byTest[a.test_series_id].push(a);
    }

    const result = (tests || []).map((t: any) => {
      const list = byTest[t.id] || [];
      const latest = list[0] || null;

      return {
        id: t.id,
        title: t.title,
        exam_name: t.exam_name,
        duration_minutes: t.duration_minutes,
        max_marks: t.max_marks,
        question_count: t.question_count,
        created_at: t.created_at,
        provider: t.provider || 'prepfusion',
        test_category: t.test_category || 'standard',
        test_number: t.test_number ?? null,
        subject: t.subject || null,
        topic: t.topic || null,
        syllabus: t.syllabus || null,
        exam_year: t.exam_year ?? null,
        stream: t.stream || null,
        attempt_count: list.length,
        latest_attempt: latest
          ? {
              score: Number(latest.score || 0),
              max_marks: Number(t.max_marks || 0),
              submitted_at: latest.submitted_at,
            }
          : null,
      };
    }).sort((a: any, b: any) => {
      // Attempted exams first, then newest published exams.
      if (a.attempt_count !== b.attempt_count) return b.attempt_count - a.attempt_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json(
      { tests: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load test series.' },
      { status: 500 }
    );
  }
}
