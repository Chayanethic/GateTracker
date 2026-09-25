'use client';

import Link from 'next/link';
import { 
  Target, Activity, Zap, Flame, ArrowRight, 
  CalendarPlus, CheckCircle2, ShieldCheck, AlertTriangle, X, Edit3, Calendar,
  Play, Link as LinkIcon, CheckSquare, Clock, ChevronDown, BookOpen, Layers, Sparkles, HelpCircle, Network, Save
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { getUserProfile } from '../../../lib/dataService';
import toast from 'react-hot-toast';
import WeeklyTargetPanel from '../../../components/dashboard/WeeklyTargetPanel';
import DashboardStudyInsights from '../../../components/dashboard/DashboardStudyInsights';

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
  const [curriculumMaterials, setCurriculumMaterials] = useState<any[]>([]);
  const [activeGoal, setActiveGoal] = useState<any | null>(null);
  
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

      const { data: userProfileData } = await supabase.from('user_profiles').select('streak, syllabus_progress, target_exam_date, branch').eq('user_id', session.user.id).single();
      const xpData = await getUserProfile(session.user.id);
      const { data: trackingData } = await supabase.from('daily_tracking').select('xp_earned').eq('user_id', session.user.id).eq('date_str', todayStr).maybeSingle();
      const { data: progData } = await supabase.from('user_progress').select('material_id').eq('user_id', session.user.id);

      let curriculumQuery = supabase
        .from('study_materials')
        .select('id, subject_name, topic_name, title, stream');
      if (userProfileData?.branch) curriculumQuery = curriculumQuery.eq('stream', userProfileData.branch);
      const { data: curriculumData } = await curriculumQuery;

      const { data: goalData } = await supabase.from('study_goals')
        .select('*')
        .eq('user_id', session.user.id)
        .lte('start_date', todayStr)
        .gte('target_date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1).single();

      if (isMounted) {
        setProfile({ xp: xpData?.xp || 0, streak: userProfileData?.streak || 0 });
        if (userProfileData?.syllabus_progress) setCompletedTopics(userProfileData.syllabus_progress);
        if (userProfileData?.target_exam_date) {
          setTargetDate(userProfileData.target_exam_date);
          setTempDate(userProfileData.target_exam_date);
        }
        if (progData) setGlobalProgress(new Set(progData.map(p => p.material_id)));
        setCurriculumMaterials(curriculumData || []);
        setActiveGoal(goalData || null);
        
        if (goalData && goalData.routine_data[todayStr]) {
          const blocks = goalData.routine_data[todayStr];
          setTodayBlocks(blocks);
          
          const matIds: string[] = [];
          blocks.forEach((b:any) => b.tasks.forEach((t:any) => { if (t.originalId || t.id) matIds.push(t.originalId || t.id); }));
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
        {/* WEEKLY TARGET + CURRICULUM PROGRESS */}
        {/* ======================================================== */}
        <WeeklyTargetPanel
          goal={activeGoal}
          curriculum={curriculumMaterials}
          completedIds={globalProgress}
          today={getISTDateString(getISTNow())}
        />

        <DashboardStudyInsights
          curriculum={curriculumMaterials}
          completedIds={globalProgress}
        />


        {/* ======================================================== */}
        {/* COMPACT PROTOCOL + TOOLS */}
        {/* ======================================================== */}
        <section className="mt-6 mb-6 w-full space-y-3 relative z-10">
          <div className="rounded-2xl bg-zinc-950/80 ring-1 ring-white/10 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Play size={13} fill="currentColor" className="text-emerald-400 ml-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-white">Today&apos;s Protocol</h2>
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-500">{allTodayTasks.length} tasks</span>
                  </div>
                  <p className="truncate text-[9px] text-zinc-600">Your scheduled lectures — open, watch, and finish.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {allTodayTasks.length > 0 && <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[8px] font-black text-emerald-300 ring-1 ring-emerald-500/20">{allTodayTasks.filter((t:any) => globalProgress.has(t.originalId || t.id)).length}/{allTodayTasks.length} done</span>}
                <Link href="/daily-tracker" className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider text-zinc-400 ring-1 ring-white/10 hover:text-white">Daily tracker</Link>
              </div>
            </div>

            {allTodayTasks.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto p-3 custom-scrollbar">
                {allTodayTasks.map((task: any, idx: number) => {
                  const targetId = task.originalId || task.id;
                  const isDone = globalProgress.has(targetId);
                  const thumbUrl = getYoutubeThumbnail(taskUrls[targetId]);
                  return (
                    <Link key={`${targetId}-${idx}`} href={`/resources/${targetId}`} className={`group flex min-w-[220px] max-w-[260px] items-center gap-3 rounded-xl bg-white/[0.025] p-2 ring-1 transition hover:bg-white/[0.045] ${isDone ? 'ring-emerald-500/20 opacity-65' : 'ring-white/5 hover:ring-indigo-500/30'}`}>
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5">
                        {thumbUrl ? <img src={thumbUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><BookOpen size={17} className="text-zinc-700" /></div>}
                        {isDone ? <span className="absolute bottom-1 right-1 rounded bg-emerald-500 px-1 py-0.5 text-[7px] font-black text-zinc-950">DONE</span> : <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[7px] font-bold text-zinc-300">{Math.round(task.durationMins || task.minsAllocated || 0)}m</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[10px] font-black ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-200 group-hover:text-indigo-300'}`}>{task.title}</div>
                        <div className="mt-1 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-600">{task.subject} • {task.blockStart}</div>
                      </div>
                      <Play size={12} fill="currentColor" className={isDone ? 'text-emerald-500/40' : 'text-indigo-400'} />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500"><CalendarPlus size={15} className="text-zinc-600" /> No protocol scheduled today.</div>
                <div className="flex gap-2">
                  <Link href="/auto-planner" className="rounded-lg bg-indigo-500/10 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20"><Zap size={11} className="mr-1 inline" /> Auto-AI</Link>
                  <Link href="/create-goal" className="rounded-lg bg-white/[0.03] px-3 py-2 text-[8px] font-black uppercase tracking-wider text-zinc-400 ring-1 ring-white/10 hover:text-white"><Target size={11} className="mr-1 inline" /> Manual</Link>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Link href="/daily-tracker" className="group flex items-center gap-3 rounded-xl bg-zinc-950/70 px-3.5 py-3 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-emerald-500/30">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20"><Activity size={14} className="text-emerald-400" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-zinc-200">Daily Tracker</div><div className="truncate text-[8px] text-zinc-600">Hours, consistency & exam logs</div></div><ArrowRight size={12} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-400" />
            </Link>
            <Link href="/auto-planner" className="group flex items-center gap-3 rounded-xl bg-zinc-950/70 px-3.5 py-3 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-indigo-500/30">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20"><Network size={14} className="text-indigo-400" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-zinc-200">Auto-AI Engine</div><div className="truncate text-[8px] text-zinc-600">Auto-balance your syllabus</div></div><ArrowRight size={12} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
            </Link>
            <Link href="/create-goal" className="group flex items-center gap-3 rounded-xl bg-zinc-950/70 px-3.5 py-3 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-zinc-600">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700"><CalendarPlus size={14} className="text-zinc-400" /></div>
              <div className="min-w-0 flex-1"><div className="text-[10px] font-black text-zinc-200">Manual Target</div><div className="truncate text-[8px] text-zinc-600">Build your own schedule</div></div><ArrowRight size={12} className="text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
            </Link>
          </div>
        </section>

      {/* ======================================================== */}
      {/* PREMIUM OPTIMIZED MODAL (SYLLABUS) */}
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
