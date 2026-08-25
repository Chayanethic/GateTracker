'use client';

import Link from 'next/link';
import { 
  Target, Activity, Zap, Flame, ArrowRight, 
  CalendarPlus, CheckCircle2, ShieldCheck, AlertTriangle, X, Edit3, Calendar,
  Play, Link as LinkIcon, CheckSquare, Clock, ChevronDown, BookOpen, Layers, Sparkles, HelpCircle, Network, Save, Moon, BedDouble, SunMedium
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { getUserProfile } from '../../../lib/dataService';
import toast from 'react-hot-toast';

// --- FULL GATE ECE SYLLABUS ---
const GATE_SYLLABUS = [
  { subject: "Network Analysis", weight: 4.8, topics: [ { id: "net_1", name: "Basics of Networks & Network Theorems", weight: 1.2 }, { id: "net_2", name: "Transient Analysis", weight: 1.8 }, { id: "net_3", name: "AC Circuits - Phasor Diagram, Resonance & Complex Power", weight: 0.6 }, { id: "net_4", name: "Two Port Networks", weight: 1.2 } ] },
  { subject: "Signals & Systems", weight: 6.0, topics: [ { id: "sig_1", name: "Basics of Signals & Systems", weight: 1.5 }, { id: "sig_2", name: "Continuous Time Fourier Series", weight: 0.5 }, { id: "sig_3", name: "Continuous Time Fourier Transforms", weight: 1.0 }, { id: "sig_4", name: "Laplace Transforms", weight: 1.0 }, { id: "sig_5", name: "Z Transforms", weight: 1.0 }, { id: "sig_6", name: "DTFS, DTFT, DFT, FFT", weight: 1.0 } ] },
  { subject: "Analog Electronics", weight: 6.0, topics: [ { id: "ana_1", name: "Diode Circuits", weight: 1.0 }, { id: "ana_2", name: "MOSFETs", weight: 2.0 }, { id: "ana_3", name: "OpAmps", weight: 2.0 }, { id: "ana_4", name: "BJTs", weight: 1.0 } ] },
  { subject: "Digital Electronics", weight: 4.8, topics: [ { id: "dig_1", name: "Basics of Boolean Algebra & Logic Gates", weight: 1.0 }, { id: "dig_2", name: "Basics of Number Systems", weight: 0.4 }, { id: "dig_3", name: "Combinational Circuits", weight: 0.8 }, { id: "dig_4", name: "Sequential Circuits", weight: 1.0 }, { id: "dig_5", name: "ADC & DAC", weight: 1.0 }, { id: "dig_6", name: "CMOS Logic Implementation", weight: 0.4 }, { id: "dig_7", name: "COA", weight: 0.2 } ] },
  { subject: "Control System", weight: 4.8, topics: [ { id: "con_1", name: "Basics of Control System", weight: 0.2 }, { id: "con_2", name: "Signal Flow Graph & Block Diagram Reduction", weight: 0.2 }, { id: "con_3", name: "Time Response Analysis", weight: 0.5 }, { id: "con_4", name: "Routh-Hurwitz Criterion", weight: 0.4 }, { id: "con_5", name: "Root Locus Analysis", weight: 0.4 }, { id: "con_6", name: "Frequency Response of 2nd Order Systems", weight: 0.2 }, { id: "con_7", name: "Polar Plot", weight: 0.6 }, { id: "con_8", name: "Nyquist Plot", weight: 0.6 }, { id: "con_9", name: "Bode Plots", weight: 0.6 }, { id: "con_10", name: "State Space Analysis", weight: 0.6 }, { id: "con_11", name: "Controllers and Compensators", weight: 0.5 } ] },
  { subject: "Engineering Mathematics", weight: 7.8, topics: [ { id: "mat_1", name: "Linear Algebra", weight: 1.8 }, { id: "mat_2", name: "Limits, Continuity & Differentiability", weight: 0.5 }, { id: "mat_3", name: "Differential Calculus", weight: 1.25 }, { id: "mat_4", name: "Integral Calculus", weight: 1.25 }, { id: "mat_5", name: "Differential Equations", weight: 0.3 }, { id: "mat_6", name: "Vector Calculus", weight: 0.45 }, { id: "mat_7", name: "Complex Variable Analysis", weight: 0.45 }, { id: "mat_8", name: "Probability and Statistics", weight: 1.8 } ] },
  { subject: "General Aptitude", weight: 9.0, topics: [ { id: "apt_1", name: "Verbal Aptitude", weight: 1.6 }, { id: "apt_2", name: "Quantitative Aptitude", weight: 3.8 }, { id: "apt_3", name: "Analytical Aptitude", weight: 2.4 }, { id: "apt_4", name: "Spatial Aptitude", weight: 1.2 } ] },
  { subject: "Electromagnetic Field Theory", weight: 4.2, topics: [ { id: "emf_1", name: "Vector Algebra, Coordinate system & Calculus", weight: 0.5 }, { id: "emf_2", name: "Maxwell's Equation & EM waves", weight: 1.0 }, { id: "emf_3", name: "Transmission Lines & Smith Chart", weight: 1.5 }, { id: "emf_4", name: "Waveguides", weight: 0.7 }, { id: "emf_5", name: "Antenna Theory", weight: 0.5 } ] },
  { subject: "Electronic Devices & Circuits", weight: 5.4, topics: [ { id: "edc_1", name: "Basic Semiconductor Physics", weight: 2.16 }, { id: "edc_2", name: "PN Junction & Special Purpose Diodes", weight: 1.08 }, { id: "edc_3", name: "Bipolar Junction Transistors", weight: 0.54 }, { id: "edc_4", name: "MOS Cap & MOS Physics", weight: 1.62 } ] },
  { subject: "Communication Systems", weight: 7.2, topics: [ { id: "com_1", name: "Random Variable & Random Process", weight: 1.5 }, { id: "com_2", name: "Digital Communication Systems", weight: 2.5 }, { id: "com_3", name: "Information Theory", weight: 1.8 }, { id: "com_4", name: "Analog Communication Systems", weight: 1.4 } ] }
];

export default function UserDashboard() {
  const [profile, setProfile] = useState({ xp: 0, streak: 0 });
  const [todayXp, setTodayXp] = useState(0);
  const [isTodaySecured, setIsTodaySecured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState('');
  
  // Daily Protocol State & Thumbnails
  const [todayBlocks, setTodayBlocks] = useState<any[]>([]);
  const [taskUrls, setTaskUrls] = useState<Record<string, string>>({});
  const [globalProgress, setGlobalProgress] = useState<Set<string>>(new Set());
  
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [trackMasturbation, setTrackMasturbation] = useState(false);
  const [sleepMastPrompted, setSleepMastPrompted] = useState(false);
  const [sleepRow, setSleepRow] = useState<any | null>(null);
  const [sleepModal, setSleepModal] = useState<'setup' | 'morning' | 'afternoon' | null>(null);
  const [sleepBed, setSleepBed] = useState('');
  const [sleepWake, setSleepWake] = useState('');
  const [sleepNap, setSleepNap] = useState('');
  const [sleepMast, setSleepMast] = useState('');
  const [savingSleep, setSavingSleep] = useState(false);

  const getISTNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const getISTDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const getYoutubeThumbnail = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`; 
    }
    return ''; 
  };

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;

      const todayStr = getISTDateString(getISTNow());

      const { data: userProfileData } = await supabase.from('user_profiles').select('streak, syllabus_progress, target_exam_date, branch, sleep_tracking_enabled, track_masturbation, sleep_masturbation_prompted').eq('user_id', session.user.id).single();
      const xpData = await getUserProfile(session.user.id);
      const { data: trackingData } = await supabase.from('daily_tracking').select('xp_earned').eq('user_id', session.user.id).eq('date_str', todayStr).maybeSingle();
      const { data: todaySleep } = await supabase.from('sleep_tracking').select('date_str, bed_time, wake_time, night_sleep_minutes, afternoon_sleep_minutes, masturbation').eq('user_id', session.user.id).eq('date_str', todayStr).maybeSingle();
      const { data: progData } = await supabase.from('user_progress').select('material_id').eq('user_id', session.user.id);

      const { data: goalData } = await supabase.from('study_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .lte('start_date', todayStr)
        .gte('target_date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1).single();

      if (isMounted) {
        setProfile({ xp: xpData?.xp || 0, streak: userProfileData?.streak || 0 });
        setSleepEnabled(Boolean(userProfileData?.sleep_tracking_enabled));
        setTrackMasturbation(Boolean(userProfileData?.track_masturbation));
        setSleepMastPrompted(Boolean(userProfileData?.sleep_masturbation_prompted));
        setSleepRow(todaySleep || null);
        if (todaySleep) {
          setSleepBed((todaySleep.bed_time || '').slice(0, 5));
          setSleepWake((todaySleep.wake_time || '').slice(0, 5));
          setSleepNap(String(todaySleep.afternoon_sleep_minutes || ''));
          setSleepMast(todaySleep.masturbation == null ? '' : todaySleep.masturbation ? 'yes' : 'no');
        }
        const istHour = getISTNow().getHours();
        if (userProfileData?.sleep_tracking_enabled && !userProfileData?.sleep_masturbation_prompted) setSleepModal('setup');
        else if (userProfileData?.sleep_tracking_enabled && !todaySleep) setSleepModal('morning');
        else if (userProfileData?.sleep_tracking_enabled && istHour >= 18 && !localStorage.getItem(`gate_sleep_afternoon_${todayStr}`)) setSleepModal('afternoon');
        if (userProfileData?.syllabus_progress) setCompletedTopics(userProfileData.syllabus_progress);
        if (userProfileData?.target_exam_date) {
          setTargetDate(userProfileData.target_exam_date);
          setTempDate(userProfileData.target_exam_date);
        }
        if (progData) setGlobalProgress(new Set(progData.map(p => p.material_id)));
        
        if (goalData && goalData.routine_data[todayStr]) {
          const blocks = goalData.routine_data[todayStr];
          setTodayBlocks(blocks);
          
          const matIds: string[] = [];
          blocks.forEach((b:any) => b.tasks.forEach((t:any) => { if (t.originalId) matIds.push(t.originalId); }));
          if (matIds.length > 0) {
            let matQuery = supabase.from('study_materials').select('id, url').in('id', matIds);
            if (userProfileData?.branch) matQuery = matQuery.eq('stream', userProfileData.branch);
            const { data: mats } = await matQuery;
            if (mats) {
              const urlMap: Record<string, string> = {};
              mats.forEach(m => { urlMap[m.id] = m.url; });
              setTaskUrls(urlMap);
            }
          }
        }
        
        const trueTodayXp = trackingData?.xp_earned || 0;
        setTodayXp(trueTodayXp);
        setIsTodaySecured(trueTodayXp >= 200); 
        setIsLoading(false);
      }
    };
    loadDashboardData();
    return () => { isMounted = false; };
  }, []);

  const { totalPercentage, remainingPercentage } = useMemo(() => {
    let total = 0, completed = 0;
    GATE_SYLLABUS.forEach(sub => sub.topics.forEach(top => {
      total += top.weight;
      if (completedTopics.includes(top.id)) completed += top.weight;
    }));
    const perc = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
    return { totalPercentage: perc, remainingPercentage: 100 - perc };
  }, [completedTopics]);

  const { daysRemaining, isUrgent } = useMemo(() => {
    if (!targetDate) return { daysRemaining: 0, isUrgent: false };
    const now = getISTNow();
    const target = new Date(`${targetDate}T00:00:00+05:30`);
    const diff = target.getTime() - now.getTime();
    const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    return { daysRemaining: days, isUrgent: days < 150 && remainingPercentage > 40 }; 
  }, [targetDate, remainingPercentage]);

  const gateExamDaysRemaining = useMemo(() => {
    const today = getISTNow();
    const exam = new Date('2027-02-07T00:00:00');
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.ceil((exam.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)));
  }, []);

  const allTodayTasks = useMemo(() => {
    const tasks: any[] = [];
    todayBlocks.forEach(block => {
      block.tasks.forEach((task: any) => {
        tasks.push({ ...task, blockStart: block.start, blockEnd: block.end, blockColor: block.color || 'indigo' });
      });
    });
    return tasks;
  }, [todayBlocks]);

  const saveTargetDate = async () => {
    if (!tempDate) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setTargetDate(tempDate); setIsEditingDate(false);
    try {
      const response = await fetch('/api/sync-target-date', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session.user.id, targetDate: tempDate }) });
      if (!response.ok) throw new Error("Server Error");
      toast.success('Timeline Locked', { style: { background: '#121214', color: '#10b981', border: '1px solid #059669', borderRadius: '12px' }});
    } catch (error: any) { toast.error(`Sync Failed`); }
  };

  const toggleTopic = (topicId: string) => {
    let newTopics = [...completedTopics];
    if (newTopics.includes(topicId)) newTopics = newTopics.filter(id => id !== topicId); else newTopics.push(topicId); 
    setCompletedTopics(newTopics);
    setHasUnsavedChanges(true);
  };

  const syncSyllabusToServer = async () => {
    if (!hasUnsavedChanges) {
        setShowSyllabusModal(false);
        return;
    }
    setIsSyncing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const response = await fetch('/api/sync-syllabus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: session.user.id, topics: completedTopics }) });
      if (!response.ok) throw new Error("Transmission failed");
      toast.success('Matrix Synchronized', { style: { background: '#121214', color: '#10b981', border: '1px solid #059669', borderRadius: '12px' }});
      setHasUnsavedChanges(false);
      setShowSyllabusModal(false);
    } catch (error) { 
      toast.error('Network Error: Sync Failed.'); 
    }
    setIsSyncing(false);
  };

  const toggleSubjectExpand = (subject: string) => setExpandedSubjects(prev => prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]);

  if (isLoading) return <div className="min-h-screen bg-[#050505] flex flex-col gap-4 items-center justify-center text-emerald-500 font-bold tracking-widest text-[10px] uppercase animate-pulse"><Activity size={32} className="animate-spin text-emerald-500"/>Compiling Command Center...</div>;
  
  const isOvercharged = todayXp > 200;
  const calculateSleepMinutes = (bed: string, wake: string) => {
    if (!bed || !wake) return 0;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let start = bh * 60 + bm;
    let end = wh * 60 + wm;
    if (end <= start) end += 1440;
    return Math.max(0, end - start);
  };

  const saveSleepPreference = async (value: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('user_profiles').update({ track_masturbation: value, sleep_masturbation_prompted: true }).eq('user_id', session.user.id);
    if (error) { toast.error(error.message); return; }
    setTrackMasturbation(value);
    setSleepMastPrompted(true);
    setSleepModal('morning');
  };

  const saveSleepCheckIn = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const todayStr = getISTDateString(getISTNow());
    setSavingSleep(true);
    const existing = sleepRow || {};
    const night = sleepModal === 'afternoon' ? Number(existing.night_sleep_minutes || 0) : calculateSleepMinutes(sleepBed, sleepWake);
    const afternoon = sleepModal === 'morning' ? Number(existing.afternoon_sleep_minutes || 0) : Math.max(0, Math.round(Number(sleepNap) || 0));
    if (sleepModal === 'morning' && (!sleepBed || !sleepWake)) {
      toast.error('Please enter your sleep and wake time.');
      setSavingSleep(false);
      return;
    }
    const { data, error } = await supabase.from('sleep_tracking').upsert({
      user_id: session.user.id, date_str: todayStr,
      bed_time: sleepModal === 'morning' ? sleepBed : (existing.bed_time || null),
      wake_time: sleepModal === 'morning' ? sleepWake : (existing.wake_time || null),
      night_sleep_minutes: night,
      afternoon_sleep_minutes: afternoon,
      masturbation: trackMasturbation ? (sleepModal === 'morning' ? (sleepMast === '' ? null : sleepMast === 'yes') : (existing.masturbation ?? null)) : null,
    }, { onConflict: 'user_id,date_str' }).select().single();
    setSavingSleep(false);
    if (error) { toast.error(error.message); return; }
    setSleepRow(data);
    if (sleepModal === 'afternoon') localStorage.setItem(`gate_sleep_afternoon_${todayStr}`, '1');
    setSleepModal(null);
    toast.success(sleepModal === 'morning' ? 'Sleep record saved.' : 'Afternoon sleep saved.');
  };

  const xpPercent = Math.min(100, (todayXp / 200) * 100);
  const ringOffset = 138.16 - (138.16 * xpPercent) / 100;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col relative pb-10">
      
      {/* AMBIENT GLOWS */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-5%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="p-4 md:p-6 lg:p-8 max-w-[1500px] mx-auto w-full h-full flex flex-col flex-1 animate-in fade-in zoom-in-[0.98] duration-700 ease-out relative z-10">
        
        {/* ======================================================== */}
        {/* ALL-IN-ONE COMPACT TOP-RIGHT WIDGET ARRAY */}
        {/* ======================================================== */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8 shrink-0 w-full border-b border-zinc-900/80 pb-6">
          
          <div className="hidden lg:block w-full lg:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[9px] font-bold uppercase tracking-widest shadow-inner backdrop-blur-xl">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              System Online
            </div>
          </div>
          
          {/* HORIZONTAL SCROLLABLE BAR FOR WIDGETS */}
          <div className="flex items-center justify-start lg:justify-end gap-3 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-2 lg:pb-0 px-1">
            
            {/* TOTAL XP WALLET */}
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-zinc-900/40 ring-1 ring-zinc-800 shadow-sm shrink-0 whitespace-nowrap">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20"><Zap size={14} className="text-indigo-400" /></div>
              <div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-0.5">Wallet</div>
                <div className="text-xs font-black text-zinc-100 leading-none">{profile.xp.toLocaleString()} XP</div>
              </div>
            </div>

            {/* DAILY NEURAL CHARGE / STREAK */}
            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-700 shrink-0 whitespace-nowrap ${isOvercharged ? 'bg-orange-500/10 ring-1 ring-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.2)]' : isTodaySecured ? 'bg-orange-500/5 ring-1 ring-orange-500/20 shadow-sm' : 'bg-zinc-900/40 ring-1 ring-zinc-800 shadow-sm'}`}>
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
                  <circle cx="25" cy="25" r="22" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-900" />
                  <circle cx="25" cy="25" r="22" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="138.16" strokeDashoffset={ringOffset} className={`transition-all duration-1000 ease-out ${isOvercharged ? 'text-orange-400' : isTodaySecured ? 'text-orange-500' : 'text-zinc-600'}`} strokeLinecap="round" />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center ${isOvercharged ? 'animate-bounce' : isTodaySecured ? 'animate-pulse' : ''}`}>
                  <Flame size={12} className={isOvercharged ? 'text-white' : isTodaySecured ? 'text-orange-500' : 'text-zinc-700'} />
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest font-bold mb-0.5 flex items-center gap-1">
                  {isOvercharged ? <span className="text-orange-400">OVERCHARGED</span> : isTodaySecured ? <span className="text-orange-500">SECURED</span> : <span className="text-zinc-500">Goal: 200 XP</span>}
                </div>
                <div className="text-xs font-black text-zinc-100 leading-none flex items-center gap-1.5">
                  <span className={isOvercharged ? 'text-orange-300' : ''}>{todayXp}</span>
                  <div className="w-1 h-1 rounded-full bg-zinc-800 mx-0.5"></div>
                  <span className={isTodaySecured ? 'text-orange-400' : 'text-zinc-500'}>{profile.streak} Days</span>
                </div>
              </div>
            </div>

            {/* FIXED GATE 2027 COUNTDOWN */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/[0.06] ring-1 ring-red-500/20 shrink-0 whitespace-nowrap">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Calendar size={14} className="text-red-400" />
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-widest text-red-400/80 font-bold mb-0.5">GATE 2027 • FEB 7</div>
                <div className="text-sm font-black text-zinc-100 leading-none">{gateExamDaysRemaining} <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Days Remaining</span></div>
              </div>
            </div>

            {/* TARGET / TIMELINE / SYLLABUS MATRIX BUTTON */}
            {targetDate ? (
              <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                <button onClick={() => setShowSyllabusModal(true)} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-900/40 ring-1 ring-zinc-800 hover:ring-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-300 shadow-sm group">
                  <div className="text-left">
                    <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-0.5 group-hover:text-emerald-500/70 transition-colors flex items-center gap-1.5">
                      Syllabus <div className="w-1 h-1 rounded-full bg-zinc-700"></div> {totalPercentage}% Done
                    </div>
                    <div className="text-xs font-black text-zinc-100 leading-none flex items-center gap-1.5">
                      <span className={isUrgent ? 'text-red-400' : 'text-emerald-400'}>{daysRemaining} Days Left</span>
                      <span className="text-zinc-600 text-[9px] font-mono">({new Date(targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                     <Target size={14}/>
                  </div>
                </button>
                <button onClick={() => setIsEditingDate(true)} className="p-2 bg-zinc-900/40 ring-1 ring-zinc-800 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Edit3 size={14}/>
                </button>
              </div>
            ) : (
              <button onClick={() => setIsEditingDate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400 font-black text-[9px] uppercase tracking-widest transition-all hover:bg-emerald-500/20 shrink-0 whitespace-nowrap">
                <Target size={12}/> Initialize Matrix Target
              </button>
            )}
            
            {/* INLINE DATE EDITOR (Only visible when editing) */}
            {isEditingDate && (
              <div className="flex items-center gap-1.5 bg-[#0a0a0b] px-2 py-1.5 rounded-xl ring-1 ring-emerald-500/50 shadow-xl animate-in fade-in zoom-in shrink-0 whitespace-nowrap">
                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="bg-transparent text-[10px] text-zinc-200 font-bold outline-none px-2 w-28" />
                <button onClick={saveTargetDate} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 p-1.5 rounded-md transition-colors"><CheckCircle2 size={12}/></button>
                <button onClick={() => setIsEditingDate(false)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-1.5 rounded-md transition-colors"><X size={12}/></button>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* HERO SECTION: CINEMATIC TODAY'S PROTOCOL */}
        {/* ======================================================== */}
        <div className="mb-10 w-full relative z-20 flex-1">
          
          {allTodayTasks.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center shadow-inner">
                  <Play size={14} fill="currentColor" className="text-emerald-400 ml-0.5" /> 
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">Today's Protocol</h2>
              </div>

              <div className="flex gap-5 overflow-x-auto pb-6 custom-scrollbar snap-x snap-mandatory">
                {allTodayTasks.map((task: any, idx: number) => {
                  const targetId = task.originalId || task.id;
                  const isDone = globalProgress.has(targetId);
                  const thumbUrl = getYoutubeThumbnail(taskUrls[targetId]);

                  return (
                    <div key={idx} className={`snap-center shrink-0 w-[280px] sm:w-[320px] flex flex-col gap-3 group transition-all duration-300 ${isDone ? 'opacity-60' : 'hover:-translate-y-1'}`}>
                      
                      {/* Full YouTube-Style Thumbnail */}
                      <Link href={targetId && !isDone ? `/resources/${targetId}` : '#'} className={`relative w-full aspect-video rounded-xl overflow-hidden ring-1 transition-all block ${isDone ? 'ring-emerald-500/50 cursor-default' : 'ring-zinc-800 group-hover:ring-indigo-500/50 shadow-lg group-hover:shadow-[0_15px_30px_rgba(99,102,241,0.15)]'}`}>
                        {thumbUrl ? (
                           <img src={thumbUrl} alt="Thumbnail" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-zinc-900"><BookOpen size={24} className="text-zinc-700"/></div>
                        )}
                        
                        {/* Duration Badge / Done Badge */}
                        <div className="absolute bottom-2 right-2 z-10">
                           {isDone ? (
                              <div className="bg-emerald-500/90 text-zinc-950 px-2 py-0.5 rounded text-[10px] font-black backdrop-blur-md shadow-lg flex items-center gap-1">
                                <CheckCircle2 size={10}/> Done
                              </div>
                           ) : (
                              <div className="bg-black/80 text-zinc-200 px-1.5 py-0.5 rounded text-[10px] font-bold backdrop-blur-md">
                                {Math.round(task.durationMins || task.minsAllocated || 0)}m
                              </div>
                           )}
                        </div>

                        {/* Play Overlay */}
                        {!isDone && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                             <Play size={40} className="text-white drop-shadow-2xl" fill="currentColor"/>
                          </div>
                        )}
                      </Link>

                      {/* Clean Text Below Thumbnail */}
                      <div className="flex items-start gap-3 px-1">
                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ring-1 ${isDone ? 'bg-emerald-500/10 ring-emerald-500/30' : `bg-zinc-900 ring-zinc-800`}`}>
                           <span className={`text-[10px] font-black ${isDone ? 'text-emerald-500' : `text-zinc-400`}`}>{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-bold truncate leading-tight ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-100 group-hover:text-indigo-400 transition-colors'}`}>{task.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-medium text-zinc-500 truncate">{task.subject}</span>
                            <span className="text-zinc-800 text-[10px]">•</span>
                            <span className={`text-[9px] font-bold uppercase tracking-widest text-${task.blockColor}-400`}>{task.blockStart}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            // CLEAN ONBOARDING BANNER
            <div className="bg-zinc-900/40 ring-1 ring-zinc-800/80 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-zinc-800 rotate-3">
                <CalendarPlus size={28} className="text-zinc-600" />
              </div>
              <h3 className="text-xl font-black text-zinc-300 mb-2 tracking-tight group-hover:text-zinc-100 transition-colors">No Protocol Set for Today</h3>
              <p className="text-xs text-zinc-500 font-medium mb-8 max-w-sm leading-relaxed">Your timeline is empty. Deploy the AI Matrix Engine to auto-balance your workload, or construct a timeline manually.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <Link href="/auto-planner" className="flex-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-zinc-950 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest ring-1 ring-indigo-500/30 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 shadow-sm">
                  <Zap size={14}/> Deploy Auto-AI
                </Link>
                <Link href="/create-goal" className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest ring-1 ring-zinc-800 transition-all flex items-center justify-center gap-2 shadow-inner">
                  <Target size={14}/> Manual Build
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* SLEEP TRACKER */}
        {/* ======================================================== */}
        <section className="mb-10 bg-zinc-900/40 ring-1 ring-zinc-800/80 rounded-[2rem] p-5 sm:p-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center"><Moon size={19} className="text-indigo-400"/></div>
              <div><h2 className="text-lg font-black text-zinc-100">Sleep & Recovery</h2><p className="text-[10px] text-zinc-600 mt-1">{sleepEnabled ? 'Daily sleep tracking is enabled.' : 'Enable sleep tracking to record bedtime, wake time and afternoon sleep.'}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={async()=>{const {data:{session}}=await supabase.auth.getSession(); if(!session)return; const next=!sleepEnabled; const {error}=await supabase.from('user_profiles').update({sleep_tracking_enabled:next, ...(next ? {sleep_masturbation_prompted:false} : {})}).eq('user_id',session.user.id); if(error)toast.error(error.message); else {setSleepEnabled(next); if(next){setSleepMastPrompted(false); setSleepModal('setup');} toast.success(next?'Sleep tracking enabled.':'Sleep tracking disabled.');}}} className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${sleepEnabled?'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/30':'bg-zinc-950 text-zinc-400 ring-1 ring-zinc-800'}`}>{sleepEnabled?'Enabled':'Enable Sleep'}</button>
              {sleepEnabled && <Link href="/sleep-tracker" className="px-3 py-2 rounded-xl bg-zinc-950 text-zinc-400 ring-1 ring-zinc-800 hover:text-white text-[9px] font-black uppercase tracking-widest">Open Sleep Graph</Link>}
            </div>
          </div>
          {sleepEnabled && <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800"><div className="text-[8px] uppercase tracking-widest text-zinc-600">Night</div><div className="text-sm font-black text-zinc-200 mt-1">{sleepRow ? `${Math.floor(Number(sleepRow.night_sleep_minutes||0)/60)}h ${Number(sleepRow.night_sleep_minutes||0)%60}m` : 'Not recorded'}</div></div>
            <div className="p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800"><div className="text-[8px] uppercase tracking-widest text-zinc-600">Afternoon</div><div className="text-sm font-black text-zinc-200 mt-1">{sleepRow ? `${Math.floor(Number(sleepRow.afternoon_sleep_minutes||0)/60)}h ${Number(sleepRow.afternoon_sleep_minutes||0)%60}m` : 'Not recorded'}</div></div>
            <div className="p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800"><div className="text-[8px] uppercase tracking-widest text-zinc-600">Total Sleep</div><div className="text-sm font-black text-indigo-300 mt-1">{sleepRow ? `${Math.floor((Number(sleepRow.night_sleep_minutes||0)+Number(sleepRow.afternoon_sleep_minutes||0))/60)}h ${(Number(sleepRow.night_sleep_minutes||0)+Number(sleepRow.afternoon_sleep_minutes||0))%60}m` : '—'}</div></div>
            <div className="p-3 rounded-xl bg-amber-500/[0.05] ring-1 ring-amber-500/20"><div className="text-[8px] uppercase tracking-widest text-amber-400">GATE Focus</div><div className="text-[10px] font-bold text-zinc-400 mt-1">{gateExamDaysRemaining} days left • protect sleep, then add focused study.</div></div>
          </div>}
        </section>

        {/* ======================================================== */}
        {/* LOWER SECTION: SPLIT MATRIX PLANNERS */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 w-full xl:w-5/6 mx-auto mt-auto">
          
          {/* Card 0: Daily Study Tracker */}
          <Link href="/daily-tracker" className="group bg-zinc-900/40 ring-1 ring-zinc-800/80 rounded-[2rem] p-6 sm:p-8 transition-all duration-500 hover:ring-emerald-500/40 hover:-translate-y-1 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
               <div className="w-12 h-12 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 ease-out">
                 <Activity size={20} className="text-emerald-400" />
               </div>
               <div className="bg-zinc-950/80 ring-1 ring-zinc-800 px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-widest text-zinc-500">Daily Log</div>
            </div>

            <h3 className="text-lg font-black text-zinc-100 mb-2 relative z-10 tracking-tight group-hover:text-emerald-100 transition-colors">Daily Tracker</h3>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-6 flex-1 relative z-10">
              See exactly what you completed each day, total lecture hours, your consistency, and every exam score in one place.
            </p>

            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 relative z-10">
              Open Daily Report <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 1: AI Auto Planner */}
          <Link href="/auto-planner" className="group bg-zinc-900/40 ring-1 ring-zinc-800/80 rounded-[2rem] p-6 sm:p-8 transition-all duration-500 hover:ring-indigo-500/40 hover:-translate-y-1 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
               <div className="w-12 h-12 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500 ease-out">
                 <Network size={20} className="text-indigo-400" />
               </div>
               <div className="bg-zinc-950/80 ring-1 ring-zinc-800 px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-widest text-zinc-500">Automated</div>
            </div>
            
            <h3 className="text-lg font-black text-zinc-100 mb-2 relative z-10 tracking-tight group-hover:text-indigo-100 transition-colors">Auto-AI Engine</h3>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-6 flex-1 relative z-10">
              The engine mathematically distributes your syllabus evenly across remaining days. Best for hands-off scheduling.
            </p>
            
            <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 relative z-10">
              Initialize Engine <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Manual Architect */}
          <Link href="/create-goal" className="group bg-zinc-900/40 ring-1 ring-zinc-800/80 rounded-[2rem] p-6 sm:p-8 transition-all duration-500 hover:ring-zinc-600 hover:-translate-y-1 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-700/5 rounded-full blur-[40px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
               <div className="w-12 h-12 bg-zinc-800/50 ring-1 ring-zinc-700 rounded-xl flex items-center justify-center shadow-inner group-hover:-rotate-12 transition-transform duration-500 ease-out">
                 <CalendarPlus size={20} className="text-zinc-400" />
               </div>
               <div className="bg-zinc-950/80 ring-1 ring-zinc-800 px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-widest text-zinc-500">Manual</div>
            </div>
            
            <h3 className="text-lg font-black text-zinc-100 mb-2 relative z-10 tracking-tight group-hover:text-zinc-100 transition-colors">Manual Architect</h3>
            <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mb-6 flex-1 relative z-10">
              Drag and drop specific topics into custom time blocks. Best for highly specific, day-by-day micromanagement.
            </p>
            
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 relative z-10">
              Construct Build <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>
      </div>

      {sleepModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0a0a0b] ring-1 ring-zinc-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6"><div className="w-11 h-11 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center"><Moon size={19} className="text-indigo-400"/></div><div><div className="text-[8px] uppercase tracking-widest text-indigo-400 font-black">Daily Sleep Check-in</div><h2 className="text-xl font-black text-zinc-100">{sleepModal === 'setup' ? 'Sleep tracking setup' : sleepModal === 'morning' ? 'Good morning. Log last night.' : 'Afternoon sleep check'}</h2></div></div>
            {sleepModal === 'setup' ? <div className="space-y-5"><p className="text-xs text-zinc-500">Sleep tracking is enabled. Do you also want the app to ask a private masturbation question in your morning sleep check-in?</p><div className="grid grid-cols-2 gap-3"><button onClick={()=>saveSleepPreference(true)} className="py-4 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30 text-rose-300 text-xs font-black">Yes, track it</button><button onClick={()=>saveSleepPreference(false)} className="py-4 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800 text-zinc-300 text-xs font-black">No, skip it</button></div></div> : sleepModal === 'morning' ? <div className="space-y-4">
              <p className="text-xs text-zinc-500">Enter the times yourself. The app will calculate your night sleep automatically.</p>
              <div className="grid grid-cols-2 gap-3"><label className="text-[9px] uppercase tracking-widest text-zinc-500">When did you go to sleep?<input type="time" value={sleepBed} onChange={e=>setSleepBed(e.target.value)} className="mt-1 w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-zinc-100"/></label><label className="text-[9px] uppercase tracking-widest text-zinc-500">When did you wake up?<input type="time" value={sleepWake} onChange={e=>setSleepWake(e.target.value)} className="mt-1 w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-zinc-100"/></label></div>
              {trackMasturbation && <label className="block text-[9px] uppercase tracking-widest text-zinc-500">Did you masturbate last night?<select value={sleepMast} onChange={e=>setSleepMast(e.target.value)} className="mt-1 w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-zinc-100"><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>}
            </div> : <div className="space-y-4"><p className="text-xs text-zinc-500">Did you sleep this afternoon? Enter the total nap duration. Use 0 if you did not sleep.</p><label className="block text-[9px] uppercase tracking-widest text-zinc-500">Afternoon sleep (minutes)<input type="number" min="0" value={sleepNap} onChange={e=>setSleepNap(e.target.value)} placeholder="0" className="mt-1 w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-zinc-100"/></label></div>}
            <div className="flex items-center justify-end gap-2 mt-7"><button onClick={()=>{if(sleepModal==='afternoon'){localStorage.setItem(`gate_sleep_afternoon_${getISTDateString(getISTNow())}`,'1')}setSleepModal(null)}} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-zinc-500 ring-1 ring-zinc-800 text-[9px] font-black uppercase tracking-widest">Later</button><button onClick={saveSleepCheckIn} disabled={savingSleep} className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest">{savingSleep?'Saving...':'Save Sleep'}</button></div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PREMIUM OPTIMIZED MODAL (SYLLABUS) */
      {/* ======================================================== */}
      {showSyllabusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#050505]/80 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-[#0a0a0b] ring-1 ring-zinc-800 rounded-[2rem] w-full max-w-[850px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="bg-zinc-900/30 border-b border-zinc-800 p-6 sm:p-8 shrink-0 relative z-20 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl shadow-inner"><CheckSquare size={24} className="text-emerald-500"/></div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-none mb-1.5">GATE ECE Matrix</h2>
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span className="flex items-center gap-1"><Clock size={10} className="text-emerald-500/70"/> {daysRemaining} Days</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                    <span className="text-emerald-400/80">{totalPercentage}% Mastered</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowSyllabusModal(false)} className="p-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors ring-1 ring-zinc-800"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
              <div className="space-y-3">
                {GATE_SYLLABUS.map((subjectData, sIdx) => {
                  const isExpanded = expandedSubjects.includes(subjectData.subject);
                  const subTotalWeight = subjectData.topics.reduce((acc, t) => acc + t.weight, 0);
                  const subCompletedWeight = subjectData.topics.filter(t => completedTopics.includes(t.id)).reduce((acc, t) => acc + t.weight, 0);
                  const subPercent = subTotalWeight === 0 ? 0 : Math.round((subCompletedWeight / subTotalWeight) * 100);
                  const isSubComplete = subPercent === 100;

                  return (
                    <div key={sIdx} className={`rounded-2xl overflow-hidden transition-all duration-300 ring-1 ${isExpanded ? 'ring-zinc-700 bg-zinc-900/20 shadow-lg' : 'ring-zinc-800/80 bg-transparent hover:bg-zinc-900/40'}`}>
                      
                      <button onClick={() => toggleSubjectExpand(subjectData.subject)} className="w-full p-4 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-1 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-zinc-800 rotate-180' : 'bg-transparent'}`}>
                            <ChevronDown size={14} className={isExpanded ? 'text-zinc-200' : 'text-zinc-500'}/>
                          </div>
                          <h3 className={`text-xs sm:text-sm font-bold tracking-tight text-left ${isSubComplete ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {subjectData.subject}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          {isSubComplete && <CheckCircle2 size={14} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                          <div className="text-[9px] font-bold text-zinc-400 bg-zinc-950 px-2 py-1 rounded-md ring-1 ring-zinc-800">{subPercent}%</div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2 sm:p-4 pt-0 space-y-1 animate-in slide-in-from-top-2 duration-200 ease-out">
                          {subjectData.topics.map(topic => {
                            const isDone = completedTopics.includes(topic.id);
                            return (
                              <div key={topic.id} onClick={() => toggleTopic(topic.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 group ring-1 ${isDone ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-zinc-950 ring-zinc-800 hover:ring-zinc-600 hover:bg-zinc-900'}`}>
                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                  <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center ring-1 transition-all duration-200 ${isDone ? 'bg-emerald-500 ring-emerald-500 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'ring-zinc-700 bg-black group-hover:ring-zinc-500'}`}>
                                    {isDone && <CheckSquare size={10} strokeWidth={3} />}
                                  </div>
                                  <span className={`text-xs font-medium truncate transition-colors ${isDone ? 'text-emerald-500/70 line-through' : 'text-zinc-300 group-hover:text-white'}`}>{topic.name}</span>
                                </div>
                                <span className={`text-[9px] font-mono shrink-0 ${isDone ? 'text-emerald-500/40' : 'text-zinc-600'}`}>{topic.weight}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* OPTIMIZED BATCH SAVE BUTTON */}
            <div className="bg-zinc-900/30 border-t border-zinc-800 p-4 shrink-0 flex justify-between items-center relative z-20">
               {hasUnsavedChanges ? (
                 <>
                   <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                     <AlertTriangle size={12}/> Unsaved Changes
                   </span>
                   <button onClick={syncSyllabusToServer} disabled={isSyncing} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2 disabled:opacity-50">
                     {isSyncing ? <Activity size={14} className="animate-spin"/> : <Save size={14}/>} {isSyncing ? 'Syncing...' : 'Sync to Server'}
                   </button>
                 </>
               ) : (
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                   <ShieldCheck size={12} className="text-emerald-500"/> Matrix Synchronized
                 </span>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
