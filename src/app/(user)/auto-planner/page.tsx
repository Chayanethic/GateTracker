'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  CheckSquare,CheckCircle2,Calendar as CalendarIcon, Clock, BookOpen, Target, Zap, Activity, 
  ChevronRight, ChevronLeft, ArrowLeft, Play, Database,
  Printer, History, Trash2, AlertTriangle, FileText, Sparkles, Lock, X, ChevronDown, ChevronUp, Link as LinkIcon, Flame, Search, ShieldCheck
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
  const [todayTrueXp, setTodayTrueXp] = useState(0);
  
  // UI States
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(getISTNow());

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

      // 1. Fetch Profile
      const { data: pData } = await supabase.from('user_profiles').select('streak, xp').eq('user_id', session.user.id).single();
      if (pData) setProfile({ streak: pData.streak || 0, xp: pData.xp || 0 });

      // 2. Fetch Progress (For checking off completed videos in the UI)
      const { data: progData } = await supabase.from('user_progress').select('material_id').eq('user_id', session.user.id);
      if (progData) setGlobalProgress(new Set(progData.map(p => p.material_id)));

      // 3. Fetch Active Goal
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

      // 4. Fetch Tracking Data
      const { data: allTrackingData } = await supabase.from('daily_tracking').select('date_str, completion_percent, notes, xp_earned').eq('user_id', session.user.id);
      if (allTrackingData) {
        const trackingMap: Record<string, number> = {};
        allTrackingData.forEach(t => { trackingMap[t.date_str] = t.completion_percent; });
        setAllTracking(trackingMap);
        
        const selectedDayData = allTrackingData.find(t => t.date_str === selectedDate);
        setDailyNote(selectedDayData?.notes || '');
        if (selectedDate === todayISTStr) {
           setTodayTrueXp(selectedDayData?.xp_earned || 0);
        }
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
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 pb-20 print:bg-white print:text-black overflow-hidden relative">
      
      {/* ADVANCED AMBIENT GLOWS */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* HEADER WITH LIVE STREAK */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-black/40 hover:bg-white/10 ring-1 ring-white/10 rounded-xl transition-all text-zinc-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div className="hidden sm:block">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-widest mb-1 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Zap size={10} className="text-emerald-500"/> Heads Up Display
            </div>
            <h1 className="text-lg font-black tracking-tight text-zinc-100 leading-none">
              Daily Protocol
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20 shadow-inner">
            <Flame size={14} className="text-orange-500 animate-pulse"/>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{profile.streak} Days</span>
          </div>

          <button onClick={loadRecentNotes} className="hidden sm:flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/20 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all shadow-sm">
            <FileText size={12}/> Journal Vault
          </button>
          <button onClick={loadRecentGoals} className="hidden sm:flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/20 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all shadow-sm">
            <History size={12}/> Matrix Vault
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 mt-8 print:m-0 print:max-w-none print:w-full print:px-0 relative z-10">
        
        {/* MISSION OVERVIEW (GLOBAL GOAL STATS) */}
        {!isLoading && activeGoal && goalStats && (
          <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 rounded-[2rem] p-6 sm:p-8 mb-8 shadow-2xl flex flex-col md:flex-row items-center gap-8 print:hidden relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="flex-1 w-full relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-inner">Active Mission</span>
                <span className="text-[10px] font-mono text-zinc-500 font-bold bg-black/50 px-2.5 py-1 rounded-md">{goalStats.days} Days Total</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 mb-2 tracking-tight">{activeGoal.title}</h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-5 max-w-lg font-medium">
                Mission is to complete <span className="text-zinc-200 font-bold">{goalStats.topics.length} topics</span> across <span className="text-zinc-200 font-bold">{goalStats.subjects.length} subjects</span> with a total payload of <span className="text-zinc-200 font-bold">{formatTime(goalStats.totalMins)}</span>.
              </p>
              
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto custom-scrollbar">
                {goalStats.topics.map((t, i) => <span key={i} className="text-[9px] bg-black/40 ring-1 ring-white/5 text-zinc-400 px-2 py-1 rounded-md uppercase tracking-widest font-bold">{t}</span>)}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 bg-black/40 ring-1 ring-white/5 p-6 rounded-3xl shadow-inner w-full md:w-auto relative z-10">
              <div className="relative w-20 h-20 flex items-center justify-center mb-3">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                  <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276.46" strokeDashoffset={276.46 - (276.46 * goalStats.percent) / 100} className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" strokeLinecap="round" />
                </svg>
                <span className="absolute text-lg font-black text-emerald-400">{goalStats.percent}%</span>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Global Progress</div>
                <div className="text-[11px] font-mono font-bold text-zinc-300">{formatTime(goalStats.completedMins)} <span className="text-zinc-600">/ {formatTime(goalStats.totalMins)}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE NAVIGATOR & FULL CALENDAR */}
        <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 rounded-[2rem] p-5 sm:p-6 mb-8 shadow-xl print:hidden relative z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <CalendarIcon size={14} className="text-zinc-500"/> Navigator
            </h2>
            <div className="flex gap-3">
              <button onClick={() => setShowFullCalendar(!showFullCalendar)} className="text-[10px] font-bold uppercase tracking-widest bg-black/40 ring-1 ring-white/10 text-zinc-300 px-3 py-1.5 rounded-xl hover:bg-white/5 flex items-center gap-1.5 transition-all shadow-inner">
                {showFullCalendar ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} Calendar
              </button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-black/40 ring-1 ring-white/10 text-zinc-300 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-emerald-500/50 transition-all shadow-inner" />
            </div>
          </div>
          
          {/* Calendar Strip (Collapsed View) */}
          {!showFullCalendar && (
            <div className="flex justify-between items-center gap-2 overflow-x-auto custom-scrollbar pb-2 px-1">
              {calendarStrip.map(dateStr => {
                const d = new Date(dateStr); const isToday = dateStr === todayISTStr; const isSelected = dateStr === selectedDate;
                const dailyPer = allTracking[dateStr] || 0;
                return (
                  <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`min-w-[65px] sm:min-w-[75px] py-3.5 rounded-[1rem] flex flex-col items-center gap-1.5 transition-all ring-1 relative overflow-hidden ${isSelected ? 'bg-emerald-500/10 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] -translate-y-1' : isToday ? 'bg-white/5 ring-zinc-500' : 'bg-black/40 ring-white/5 hover:ring-white/20 hover:bg-white/[0.02]'}`}>
                    {dailyPer > 0 && <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{width:`${dailyPer}%`}}></div>}
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className={`text-lg font-black ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>{d.getDate()}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Full Calendar (Expanded View) */}
          {showFullCalendar && (
            <div className="animate-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft size={16}/></button>
                <span className="text-xs font-bold text-zinc-300 w-32 text-center uppercase tracking-widest">{calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight size={16}/></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <div key={i} className="text-center text-[9px] font-bold uppercase text-zinc-500 tracking-widest">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {getCalendarGrid().map((date, i) => {
                  if (!date) return <div key={i} className="h-14"></div>;
                  const dStr = getISTDateString(date);
                  const isSelected = dStr === selectedDate;
                  const per = allTracking[dStr] || 0;
                  
                  let plannedHrs = 0;
                  if (activeGoal && dStr >= activeGoal.start_date && dStr <= activeGoal.target_date) {
                     const blocks = activeGoal.routine_data[dStr] || [];
                     plannedHrs = blocks.reduce((acc:number, b:any) => acc + b.capacityMins, 0) / 60;
                  }

                  return (
                    <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`relative h-14 rounded-xl flex flex-col items-center justify-between py-1.5 ring-1 transition-all overflow-hidden ${isSelected ? 'bg-emerald-500/10 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-black/40 ring-white/5 hover:ring-white/20'}`}>
                      {plannedHrs > 0 ? <span className="text-[8px] font-bold text-indigo-400">{plannedHrs.toFixed(1)}h</span> : <span></span>}
                      <span className={`text-sm font-black ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>{date.getDate()}</span>
                      {per > 0 ? <span className="text-[8px] font-bold text-emerald-500">{per}%</span> : <span></span>}
                      {per > 0 && <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500/50 transition-all shadow-[0_0_5px_rgba(16,185,129,1)]" style={{width:`${per}%`}}></div>}
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
          <div className="h-40 flex flex-col items-center justify-center bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem] shadow-xl">
            <Activity className="animate-spin text-emerald-500 mb-3" size={24} />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Compiling Matrix...</p>
          </div>
        ) : !activeGoal ? (
          <div className="bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem] flex flex-col items-center justify-center h-64 text-center p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
            <div className="w-16 h-16 bg-white/5 ring-1 ring-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner rotate-3">
              <CalendarIcon size={28} className="text-zinc-500" />
            </div>
            <h2 className="text-xl font-black text-zinc-200 mb-2 tracking-tight">No Active Matrix</h2>
            <p className="text-zinc-500 text-xs mb-6 font-medium max-w-sm">No study protocol is scheduled for this timeline sector.</p>
            <Link href="/auto-planner" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-95">
              Launch Auto-Planner
            </Link>
          </div>
        ) : (
          <div className="animate-in fade-in duration-700 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
            
            <div className="lg:col-span-8 space-y-6">
              {/* ROUTINE BLOCKS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {dailyBlocks.map((block: any, bIdx: number) => {
                  const isBlockDone = block.tasks.length > 0 && block.tasks.every((t:any) => globalProgress.has(t.originalId || t.id));
                  return (
                    <div key={bIdx} className={`bg-zinc-900/40 backdrop-blur-2xl ring-1 rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[500px] transition-all duration-500 print:border-gray-300 print:shadow-none print:bg-white print:max-h-none ${isBlockDone ? 'ring-emerald-500/30 bg-emerald-500/5' : 'ring-white/10 hover:ring-white/20'}`}>
                      
                      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/5 print:border-gray-200 shrink-0">
                        <div className="flex items-center gap-3">
                           <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isBlockDone ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : `bg-${block.color || 'indigo'}-500 shadow-[0_0_10px_currentColor]`}`}></span>
                           <h3 className="text-base font-black text-zinc-100 print:text-black tracking-tight">{block.start} - {block.end}</h3>
                        </div>
                        <span className={`bg-black/40 ring-1 ring-white/5 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-zinc-400 print:bg-gray-100 print:border-gray-300 print:text-black shadow-inner`}>
                          {block.capacityMins}m Block
                        </span>
                      </div>

                      {/* TASK LIST (Scrollable) */}
                      <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2 print:overflow-visible">
                        {block.tasks.length === 0 ? (
                          <div className="h-16 flex items-center justify-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl print:text-gray-500 bg-black/20">Free Time</div>
                        ) : (
                          block.tasks.map((task: any, tIdx: number) => {
                            const targetId = task.originalId || task.id; 
                            const taskMins = task.minsAllocated || task.durationMins || 0; 
                            const isDone = globalProgress.has(targetId);

                            return (
                              <div key={tIdx} className={`relative flex items-center justify-between p-3.5 rounded-[1rem] transition-all duration-300 group/task print:bg-gray-50 print:border print:border-gray-200 ring-1 ${
                                 isDone ? 'bg-emerald-500/5 ring-emerald-500/20' : 'bg-black/20 ring-white/5 hover:ring-white/10 hover:bg-white/[0.02]'
                              }`}>
                                 <div className="flex items-center gap-3 flex-1 min-w-0">
                                   
                                   {/* STATUS INDICATOR (Read-Only) */}
                                   <div className={`w-5 h-5 shrink-0 rounded-[6px] flex items-center justify-center ring-1 transition-all duration-300 ${isDone ? 'bg-emerald-500 ring-emerald-500 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'ring-white/10 bg-black/50'}`}>
                                      {isDone && <CheckSquare size={12} strokeWidth={4} />}
                                   </div>
                                   
                                   <div className="flex-1 min-w-0 pr-3">
                                     <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest print:text-gray-500">{task.topic}</span>
                                        {task.status !== 'Full' && (
                                          <div className="group relative flex items-center">
                                            <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold flex items-center gap-1 ring-1 ring-amber-500/20"><LinkIcon size={8}/> Linked</span>
                                          </div>
                                        )}
                                     </div>
                                     <h4 className={`text-[11px] font-bold truncate transition-colors print:text-black ${isDone ? 'text-emerald-500/70 line-through' : 'text-zinc-200 group-hover/task:text-white'}`}>{task.title}</h4>
                                   </div>
                                 </div>

                                 <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[10px] font-mono font-bold text-zinc-400 print:text-black bg-black/50 px-2 py-1 rounded-md ring-1 ring-white/5">{Math.round(taskMins)}m</span>
                                    
                                    {/* THE LAUNCH PAD */}
                                    {targetId && targetId.length > 20 && !isDone && (
                                       <Link href={`/resources/${targetId}`} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 text-xs font-bold uppercase tracking-widest hover:text-zinc-950 px-3 py-1.5 rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] print:hidden hover:scale-105 active:scale-95 ring-1 ring-emerald-500/20 flex items-center gap-1.5">
                                         Launch <Play size={10} fill="currentColor"/>
                                       </Link>
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
              <div className={`p-6 rounded-[2rem] shadow-2xl relative overflow-hidden transition-all duration-700 print:border-black print:shadow-none ring-1 ${dailyStats.percent === 100 ? 'bg-emerald-500/10 ring-emerald-500/40' : 'bg-zinc-900/40 backdrop-blur-2xl ring-white/10'}`}>
                {dailyStats.percent === 100 && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 animate-pulse pointer-events-none print:hidden"></div>}
                
                <div className="flex items-center justify-between gap-5 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {isPastDate && <span className="bg-red-500/10 text-red-400 ring-1 ring-red-500/20 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-inner"><Lock size={10}/> Locked</span>}
                      {dailyStats.percent === 100 && <span className="bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.2)]"><Sparkles size={10}/> 100% Cleared</span>}
                    </div>
                    <h2 className="text-base font-black text-zinc-100 print:text-black tracking-tight">Protocol Progress</h2>
                    <div className="text-[11px] font-mono font-bold text-zinc-400 mt-1">{formatTime(dailyStats.completedMins)} / {formatTime(dailyStats.totalMins)}</div>
                  </div>
                  
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0 bg-black/40 ring-1 ring-white/10 rounded-2xl shadow-inner print:bg-white print:border-gray-300">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800 print:text-gray-200" />
                      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * dailyStats.percent) / 100} className={`transition-all duration-1000 ease-out drop-shadow-[0_0_8px_currentColor] ${dailyStats.percent === 100 ? 'text-emerald-400' : 'text-emerald-500'}`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-sm font-black text-zinc-100 print:text-black">{dailyStats.percent}%</span>
                  </div>
                </div>

                {/* THE DAILY CHARGE SYNC (Shows True XP earned today) */}
                {selectedDate === todayISTStr && (
                  <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Daily Neural Charge</div>
                      <div className="text-sm font-black text-zinc-200 flex items-center gap-1.5">
                        <Zap size={14} className={todayTrueXp >= 200 ? "text-orange-400" : "text-zinc-500"}/> 
                        {todayTrueXp} <span className="text-[10px] text-zinc-600 font-medium">/ 200 XP</span>
                      </div>
                    </div>
                    {todayTrueXp >= 200 ? (
                      <div className="bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/30 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                        <ShieldCheck size={12}/> Streak Secured
                      </div>
                    ) : (
                      <div className="bg-white/5 text-zinc-500 ring-1 ring-white/10 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-inner">
                        Pending XP
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* END OF DAY JOURNAL */}
              <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 rounded-[2rem] p-6 shadow-2xl print:hidden transition-all focus-within:ring-indigo-500/40 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="p-2 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-xl shadow-inner"><FileText size={16} className="text-indigo-400"/></div>
                   <div>
                     <h3 className="text-sm font-black text-zinc-100 tracking-tight">End of Day Report</h3>
                   </div>
                 </div>
                 <textarea 
                   value={dailyNote} onChange={e => setDailyNote(e.target.value)} disabled={isPastDate}
                   placeholder={isPastDate ? "Record locked." : "Log progression, friction points, and focus parameters..."}
                   className="w-full h-28 bg-black/40 ring-1 ring-white/5 rounded-2xl p-4 text-[11px] text-zinc-200 outline-none focus:ring-indigo-500/50 transition-all resize-none disabled:opacity-40 shadow-inner custom-scrollbar font-medium"
                 ></textarea>
                 {!isPastDate && (
                   <div className="flex justify-end mt-4">
                     <button onClick={saveDailyNotes} disabled={isSavingNote} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50 transition-all hover:scale-105 active:scale-95">
                       {isSavingNote ? <Activity size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>} Save Report
                     </button>
                   </div>
                 )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ========================================= */}
      {/* LAZY-LOAD JOURNAL NOTES VAULT MODAL       */}
      {/* ========================================= */}
      {showNotesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050505]/80 backdrop-blur-lg animate-in fade-in duration-300 print:hidden">
          <div className="bg-zinc-950/90 ring-1 ring-white/10 rounded-[2rem] p-6 sm:p-8 max-w-[600px] w-full shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh] backdrop-blur-2xl">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-6 border-b border-white/5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-rose-500/10 ring-1 ring-rose-500/20 rounded-xl shadow-inner"><FileText size={20} className="text-rose-400"/></div>
                <div>
                  <h2 className="text-xl font-black text-zinc-100 tracking-tight">Journal Vault</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Your daily progression logs.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <div className="relative">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                   <input type="date" value={noteSearchDate} onChange={(e) => searchNoteByDate(e.target.value)} className="bg-black/50 ring-1 ring-white/10 text-zinc-300 rounded-xl pl-9 pr-3 py-2 text-[11px] font-bold outline-none focus:ring-rose-500 transition-colors shadow-inner" />
                 </div>
                 <button onClick={() => setShowNotesModal(false)} className="text-zinc-500 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><X size={18}/></button>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar space-y-4 pr-2 flex-1">
              {isLoadingNotes ? (
                <div className="flex flex-col items-center justify-center py-12 text-rose-500/50">
                  <Activity size={28} className="animate-spin mb-3"/>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Searching Archives...</span>
                </div>
              ) : recentNotes.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-medium bg-black/20 rounded-2xl ring-1 ring-white/5">No journal entries found in the neural link.</div>
              ) : (
                recentNotes.map((note, i) => (
                  <div key={i} className="bg-black/40 ring-1 ring-white/5 rounded-[1.5rem] p-5 shadow-lg relative overflow-hidden hover:ring-white/10 transition-colors">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                    <div className="flex justify-between items-center mb-3 pl-3">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">{new Date(note.date_str).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg ring-1 ring-emerald-500/20">{note.completion_percent}% Completed</span>
                    </div>
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap pl-3 leading-relaxed font-medium">{note.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECENT GOALS MODAL */}
      {showRecentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#050505]/80 backdrop-blur-lg animate-in fade-in duration-300 print:hidden">
          <div className="bg-zinc-950/90 ring-1 ring-white/10 rounded-[2rem] p-6 sm:p-8 max-w-[550px] w-full shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[80vh] backdrop-blur-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-xl shadow-inner"><History size={20} className="text-indigo-400"/></div>
                <div>
                  <h2 className="text-xl font-black text-zinc-100 tracking-tight">Matrix Vault</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Recent deployment blueprints.</p>
                </div>
              </div>
              <button onClick={() => setShowRecentModal(false)} className="text-zinc-500 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"><X size={18}/></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar space-y-3 pr-2">
              {recentGoals.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-medium bg-black/20 rounded-2xl ring-1 ring-white/5">No blueprints found in the neural link.</div>
              ) : (
                recentGoals.map(goal => (
                  <div key={goal.id} className="bg-black/40 ring-1 ring-white/5 hover:ring-indigo-500/30 rounded-[1.5rem] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-colors shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                    <div>
                      <h4 className="text-[13px] font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors mb-1">{goal.title}</h4>
                      <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-widest bg-white/5 w-fit px-2 py-1 rounded-md ring-1 ring-white/5">Gen: {new Date(goal.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg ring-1 ring-emerald-500/20 shadow-inner">
                        {Math.max(1, Math.round((new Date(goal.target_date).getTime() - new Date(goal.start_date).getTime()) / (1000 * 3600 * 24)) + 1)} Days
                      </span>
                      <button onClick={() => setGoalToDelete(goal.id)} className="p-2 text-zinc-600 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 ring-1 ring-transparent hover:ring-red-500/20">
                        <Trash2 size={16}/>
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#050505]/90 backdrop-blur-xl animate-in fade-in duration-200 print:hidden">
          <div className="bg-zinc-950/90 ring-1 ring-red-500/30 rounded-[2rem] p-8 sm:p-10 max-w-[400px] w-full shadow-[0_0_80px_rgba(239,68,68,0.2)] text-center relative overflow-hidden backdrop-blur-2xl">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
            
            <div className="w-16 h-16 bg-red-500/10 ring-1 ring-red-500/20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)] rotate-3">
              <AlertTriangle size={32} className="text-red-500"/>
            </div>
            
            <h2 className="text-2xl font-black text-zinc-100 mb-2 tracking-tight">Destruct Sequence</h2>
            <p className="text-zinc-400 text-xs mb-8 leading-relaxed font-medium">This will permanently erase the timeline. Daily tracking XP records will remain intact in the main ledger.</p>
            
            <div className="flex gap-3">
              <button onClick={() => setGoalToDelete(null)} className="flex-1 bg-black/50 hover:bg-white/5 ring-1 ring-white/10 text-zinc-300 font-bold py-3.5 rounded-xl transition-colors text-xs hover:text-white">Abort</button>
              <button onClick={() => deleteGoal(goalToDelete)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] text-xs ring-1 ring-red-500 hover:scale-105 active:scale-95">Execute</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}