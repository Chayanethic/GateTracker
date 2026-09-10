import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminOk(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}
const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const c = db();
    const { data: reports, error } = await c
      .from('qb_question_reports')
      .select('id,user_id,question_id,reason,details,status,created_at,resolved_at')
      .order('created_at', { ascending: false });

    if (error) {
      if (/relation .*qb_question_reports.*does not exist/i.test(error.message)) {
        return NextResponse.json({ error: 'Question reports table is missing. Run the latest question_bank.sql in Supabase.' }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = [...new Set((reports || []).map((r: any) => r.question_id).filter(Boolean))];
    let questions: any[] = [];
    if (ids.length) {
      const { data, error: qError } = await c
        .from('qb_questions')
        .select('id,external_id,question_number,question_html,options,option_image_urls,explanation_html,question_type,raw_data,chapter_id')
        .in('id', ids);
      if (qError) return NextResponse.json({ error: `Unable to load reported questions: ${qError.message}` }, { status: 500 });
      questions = data || [];
    }

    const chapterIds = [...new Set(questions.map(q => q.chapter_id).filter(Boolean))];
    let chapters: any[] = [];
    if (chapterIds.length) {
      const { data, error: chError } = await c
        .from('qb_chapters')
        .select('id,name,subject_id')
        .in('id', chapterIds);
      if (chError) return NextResponse.json({ error: `Unable to load reported chapters: ${chError.message}` }, { status: 500 });
      chapters = data || [];
    }

    const subjectIds = [...new Set(chapters.map(ch => ch.subject_id).filter(Boolean))];
    let subjects: any[] = [];
    if (subjectIds.length) {
      const { data, error: sError } = await c
        .from('qb_subjects')
        .select('id,name')
        .in('id', subjectIds);
      if (sError) return NextResponse.json({ error: `Unable to load reported subjects: ${sError.message}` }, { status: 500 });
      subjects = data || [];
    }

    const qMap = new Map(questions.map(q => [q.id, q]));
    const chMap = new Map(chapters.map(ch => [ch.id, ch]));
    const sMap = new Map(subjects.map(s => [s.id, s]));

    const out = (reports || []).map((r: any) => {
      const q = qMap.get(r.question_id) || null;
      const ch = q ? chMap.get(q.chapter_id) || null : null;
      const sub = ch ? sMap.get(ch.subject_id) || null : null;
      return {
        ...r,
        qb_questions: q ? {
          ...q,
          qb_chapters: ch ? { ...ch, qb_subjects: sub || null } : null
        } : null
      };
    });

    return NextResponse.json({ reports: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to load reports.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const body = await req.json();
    const id = String(body.id || '');
    const status = String(body.status || 'resolved');
    if (!id || !['open', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const { error } = await db().from('qb_question_reports')
      .update({ status, resolved_at: status === 'open' ? null : new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unable to update report.' }, { status: 500 });
  }
}
