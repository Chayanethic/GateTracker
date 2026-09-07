import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { userId, earned } = await req.json();

    if (!userId || earned <= 0) {
      return NextResponse.json({ error: 'Invalid Data' }, { status: 400 });
    }

    // Initialize Supabase Server Client (Bypasses Browser Restrictions)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // Use Service Role Key if available, otherwise fallback to Anon Key
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Fetch current profile to get exact current XP (or default to 0)
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp, streak')
      .eq('id', userId)
      .maybeSingle();

    const currentXp = profile?.xp || 0;
    const newXp = currentXp + earned;

    // 2. Force an UPSERT: Creates the row if it's missing, updates if it exists!
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId, 
        xp: newXp,
        streak: profile?.streak || 0 
      })
      .select('xp')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, newTotal: data.xp });

  } catch (error: any) {
    console.error("SERVER API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}