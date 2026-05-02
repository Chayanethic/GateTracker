'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getUserProfile, getUserProgress, getUniqueSubjects, getSubjectSyllabus } from '../../../lib/dataService';
import { 
  Flame, Zap, Activity, ChevronRight, ArrowLeft, BookOpen, 
  LayoutGrid, CheckCircle2, CircleDashed, Play, Clock, 
  Trophy, Sparkles, Target, Loader2, FastForward
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- YOUTUBE THUMBNAIL EXTRACTOR (100% FREE) ---
const getYoutubeThumbnail = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  return (match && match[2].length === 11) ? `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
};

export default function ResourcesHub() {
  const router = useRouter();
  
  // --- CORE STATE ---
  const [profile, setProfile] = useState({ xp: 0, streak: 0 });
  const [progress, setProgress] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- OPTIMIZED CACHING ENGINE ---
  const [syllabusCache, setSyllabusCache] = useState<Record<string, any[]>>({});
  const [isFetchingSyllabus, setIsFetchingSyllabus] = useState(false);
  
  // --- NAVIGATION & SETTINGS ---
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSubjectMaterials, setActiveSubjectMaterials] = useState<any[]>([]);
  const [studyHours, setStudyHours] = useState<number>(4);
  const [playbackSpeed, setPlaybackSpeed] = useState<number | string>(1.25);

  // --- INITIALIZATION (Fixed Streak Fetch) ---
  useEffect(() => {
    let isMounted = true; 
    const loadCoreSystem = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;
      
      const [xpData, { data: dbProfile }, progData, subjs] = await Promise.all([
        getUserProfile(session.user.id),
        supabase.from('user_profiles').select('streak').eq('user_id', session.user.id).maybeSingle(),
        getUserProgress(session.user.id),
        getUniqueSubjects() 
      ]);
      
      if (isMounted) {
        setProfile({ xp: xpData?.xp || 0, streak: dbProfile?.streak || 0 });
        setProgress(progData || []);
        setSubjects(subjs);
        setIsLoading(false);
      }
    };
    loadCoreSystem();
    return () => { isMounted = false; };
  }, []);

  // --- OPTIMIZED DATA FETCHING ---
  const handleSubjectSelect = async (subject: string) => {
    setActiveSubject(subject);
    setActiveTopic(null);

    if (syllabusCache[subject]) {
      setActiveSubjectMaterials(syllabusCache[subject]);
    } else {
      setIsFetchingSyllabus(true);
      const materials = await getSubjectSyllabus(subject);
      setSyllabusCache(prev => ({ ...prev, [subject]: materials }));
      setActiveSubjectMaterials(materials);
      setIsFetchingSyllabus(false);
    }
  };

  // --- SMART TIME FORMATTING ---
  const getMins = (durStr: string) => {
    if (!durStr) return 0;
    const parts = durStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return 0;
  };

  const formatTime = (totalMins: number) => {
    if (totalMins === 0) return '0m';
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // --- PROGRESS CALCULATIONS ---
  const activeSyllabus = useMemo(() => {
    const grouped: any = {};
    activeSubjectMaterials.forEach(mat => {
      if (!grouped[mat.topic_name]) grouped[mat.topic_name] = [];
      grouped[mat.topic_name].push(mat);
    });
    return grouped;
  }, [activeSubjectMaterials]);

  const isComplete = (matId: string) => progress.some(p => p.material_id === matId && p.completed);

  const subjectStats = useMemo(() => {
    let totalMins = 0, completedMins = 0, totalItems = activeSubjectMaterials.length, completedItems = 0;

    activeSubjectMaterials.forEach(mat => {
      const mins = getMins(mat.duration);
      totalMins += mins;
      if (isComplete(mat.id)) { completedMins += mins; completedItems++; }
    });

    const speed = Number(playbackSpeed) || 1;
    const adjustedRemainingMins = Math.max(0, totalMins - completedMins) / speed;
    const daysRequired = Math.ceil(adjustedRemainingMins / 60 / studyHours) || 0;
    const percent = totalMins > 0 ? Math.round((completedMins / totalMins) * 100) : 0;

    return { totalItems, completedItems, percent, daysRequired, totalMins, completedMins };
  }, [activeSubjectMaterials, progress, playbackSpeed, studyHours]);

  // --- INLINE PROGRESS TOGGLE ---
  const handleToggleProgress = async (e: React.MouseEvent, matId: string, currentlyDone: boolean) => {
    e.stopPropagation(); 
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setProgress(prev => {
      if (currentlyDone) return prev.filter(p => p.material_id !== matId);
      return [...prev, { material_id: matId, completed: true }];
    });

    try {
      if (currentlyDone) {
        await supabase.from('user_progress').delete().match({ user_id: session.user.id, material_id: matId });
      } else {
        await supabase.from('user_progress').upsert({ user_id: session.user.id, material_id: matId, completed: true });
        toast.success('Module Mastered!', { icon: '🔥', style: { background: '#121214', color: '#10b981', border: '1px solid #059669', fontSize: '12px' }});
      }
    } catch (err) { console.error("Progress Sync Error", err); }
  };

  if (isLoading) return <div className="min-h-screen bg-[#050505] text-emerald-500 flex items-center justify-center text-xs font-bold tracking-widest uppercase animate-pulse">Syncing Database...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 pb-20 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* COMPACT HEADER */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 py-3 px-4 md:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          {activeSubject && (
            <button onClick={() => { setActiveSubject(null); setActiveSubjectMaterials([]); }} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-zinc-100">
              <ArrowLeft size={16} />
            </button>
          )}
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <LayoutGrid size={18} className="text-emerald-500" /> Syllabus Hub
          </h1>
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900/50 ring-1 ring-white/5 px-2.5 py-1 rounded-lg shadow-inner backdrop-blur-md">
            <Flame className="text-orange-500" size={14} />
            <span className="font-bold text-zinc-200 text-xs">{profile.streak} <span className="text-zinc-500 hidden md:inline font-medium text-[10px]">Days</span></span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-500/10 ring-1 ring-indigo-500/20 px-2.5 py-1 rounded-lg shadow-inner backdrop-blur-md">
            <Zap className="text-indigo-400" size={14} />
            <span className="font-bold text-zinc-200 text-xs">{profile.xp.toLocaleString()} <span className="text-indigo-500/50 hidden md:inline font-medium text-[10px]">XP</span></span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 mt-6 relative z-10">
        {!activeSubject ? (
          /* ========================================= */
          /* SUBJECT GRID                              */
          /* ========================================= */
          <div className="animate-in fade-in zoom-in-[0.98] duration-500 ease-out">
            <div className="mb-6 border-l-2 border-emerald-500 pl-3">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-100 mb-0.5 tracking-tight">Curriculum</h2>
              <p className="text-zinc-500 text-[10px] sm:text-xs font-medium">Select a module to initiate dopamine-optimized learning protocols.</p>
            </div>
            
            {/* RESPONSIVE GRID: 2 cols on mobile, 5 on wide screens */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {subjects.map(subj => (
                <button key={subj} onClick={() => handleSubjectSelect(subj)} className="p-4 sm:p-5 rounded-2xl bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 hover:ring-emerald-500/50 hover:bg-zinc-900/60 transition-all duration-300 text-left flex flex-col gap-3 group hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] relative overflow-hidden hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] -mr-10 -mt-10 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-0"></div>
                  
                  <div className="p-2 sm:p-3 bg-white/5 ring-1 ring-white/10 rounded-xl w-fit group-hover:bg-emerald-500/10 group-hover:ring-emerald-500/30 transition-colors shadow-inner relative z-10">
                    <BookOpen size={18} className="text-zinc-400 group-hover:text-emerald-400 transition-colors sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-sm sm:text-lg font-black text-zinc-100 relative z-10 tracking-tight leading-tight">{subj}</h3>
                  <div className="text-[8px] sm:text-[10px] font-bold text-zinc-500 tracking-widest uppercase group-hover:text-emerald-400 transition-colors flex items-center gap-1 mt-auto relative z-10">
                    Initialize <ChevronRight size={10} className="group-hover:translate-x-1 transition-transform sm:w-3 sm:h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ========================================= */
          /* ACTIVE SUBJECT VIEW                       */
          /* ========================================= */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 sm:space-y-6">
              
             {isFetchingSyllabus ? (
                <div className="h-48 flex flex-col items-center justify-center bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-3xl">
                  <Loader2 className="animate-spin text-emerald-500 mb-3" size={28} />
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Downloading Neural Pathways...</p>
                </div>
             ) : (
                <>
                 {/* COMPACT MASTER DASHBOARD PANEL */}
                 <div className="bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900/80">
                      <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.8)] rounded-r-full" style={{ width: `${subjectStats.percent}%` }}></div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mt-1">
                      <div className="flex-1 relative z-10 w-full">
                        <div className="inline-flex items-center gap-1.5 text-emerald-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-3 bg-emerald-500/10 px-2 py-1 rounded-md ring-1 ring-emerald-500/20">
                          <Activity size={10} className="animate-pulse"/> Chrono-Predictor Active
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-100 mb-2 flex items-center gap-2 tracking-tight">
                          {activeSubject}
                          {subjectStats.percent === 100 && <Trophy className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" size={20} />}
                        </h2>
                        
                        {/* SUBJECT TIME HIGHLIGHT */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                          <div className="bg-black/40 ring-1 ring-white/5 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                             <Clock size={12} className="text-zinc-500"/>
                             <span className="text-xs sm:text-sm font-black text-emerald-400">{formatTime(subjectStats.completedMins)}</span>
                             <span className="text-zinc-600 text-xs">/</span>
                             <span className="text-xs sm:text-sm font-bold text-zinc-400">{formatTime(subjectStats.totalMins)}</span>
                          </div>
                          <div className="text-[10px] sm:text-xs text-zinc-400 font-medium">
                            <span className="text-emerald-400 font-bold">{subjectStats.completedItems}</span> / {subjectStats.totalItems} modules ({subjectStats.percent}%)
                          </div>
                        </div>
                      </div>
                      
                      {/* COMPACT CALCULATOR CONTROLS */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-black/40 p-3 sm:p-4 rounded-xl ring-1 ring-white/5 w-full lg:w-auto shadow-inner relative z-10">
                        <div className="flex-1 sm:flex-none">
                          <label className="text-[8px] sm:text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block">Daily Hrs</label>
                          <input type="number" min="1" max="16" value={studyHours} onChange={e => setStudyHours(Number(e.target.value))} className="w-full sm:w-16 bg-zinc-900/80 ring-1 ring-white/10 rounded-lg p-2 text-center text-zinc-200 text-xs font-bold outline-none focus:ring-emerald-500/50 transition-all shadow-inner" />
                        </div>
                        <div className="flex-1 sm:flex-none">
                          <label className="text-[8px] sm:text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1 block flex items-center gap-1">Speed <FastForward size={8}/></label>
                          {/* CUSTOM SPEED INPUT */}
                          <input type="number" step="0.05" min="0.25" max="4.0" value={playbackSpeed} onChange={e => setPlaybackSpeed(e.target.value)} className="w-full sm:w-20 bg-zinc-900/80 ring-1 ring-white/10 rounded-lg p-2 text-center text-zinc-200 text-xs font-bold outline-none focus:ring-emerald-500/50 transition-all shadow-inner" />
                        </div>
                        <div className="pl-3 sm:pl-4 border-l border-white/10 text-right min-w-[60px] sm:min-w-[70px]">
                          <div className="text-xl sm:text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] leading-none">{subjectStats.daysRequired}</div>
                          <div className="text-[7px] sm:text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Days Left</div>
                        </div>
                      </div>
                    </div>
                 </div>

                 {/* SYLLABUS TOPICS (COMPACT GRID LAYOUT) */}
                 <div className="space-y-4">
                  {Object.keys(activeSyllabus).map(topic => {
                    const topicVideos = activeSyllabus[topic];
                    
                    const tTotalMins = topicVideos.reduce((acc: number, v: any) => acc + getMins(v.duration), 0);
                    const tCompletedMins = topicVideos.reduce((acc: number, v: any) => isComplete(v.id) ? acc + getMins(v.duration) : acc, 0);
                    const tPercent = tTotalMins > 0 ? Math.round((tCompletedMins / tTotalMins) * 100) : 0;
                    
                    const speed = Number(playbackSpeed) || 1;
                    const tAdjustedRemainingMins = Math.max(0, tTotalMins - tCompletedMins) / speed;
                    const tDaysRequired = Math.ceil(tAdjustedRemainingMins / 60 / studyHours) || 0;
                    const isFullyMastered = tPercent === 100;

                    return (
                      <div key={topic} className={`bg-zinc-900/30 backdrop-blur-md ring-1 rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500 shadow-lg ${isFullyMastered ? 'ring-emerald-500/30 bg-emerald-500/5' : 'ring-white/10'}`}>
                        
                        {/* COMPACT TOPIC ACCORDION HEADER */}
                        <button onClick={() => setActiveTopic(activeTopic === topic ? null : topic)} className="w-full flex justify-between items-center p-3 sm:p-5 text-left hover:bg-white/[0.02] transition-colors relative group">
                          <div className="absolute bottom-0 left-0 h-[2px] bg-white/5 w-full">
                             <div className="h-full bg-emerald-500 transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${tPercent}%` }}></div>
                          </div>
                          
                          <div className="flex-1 pr-3 sm:pr-4">
                            <span className={`font-black text-base sm:text-lg md:text-xl transition-colors tracking-tight leading-tight ${isFullyMastered ? 'text-emerald-400' : 'text-zinc-100'}`}>
                              {topic}
                            </span>
                            <div className="text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
                               
                               {/* TOPIC TIME HIGHLIGHT */}
                               <span className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 sm:py-1 rounded border border-white/5">
                                 <Clock size={10} className="text-zinc-500"/> 
                                 <span className="text-emerald-400 font-bold">{formatTime(tCompletedMins)}</span> 
                                 <span className="text-zinc-600">/</span>
                                 <span className="font-semibold text-zinc-400">{formatTime(tTotalMins)}</span>
                               </span>
                               
                               {!isFullyMastered && tDaysRequired > 0 && (
                                  <span className="flex items-center gap-1 text-zinc-400 bg-black/40 px-2 py-0.5 sm:py-1 rounded border border-white/5">
                                    <Activity size={10}/> {tDaysRequired} Day{tDaysRequired > 1 ? 's' : ''} at {speed}x
                                  </span>
                               )}

                               {isFullyMastered && (
                                 <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 sm:py-1 rounded border border-emerald-500/20 shadow-inner font-bold">
                                   <Sparkles size={10}/> Mastered
                                 </span>
                               )}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded-full transition-all duration-300 ${activeTopic === topic ? 'bg-white/10 rotate-90 text-zinc-100' : 'bg-transparent text-zinc-500'}`}>
                             <ChevronRight size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        </button>
                        
                        {/* RESPONSIVE MICRO-GRID (2 cols on mobile, up to 5 on wide screens) */}
                        {activeTopic === topic && (
                          <div className="p-3 sm:p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 bg-black/20 border-t border-white/5">
                            {topicVideos.map((mat: any) => {
                              const isDone = isComplete(mat.id);
                              const thumbUrl = getYoutubeThumbnail(mat.url);
                              
                              return (
                                <div key={mat.id} 
                                  onClick={() => router.push(`/resources/${mat.id}`)}
                                  className={`group relative flex flex-col rounded-xl overflow-hidden ring-1 transition-all duration-300 cursor-pointer shadow-md hover:-translate-y-1 ${
                                    isDone ? 'bg-black/60 ring-emerald-500/30' : 'bg-zinc-900/60 ring-white/10 hover:ring-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                                  }`}
                                >
                                  {/* COMPACT THUMBNAIL */}
                                  <div className="relative w-full aspect-video bg-zinc-950 overflow-hidden shrink-0">
                                    {thumbUrl ? (
                                      <img src={thumbUrl} alt={mat.title} className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isDone ? 'opacity-40 grayscale-[60%]' : 'group-hover:scale-105 opacity-90 group-hover:opacity-100'}`} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700"><Play size={20} /></div>
                                    )}
                                    
                                    {isDone && (
                                      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[1px] flex items-center justify-center">
                                        <div className="bg-emerald-500 text-zinc-950 p-1.5 sm:p-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)]">
                                           <CheckCircle2 size={20} className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
                                        </div>
                                      </div>
                                    )}

                                    {!isDone && (
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-full flex items-center justify-center text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.8)] transform scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
                                          <Play size={14} className="ml-0.5 sm:ml-1 w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" />
                                        </div>
                                      </div>
                                    )}

                                    <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 bg-black/80 backdrop-blur-md px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold text-zinc-200 border border-white/10 shadow-sm">
                                      {mat.duration || '0:00'}
                                    </div>
                                  </div>

                                  {/* COMPACT INFO AREA */}
                                  <div className="p-2 sm:p-3 flex gap-1.5 sm:gap-2 items-start flex-1 bg-gradient-to-b from-transparent to-black/40">
                                    <button 
                                      onClick={(e) => handleToggleProgress(e, mat.id, isDone)}
                                      className="shrink-0 mt-0.5 transition-transform hover:scale-110 active:scale-95 z-10 relative"
                                    >
                                      {isDone ? (
                                        <CheckCircle2 size={14} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                      ) : (
                                        <CircleDashed size={14} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                                      )}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`text-[10px] sm:text-xs font-bold line-clamp-2 leading-tight transition-colors ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-200 group-hover:text-emerald-50'}`}>
                                        {mat.title}
                                      </h4>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                 </div>
                </>
             )}
          </div>
        )}
      </main>
    </div>
  );
}