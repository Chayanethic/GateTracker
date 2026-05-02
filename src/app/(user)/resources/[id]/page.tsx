'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { getUserProfile, upsertUserProgress, addExperiencePoints } from '../../../../lib/dataService';
import toast from 'react-hot-toast';
import { BookOpen, ArrowLeft, Check, Maximize2, MonitorPlay, Save, Database } from 'lucide-react';

export default function FocusRoom() {
  const params = useParams();
  const router = useRouter();
  const videoId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ xp: 0, streak: 0 });
  
  // OPTIMIZATION REFS (Zero DB Spam & Stale Closure Fixes)
  const pendingXpRef = useRef(0);
  const profileRef = useRef(profile);
  const userIdRef = useRef<string | null>(null); // <-- THE FIX: Safely tracks ID for the background saver
  
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

      const { data: matData } = await supabase.from('study_materials').select('*').eq('id', videoId).single();
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
      // THE FIX: We completely removed the background database save from here!
      // XP will now ONLY be saved when the user clicks the "Sync & Exit" button.
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

  // --- 6. EXIT PROTOCOL ---
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

    if (earned > 0 && currentUserId) {
      const newTotal = await addExperiencePoints(currentUserId, earned);
      
      if (newTotal !== null) {
        pendingXpRef.current = 0; 
        setProfile(prev => ({ ...prev, xp: newTotal })); 
        toast.success(`+${earned} XP Secured in Database!`, { 
          style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a', fontSize: '14px' }
        });
      }
    }
    if (material && currentUserId) {
        await upsertUserProgress(currentUserId, material.id, isCompleted, notes);
    }
    
    // THE FIX: Do not use router.push(). Force the browser to completely reload the Hub page.
    window.location.href = '/resources'; 
  };

  const exitWithoutSaving = () => {
    pendingXpRef.current = 0; 
    router.push('/resources');
  };

  if (!material) return <div className="min-h-screen bg-[#09090b] text-zinc-500 flex items-center justify-center font-medium text-sm tracking-wider uppercase">Loading Session...</div>;

  return (
    <div ref={pageContainerRef} className="min-h-screen bg-[#09090b] text-zinc-300 font-sans relative flex flex-col selection:bg-zinc-800 overflow-y-auto">
      
      {/* --- SLEEK EXIT MODAL --- */}
      {showExitPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
             
             <h3 className="text-xl font-semibold text-zinc-100 mb-2 tracking-tight">Session Summary</h3>
             <p className="text-zinc-400 text-sm mb-6">
               You accumulated focus time. Would you like to sync this XP before leaving?
             </p>

             <div className="text-4xl font-semibold text-zinc-100 mb-8 py-2 border-y border-zinc-800/50">
               +{displayXp} <span className="text-lg text-zinc-500 font-medium">XP</span>
             </div>

             <div className="flex flex-col gap-3">
               <button onClick={confirmExitAndClaim} className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                 <Database size={16} /> Sync XP & Exit
               </button>
               <div className="flex gap-3 mt-1">
                 <button onClick={() => setShowExitPrompt(false)} className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-medium py-2.5 rounded-lg transition-colors text-sm">
                   Return
                 </button>
                 <button onClick={exitWithoutSaving} className="flex-1 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 font-medium py-2.5 rounded-lg transition-colors text-sm">
                   Discard
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MINIMALIST HEADER --- */}
      <header className="shrink-0 sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800 py-3 px-4 md:px-6 flex justify-between items-center">
        <button onClick={triggerExitPrompt} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-lg font-medium text-sm">
          <ArrowLeft size={16} /> End Session
        </button>
        <div className="flex items-center gap-4">
          {isFullscreen && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-md">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-xs font-medium text-zinc-300 tracking-wide uppercase">Tracking</span>
            </div>
          )}
        </div>
      </header>

      {/* --- RESPONSIVE GRID LAYOUT --- */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: THEATER */}
        <div className="w-full lg:w-[65%] xl:w-[70%] flex flex-col gap-4 animate-in fade-in duration-500">
          
          <div ref={playerContainerRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 group">
            <iframe 
              ref={iframeRef} 
              src={getEmbedUrl(material.url)}
              className="absolute top-0 left-0 w-full h-full object-cover"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={true}
              title={material.title}
            />

            {/* STRICT FOCUS OVERLAY - Minimalist Version */}
            {!isFullscreen && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-4">
                 <h3 className="text-2xl font-semibold text-zinc-100 mb-2 tracking-tight">Focus Required</h3>
                 <p className="text-zinc-400 mb-6 text-sm text-center max-w-sm">
                   Select a workspace mode to begin tracking time and remove distractions.
                 </p>
                 
                 <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                   <button onClick={enterStudyMode} className="flex-1 flex items-center justify-center gap-3 bg-zinc-100 hover:bg-white text-zinc-900 py-3.5 px-4 rounded-lg font-medium transition-colors">
                     <BookOpen size={18} />
                     <div className="flex flex-col items-start text-left">
                       <span className="text-sm leading-none mb-1">Study Mode</span>
                       <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Split Screen</span>
                     </div>
                   </button>
                   
                   <button onClick={enterCinemaMode} className="flex-1 flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 py-3.5 px-4 rounded-lg font-medium transition-colors">
                     <MonitorPlay size={18} className="text-zinc-400" />
                     <div className="flex flex-col items-start text-left">
                       <span className="text-sm leading-none mb-1">Cinema</span>
                       <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Video Only</span>
                     </div>
                   </button>
                 </div>
              </div>
            )}
          </div>
          
          {/* Metadata & Checkbox */}
          <div className="bg-[#18181b] p-5 md:p-6 rounded-xl border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold text-zinc-100 leading-tight mb-1">{material.title}</h2>
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium">
                <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{material.topic_name}</span>
                <span>•</span>
                <span>{material.subject_name}</span>
              </div>
            </div>
            
            <button 
              onClick={toggleCompletion} 
              className={`shrink-0 w-full sm:w-auto px-5 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border ${
                isCompleted 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              <Check size={16} /> 
              {isCompleted ? 'Completed' : 'Mark Complete'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: NEURAL NOTES */}
        <div className="w-full lg:w-[35%] xl:w-[30%] flex flex-col">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl flex flex-col h-[400px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24">
            
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="text-zinc-400" size={16} />
                <h3 className="font-medium text-sm text-zinc-200">Notes</h3>
              </div>
              <button onClick={saveNotes} disabled={isSaving} className="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700">
                 <Save size={14} />
              </button>
            </div>
            
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record your insights..."
              className="flex-1 w-full bg-transparent text-zinc-300 p-5 resize-none outline-none focus:bg-zinc-900/30 transition-colors leading-relaxed placeholder:text-zinc-600 text-sm custom-scrollbar"
            />
            
          </div>
        </div>

      </main>
    </div>
  );
}