import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { userId, topics } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 400 });
    }

    // Initialize Supabase Server Client with the Admin Key (Bypasses Browser RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Force an UPSERT to permanently lock the syllabus array into the user's profile
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ 
        user_id: userId, 
        syllabus_progress: topics,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' // Tells Supabase to update the existing row, not create a new one
      });

    if (error) throw error;

    return NextResponse.json({ success: true, savedTopics: topics });

  } catch (error: any) {
    console.error("SERVER API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}