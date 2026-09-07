import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { error } = await supabase.from('test_series_access_requests').upsert({
    user_id: session.user.id,
    status: 'pending',
    requested_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
