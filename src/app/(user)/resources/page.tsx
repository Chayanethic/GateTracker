'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { getUserProfile, getUserProgress, getUniqueSubjects, getSubjectSyllabus, syncDailyLectureCompletion } from '../../../lib/dataService';
import { 
  Flame, Zap, Activity, ChevronRight, ArrowLeft, BookOpen, 
  LayoutGrid, CheckCircle2, CircleDashed, Play, Clock, 
  Trophy, Sparkles, Target, Loader2, FastForward, Lock,
  Sun, Moon, Hash, FileVideo, Crown
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- YOUTUBE THUMBNAIL EXTRACTOR (100% FREE) --- kept for potential future use
const getYoutubeThumbnail = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  return (match && match[2].length === 11) ? `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
};

// --- THEME TOKENS (LIGHT = DEFAULT "DAY" MODE) ---
const LIGHT = {
  page: 'bg-zinc-50 text-zinc-800',
  blob: 'opacity-0',
  headerBg: 'bg-white/90 backdrop-blur-xl border-b border-zinc-200',
  headerTitle: 'text-zinc-900',
  headerIcon: 'text-emerald-600',
  backBtn: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900',
  streakBg: 'bg-white ring-1 ring-zinc-200',
  xpBg: 'bg-indigo-50 ring-1 ring-indigo-200',
  themeToggleBg: 'bg-zinc-100 hover:bg-zinc-200 ring-1 ring-zinc-200 text-amber-500',
  sectionHeading: 'text-zinc-900',
  sectionSub: 'text-zinc-500',
  subjectCardBg: 'bg-white ring-1 ring-zinc-200 hover:ring-emerald-400 hover:bg-emerald-50/40',
  subjectIconBg: 'bg-zinc-100 ring-1 ring-zinc-200 group-hover:bg-emerald-100 group-hover:ring-emerald-300',
  subjectIconText: 'text-zinc-500 group-hover:text-emerald-600',
  subjectTitle: 'text-zinc-900',
  subjectCta: 'text-zinc-500 group-hover:text-emerald-600',
  loaderBg: 'bg-white ring-1 ring-zinc-200',
  loaderText: 'text-zinc-500',
  panelBg: 'bg-white ring-1 ring-zinc-200 shadow-sm',
  progressTrackBg: 'bg-zinc-200',
  chipBg: 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700',
  subjectTitleBig: 'text-zinc-900',
  statPill: 'bg-zinc-100 ring-1 ring-zinc-200',
  statPillLabel: 'text-zinc-500',
  controlsBg: 'bg-zinc-100 ring-1 ring-zinc-200',
  inputBg: 'bg-white ring-1 ring-zinc-300 text-zinc-800 focus:ring-emerald-400',
  daysBig: 'text-emerald-600',
  daysLabel: 'text-zinc-500',
  topicCardBg: 'bg-white ring-1 ring-zinc-200 shadow-sm',
  topicCardMasteredBg: 'ring-emerald-400 bg-emerald-50/50',
  topicHeaderHover: 'hover:bg-zinc-50',
  topicTrackBg: 'bg-zinc-200',
  topicTitle: 'text-zinc-900',
  topicTitleMastered: 'text-emerald-700',
  topicMetaPill: 'bg-zinc-100 ring-1 ring-zinc-200 text-zinc-500',
  topicMasteredPill: 'bg-emerald-100 ring-1 ring-emerald-300 text-emerald-700',
  chevronBg: 'text-zinc-400',
  chevronBgActive: 'bg-zinc-100 text-zinc-900',
  listBg: 'bg-zinc-50/60 border-t border-zinc-200',
  rowBg: 'bg-white ring-1 ring-zinc-200 hover:ring-emerald-300 hover:shadow-md',
  rowBgDone: 'bg-zinc-50 ring-1 ring-emerald-200',
  rowBgLocked: 'bg-amber-50/60 ring-1 ring-amber-200',
  rowIconBg: 'bg-indigo-50 text-indigo-600',
  rowIconBgLocked: 'bg-amber-100 text-amber-600',
  rowTitle: 'text-zinc-800',
  rowTitleDone: 'text-zinc-400 line-through',
  rowSub: 'text-zinc-500',
  watchBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  lockedBtn: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
  lecBadge: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200',
  paidBadge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
  checkOn: 'text-emerald-500',
  checkOff: 'text-zinc-300 group-hover:text-emerald-400',
};

const DARK = {
  page: 'bg-[#050505] text-zinc-300',
  blob: 'opacity-100',
  headerBg: 'bg-zinc-950/80 backdrop-blur-xl border-b border-white/5',
  headerTitle: 'text-zinc-100',
  headerIcon: 'text-emerald-500',
  backBtn: 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-100',
  streakBg: 'bg-zinc-900/50 ring-1 ring-white/5',
  xpBg: 'bg-indigo-500/10 ring-1 ring-indigo-500/20',
  themeToggleBg: 'bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-indigo-300',
  sectionHeading: 'text-zinc-100',
  sectionSub: 'text-zinc-500',
  subjectCardBg: 'bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 hover:ring-emerald-500/50 hover:bg-zinc-900/60',
  subjectIconBg: 'bg-white/5 ring-1 ring-white/10 group-hover:bg-emerald-500/10 group-hover:ring-emerald-500/30',
  subjectIconText: 'text-zinc-400 group-hover:text-emerald-400',
  subjectTitle: 'text-zinc-100',
  subjectCta: 'text-zinc-500 group-hover:text-emerald-400',
  loaderBg: 'bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10',
  loaderText: 'text-zinc-500',
  panelBg: 'bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl',
  progressTrackBg: 'bg-zinc-900/80',
  chipBg: 'bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400',
  subjectTitleBig: 'text-zinc-100',
  statPill: 'bg-black/40 ring-1 ring-white/5',
  statPillLabel: 'text-zinc-500',
  controlsBg: 'bg-black/40 ring-1 ring-white/5',
  inputBg: 'bg-zinc-900/80 ring-1 ring-white/10 text-zinc-200 focus:ring-emerald-500/50',
  daysBig: 'text-emerald-400',
  daysLabel: 'text-zinc-500',
  topicCardBg: 'bg-zinc-900/30 backdrop-blur-md ring-1 ring-white/10 shadow-lg',
  topicCardMasteredBg: 'ring-emerald-500/30 bg-emerald-500/5',
  topicHeaderHover: 'hover:bg-white/[0.02]',
  topicTrackBg: 'bg-white/5',
  topicTitle: 'text-zinc-100',
  topicTitleMastered: 'text-emerald-400',
  topicMetaPill: 'bg-black/40 border border-white/5 text-zinc-500',
  topicMasteredPill: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
  chevronBg: 'text-zinc-500',
  chevronBgActive: 'bg-white/10 text-zinc-100',
  listBg: 'bg-black/20 border-t border-white/5',
  rowBg: 'bg-zinc-900/60 ring-1 ring-white/10 hover:ring-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  rowBgDone: 'bg-black/60 ring-1 ring-emerald-500/30',
  rowBgLocked: 'bg-amber-500/[0.06] ring-1 ring-amber-500/20',
  rowIconBg: 'bg-indigo-500/10 text-indigo-400',
  rowIconBgLocked: 'bg-amber-500/10 text-amber-400',
  rowTitle: 'text-zinc-200',
  rowTitleDone: 'text-zinc-600 line-through',
  rowSub: 'text-zinc-500',
  watchBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  lockedBtn: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30',
  lecBadge: 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700',
  paidBadge: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30',
  checkOn: 'text-emerald-500',
  checkOff: 'text-zinc-500 group-hover:text-emerald-400',
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

  // --- THEME STATE (default = DARK / NIGHT MODE) ---
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('resourcesHubTheme') : null;
    if (saved === 'dark') setIsDark(true);
    else if (saved === 'light') setIsDark(false);
    // if nothing saved, default stays dark (night mode)
  }, []);
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') window.localStorage.setItem('resourcesHubTheme', next ? 'dark' : 'light');
      return next;
    });
  };
  const T = isDark ? DARK : LIGHT;

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
    // Sort each topic's videos by lecture_no (falls back to original insertion order)
    Object.keys(grouped).forEach(topic => {
      grouped[topic] = [...grouped[topic]].sort((a: any, b: any) => {
        const an = a.lecture_no ?? Number.MAX_SAFE_INTEGER;
        const bn = b.lecture_no ?? Number.MAX_SAFE_INTEGER;
        return an - bn;
      });
    });
    return grouped;
  }, [activeSubjectMaterials]);

  const isComplete = (matId: string) => progress.some(p => p.material_id === matId && p.completed);
  const isLockedPaid = (mat: any) => !!mat.is_paid; // Paid lectures are always locked/unopenable in the student view

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
      const material = activeSubjectMaterials.find((m: any) => m.id === matId);

      if (currentlyDone) {
        await supabase.from('user_progress').delete().match({ user_id: session.user.id, material_id: matId });
        if (material) await syncDailyLectureCompletion(session.user.id, material, false);
      } else {
        await supabase.from('user_progress').upsert({ user_id: session.user.id, material_id: matId, completed: true });
        if (material) await syncDailyLectureCompletion(session.user.id, material, true);
        toast.success('Module Mastered!', { icon: '🔥', style: { background: '#121214', color: '#10b981', border: '1px solid #059669', fontSize: '12px' }});
      }
    } catch (err) { console.error("Progress Sync Error", err); }
  };

  const handleOpenMaterial = (mat: any) => {
    if (isLockedPaid(mat)) {
      toast('This is a paid lecture — locked for now.', { icon: '🔒', style: { background: isDark ? '#121214' : '#fff', color: '#d97706', border: '1px solid #f59e0b' }});
      return;
    }
    router.push(`/resources/${mat.id}`);
  };

  if (isLoading) return <div className={`min-h-screen ${T.page} flex items-center justify-center text-xs font-bold tracking-widest uppercase animate-pulse`}>Syncing Database...</div>;

  return (
    <div className={`min-h-screen ${T.page} font-sans selection:bg-emerald-500/30 pb-20 relative overflow-hidden transition-colors duration-300`}>
      <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none transition-opacity duration-500 ${T.blob}`}></div>

      {/* COMPACT HEADER */}
      <header className={`sticky top-0 z-40 ${T.headerBg} py-3 px-4 md:px-8 flex justify-between items-center shadow-sm`}>
        <div className="flex items-center gap-3">
          {activeSubject && (
            <button onClick={() => { setActiveSubject(null); setActiveSubjectMaterials([]); }} className={`p-1.5 ${T.backBtn} rounded-full transition-colors`}>
              <ArrowLeft size={16} />
            </button>
          )}
          <h1 className={`text-base sm:text-lg font-bold tracking-tight ${T.headerTitle} flex items-center gap-2`}>
            <LayoutGrid size={18} className={T.headerIcon} /> Syllabus Hub
          </h1>
        </div>
        
        <div className="flex gap-2 items-center">
          <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${T.themeToggleBg}`} title={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}>
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <div className={`flex items-center gap-1.5 ${T.streakBg} px-2.5 py-1 rounded-lg shadow-inner backdrop-blur-md`}>
            <Flame className="text-orange-500" size={14} />
            <span className={`font-bold text-xs ${T.headerTitle}`}>{profile.streak} <span className="text-zinc-500 hidden md:inline font-medium text-[10px]">Days</span></span>
          </div>
          <div className={`flex items-center gap-1.5 ${T.xpBg} px-2.5 py-1 rounded-lg shadow-inner backdrop-blur-md`}>
            <Zap className="text-indigo-400" size={14} />
            <span className={`font-bold text-xs ${T.headerTitle}`}>{profile.xp.toLocaleString()} <span className="text-indigo-500/60 hidden md:inline font-medium text-[10px]">XP</span></span>
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
              <h2 className={`text-xl sm:text-2xl md:text-3xl font-black mb-0.5 tracking-tight ${T.sectionHeading}`}>Curriculum</h2>
              <p className={`text-[10px] sm:text-xs font-medium ${T.sectionSub}`}>Select a module to initiate dopamine-optimized learning protocols.</p>
            </div>
            
            {/* RESPONSIVE GRID: 2 cols on mobile, 5 on wide screens */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
              {subjects.map(subj => (
                <button key={subj} onClick={() => handleSubjectSelect(subj)} className={`p-4 sm:p-5 rounded-2xl ${T.subjectCardBg} transition-all duration-300 text-left flex flex-col gap-3 group relative overflow-hidden hover:-translate-y-1`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] -mr-10 -mt-10 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-0"></div>
                  
                  <div className={`p-2 sm:p-3 ${T.subjectIconBg} rounded-xl w-fit transition-colors shadow-inner relative z-10`}>
                    <BookOpen size={18} className={`${T.subjectIconText} transition-colors sm:w-6 sm:h-6`} />
                  </div>
                  <h3 className={`text-sm sm:text-lg font-black relative z-10 tracking-tight leading-tight ${T.subjectTitle}`}>{subj}</h3>
                  <div className={`text-[8px] sm:text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-1 mt-auto relative z-10 ${T.subjectCta}`}>
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
                <div className={`h-48 flex flex-col items-center justify-center ${T.loaderBg} rounded-3xl`}>
                  <Loader2 className="animate-spin text-emerald-500 mb-3" size={28} />
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${T.loaderText}`}>Downloading Neural Pathways...</p>
                </div>
             ) : (
                <>
                 {/* COMPACT MASTER DASHBOARD PANEL */}
                 <div className={`${T.panelBg} rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden group`}>
                    <div className={`absolute top-0 left-0 w-full h-1 ${T.progressTrackBg}`}>
                      <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.8)] rounded-r-full" style={{ width: `${subjectStats.percent}%` }}></div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 mt-1">
                      <div className="flex-1 relative z-10 w-full">
                        <div className={`inline-flex items-center gap-1.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-3 ${T.chipBg} px-2 py-1 rounded-md`}>
                          <Activity size={10} className="animate-pulse"/> Chrono-Predictor Active
                        </div>
                        <h2 className={`text-xl sm:text-2xl md:text-3xl font-black mb-2 flex items-center gap-2 tracking-tight ${T.subjectTitleBig}`}>
                          {activeSubject}
                          {subjectStats.percent === 100 && <Trophy className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" size={20} />}
                        </h2>
                        
                        {/* SUBJECT TIME HIGHLIGHT */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3">
                          <div className={`${T.statPill} px-2.5 py-1.5 rounded-lg flex items-center gap-2`}>
                             <Clock size={12} className="text-zinc-500"/>
                             <span className="text-xs sm:text-sm font-black text-emerald-500">{formatTime(subjectStats.completedMins)}</span>
                             <span className="text-zinc-400 text-xs">/</span>
                             <span className={`text-xs sm:text-sm font-bold ${T.headerTitle}`}>{formatTime(subjectStats.totalMins)}</span>
                          </div>
                          <div className={`text-[10px] sm:text-xs font-medium ${T.statPillLabel}`}>
                            <span className="text-emerald-500 font-bold">{subjectStats.completedItems}</span> / {subjectStats.totalItems} modules ({subjectStats.percent}%)
                          </div>
                        </div>
                      </div>
                      
                      {/* COMPACT CALCULATOR CONTROLS */}
                      <div className={`flex flex-wrap sm:flex-nowrap items-center gap-3 ${T.controlsBg} p-3 sm:p-4 rounded-xl w-full lg:w-auto shadow-inner relative z-10`}>
                        <div className="flex-1 sm:flex-none">
                          <label className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mb-1 block ${T.statPillLabel}`}>Daily Hrs</label>
                          <input type="number" min="1" max="16" value={studyHours} onChange={e => setStudyHours(Number(e.target.value))} className={`w-full sm:w-16 ${T.inputBg} rounded-lg p-2 text-center text-xs font-bold outline-none transition-all shadow-inner`} />
                        </div>
                        <div className="flex-1 sm:flex-none">
                          <label className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mb-1 block flex items-center gap-1 ${T.statPillLabel}`}>Speed <FastForward size={8}/></label>
                          <input type="number" step="0.05" min="0.25" max="4.0" value={playbackSpeed} onChange={e => setPlaybackSpeed(e.target.value)} className={`w-full sm:w-20 ${T.inputBg} rounded-lg p-2 text-center text-xs font-bold outline-none transition-all shadow-inner`} />
                        </div>
                        <div className="pl-3 sm:pl-4 border-l border-zinc-300/50 text-right min-w-[60px] sm:min-w-[70px]">
                          <div className={`text-xl sm:text-2xl font-black leading-none ${T.daysBig}`}>{subjectStats.daysRequired}</div>
                          <div className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-widest mt-1 ${T.daysLabel}`}>Days Left</div>
                        </div>
                      </div>
                    </div>
                 </div>

                 {/* SYLLABUS TOPICS */}
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
                      <div key={topic} className={`${T.topicCardBg} rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500 ${isFullyMastered ? T.topicCardMasteredBg : ''}`}>
                        
                        {/* TOPIC ACCORDION HEADER */}
                        <button onClick={() => setActiveTopic(activeTopic === topic ? null : topic)} className={`w-full flex justify-between items-center p-3 sm:p-5 text-left ${T.topicHeaderHover} transition-colors relative group`}>
                          <div className={`absolute bottom-0 left-0 h-[2px] ${T.topicTrackBg} w-full`}>
                             <div className="h-full bg-emerald-500 transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${tPercent}%` }}></div>
                          </div>
                          
                          <div className="flex-1 pr-3 sm:pr-4">
                            <span className={`font-black text-base sm:text-lg md:text-xl transition-colors tracking-tight leading-tight ${isFullyMastered ? T.topicTitleMastered : T.topicTitle}`}>
                              {topic}
                            </span>
                            <div className={`text-[9px] sm:text-[10px] font-medium mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3 ${T.sectionSub}`}>
                               
                               <span className={`flex items-center gap-1.5 ${T.topicMetaPill} px-2 py-0.5 sm:py-1 rounded`}>
                                 <Clock size={10} className="text-zinc-500"/> 
                                 <span className="text-emerald-500 font-bold">{formatTime(tCompletedMins)}</span> 
                                 <span className="text-zinc-400">/</span>
                                 <span className="font-semibold">{formatTime(tTotalMins)}</span>
                               </span>
                               
                               {!isFullyMastered && tDaysRequired > 0 && (
                                  <span className={`flex items-center gap-1 ${T.topicMetaPill} px-2 py-0.5 sm:py-1 rounded`}>
                                    <Activity size={10}/> {tDaysRequired} Day{tDaysRequired > 1 ? 's' : ''} at {speed}x
                                  </span>
                               )}

                               {isFullyMastered && (
                                 <span className={`flex items-center gap-1 ${T.topicMasteredPill} px-2 py-0.5 sm:py-1 rounded font-bold`}>
                                   <Sparkles size={10}/> Mastered
                                 </span>
                               )}
                            </div>
                          </div>
                          <div className={`p-1 sm:p-1.5 rounded-full transition-all duration-300 ${activeTopic === topic ? `rotate-90 ${T.chevronBgActive}` : `bg-transparent ${T.chevronBg}`}`}>
                             <ChevronRight size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        </button>
                        
                        {/* LECTURE LIST (row style) */}
                        {activeTopic === topic && (
                          <div className={`p-3 sm:p-5 flex flex-col gap-2.5 sm:gap-3 ${T.listBg}`}>
                            {topicVideos.map((mat: any, idx: number) => {
                              const isDone = isComplete(mat.id);
                              const locked = isLockedPaid(mat);
                              const lecNo = mat.lecture_no ?? (idx + 1);

                              return (
                                <div
                                  key={mat.id}
                                  onClick={() => handleOpenMaterial(mat)}
                                  className={`group relative flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 transition-all duration-300
                                    ${locked ? `${T.rowBgLocked} cursor-not-allowed` : isDone ? `${T.rowBgDone} cursor-pointer` : `${T.rowBg} cursor-pointer hover:-translate-y-0.5`}
                                  `}
                                >
                                  {/* COMPLETION CHECKBOX (works for paid/locked lectures too) */}
                                  <button
                                    onClick={(e) => handleToggleProgress(e, mat.id, isDone)}
                                    className="shrink-0 transition-transform hover:scale-110 active:scale-95 z-10 relative"
                                  >
                                    {isDone ? (
                                      <CheckCircle2 size={18} className={T.checkOn} />
                                    ) : (
                                      <CircleDashed size={18} className={T.checkOff} />
                                    )}
                                  </button>

                                  {/* ICON BOX */}
                                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${locked ? T.rowIconBgLocked : T.rowIconBg}`}>
                                    {locked ? <Lock size={16} /> : <FileVideo size={16} />}
                                  </div>

                                  {/* TITLE + META */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-xs sm:text-sm font-bold leading-snug ${isDone ? T.rowTitleDone : T.rowTitle}`}>
                                      {lecNo}. {mat.title}
                                    </h4>
                                    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-[9px] sm:text-[10px] font-semibold ${T.rowSub}`}>
                                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${T.lecBadge}`}>
                                        <Hash size={9}/> Lec {lecNo}
                                      </span>
                                      <span>{topic}</span>
                                      {mat.duration && (
                                        <span className="flex items-center gap-1">
                                          <Clock size={10}/> {mat.duration}
                                        </span>
                                      )}
                                      {locked && (
                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold ${T.paidBadge}`}>
                                          <Crown size={9}/> Paid
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* ACTION BUTTON */}
                                  <div className="shrink-0">
                                    {locked ? (
                                      <span className={`text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center gap-1.5 ${T.lockedBtn}`}>
                                        <Lock size={11}/> Locked
                                      </span>
                                    ) : (
                                      <span className={`text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center gap-1.5 transition-colors ${T.watchBtn}`}>
                                        <Play size={11} fill="currentColor"/> Watch
                                      </span>
                                    )}
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
