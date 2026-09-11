import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function user(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  const u = await user(req);
  if (!u) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedStream = String(searchParams.get('stream') || '').trim().toLowerCase();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Question Bank follows the stream selected by the logged-in user. The old
  // implementation always defaulted to ECE, which made the whole Question
  // Bank appear empty for users whose profile is on another stream. Keep an
  // explicit ?stream= override for navigation/debugging, otherwise resolve it
  // from the user's profile.
  let stream = requestedStream;
  if (!stream) {
    const { data: profile } = await db
      .from('user_profiles')
      .select('branch')
      .eq('user_id', u.id)
      .maybeSingle();
    stream = String(profile?.branch || '').trim().toLowerCase();
  }
  if (!stream) stream = 'ece';

  const { data: subjects, error } = await db.from('qb_subjects')
    .select('id,name,description,sort_order,chapters:qb_chapters(id,name,description,sort_order,question_count,is_published)')
    .ilike('stream', stream).eq('is_published', true).order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subjectRows = (subjects || []).map((s: any) => ({ ...s, chapters: (s.chapters || []).filter((c: any) => c.is_published) }));
  const chapterIds = subjectRows.flatMap((s: any) => s.chapters.map((c: any) => c.id));
  const questionToChapter = new Map<string, string>();
  const questionToSubject = new Map<string, string>();
  const chapterStats = new Map<string, { total:number; mcq:number; msq:number; nat:number; unknown:number; attempted:number; saved:number }>();
  const attemptedIds = new Set<string>();
  const bookmarkedIds = new Set<string>();

  if (chapterIds.length) {
    const { data: qs, error: qError } = await db.from('qb_questions')
      .select('id,chapter_id,question_type').in('chapter_id', chapterIds).eq('is_published', true);
    if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });
    (qs || []).forEach((q: any) => {
      questionToChapter.set(q.id, q.chapter_id);
      const stat = chapterStats.get(q.chapter_id) || { total:0, mcq:0, msq:0, nat:0, unknown:0, attempted:0, saved:0 };
      stat.total++;
      const type = String(q.question_type || '').toUpperCase();
      if (type === 'MCQ') stat.mcq++; else if (type === 'MSQ') stat.msq++; else if (type === 'NAT') stat.nat++; else stat.unknown++;
      chapterStats.set(q.chapter_id, stat);
    });
    const qids = (qs || []).map((q:any)=>q.id);
    if (qids.length) {
      const { data: p, error: pError } = await db.from('qb_question_progress')
        .select('question_id,attempted_count,bookmarked').eq('user_id', u.id).in('question_id', qids);
      if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });
      (p || []).forEach((row: any) => {
        if (Number(row.attempted_count || 0) > 0) attemptedIds.add(row.question_id);
        if (row.bookmarked) bookmarkedIds.add(row.question_id);
      });
    }
  }

  attemptedIds.forEach(qid => { const cid=questionToChapter.get(qid); if(cid){ const s=chapterStats.get(cid); if(s)s.attempted++; }});
  bookmarkedIds.forEach(qid => { const cid=questionToChapter.get(qid); if(cid){ const s=chapterStats.get(cid); if(s)s.saved++; }});

  const subjectByChapter = new Map<string,string>();
  subjectRows.forEach((s:any)=>s.chapters.forEach((c:any)=>subjectByChapter.set(c.id,s.id)));

  const result = subjectRows.map((s:any) => {
    const chapters = s.chapters.map((c:any) => {
      const st = chapterStats.get(c.id) || {total:0,mcq:0,msq:0,nat:0,unknown:0,attempted:0,saved:0};
      const total = st.total;
      return {
        ...c,
        question_count: total,
        attempted_count: st.attempted,
        remaining_count: Math.max(0,total-st.attempted),
        progress_percent: total ? Math.round((st.attempted/total)*100) : 0,
        mcq_count: st.mcq, msq_count: st.msq, nat_count: st.nat, unknown_count: st.unknown,
        saved_count: st.saved,
      };
    });
    const total = chapters.reduce((n:number,c:any)=>n+Number(c.question_count||0),0);
    const attempted = chapters.reduce((n:number,c:any)=>n+Number(c.attempted_count||0),0);
    const saved = chapters.reduce((n:number,c:any)=>n+Number(c.saved_count||0),0);
    return {
      ...s, chapters, total_questions: total, attempted_count: attempted,
      remaining_count: Math.max(0,total-attempted), progress_percent: total ? Math.round((attempted/total)*100) : 0,
      mcq_count: chapters.reduce((n:number,c:any)=>n+Number(c.mcq_count||0),0),
      msq_count: chapters.reduce((n:number,c:any)=>n+Number(c.msq_count||0),0),
      nat_count: chapters.reduce((n:number,c:any)=>n+Number(c.nat_count||0),0),
      unknown_count: chapters.reduce((n:number,c:any)=>n+Number(c.unknown_count||0),0),
      saved_count: saved,
    };
  });

  return NextResponse.json({ subjects: result });
}
