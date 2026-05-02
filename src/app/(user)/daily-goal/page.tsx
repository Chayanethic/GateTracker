'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Clock, BookOpen, Target, Zap, Activity, 
  ChevronRight, ChevronLeft, ArrowLeft, CheckCircle2, CircleDashed, Play, 
  Printer, History, Trash2, AlertTriangle, FileText, Sparkles, Lock, X, ChevronDown, ChevronUp, Link as LinkIcon, Flame, Search, ShieldAlert
} from 'lucide-react';

export default function DailyGoalTracker() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  
  // --- TIMEZONE UTILS ---
  const getISTNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const getISTDateString = (date: Date) => {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayISTStr = getISTDateString(getISTNow());

  const formatTime = (totalMins: number) => {
    const h = Math.floor(totalMins / 60); const m = Math.round(totalMins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // --- STATE ---
  const [profile, setProfile] = useState({ streak: 0, xp: 0 });
  const [selectedDate, setSelectedDate] = useState<string>(todayISTStr);
  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [dailyBlocks, setDailyBlocks] = useState<any[]>([]);
  const [globalProgress, setGlobalProgress] = useState<Set<string>>(new Set());
  const [allTracking, setAllTracking] = useState<Record<string, number>>({});
  
  // UI States
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(getISTNow());
  const [celebratingTask, setCelebratingTask] = useState<string | null>(null);

  // Irreversible Task Completion State
  const [taskToConfirm, setTaskToConfirm] = useState<any>(null);
  const [isLockingTask, setIsLockingTask] = useState(false);

  // Journal States
  const [dailyNote, setDailyNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [noteSearchDate, setNoteSearchDate] = useState<string>('');
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Vault States
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [recentGoals, setRecentGoals] = useState<any[]>([]);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    let isMounted = true;
    const fetchDailyData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;

      // Fetch Profile
      const { data: pData } = await supabase.from('user_profiles').select('streak, xp').eq('user_id', session.user.id).single();
      if (pData) setProfile({ streak: pData.streak || 0, xp: pData.xp || 0 });

      // Fetch Progress
      const { data: progData } = await supabase.from('user_progress').select('material_id').eq('user_id', session.user.id);
      if (progData) setGlobalProgress(new Set(progData.map(p => p.material_id)));

      // Fetch Active Goal
      const { data: goalData } = await supabase.from('study_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .lte('start_date', selectedDate)
        .gte('target_date', selectedDate)
        .order('created_at', { ascending: false })
        .limit(1).single();

      if (goalData) {
        setActiveGoal(goalData);
        setDailyBlocks(goalData.routine_data[selectedDate] || []);
        setCalendarMonth(new Date(goalData.start_date));
      } else {
        setActiveGoal(null);
        setDailyBlocks([]);
      }

      // Fetch Tracking Data
      const { data: allTrackingData } = await supabase.from('daily_tracking').select('date_str, completion_percent, notes').eq('user_id', session.user.id);
      if (allTrackingData) {
        const trackingMap: Record<string, number> = {};
        allTrackingData.forEach(t => { trackingMap[t.date_str] = t.completion_percent; });
        setAllTracking(trackingMap);
        
        const todayNote = allTrackingData.find(t => t.date_str === selectedDate)?.notes || '';
        setDailyNote(todayNote);
      } else {
        setDailyNote('');
      }

      setIsLoading(false);
    };

    fetchDailyData();
    return () => { isMounted = false; };
  }, [selectedDate]);

  // --- STATS CALCULATION ---
  const isPastDate = selectedDate < todayISTStr;
  
  const dailyStats = useMemo(() => {
    let totalMins = 0; let completedMins = 0;
    dailyBlocks.forEach(block => {
      block.tasks.forEach((task: any) => {
        const taskMins = task.minsAllocated || task.durationMins || 0;
        totalMins += taskMins;
        if (globalProgress.has(task.originalId || task.id)) completedMins += taskMins;
      });
    });
    return { totalMins, completedMins, percent: totalMins === 0 ? 0 : Math.round((completedMins / totalMins) * 100) };
  }, [dailyBlocks, globalProgress]);

  const goalStats = useMemo(() => {
    if (!activeGoal) return null;
    let totalMins = 0; let completedMins = 0;
    const topics = new Set<string>();
    const subjects = new Set<string>();

    Object.values(activeGoal.routine_data).forEach((blocks: any) => {
      blocks.forEach((b: any) => {
        b.tasks.forEach((t: any) => {
          const taskMins = t.minsAllocated || t.durationMins || 0;
          totalMins += taskMins;
          if (t.topic !== 'Mixed Content') { topics.add(t.topic); subjects.add(t.subject); }
          if (globalProgress.has(t.originalId || t.id)) completedMins += taskMins;
        });
      });
    });

    const days = Math.max(1, Math.round((new Date(activeGoal.target_date).getTime() - new Date(activeGoal.start_date).getTime()) / (1000 * 3600 * 24)) + 1);
    return { 
      totalMins, completedMins, days, subjects: Array.from(subjects), topics: Array.from(topics),
      percent: totalMins === 0 ? 0 : Math.round((completedMins / totalMins) * 100) 
    };
  }, [activeGoal, globalProgress]);

  // --- ACTIONS: IRREVERSIBLE PROGRESS & BULLETPROOF STREAK ---
  
  const initiateTaskCompletion = (task: any, isCurrentlyDone: boolean) => {
    if (isPastDate) return toast.error("Record locked. Cannot alter past routines.", { style: {background:'#121214', color:'#ef4444'} });
    if (isCurrentlyDone) return toast.error("Task already locked. Neural pathways cannot be reversed.", { style: {background:'#121214', color:'#a1a1aa'} });
    setTaskToConfirm(task);
  };

  const executeTaskCompletion = async () => {
    if (!taskToConfirm) return;
    setIsLockingTask(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsLockingTask(false); return; }
    
    const targetId = taskToConfirm.originalId || taskToConfirm.id;

    try {
      // 1. Lock Task in Database
      await supabase.from('user_progress').upsert({ user_id: session.user.id, material_id: targetId, completed: true });
      
      // 2. Predict the EXACT next state
      const nextProgress = new Set(globalProgress);
      nextProgress.add(targetId);
      
      // 3. Recalculate true completed percentage using the future state
      let exactCompletedMins = 0;
      let exactTotalMins = 0;
      dailyBlocks.forEach(block => {
        block.tasks.forEach((t: any) => {
          const tMins = t.minsAllocated || t.durationMins || 0;
          exactTotalMins += tMins;
          if (nextProgress.has(t.originalId || t.id)) {
            exactCompletedMins += tMins;
          }
        });
      });
      const newPercent = exactTotalMins === 0 ? 0 : Math.round((exactCompletedMins / exactTotalMins) * 100);

      // Update local state instantly to feel snappy
      setGlobalProgress(nextProgress);
      setCelebratingTask(taskToConfirm.id);
      
      // 4. Lock Daily Percentage instantly so calendar strip updates
      await supabase.from('daily_tracking').upsert({ user_id: session.user.id, date_str: selectedDate, completion_percent: newPercent });
      setAllTracking(prev => ({...prev, [selectedDate]: newPercent}));

      // 5. BULLETPROOF STREAK ENGINE (XP REMOVED)
      if (newPercent === 100 && dailyStats.percent < 100) {
         // Fetch fresh data so we never accidentally reset to 0
         const { data: existingProfile } = await supabase.from('user_profiles').select('*').eq('user_id', session.user.id).single();
         const freshStreak = (existingProfile?.streak || 0) + 1;
         
         await supabase.from('user_profiles').upsert({
            user_id: session.user.id,
            streak: freshStreak,
            updated_at: new Date().toISOString()
         });
         
         setProfile(prev => ({ ...prev, streak: freshStreak }));
         toast.success(`PERFECT DAY! STREAK INCREASED TO ${freshStreak} 🔥`, { 
            duration: 4000, 
            style: {background:'#121214', color:'#3b82f6', border:'1px solid #2563eb', padding: '16px', fontWeight: 'bold'} 
         });
      } else {
         toast.success("Target Locked!", { icon: '🎯', style: {background:'#121214', color:'#10b981', border:'1px solid #059669'} });
      }

      setTimeout(() => setCelebratingTask(null), 2000);
    } catch (e) { 
      toast.error("Critical Sync Failure"); 
    } finally {
      setIsLockingTask(false);
      setTaskToConfirm(null);
    }
  };

  // --- ACTIONS: NOTES VAULT ---
  const saveDailyNotes = async () => {
    if (isPastDate) return toast.error("Cannot alter past journal entries.");
    setIsSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('daily_tracking').upsert({ user_id: session.user.id, date_str: selectedDate, notes: dailyNote, completion_percent: dailyStats.percent });
      setAllTracking(prev => ({...prev, [selectedDate]: dailyStats.percent}));
      toast.success("Daily Report Synced.", { icon: '📝', style: {background:'#121214', color:'#10b981'} });
    }
    setIsSavingNote(false);
  };

  const loadRecentNotes = async () => {
    setShowNotesModal(true); setNoteSearchDate(''); setIsLoadingNotes(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('daily_tracking').select('date_str, notes, completion_percent').eq('user_id', session.user.id).neq('notes', '').order('date_str', { ascending: false }).limit(5);
      if (data) setRecentNotes(data);
    }
    setIsLoadingNotes(false);
  };

  const searchNoteByDate = async (date: string) => {
    setNoteSearchDate(date);
    if (!date) return loadRecentNotes();
    setIsLoadingNotes(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('daily_tracking').select('date_str, notes, completion_percent').eq('user_id', session.user.id).eq('date_str', date).single();
      if (data && data.notes) setRecentNotes([data]); else setRecentNotes([]);
    }
    setIsLoadingNotes(false);
  };

  // --- ACTIONS: GOAL VAULT ---
  const loadRecentGoals = async () => {
    setShowRecentModal(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('study_goals').select('id, title, start_date, target_date, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5);
      if (data) setRecentGoals(data);
    }
  };

  const deleteGoal = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('study_goals').delete().match({ user_id: session.user.id, id });
      setRecentGoals(prev => prev.filter(g => g.id !== id));
      setGoalToDelete(null);
      toast.success("Goal Erased.", { style: {background:'#121214', color:'#10b981'} });
      if (activeGoal?.id === id) { setActiveGoal(null); setDailyBlocks([]); }
    }
  };

  // --- CALENDAR RENDERERS ---
  const calendarStrip = useMemo(() => {
    const dates = []; const baseDate = new Date(selectedDate);
    for (let i = -3; i <= 3; i++) { const d = new Date(baseDate); d.setDate(d.getDate() + i); dates.push(getISTDateString(d)); }
    return dates;
  }, [selectedDate]);

  const getCalendarGrid = () => {
    const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-emerald-500/30 pb-20 print:bg-white print:text-black">
      
      {/* HEADER WITH LIVE STREAK */}
      <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/80 py-3 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
            <Target className="text-emerald-500" size={16} /> HUD
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-md ml-2 transition-all" key={profile.streak}>
            <Flame size={12} className="text-orange-500 animate-pulse"/>
            <span className="text-[10px] font-bold text-orange-400">{profile.streak} Days</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadRecentNotes} className="hidden sm:flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all">
            <FileText size={12}/> Journal Vault
          </button>
          <button onClick={loadRecentGoals} className="hidden sm:flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all">
            <History size={12}/> Matrix Vault
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors">
            <Printer size={12}/> Export
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 mt-6 print:m-0 print:max-w-none print:w-full print:px-0">
        
        {/* MISSION OVERVIEW (GLOBAL GOAL STATS) */}
        {!isLoading && activeGoal && goalStats && (
          <div className="bg-gradient-to-br from-[#121214] to-[#09090b] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl flex flex-col md:flex-row items-center gap-6 print:hidden relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            
            <div className="flex-1 w-full relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest">Active Mission</span>
                <span className="text-[9px] font-mono text-zinc-500">{goalStats.days} Days Total</span>
              </div>
              <h2 className="text-lg font-bold text-zinc-100 mb-1">{activeGoal.title}</h2>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                Mission is to complete <span className="text-zinc-200 font-bold">{goalStats.topics.length} topics</span> across <span className="text-zinc-200 font-bold">{goalStats.subjects.length} subjects</span> with a total payload of <span className="text-zinc-200 font-bold">{formatTime(goalStats.totalMins)}</span>.
              </p>
              
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar">
                {goalStats.topics.map((t, i) => <span key={i} className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{t}</span>)}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 bg-[#09090b] border border-zinc-800/80 p-3 rounded-2xl shadow-inner w-full md:w-auto relative z-10">
              <div className="relative w-14 h-14 flex items-center justify-center mb-1">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * goalStats.percent) / 100} className="text-emerald-500 transition-all duration-1000 ease-out" />
                </svg>
                <span className="absolute text-xs font-bold text-emerald-400">{goalStats.percent}%</span>
              </div>
              <div className="text-center">
                <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Global Progress</div>
                <div className="text-[10px] font-mono font-bold text-zinc-300">{formatTime(goalStats.completedMins)} <span className="text-zinc-600">/ {formatTime(goalStats.totalMins)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE NAVIGATOR & FULL CALENDAR */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarIcon size={12} className="text-zinc-500"/> Navigator
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setShowFullCalendar(!showFullCalendar)} className="text-[9px] font-bold uppercase tracking-widest bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-1 rounded-lg hover:bg-zinc-800 flex items-center gap-1 transition-colors">
                {showFullCalendar ? <ChevronUp size={10}/> : <ChevronDown size={10}/>} Calendar
              </button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-[#09090b] border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:border-emerald-500 transition-colors" />
            </div>
          </div>
          
          {/* Calendar Strip (Collapsed View) */}
          {!showFullCalendar && (
            <div className="flex justify-between items-center gap-2 overflow-x-auto custom-scrollbar pb-1 px-1">
              {calendarStrip.map(dateStr => {
                const d = new Date(dateStr); const isToday = dateStr === todayISTStr; const isSelected = dateStr === selectedDate;
                const dailyPer = allTracking[dateStr] || 0;
                return (
                  <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`min-w-[55px] sm:min-w-[65px] py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all border relative overflow-hidden ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] -translate-y-0.5' : isToday ? 'bg-zinc-800/50 border-zinc-500' : 'bg-[#09090b] border-zinc-800 hover:border-zinc-600'}`}>
                    {dailyPer > 0 && <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all" style={{width:`${dailyPer}%`}}></div>}
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>{d.getDate()}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Full Calendar (Expanded View) */}
          {showFullCalendar && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center mb-3 px-2">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1 hover:bg-zinc-800 rounded"><ChevronLeft size={14}/></button>
                <span className="text-[10px] font-bold text-zinc-300 w-24 text-center">{calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1 hover:bg-zinc-800 rounded"><ChevronRight size={14}/></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[8px] font-bold uppercase text-zinc-600">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {getCalendarGrid().map((date, i) => {
                  if (!date) return <div key={i} className="h-12"></div>;
                  const dStr = getISTDateString(date);
                  const isSelected = dStr === selectedDate;
                  const per = allTracking[dStr] || 0;
                  
                  let plannedHrs = 0;
                  if (activeGoal && dStr >= activeGoal.start_date && dStr <= activeGoal.target_date) {
                     const blocks = activeGoal.routine_data[dStr] || [];
                     plannedHrs = blocks.reduce((acc:number, b:any) => acc + b.capacityMins, 0) / 60;
                  }

                  return (
                    <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`relative h-12 rounded-xl flex flex-col items-center justify-between py-1 border transition-all overflow-hidden ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}`}>
                      {plannedHrs > 0 ? <span className="text-[7px] font-bold text-indigo-400">{plannedHrs.toFixed(1)}h</span> : <span></span>}
                      <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>{date.getDate()}</span>
                      {per > 0 ? <span className="text-[7px] font-bold text-emerald-500">{per}%</span> : <span></span>}
                      {per > 0 && <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500/50 transition-all" style={{width:`${per}%`}}></div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* PRINT HEADER */}
        <div className="hidden print:block text-center mb-6 border-b-2 border-black pb-2">
           <h1 className="text-2xl font-extrabold text-black uppercase tracking-tight">Daily Protocol</h1>
           <p className="text-xs text-gray-600 mt-1 font-bold">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {isLoading ? (
          <div className="h-32 flex flex-col items-center justify-center bg-[#121214] border border-zinc-800/80 rounded-2xl shadow-xl">
            <Activity className="animate-spin text-emerald-500 mb-2" size={20} />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Compiling Matrix...</p>
          </div>
        ) : !activeGoal ? (
          <div className="bg-[#121214] border border-zinc-800 border-dashed rounded-2xl flex flex-col items-center justify-center h-40 text-center p-4 shadow-sm">
            <CalendarIcon size={24} className="text-zinc-700 mb-2" />
            <h2 className="text-sm font-bold text-zinc-300 mb-1">No Active Matrix</h2>
            <p className="text-zinc-500 text-[10px] mb-4">No study goal scheduled for this sector.</p>
            <Link href="/create-goal" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-bold transition-all">Initialize New Protocol</Link>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <div className="lg:col-span-8 space-y-6">
              {/* ROUTINE BLOCKS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dailyBlocks.map((block: any, bIdx: number) => {
                  const isBlockDone = block.tasks.length > 0 && block.tasks.every((t:any) => globalProgress.has(t.originalId || t.id));
                  return (
                    <div key={bIdx} className={`bg-[#121214] border rounded-2xl p-4 shadow-lg flex flex-col max-h-[400px] transition-all duration-500 print:border-gray-300 print:shadow-none print:bg-white print:max-h-none ${isBlockDone ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent' : 'border-zinc-800/80 hover:border-zinc-700'}`}>
                      
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50 print:border-gray-200 shrink-0">
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full transition-all duration-300 ${isBlockDone ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-indigo-500'}`}></span>
                           <h3 className="text-sm font-bold text-zinc-200 print:text-black">{block.start} - {block.end}</h3>
                        </div>
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest text-zinc-400 print:bg-gray-100 print:border-gray-300 print:text-black">
                          {block.type} ({block.capacityMins}m)
                        </span>
                      </div>

                      {/* TASK LIST (Scrollable) */}
                      <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1 print:overflow-visible">
                        {block.tasks.length === 0 ? (
                          <div className="h-12 flex items-center justify-center text-[9px] font-bold text-zinc-600 uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl print:text-gray-500 bg-[#09090b]">Free Time</div>
                        ) : (
                          block.tasks.map((task: any, tIdx: number) => {
                            const targetId = task.originalId || task.id; // Safely get underlying video ID
                            const taskMins = task.minsAllocated || task.durationMins || 0; // Safely get duration
                            const isDone = globalProgress.has(targetId);
                            const isCelebrating = celebratingTask === task.id;

                            return (
                              <div key={tIdx} className={`relative flex items-center justify-between p-2.5 rounded-xl transition-all duration-500 group/task print:bg-gray-50 print:border print:border-gray-200 ${
                                 isCelebrating ? 'bg-emerald-500/20 border border-emerald-500/50 scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10' : 
                                 isDone ? 'bg-[#09090b] border border-zinc-800/50 opacity-60' : 'bg-[#18181b] border border-zinc-700 hover:border-indigo-500/40'
                              }`}>
                                 <div className="flex items-center gap-3 flex-1 min-w-0">
                                   
                                   {/* COMPLETION BUTTON (IRREVERSIBLE) */}
                                   <button 
                                      disabled={isPastDate || isDone} 
                                      onClick={() => initiateTaskCompletion(task, isDone)} 
                                      className={`shrink-0 transition-transform duration-300 print:hidden ${isPastDate || isDone ? 'cursor-not-allowed' : 'hover:scale-110 active:scale-90'}`}
                                    >
                                     {isDone ? <CheckCircle2 size={20} className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> : <CircleDashed size={20} className="text-zinc-600 hover:text-emerald-400 transition-colors" />}
                                   </button>
                                   
                                   <div className="hidden print:block w-4 h-4 border border-black rounded flex items-center justify-center">{isDone && <CheckCircle2 size={10} className="text-black" />}</div>

                                   <div className="flex-1 min-w-0 pr-2">
                                     <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest print:text-gray-500">{task.subject}</span>
                                        {task.status !== 'Full' && (
                                          <div className="group relative flex items-center">
                                            <span className="text-[7px] uppercase tracking-widest px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold flex items-center gap-0.5 cursor-help"><LinkIcon size={6}/> Linked</span>
                                          </div>
                                        )}
                                     </div>
                                     <h4 className={`text-[11px] font-bold truncate transition-colors print:text-black ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{task.title}</h4>
                                   </div>
                                 </div>

                                 <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[9px] font-mono font-bold text-zinc-400 print:text-black bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800/50">{Math.round(taskMins)}m</span>
                                    {targetId && targetId.length > 20 && !isDone && (
                                       <button onClick={() => router.push(`/resources/${targetId}`)} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-zinc-900 p-1.5 rounded-lg transition-all shadow-sm print:hidden hover:scale-105 active:scale-95">
                                         <Play size={12} className="ml-0.5" fill="currentColor"/>
                                       </button>
                                    )}
                                 </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              
              {/* DAILY PROGRESS HUD */}
              <div className={`p-5 rounded-2xl border shadow-xl relative overflow-hidden transition-all duration-700 print:border-black print:shadow-none ${dailyStats.percent === 100 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-[#121214] border-zinc-800/80'}`}>
                {dailyStats.percent === 100 && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 animate-pulse pointer-events-none print:hidden"></div>}
                
                <div className="flex items-center justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {isPastDate && <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex items-center gap-1"><Lock size={8}/> Locked</span>}
                      {dailyStats.percent === 100 && <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex items-center gap-1"><Sparkles size={8}/> 100% Cleared</span>}
                    </div>
                    <h2 className="text-sm font-bold text-zinc-100 print:text-black">Daily Progress</h2>
                    <div className="text-[10px] font-mono font-bold text-zinc-400 mt-1">{formatTime(dailyStats.completedMins)} / {formatTime(dailyStats.totalMins)}</div>
                  </div>
                  
                  <div className="relative w-14 h-14 flex items-center justify-center shrink-0 bg-[#09090b] border border-zinc-800 rounded-full shadow-inner print:bg-white print:border-gray-300">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800 print:text-gray-200" />
                      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * dailyStats.percent) / 100} className={`transition-all duration-1000 ease-out ${dailyStats.percent === 100 ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    </svg>
                    <span className="absolute text-xs font-bold text-zinc-100 print:text-black">{dailyStats.percent}%</span>
                  </div>
                </div>
              </div>

              {/* END OF DAY JOURNAL */}
              <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-5 shadow-xl print:hidden transition-all focus-within:border-indigo-500/50">
                 <div className="flex items-center gap-2 mb-3">
                   <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shadow-inner"><FileText size={14} className="text-indigo-400"/></div>
                   <div>
                     <h3 className="text-sm font-bold text-zinc-100">End of Day Report</h3>
                   </div>
                 </div>
                 <textarea 
                   value={dailyNote} onChange={e => setDailyNote(e.target.value)} disabled={isPastDate}
                   placeholder={isPastDate ? "Record locked." : "Log progression, friction points..."}
                   className="w-full h-24 bg-[#09090b] border border-zinc-800 rounded-xl p-3 text-[11px] text-zinc-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none disabled:opacity-40 shadow-inner custom-scrollbar"
                 ></textarea>
                 {!isPastDate && (
                   <div className="flex justify-end mt-3">
                     <button onClick={saveDailyNotes} disabled={isSavingNote} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(99,102,241,0.3)] disabled:opacity-50 transition-all">
                       {isSavingNote ? <Activity size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>} Save Report
                     </button>
                   </div>
                 )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ========================================= */}
      {/* IRREVERSIBLE TASK CONFIRMATION MODAL        */}
      {/* ========================================= */}
      {taskToConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#09090b]/90 backdrop-blur-md animate-in fade-in duration-200 print:hidden">
          <div className="bg-[#121214] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 max-w-[400px] w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <ShieldAlert size={32} className="text-emerald-500"/>
            </div>
            
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Lock Neural Pathway?</h2>
            <p className="text-zinc-400 text-xs mb-4 leading-relaxed font-medium">Are you sure you have completely mastered <span className="text-emerald-400 font-bold">"{taskToConfirm.title}"</span>?</p>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-6">
               <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Warning</p>
               <p className="text-xs text-zinc-300">Once confirmed, this module is permanently locked into your progress matrix and <span className="text-red-400 font-bold">cannot be unchecked</span>.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setTaskToConfirm(null)} disabled={isLockingTask} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl transition-colors text-xs hover:text-white disabled:opacity-50">Abort</button>
              <button onClick={executeTaskCompletion} disabled={isLockingTask} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] text-xs border border-emerald-500 flex items-center justify-center gap-2 disabled:opacity-50">
                {isLockingTask ? <Activity size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} 
                {isLockingTask ? 'Locking...' : 'Lock & Gain XP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* LAZY-LOAD JOURNAL NOTES VAULT MODAL       */}
      {/* ========================================= */}
      {showNotesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
          <div className="bg-[#121214]/90 border border-zinc-700/50 rounded-2xl p-6 max-w-[600px] w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] backdrop-blur-xl">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-zinc-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg shadow-inner"><FileText size={18} className="text-rose-400"/></div>
                <div>
                  <h2 className="text-base font-bold text-zinc-100">Journal Vault</h2>
                  <p className="text-[9px] text-zinc-500 font-medium">Your daily progression logs.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                 <div className="relative">
                   <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"/>
                   <input type="date" value={noteSearchDate} onChange={(e) => searchNoteByDate(e.target.value)} className="bg-[#09090b] border border-zinc-700 text-zinc-300 rounded-lg pl-8 pr-2 py-1.5 text-[10px] font-bold outline-none focus:border-rose-500 transition-colors" />
                 </div>
                 <button onClick={() => setShowNotesModal(false)} className="text-zinc-500 hover:text-white p-1.5 bg-zinc-900 rounded-lg transition-colors"><X size={16}/></button>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar space-y-3 pr-2 flex-1">
              {isLoadingNotes ? (
                <div className="flex flex-col items-center justify-center py-10 text-rose-500/50">
                  <Activity size={24} className="animate-spin mb-2"/>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Searching Archives...</span>
                </div>
              ) : recentNotes.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-medium">No journal entries found.</div>
              ) : (
                recentNotes.map((note, i) => (
                  <div key={i} className="bg-[#09090b]/80 border border-zinc-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
                    <div className="flex justify-between items-center mb-2 pl-2">
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{new Date(note.date_str).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{note.completion_percent}% Completed</span>
                    </div>
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap pl-2 leading-relaxed">{note.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECENT GOALS MODAL */}
      {showRecentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-md animate-in fade-in duration-300 print:hidden">
          <div className="bg-[#121214]/90 border border-zinc-700/50 rounded-2xl p-6 max-w-[500px] w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[80vh] backdrop-blur-xl">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-800 border border-zinc-700 rounded-lg shadow-inner"><History size={16} className="text-zinc-200"/></div>
                <h2 className="text-sm font-bold text-zinc-100">Matrix Vault</h2>
              </div>
              <button onClick={() => setShowRecentModal(false)} className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors"><X size={16}/></button>
            </div>
            <div className="overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {recentGoals.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-[10px] font-medium">No blueprints found.</div>
              ) : (
                recentGoals.map(goal => (
                  <div key={goal.id} className="bg-[#09090b]/80 border border-zinc-800/80 hover:border-indigo-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-colors shadow-sm">
                    <div>
                      <h4 className="text-[11px] font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">{goal.title}</h4>
                      <p className="text-[8px] text-zinc-500 font-mono mt-1 font-bold uppercase tracking-widest bg-zinc-900/50 w-fit px-1.5 py-0.5 rounded">Gen: {new Date(goal.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 shadow-inner">
                        {Math.max(1, Math.round((new Date(goal.target_date).getTime() - new Date(goal.start_date).getTime()) / (1000 * 3600 * 24)) + 1)} Days
                      </span>
                      <button onClick={() => setGoalToDelete(goal.id)} className="p-1.5 text-zinc-600 hover:text-red-400 bg-zinc-900 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-500/20">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION WARNING */}
      {goalToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#09090b]/95 backdrop-blur-xl animate-in fade-in duration-200 print:hidden">
          <div className="bg-[#121214] border border-red-500/30 rounded-2xl p-6 sm:p-8 max-w-[350px] w-full shadow-[0_0_80px_rgba(239,68,68,0.2)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600 animate-pulse"></div>
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <AlertTriangle size={24} className="text-red-500"/>
            </div>
            <h2 className="text-lg font-extrabold text-zinc-100 mb-2 tracking-tight">Destruct Sequence</h2>
            <p className="text-zinc-400 text-[10px] mb-6 leading-relaxed font-medium">This will permanently erase the timeline. Daily tracking XP records will remain intact.</p>
            <div className="flex gap-2">
              <button onClick={() => setGoalToDelete(null)} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-2.5 rounded-lg transition-colors text-[10px] hover:text-white">Abort</button>
              <button onClick={() => deleteGoal(goalToDelete)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] text-[10px] border border-red-500">Execute</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}