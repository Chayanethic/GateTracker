// src/lib/dataService.ts
import { supabase } from './supabase';


export const getTargetSubjects = async () => {
  const { data, error } = await supabase.from('subjects').select('*');
  if (error) console.error("Error fetching subjects:", error);
  return data || [];
};


// Fetch ALL materials at once so we don't spam the database
export const getAllStudyMaterials = async () => {
  const { data, error } = await supabase.from('study_materials').select('*');
  if (error) console.error("Error fetching materials:", error);
  return data || [];
};

// Fetch the user's specific progress (checkboxes and notes)
export const getUserProgress = async (userId: string) => {
  const { data, error } = await supabase.from('user_progress').select('*').eq('user_id', userId);
  if (error) console.error("Error fetching progress:", error);
  return data || [];
};

// Save notes or mark as complete
export const upsertUserProgress = async (userId: string, materialId: string, completed: boolean, notes: string) => {
  const { error } = await supabase.from('user_progress').upsert(
    { user_id: userId, material_id: materialId, completed, notes, updated_at: new Date() },
    { onConflict: 'user_id, material_id' }
  );
  if (error) console.error("Error saving progress:", error);
};

// --- LAZY FETCHING (Saves Server Bills) ---

// 1. Fetch ONLY the names of the subjects (Extremely lightweight)
export const getCurrentUserBranch = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('branch')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Error fetching user branch:', error);
    return null;
  }
  return data?.branch || null;
};

export const getUniqueSubjects = async (branch?: string) => {
  let query = supabase.from('study_materials').select('subject_name');
  if (branch) query = query.eq('stream', branch);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return [...new Set(data.map(d => d.subject_name))]; // Extract unique names
};

// 2. Fetch ONLY the materials for the clicked subject (No heavy URLs fetched)
// MAKE SURE IT LOOKS LIKE THIS:
export const getSubjectSyllabus = async (subjectName: string, branch?: string) => {
  let query = supabase
    .from('study_materials')
    .select('*')
    .eq('subject_name', subjectName);
  if (branch) query = query.eq('stream', branch);
  const { data, error } = await query;
  if (error) console.error('Error fetching syllabus:', error);
  return data || [];
};

// --- BULLETPROOF XP SAVING ---
export const saveAccurateXp = async (userId: string, xpEarned: number) => {
  // Uses the secure SQL RPC function we created above
  const { error } = await supabase.rpc('increment_user_xp', {
    user_uuid: userId,
    xp_amount: xpEarned
  });
  if (error) console.error("Failed to save XP securely:", error);
};



// Optimized XP Saving Function
// Add this to your dataService.ts
// 1. UPDATE THIS FUNCTION
// --- X-RAY PUSH (SAVE) FUNCTION ---
// --- NEW BACKEND PUSH FUNCTION ---
export const addExperiencePoints = async (userId: string, earned: number) => {
  console.log(`[API PUSH] Sending ${earned} XP to Backend Server...`);
  
  if (earned <= 0) return null;

  try {
    // Send a secure POST request to our new Next.js API route
    const response = await fetch('/api/sync-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, earned })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[API PUSH ERROR] Server rejected the save:", data.error);
      alert(`BACKEND API ERROR: ${data.error}`);
      return null;
    }
    
    console.log("[API PUSH SUCCESS] Backend saved it! New Total XP:", data.newTotal);
    return data.newTotal; 

  } catch (err) {
    console.error("[API NETWORK ERROR] Failed to reach server:", err);
    return null;
  }
};


// --- X-RAY FETCH (READ) FUNCTION ---
export const getUserProfile = async (userId: string) => {
  console.log(`[X-RAY FETCH] 1. Fetching profile for user: ${userId}`);

  const { data, error } = await supabase
    .from('profiles')
    .select('xp, streak')
    .eq('id', userId)
    .maybeSingle();
  
  if (error) {
    console.error("[X-RAY FETCH ERROR] Database refused to read:", error);
    alert(`FETCH ERROR: ${error.message} \n\nCheck the Console!`);
    return { xp: 0, streak: 0 };
  }

  console.log("[X-RAY FETCH SUCCESS] 2. Raw data received from database:", data);

  if (!data) {
    console.warn("[X-RAY FETCH WARNING] 3. No profile row exists for this user! Defaulting to 0.");
    return { xp: 0, streak: 0 };
  }

  return data;
};

// --- THE DAILY STREAK ENGINE ---
export const syncDailyXpAndStreak = async (userId: string, earnedXp: number) => {
  const getISTDateString = () => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  
  const todayStr = getISTDateString();

  // 1. Check how much XP you already earned today
  const { data: tracking } = await supabase
    .from('daily_tracking')
    .select('xp_earned')
    .eq('user_id', userId)
    .eq('date_str', todayStr)
    .maybeSingle();

  const currentDailyXp = tracking?.xp_earned || 0;
  const newDailyXp = currentDailyXp + earnedXp;

  // 2. Save the new Daily XP total
  await supabase.from('daily_tracking').upsert({
    user_id: userId,
    date_str: todayStr,
    xp_earned: newDailyXp
  });

  // 3. THE MAGIC LOGIC: Did they cross 200 XP just now?
  if (currentDailyXp < 200 && newDailyXp >= 200) {
    // Increment Streak!
    const { data: profile } = await supabase.from('profiles').select('streak').eq('id', userId).single();
    const newStreak = (profile?.streak || 0) + 1;
    
    await supabase.from('profiles').update({ streak: newStreak }).eq('id', userId);
    
    return { streakIncreased: true, newStreak, newDailyXp };
  }

  return { streakIncreased: false, newDailyXp };
};

// --- TOPIC TIME MIRROR ---
// When a tracked topic's curriculum videos are completed, stamp the exact
// completion moment. This keeps the Topic Time Mirror fully automatic.
export const syncTopicTrackingCompletion = async (
  userId: string,
  material: { subject_name?: string; topic_name?: string }
) => {
  if (!userId || !material?.subject_name || !material?.topic_name) return;

  const { data: tracking } = await supabase
    .from('topic_tracking')
    .select('enabled, started_at, completed_at, best_elapsed_minutes, best_lecture_minutes, best_pace_hours_per_day, record_at')
    .eq('user_id', userId)
    .eq('subject_name', material.subject_name)
    .eq('topic_name', material.topic_name)
    .maybeSingle();

  if (!tracking?.enabled) return;

  const { data: materials } = await supabase
    .from('study_materials')
    .select('id, duration')
    .eq('subject_name', material.subject_name)
    .eq('topic_name', material.topic_name);

  const ids = (materials || []).map((m: any) => m.id);
  if (!ids.length) return;

  const { data: completed } = await supabase
    .from('user_progress')
    .select('material_id')
    .eq('user_id', userId)
    .eq('completed', true)
    .in('material_id', ids);

  const completedIds = new Set((completed || []).map((r: any) => String(r.material_id)));
  const finished = completedIds.size >= ids.length;

  const toMins = (v: any) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const p = String(v).split(':').map(Number);
    if (p.some(Number.isNaN)) return 0;
    if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
    if (p.length === 2) return p[0] + p[1] / 60;
    return Number(p[0]) || 0;
  };

  if (!finished) {
    await supabase.from('topic_tracking').update({
      completed_at: null,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId)
      .eq('subject_name', material.subject_name)
      .eq('topic_name', material.topic_name);
    return;
  }

  const completedAt = new Date().toISOString();
  const startedAt = tracking.started_at ? new Date(tracking.started_at).getTime() : Date.now();
  const elapsedMinutes = Math.max(0, (Date.now() - startedAt) / 60000);
  const totalLectureMinutes = (materials || []).reduce((sum: number, m: any) => sum + toMins(m.duration), 0);
  const paceHoursPerDay = totalLectureMinutes > 0 && elapsedMinutes > 0
    ? totalLectureMinutes / (elapsedMinutes / 1440) / 60
    : 0;

  const oldBest = tracking.best_elapsed_minutes == null ? null : Number(tracking.best_elapsed_minutes);
  const oldPace = tracking.best_pace_hours_per_day == null ? null : Number(tracking.best_pace_hours_per_day);
  const newRecord = oldBest == null || elapsedMinutes < oldBest;
  const newPaceRecord = oldPace == null || paceHoursPerDay > oldPace;

  await supabase
    .from('topic_tracking')
    .update({
      completed_at: completedAt,
      best_elapsed_minutes: newRecord ? elapsedMinutes : oldBest,
      best_lecture_minutes: newRecord ? totalLectureMinutes : (tracking.best_lecture_minutes ?? totalLectureMinutes),
      best_pace_hours_per_day: newPaceRecord ? paceHoursPerDay : oldPace,
      record_at: (newRecord || newPaceRecord) ? completedAt : tracking.record_at,
      updated_at: completedAt
    })
    .eq('user_id', userId)
    .eq('subject_name', material.subject_name)
    .eq('topic_name', material.topic_name);
};

// --- DAILY STUDY LEDGER ---
// Every lecture completion is recorded separately by date so the user can see
// exactly what they studied each day without losing the global syllabus progress.
export const getISTDateString = (date = new Date()) => {
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const parseDurationToMinutes = (duration: string | number | null | undefined) => {
  if (typeof duration === 'number') return duration;
  if (!duration) return 0;
  const parts = String(duration).split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return Number(parts[0]) || 0;
};

export const syncDailyLectureCompletion = async (
  userId: string,
  material: {
    id: string;
    title?: string;
    subject_name?: string;
    topic_name?: string;
    duration?: string | number;
  },
  completed: boolean,
  dateStr = getISTDateString()
) => {
  if (!userId || !material?.id) return;

  if (completed) {
    const { error } = await supabase.from('daily_lecture_activity').upsert({
      user_id: userId,
      material_id: material.id,
      date_str: dateStr,
      title: material.title || 'Untitled Lecture',
      subject_name: material.subject_name || '',
      topic_name: material.topic_name || '',
      duration_mins: Math.round(parseDurationToMinutes(material.duration)),
    }, { onConflict: 'user_id,material_id,date_str' });

    if (error) {
      console.error('Daily lecture log error:', error);
      return;
    }
  } else {
    const { error } = await supabase.from('daily_lecture_activity')
      .delete()
      .match({ user_id: userId, material_id: material.id, date_str: dateStr });

    if (error) console.error('Daily lecture delete error:', error);
  }

  // Keep the existing daily_tracking row in sync for lightweight dashboard reads.
  const { data: rows, error: readError } = await supabase
    .from('daily_lecture_activity')
    .select('duration_mins')
    .eq('user_id', userId)
    .eq('date_str', dateStr);

  if (readError) {
    console.error('Daily lecture summary read error:', readError);
    return;
  }

  const studyMinutes = Math.round((rows || []).reduce((sum, row) => sum + Number(row.duration_mins || 0), 0));
  const lecturesCompleted = rows?.length || 0;

  const { data: existing } = await supabase.from('daily_tracking')
    .select('notes, completion_percent, xp_earned')
    .eq('user_id', userId)
    .eq('date_str', dateStr)
    .maybeSingle();

  const { error: summaryError } = await supabase.from('daily_tracking').upsert({
    user_id: userId,
    date_str: dateStr,
    study_minutes: studyMinutes,
    lectures_completed: lecturesCompleted,
    notes: existing?.notes || '',
    completion_percent: existing?.completion_percent || 0,
    xp_earned: existing?.xp_earned || 0,
  }, { onConflict: 'user_id,date_str' });

  if (summaryError) console.error('Daily tracking summary error:', summaryError);
};
