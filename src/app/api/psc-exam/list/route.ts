import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parsePscExamMeta } from '@/lib/pscExam';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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

    const admin = db();

    // Do NOT select the heavy `questions` column when listing all tests!
    let rows: any[] = [];
    const rich = await admin
      .from('test_series')
      .select(
        'id,title,exam_name,duration_minutes,max_marks,question_count,created_at,is_published,provider,test_category,subject,topic,stream'
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!rich.error) {
      rows = rich.data || [];
    } else {
      const legacy = await admin
        .from('test_series')
        .select(
          'id,title,exam_name,duration_minutes,max_marks,question_count,created_at,is_published'
        )
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (legacy.error) {
        return NextResponse.json({ error: legacy.error.message }, { status: 500 });
      }
      rows = legacy.data || [];
    }

    const pscTests = rows.filter((t: any) => parsePscExamMeta(t).isPsc);
    const ids = pscTests.map((t: any) => t.id);

    if (!ids.length) {
      return NextResponse.json({ tests: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

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

    const result = pscTests.map((t: any) => {
      const meta = parsePscExamMeta(t);
      const list = byTest[t.id] || [];
      const latest = list[0] || null;
      const topics = String(t.topic || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      return {
        id: t.id,
        title: t.title,
        category: meta.category,
        stream: meta.stream,
        exam_name: meta.displayExamName,
        duration_minutes: Number(t.duration_minutes || 45),
        max_marks: Number(t.max_marks || 0),
        question_count: Number(t.question_count || 0),
        topics,
        created_at: t.created_at,
        attempt_count: list.length,
        latest_attempt: latest
          ? {
              score: Number(latest.score || 0),
              max_marks: Number(t.max_marks || 0),
              submitted_at: latest.submitted_at,
            }
          : null,
      };
    });

    return NextResponse.json(
      { tests: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unable to load PSC exam tests.' },
      { status: 500 }
    );
  }
}
