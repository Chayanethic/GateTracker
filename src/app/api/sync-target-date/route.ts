import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { userId, targetDate } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 400 });
    }

    // IMPORTANT: Make sure these environment variables exist in your .env.local file!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase Env Variables.");
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Initialize Supabase Server Client with the Admin Key (Bypasses Browser RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Force an UPSERT to permanently lock the date into the user's profile
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ 
        user_id: userId, 
        target_exam_date: targetDate,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });

    if (error) {
        console.error("Supabase Upsert Error:", error);
        throw error;
    }

    return NextResponse.json({ success: true, targetDate });

  } catch (error: any) {
    console.error("SERVER API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}