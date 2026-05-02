'use client';

import Link from 'next/link';
import { 
  BookOpen, Target, Activity, Zap, Flame, ArrowRight, 
  CalendarPlus, CheckCircle2, ShieldCheck, AlertCircle, 
  Clock, CheckSquare, ChevronDown, AlertTriangle, X, Edit3, Calendar
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
  const [isTodaySecured, setIsTodaySecured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState('');
  
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const getISTNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const getISTDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    let isMounted = true;
    const loadDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;

      const todayStr = getISTDateString(getISTNow());

      const { data: userProfileData } = await supabase.from('user_profiles').select('streak, syllabus_progress, target_exam_date').eq('user_id', session.user.id).single();
      const xpData = await getUserProfile(session.user.id);
      const { data: trackingData } = await supabase.from('daily_tracking').select('completion_percent').eq('user_id', session.user.id).eq('date_str', todayStr).maybeSingle();

      if (isMounted) {
        setProfile({ xp: xpData?.xp || 0, streak: userProfileData?.streak || 0 });
        if (userProfileData?.syllabus_progress) setCompletedTopics(userProfileData.syllabus_progress);
        if (userProfileData?.target_exam_date) {
          setTargetDate(userProfileData.target_exam_date);
          setTempDate(userProfileData.target_exam_date);
        }
        if (trackingData && trackingData.completion_percent === 100) setIsTodaySecured(true);
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

  const saveTargetDate = async () => {
    if (!tempDate) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    setTargetDate(tempDate);
    setIsEditingDate(false);
    
    try {
      const response = await fetch('/api/sync-target-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, targetDate: tempDate })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server Error: ${response.status}`);
      }
      toast.success('Timeline Locked', { style: { background: '#121214', color: '#10b981', border: '1px solid #059669', borderRadius: '12px' }});
    } catch (error: any) {
      toast.error(`Sync Failed: ${error.message}`);
    }
  };

  const toggleTopic = async (topicId: string) => {
    setIsSyncing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let newTopics = [...completedTopics];
    if (newTopics.includes(topicId)) newTopics = newTopics.filter(id => id !== topicId); 
    else newTopics.push(topicId); 
    
    setCompletedTopics(newTopics);
    
    try {
      const response = await fetch('/api/sync-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, topics: newTopics })
      });
      if (!response.ok) throw new Error("Server transmission failed");
    } catch (error) {
      toast.error('Network Error: Changes may not have saved.');
    }
    setIsSyncing(false);
  };

  const toggleSubjectExpand = (subject: string) => setExpandedSubjects(prev => prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]);

  if (isLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-emerald-500 font-bold tracking-widest text-xs animate-pulse">Initializing Command Center...</div>;
  const isHotStreak = profile.streak >= 3;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col relative">
      
      {/* ADVANCED AMBIENT GLOWS */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full h-full flex flex-col flex-1 animate-in fade-in zoom-in-[0.98] duration-700 ease-out relative z-10">
        
        {/* ======================================================== */}
        {/* PREMIUM HEADER */}
        {/* ======================================================== */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 pb-6 border-b border-white/5 shrink-0">
          <div className="w-full sm:w-auto text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Online
            </div>
            <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-br from-zinc-100 to-zinc-500 bg-clip-text text-transparent tracking-tight">
              Command Center
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* GLASSMORPHISM STREAK WIDGET */}
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-xl transition-all duration-500 ${isHotStreak ? 'bg-orange-500/10 ring-1 ring-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'bg-zinc-900/50 ring-1 ring-white/10 shadow-lg'}`}>
              <div className={`p-1.5 rounded-xl ${isHotStreak ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                <Flame size={16} className={isHotStreak ? 'text-orange-500 animate-pulse' : 'text-zinc-400'} />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-0.5">Active Streak</div>
                <div className="text-sm font-extrabold text-zinc-100 leading-none flex items-center gap-1.5">
                  {profile.streak} Days {isTodaySecured && <ShieldCheck size={14} className="text-emerald-500"/>}
                </div>
              </div>
            </div>
            
            {/* GLASSMORPHISM XP WIDGET */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-indigo-500/10 backdrop-blur-xl ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <div className="p-1.5 rounded-xl bg-indigo-500/20">
                <Zap size={16} className="text-indigo-400" />
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-indigo-400/70 font-bold mb-0.5">Focus Wallet</div>
                <div className="text-sm font-extrabold text-zinc-100 leading-none">{profile.xp.toLocaleString()} XP</div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* GRID LAYOUT */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* LEFT: THE REALITY CHECK ENGINE */}
          <div className="lg:col-span-5 xl:col-span-4 h-full flex flex-col">
            <div className={`flex-1 rounded-[2rem] p-8 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700 border ${isUrgent ? 'bg-red-950/20 backdrop-blur-2xl ring-1 ring-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)]' : 'bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl'}`}>
              
              {isUrgent && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}

              {/* Editable Target Date */}
              <div className="absolute top-5 right-5 z-20">
                {isEditingDate ? (
                  <div className="flex items-center gap-1.5 bg-zinc-950/80 backdrop-blur-md p-1.5 rounded-xl ring-1 ring-white/20 shadow-xl animate-in slide-in-from-top-2">
                    <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="bg-transparent text-xs text-zinc-200 font-bold outline-none px-2" />
                    <button onClick={saveTargetDate} className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg hover:bg-emerald-500 hover:text-zinc-900 transition-colors"><CheckCircle2 size={14}/></button>
                    <button onClick={() => setIsEditingDate(false)} className="bg-white/5 text-zinc-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={14}/></button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingDate(true)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-100 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg ring-1 ring-white/5 transition-all">
                    <Calendar size={12}/> {targetDate ? new Date(targetDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'Set Target'} <Edit3 size={10} className="ml-1 opacity-50"/>
                  </button>
                )}
              </div>

              {!targetDate ? (
                <div className="text-center space-y-5">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto ring-1 ring-white/10 shadow-inner">
                    <Target size={32} className="text-zinc-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-200 mb-2">Initialize Engine</h2>
                    <p className="text-sm text-zinc-500 max-w-[250px] mx-auto leading-relaxed">Lock in your exam date to activate the countdown matrix.</p>
                  </div>
                  <button onClick={() => setIsEditingDate(true)} className="bg-emerald-500 text-zinc-950 font-extrabold text-sm px-8 py-3 rounded-xl hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]">Activate</button>
                </div>
              ) : (
                <>
                  {/* Glowing Circular Progress */}
                  <div className="relative w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center mb-8 z-10 group">
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-800" />
                      <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="276.46" strokeDashoffset={276.46 - (276.46 * totalPercentage) / 100} className={`transition-all duration-1000 ease-out drop-shadow-[0_0_8px_currentColor] ${isUrgent ? 'text-red-500' : 'text-emerald-500'}`} strokeLinecap="round" />
                    </svg>
                    
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className={`text-6xl sm:text-7xl font-black tracking-tighter ${isUrgent ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'text-zinc-100'}`}>
                        {daysRemaining}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500 mt-2">Days Left</span>
                    </div>
                  </div>

                  <div className="w-full max-w-[300px] z-10">
                    <div className="flex justify-between items-end mb-6 px-4">
                      <div className="text-left">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Remaining</div>
                        <div className={`text-2xl font-black flex items-baseline gap-1 ${isUrgent ? 'text-red-400' : 'text-zinc-300'}`}>
                          {remainingPercentage}% <span className="text-[10px] font-semibold text-zinc-600 tracking-normal mb-1">Syllabus</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Completed</div>
                        <div className="text-2xl font-black text-emerald-400 flex items-baseline justify-end gap-1">
                          {totalPercentage}% <span className="text-[10px] font-semibold text-emerald-500/40 tracking-normal mb-1">Done</span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setShowSyllabusModal(true)}
                      className={`w-full py-4 rounded-2xl font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${isUrgent ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]'}`}
                    >
                      <CheckSquare size={16} /> Open Syllabus Matrix
                    </button>
                    
                    {isUrgent && (
                      <div className="mt-5 text-[10px] font-bold uppercase tracking-widest text-red-400/90 flex items-center justify-center gap-1.5 animate-pulse bg-red-500/10 py-2 rounded-xl ring-1 ring-red-500/20">
                        <AlertTriangle size={12} /> Critical Deficit Detected
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: ACTION GRID */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* Primary Action Card */}
            <Link href="/resources" className="flex-1 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem] p-8 sm:p-10 transition-all duration-500 hover:ring-indigo-500/50 hover:bg-zinc-900/60 shadow-2xl flex flex-col justify-center hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="w-20 h-20 shrink-0 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-700 ease-out">
                  <BookOpen size={36} className="text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 mb-3 tracking-tight group-hover:text-indigo-50 transition-colors">Curriculum Hub</h2>
                  <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-md">Access your structured syllabus, track modular completion, and enter distraction-free Focus Rooms.</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:ring-indigo-400 group-hover:text-white text-zinc-500 transition-all duration-300 shrink-0">
                  <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Secondary Action Split */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <Link href="/daily-goal" className="group bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem] p-6 sm:p-8 hover:ring-emerald-500/50 transition-all duration-500 shadow-xl hover:-translate-y-1 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-0"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="w-14 h-14 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-[1rem] flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500 ease-out">
                    <Target size={24} className="text-emerald-400" />
                  </div>
                  {isTodaySecured && <CheckCircle2 className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" size={20}/>}
                </div>
                <h3 className="text-xl font-black text-zinc-100 mb-2 relative z-10">Daily HUD</h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed mb-6 flex-1 relative z-10">Execute protocol & log progression.</p>
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 relative z-10">
                  Enter HUD <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              <Link href="/create-goal" className="group bg-zinc-900/40 backdrop-blur-xl ring-1 ring-white/10 rounded-[2rem] p-6 sm:p-8 hover:ring-rose-500/50 transition-all duration-500 shadow-xl hover:-translate-y-1 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-[60px] pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-0"></div>
                <div className="w-14 h-14 bg-rose-500/10 ring-1 ring-rose-500/20 rounded-[1rem] flex items-center justify-center mb-6 shadow-inner group-hover:-rotate-12 transition-transform duration-500 ease-out relative z-10">
                  <CalendarPlus size={24} className="text-rose-400" />
                </div>
                <h3 className="text-xl font-black text-zinc-100 mb-2 relative z-10">Matrix Planner</h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed mb-6 flex-1 relative z-10">Architect capacity & deploy schedules.</p>
                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5 relative z-10">
                  Build Routine <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
            
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PREMIUM NATIVE-STYLE MODAL */}
      {/* ======================================================== */}
      {showSyllabusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#050505]/80 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="bg-zinc-950/80 backdrop-blur-2xl ring-1 ring-white/10 rounded-[2rem] w-full max-w-[850px] max-h-[90vh] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-white/[0.02] border-b border-white/5 p-6 sm:p-8 shrink-0 relative z-20 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl shadow-inner"><CheckSquare size={24} className="text-emerald-500"/></div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-none mb-1.5">GATE ECE Matrix</h2>
                  <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
                    <span className="flex items-center gap-1"><Clock size={12} className="text-emerald-500/70"/> {daysRemaining} Days Left</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                    <span className="text-emerald-400/80">{totalPercentage}% Mastered</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowSyllabusModal(false)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"><X size={18}/></button>
            </div>

            {/* Accordion Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
              <div className="space-y-4">
                {GATE_SYLLABUS.map((subjectData, sIdx) => {
                  const isExpanded = expandedSubjects.includes(subjectData.subject);
                  const subTotalWeight = subjectData.topics.reduce((acc, t) => acc + t.weight, 0);
                  const subCompletedWeight = subjectData.topics.filter(t => completedTopics.includes(t.id)).reduce((acc, t) => acc + t.weight, 0);
                  const subPercent = subTotalWeight === 0 ? 0 : Math.round((subCompletedWeight / subTotalWeight) * 100);
                  const isSubComplete = subPercent === 100;

                  return (
                    <div key={sIdx} className={`rounded-2xl overflow-hidden transition-all duration-500 ring-1 ${isExpanded ? 'ring-white/10 bg-white/[0.02] shadow-xl' : 'ring-white/5 bg-transparent hover:bg-white/[0.02]'}`}>
                      
                      <button onClick={() => toggleSubjectExpand(subjectData.subject)} className="w-full p-4 sm:p-5 flex items-center justify-between transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-white/10 rotate-180' : 'bg-transparent'}`}>
                            <ChevronDown size={16} className={isExpanded ? 'text-zinc-200' : 'text-zinc-500'}/>
                          </div>
                          <h3 className={`text-sm sm:text-base font-bold tracking-tight text-left ${isSubComplete ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {subjectData.subject}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          {isSubComplete && <CheckCircle2 size={16} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                          <div className="text-[11px] font-bold text-zinc-400 bg-black/40 px-2.5 py-1 rounded-md ring-1 ring-white/5">{subPercent}%</div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 sm:p-5 pt-0 space-y-1.5 animate-in slide-in-from-top-2 duration-300 ease-out">
                          {subjectData.topics.map(topic => {
                            const isDone = completedTopics.includes(topic.id);
                            return (
                              <div key={topic.id} onClick={() => !isSyncing && toggleTopic(topic.id)} className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-300 group ring-1 ${isDone ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-black/20 ring-white/5 hover:ring-white/10 hover:bg-white/5'}`}>
                                <div className="flex items-center gap-4 min-w-0 pr-4">
                                  <div className={`w-5 h-5 shrink-0 rounded-[4px] flex items-center justify-center ring-1 transition-all duration-300 ${isDone ? 'bg-emerald-500 ring-emerald-500 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'ring-white/20 bg-black/50 group-hover:ring-emerald-500/50'}`}>
                                    {isDone && <CheckSquare size={12} strokeWidth={3} />}
                                  </div>
                                  <span className={`text-sm font-medium truncate transition-colors ${isDone ? 'text-emerald-500/70 line-through' : 'text-zinc-300 group-hover:text-zinc-100'}`}>{topic.name}</span>
                                </div>
                                <span className={`text-[10px] font-mono shrink-0 ${isDone ? 'text-emerald-500/40' : 'text-zinc-600'}`}>{topic.weight}%</span>
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
            
            {/* Modal Footer */}
            <div className="bg-white/[0.02] border-t border-white/5 p-4 shrink-0 flex justify-between items-center relative z-20">
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                 {isSyncing ? <Activity size={12} className="animate-spin text-emerald-500"/> : <ShieldCheck size={12} className="text-emerald-500"/>}
                 {isSyncing ? 'Transmitting to Server...' : 'Matrix Synchronized'}
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}