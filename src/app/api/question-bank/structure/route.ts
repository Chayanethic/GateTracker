import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function user(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  const u = await user(req);
  if (!u) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')}` } } });
  const { searchParams } = new URL(req.url);
  const stream = searchParams.get('stream') || 'ece';
  const { data: subjects, error } = await client.from('qb_subjects')
    .select('id,name,description,sort_order,chapters:qb_chapters(id,name,description,sort_order,question_count,is_published)')
    .eq('stream', stream).eq('is_published', true).order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subjects: subjects || [] });
}
