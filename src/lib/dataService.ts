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
export const getUniqueSubjects = async () => {
  const { data, error } = await supabase.from('study_materials').select('subject_name');
  if (error) { console.error(error); return []; }
  return [...new Set(data.map(d => d.subject_name))]; // Extract unique names
};

// 2. Fetch ONLY the materials for the clicked subject (No heavy URLs fetched)
// MAKE SURE IT LOOKS LIKE THIS:
export const getSubjectSyllabus = async (subjectName: string) => {
  const { data, error } = await supabase
    .from('study_materials')
    .select('*') // <--- THIS IS CRITICAL. If it says 'id, title, url', change it to '*'
    .eq('subject_name', subjectName);
  
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