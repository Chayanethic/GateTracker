'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { getUserProfile, upsertUserProgress, addExperiencePoints, syncDailyXpAndStreak, syncDailyLectureCompletion } from '../../../../lib/dataService';
import toast from 'react-hot-toast';
import {Activity, BookOpen, ArrowLeft, Check, Maximize2, MonitorPlay, Save, Database, Flame, Zap } from 'lucide-react';

export default function FocusRoom() {
  const params = useParams();
  const router = useRouter();
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ xp: 0, streak: 0 });
  
  // OPTIMIZATION REFS (Zero DB Spam & Stale Closure Fixes)
  const pendingXpRef = useRef(0);
  const profileRef = useRef(profile);
  const userIdRef = useRef<string | null>(null);
  
  // HTML Elements for Dual-Fullscreen Modes
  const pageContainerRef = useRef<HTMLDivElement>(null); 
  const playerContainerRef = useRef<HTMLDivElement>(null); 
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [material, setMaterial] = useState<any | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [notes, setNotes] = useState('');
  
  // UI STATES
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [displayXp, setDisplayXp] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep refs perfectly synced with React state
  useEffect(() => { 
    profileRef.current = profile; 
    userIdRef.current = userId; 
  }, [profile, userId]);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const loadSystem = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      
      const pData = await getUserProfile(session.user.id);
      if (pData) setProfile(pData);

      const { data: profile } = await supabase.from('user_profiles').select('branch').eq('user_id', session.user.id).maybeSingle();
      const { data: matData } = await supabase.from('study_materials').select('*').eq('id', videoId).single();
      if (matData && profile?.branch && matData.stream !== profile.branch) {
        router.replace('/resources');
        return;
      }
      if (matData) setMaterial(matData);

      const { data: progData } = await supabase.from('user_progress').select('*').eq('user_id', session.user.id).eq('material_id', videoId).single();
      if (progData) {
        setIsCompleted(progData.completed);
        setNotes(progData.notes || '');
      }
    };
    loadSystem();
  }, [videoId]);

  // --- 2. FULLSCREEN DETECTOR & AUTO-PAUSE ---
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      
      // Auto-pause the video when exiting focus mode
      if (!isFull && iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- 3. PURE TIME-BASED XP TRACKER ---
  useEffect(() => {
    let focusTimer: NodeJS.Timeout | null = null;

    if (material && isFullscreen && !showExitPrompt) {
      focusTimer = setInterval(() => {
        pendingXpRef.current += 1; 
      }, 10000); // 1 XP every 10 seconds.
    }

    return () => {
      if (focusTimer) clearInterval(focusTimer);
    };
  }, [material, isFullscreen, showExitPrompt]);

  // --- 4. VIDEO & DUAL-FOCUS CONTROLS ---
  const playVideo = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
    }
  };

  const enterStudyMode = async () => {
    try {
      if (pageContainerRef.current) {
        await pageContainerRef.current.requestFullscreen();
        playVideo();
      }
    } catch (err) { console.error(err); }
  };

  const enterCinemaMode = async () => {
    try {
      if (playerContainerRef.current) {
        await playerContainerRef.current.requestFullscreen();
        playVideo();
      }
    } catch (err) { console.error(err); }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&fs=1`;
    }
    return url; 
  };

  // --- 5. DECOUPLED TOGGLES & SAVES ---
  const toggleCompletion = async () => {
    if (!userId || !material) return;
    const newStatus = !isCompleted;
    setIsCompleted(newStatus); 
    
    await upsertUserProgress(userId, material.id, newStatus, notes);
    await syncDailyLectureCompletion(userId, material, newStatus);
    toast(newStatus ? 'Marked as Completed' : 'Status Reverted', {
      style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a', fontSize: '14px' }
    });
  };

  const saveNotes = async () => {
    if (!userId || !material) return;
    setIsSaving(true);
    await upsertUserProgress(userId, material.id, isCompleted, notes);
    setIsSaving(false);
    toast.success('Notes Synced', { 
      style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a', fontSize: '14px' }
    });
  };

  // --- 6. EXIT & STREAK PROTOCOL ---
  const triggerExitPrompt = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setDisplayXp(pendingXpRef.current);
    setShowExitPrompt(true);
  };

  const confirmExitAndClaim = async () => {
    const earned = pendingXpRef.current;
    const currentUserId = userIdRef.current; 
    let redirectDelay = 500;

    if (earned > 0 && currentUserId) {
      // 1. Save Total XP via your existing API
      const newTotal = await addExperiencePoints(currentUserId, earned);
      
      if (newTotal !== null) {
        pendingXpRef.current = 0; 
        setProfile(prev => ({ ...prev, xp: newTotal })); 
        
        // 2. CHECK DAILY STREAK ENGINE
        const streakData = await syncDailyXpAndStreak(currentUserId, earned);
        
        if (streakData.streakIncreased) {
          // DOPAMINE STREAK ALERT
          toast.success(`DAILY 200 XP SECURED!\nStreak Increased to ${streakData.newStreak} 🔥`, { 
            duration: 5000,
            icon: '🏆',
            style: { background: '#121214', color: '#f97316', border: '2px solid #ea580c', fontSize: '16px', fontWeight: 'bold', padding: '20px' }
          });
          redirectDelay = 3000; // Let them see the celebration before redirecting
        } else {
          toast.success(`+${earned} XP Secured! Daily Total: ${streakData.newDailyXp}/200`, { 
            icon: '⚡',
            style: { background: '#18181b', color: '#10b981', border: '1px solid #059669', fontSize: '14px' }
          });
        }
      }
    }
    
    if (material && currentUserId) {
        await upsertUserProgress(currentUserId, material.id, isCompleted, notes);
        if (isCompleted) await syncDailyLectureCompletion(currentUserId, material, true);
    }
    
    // Redirect back to Hub after allowing toasts to show
    setTimeout(() => {
      window.location.href = '/resources'; 
    }, redirectDelay);
  };

  const exitWithoutSaving = () => {
    pendingXpRef.current = 0; 
    router.push('/resources');
  };

  if (!material) return <div className="min-h-screen bg-[#09090b] text-zinc-500 flex items-center justify-center font-bold text-xs tracking-widest uppercase animate-pulse">Loading Session...</div>;

  return (
    <div ref={pageContainerRef} className="min-h-screen bg-[#09090b] text-zinc-300 font-sans relative flex flex-col selection:bg-zinc-800 overflow-y-auto">
      
      {/* --- SLEEK EXIT MODAL --- */}
      {showExitPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-zinc-800/80 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-300 relative overflow-hidden">
             
             <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>

             <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
               <Zap size={32} className="text-indigo-500"/>
             </div>
             
             <h3 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">Session Complete</h3>
             <p className="text-zinc-500 text-sm mb-6 font-medium">
               You generated raw focus energy. Secure it to your neural wallet before exiting.
             </p>

             <div className="text-5xl font-black text-emerald-400 mb-8 py-4 border-y border-zinc-800/50 flex items-center justify-center gap-2 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
               +{displayXp} <span className="text-xl text-emerald-500/60 font-bold uppercase tracking-widest">XP</span>
             </div>

             <div className="flex flex-col gap-3">
               <button onClick={confirmExitAndClaim} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] text-sm flex items-center justify-center gap-2">
                 <Database size={16} /> Sync XP & Exit
               </button>
               <div className="flex gap-3 mt-2">
                 <button onClick={() => setShowExitPrompt(false)} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-3 rounded-xl transition-colors text-xs">
                   Return to Focus
                 </button>
                 <button onClick={exitWithoutSaving} className="flex-1 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-zinc-500 hover:text-red-400 font-bold py-3 rounded-xl transition-colors text-xs">
                   Discard XP
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MINIMALIST HEADER --- */}
      <header className="shrink-0 sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800 py-3 px-4 md:px-6 flex justify-between items-center">
        <button onClick={triggerExitPrompt} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest">
          <ArrowLeft size={16} /> End Session
        </button>
        <div className="flex items-center gap-4">
          {isFullscreen && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md shadow-inner">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Focus Active</span>
            </div>
          )}
        </div>
      </header>

      {/* --- RESPONSIVE GRID LAYOUT --- */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: THEATER */}
        <div className="w-full lg:w-[65%] xl:w-[70%] flex flex-col gap-5 animate-in fade-in duration-500">
          
          <div ref={playerContainerRef} className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800 group shadow-2xl">
            <iframe 
              ref={iframeRef} 
              src={getEmbedUrl(material.url)}
              className="absolute top-0 left-0 w-full h-full object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={true}
              title={material.title}
            />

            {/* STRICT FOCUS OVERLAY */}
            {!isFullscreen && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center z-20 p-6">
                 <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                    <Zap size={32} className="text-indigo-500" />
                 </div>
                 <h3 className="text-3xl font-extrabold text-zinc-100 mb-2 tracking-tight">Focus Protocol Required</h3>
                 <p className="text-zinc-400 mb-8 text-sm text-center max-w-md font-medium leading-relaxed">
                   XP generation is currently paused. Select a workspace mode to remove distractions and begin mining XP.
                 </p>
                 
                 <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                   <button onClick={enterStudyMode} className="flex-1 flex items-center justify-center gap-4 bg-zinc-100 hover:bg-white text-zinc-900 py-4 px-6 rounded-xl font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                     <BookOpen size={20} />
                     <div className="flex flex-col items-start text-left">
                       <span className="text-sm leading-none mb-1">Study Mode</span>
                       <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Split Screen</span>
                     </div>
                   </button>
                   
                   <button onClick={enterCinemaMode} className="flex-1 flex items-center justify-center gap-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 py-4 px-6 rounded-xl font-bold transition-all hover:scale-105">
                     <MonitorPlay size={20} className="text-zinc-400" />
                     <div className="flex flex-col items-start text-left">
                       <span className="text-sm leading-none mb-1">Cinema</span>
                       <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Video Only</span>
                     </div>
                   </button>
                 </div>
              </div>
            )}
          </div>
          
          {/* Metadata & Checkbox */}
          <div className="bg-[#121214] p-5 md:p-6 rounded-2xl border border-zinc-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shadow-lg">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-zinc-100 leading-tight mb-2 tracking-tight">{material.title}</h2>
              <div className="flex flex-wrap items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                <span className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-md text-indigo-400">{material.topic_name}</span>
                <span className="opacity-50">•</span>
                <span className="text-zinc-500">{material.subject_name}</span>
              </div>
            </div>
            
            <button 
              onClick={toggleCompletion} 
              className={`shrink-0 w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border shadow-sm ${
                isCompleted 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              <Check size={18} /> 
              {isCompleted ? 'Module Mastered' : 'Mark as Complete'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: NEURAL NOTES */}
        <div className="w-full lg:w-[35%] xl:w-[30%] flex flex-col">
          <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl flex flex-col h-[400px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 shadow-xl focus-within:border-indigo-500/50 transition-colors duration-300">
            
            <div className="p-5 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/40 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg"><BookOpen className="text-indigo-400" size={16} /></div>
                <h3 className="font-bold text-sm text-zinc-200">Neural Notes</h3>
              </div>
              <button onClick={saveNotes} disabled={isSaving} className="text-zinc-400 hover:text-zinc-100 transition-colors p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                 {isSaving ? <Activity size={14} className="animate-spin"/> : <Save size={14} />} Save
              </button>
            </div>
            
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record your insights, formulas, and friction points here..."
              className="flex-1 w-full bg-transparent text-zinc-300 p-6 resize-none outline-none focus:bg-zinc-900/20 transition-colors leading-relaxed placeholder:text-zinc-600 text-sm custom-scrollbar"
            />
            
          </div>
        </div>

      </main>
    </div>
  );
}
