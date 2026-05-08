'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Clock, BookOpen, Settings2, Sparkles, 
  ChevronRight, ArrowLeft, Target, Zap, Activity, 
  CheckSquare, Square, Play, Database, CheckCircle2, Layers, Link as LinkIcon, Edit3
} from 'lucide-react';

// --- TYPES ---
type SyllabusItem = { id: string; title: string; subject_name: string; topic_name: string; duration: string; parsedMins: number };
type Task = { id: string; originalId: string; title: string; subject: string; topic: string; durationMins: number; status: string };

export default function AutoPlanner() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);

  // --- TIMEZONE UTILS ---
  const getISTNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const getISTDateString = (date: Date) => {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayISTStr = getISTDateString(getISTNow());

  // --- ENGINE STATE ---
  const [targetDate, setTargetDate] = useState('');
  const [rawSyllabus, setRawSyllabus] = useState<SyllabusItem[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  
  // Tuning
  const [speed, setSpeed] = useState<number>(1.25);
  const [subjectsPerDay, setSubjectsPerDay] = useState<number>(2);

  // Output
  const [generatedRoutine, setGeneratedRoutine] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchSyllabus = async () => {
      const { data } = await supabase.from('study_materials').select('*');
      if (data) {
        const parsed = data.map(m => ({ ...m, parsedMins: parseMins(m.duration) }));
        setRawSyllabus(parsed);
      }
    };
    fetchSyllabus();
    
    const future = new Date(getISTNow()); future.setDate(future.getDate() + 30);
    setTargetDate(getISTDateString(future));
  }, []);

  const parseMins = (durStr: string) => {
    if (!durStr) return 0;
    const parts = durStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return 0;
  };

  const formatTime = (totalMins: number) => {
    const h = Math.floor(totalMins / 60); const m = Math.round(totalMins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getDaysBetween = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start); const e = new Date(end);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1); 
  };

  // --- DYNAMIC CONSTRAINT LOGIC ---
  const selectedSubjectsCount = useMemo(() => {
    const subjects = new Set<string>();
    rawSyllabus.forEach(m => {
      if (selectedVideoIds.has(m.id)) subjects.add(m.subject_name);
    });
    return subjects.size;
  }, [rawSyllabus, selectedVideoIds]);

  const maxSubjectsLimit = Math.max(1, Math.min(4, selectedSubjectsCount));

  // Auto-correct the slider if user goes back and deselects subjects
  useEffect(() => {
    if (step === 3 && subjectsPerDay > maxSubjectsLimit) {
      setSubjectsPerDay(maxSubjectsLimit);
    }
  }, [step, maxSubjectsLimit, subjectsPerDay]);

  // --- TREE SELECTION LOGIC ---
  const toggleSubject = (subject: string, isSelected: boolean) => {
    const newSet = new Set(selectedVideoIds);
    rawSyllabus.filter(m => m.subject_name === subject).forEach(m => isSelected ? newSet.add(m.id) : newSet.delete(m.id));
    setSelectedVideoIds(newSet);
  };

  const toggleTopic = (subject: string, topic: string, isSelected: boolean) => {
    const newSet = new Set(selectedVideoIds);
    rawSyllabus.filter(m => m.subject_name === subject && m.topic_name === topic).forEach(m => isSelected ? newSet.add(m.id) : newSet.delete(m.id));
    setSelectedVideoIds(newSet);
  };

  const toggleVideo = (id: string) => {
    const newSet = new Set(selectedVideoIds);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedVideoIds(newSet);
  };

  // --- THE AUTO-BALANCING ALGORITHM ---
  const generateRoutine = () => {
    const totalDays = getDaysBetween(todayISTStr, targetDate);
    if (totalDays <= 0) return toast.error("Invalid Target Date.");
    if (selectedVideoIds.size === 0) return toast.error("No payload selected.");

    const queuesBySubject: Record<string, Task[]> = {};
    let totalMinsToStudy = 0;

    rawSyllabus.forEach(m => {
      if (selectedVideoIds.has(m.id)) {
        if (!queuesBySubject[m.subject_name]) queuesBySubject[m.subject_name] = [];
        const adjMins = m.parsedMins / speed;
        queuesBySubject[m.subject_name].push({
          id: `t_${m.id}_${Math.random()}`, originalId: m.id, title: m.title,
          subject: m.subject_name, topic: m.topic_name, durationMins: adjMins, status: 'Full'
        });
        totalMinsToStudy += adjMins;
      }
    });

    const targetDailyMins = totalMinsToStudy / totalDays;
    const routine: Record<string, any[]> = {};
    let currentDate = new Date(todayISTStr);
    
    let activeSubjects = Object.keys(queuesBySubject);
    let subjectIndex = 0;
    const colors: string[] = ['indigo', 'emerald', 'orange', 'cyan'];

    for (let d = 0; d < totalDays; d++) {
      const dateStr = getISTDateString(currentDate);
      routine[dateStr] = [];
      
      activeSubjects = activeSubjects.filter(sub => queuesBySubject[sub].length > 0);
      if (activeSubjects.length === 0) break;

      const todaySubjects = [];
      for (let i = 0; i < Math.min(subjectsPerDay, activeSubjects.length); i++) {
        todaySubjects.push(activeSubjects[subjectIndex % activeSubjects.length]);
        subjectIndex++;
      }

      const minsPerSubject = targetDailyMins / todaySubjects.length;
      let startTime = new Date(`2000-01-01T08:00:00`);

      todaySubjects.forEach((subj, idx) => {
        let blockTimeRemaining = minsPerSubject;
        const blockTasks: Task[] = [];
        const queue = queuesBySubject[subj];

        while (blockTimeRemaining > 0 && queue.length > 0) {
          const task = queue[0];

          if (task.durationMins <= blockTimeRemaining + 2) { 
            blockTasks.push(task);
            blockTimeRemaining -= task.durationMins;
            queue.shift(); 
          } else {
            const part1: Task = { ...task, id: `t_${Date.now()}_1`, durationMins: blockTimeRemaining, status: 'Part 1' };
            const part2: Task = { ...task, id: `t_${Date.now()}_2`, durationMins: task.durationMins - blockTimeRemaining, status: 'Remaining' };
            blockTasks.push(part1);
            queue[0] = part2; 
            blockTimeRemaining = 0;
          }
        }

        if (blockTasks.length > 0) {
          const blockDuration = minsPerSubject - blockTimeRemaining;
          const endT = new Date(startTime.getTime() + blockDuration * 60000);
          
          routine[dateStr].push({
            id: `b_${Date.now()}_${idx}`,
            start: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
            end: `${String(endT.getHours()).padStart(2, '0')}:${String(endT.getMinutes()).padStart(2, '0')}`,
            type: 'Study', capacityMins: Math.round(blockDuration), color: colors[idx % colors.length],
            tasks: blockTasks
          });
          
          startTime = new Date(endT.getTime() + 15 * 60000); 
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setGeneratedRoutine(routine);
    setStep(4);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { error } = await supabase.from('study_goals').insert({
      user_id: session.user.id, title: `Auto-Matrix: ${targetDate}`, start_date: todayISTStr,
      target_date: targetDate, speed_multiplier: speed, routine_data: generatedRoutine
    });

    setIsDeploying(false);
    if (error) toast.error('Deployment Failed.');
    else { 
      toast.success('Matrix Locked & Saved!', { icon: '🚀', style: { background: '#121214', color: '#10b981', border: '1px solid #059669' }});
      router.push('/daily-goal'); 
    }
  };

  // --- RENDERERS ---
  const syllabusTree = useMemo(() => {
    const tree: Record<string, Record<string, SyllabusItem[]>> = {};
    rawSyllabus.forEach(m => {
      if (!tree[m.subject_name]) tree[m.subject_name] = {};
      if (!tree[m.subject_name][m.topic_name]) tree[m.subject_name][m.topic_name] = [];
      tree[m.subject_name][m.topic_name].push(m);
    });
    return tree;
  }, [rawSyllabus]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col relative pb-20">
      
      {/* ADVANCED AMBIENT GLOWS */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="shrink-0 relative z-20 bg-white/[0.02] border-b border-white/5 py-4 px-6 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => step > 1 ? setStep(step - 1) : router.push('/dashboard')} className="p-2 bg-black/40 hover:bg-white/10 ring-1 ring-white/10 rounded-xl transition-all text-zinc-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div className="hidden sm:block">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-widest mb-1 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Zap size={10} className="text-emerald-500"/> Auto-Engine
            </div>
            <h1 className="text-lg font-black tracking-tight text-zinc-100 leading-none">
              Matrix Auto-Planner
            </h1>
          </div>
        </div>
        
        {/* STEP INDICATORS */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center">
              <div className={`h-2 rounded-full transition-all duration-700 ease-out flex items-center justify-center ${step >= s ? 'bg-emerald-500 w-8 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-white/10 w-4'}`}></div>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto w-full px-4 mt-8 lg:mt-12 relative z-10 flex-1 flex flex-col">
        
        {/* STEP 1: END DATE */}
        {step === 1 && (
          <div className="animate-in fade-in zoom-in-[0.98] duration-700 max-w-[600px] mx-auto text-center w-full mt-10">
            <div className="w-24 h-24 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.2)] transform rotate-3">
              <CalendarIcon size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-zinc-100 to-zinc-500 bg-clip-text text-transparent mb-4 tracking-tight">Set the Deadline</h2>
            <p className="text-zinc-400 text-sm mb-10 font-medium">The algorithm begins today. When must your mission be completed?</p>
            
            <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl flex flex-col gap-8 text-left">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                  <Target size={14}/> Target Completion Date
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={targetDate} 
                    min={todayISTStr} 
                    onChange={e => setTargetDate(e.target.value)} 
                    className="w-full bg-black/40 ring-1 ring-white/10 rounded-2xl p-5 text-xl font-bold text-zinc-100 outline-none focus:ring-emerald-500/50 focus:bg-white/5 transition-all shadow-inner" 
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <Edit3 size={20}/>
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="text-emerald-500/80 font-bold tracking-widest uppercase text-[10px] mb-2 relative z-10">Calculated Matrix Window</span>
                <span className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] relative z-10">{getDaysBetween(todayISTStr, targetDate)} <span className="text-xl text-emerald-500/50 uppercase tracking-widest">Days</span></span>
              </div>
              
              <button onClick={() => setStep(2)} className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black text-sm uppercase tracking-widest py-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 mt-2">
                Build Payload <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SYLLABUS SELECTOR */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 h-full flex flex-col">
            <div className="text-center mb-8 shrink-0">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/10 ring-1 ring-indigo-500/20 rounded-2xl mb-4 shadow-inner">
                <Database size={28} className="text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-zinc-100 mb-2 tracking-tight">Select Payload</h2>
              <p className="text-zinc-400 text-sm font-medium">Define the exact parameters you want the engine to schedule.</p>
            </div>
            
            <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 p-6 sm:p-8 rounded-[2rem] shadow-2xl flex flex-col flex-1 min-h-[60vh] max-h-[70vh]">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5 shrink-0">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Layers size={16}/> Curriculum Tree</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-inner">
                  {selectedVideoIds.size} Videos Selected
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                {Object.entries(syllabusTree).map(([subj, topics]) => {
                  const subjVideos = rawSyllabus.filter(m => m.subject_name === subj);
                  const isSubjAll = subjVideos.every(m => selectedVideoIds.has(m.id));
                  const isSubjSome = subjVideos.some(m => selectedVideoIds.has(m.id)) && !isSubjAll;

                  return (
                    <div key={subj} className="bg-black/20 ring-1 ring-white/5 rounded-[1.5rem] overflow-hidden transition-colors hover:bg-white/[0.02]">
                      <div className="flex items-center gap-4 p-4 border-b border-white/5 bg-white/[0.01]">
                        <button onClick={() => toggleSubject(subj, !isSubjAll)} className="shrink-0 transition-transform hover:scale-110 active:scale-95">
                          {isSubjAll ? <CheckSquare size={22} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"/> : isSubjSome ? <CheckSquare size={22} className="text-emerald-500/50"/> : <Square size={22} className="text-zinc-600"/>}
                        </button>
                        <h3 className="text-base sm:text-lg font-bold text-zinc-200 tracking-tight">{subj}</h3>
                      </div>

                      <div className="p-4 space-y-5">
                        {Object.entries(topics).map(([topic, videos]) => {
                          const isTopicAll = videos.every(m => selectedVideoIds.has(m.id));
                          
                          return (
                            <div key={topic} className="pl-2 border-l-2 border-zinc-800 ml-3">
                              <div className="flex items-center gap-3 mb-3 pl-3">
                                <button onClick={() => toggleTopic(subj, topic, !isTopicAll)} className="shrink-0 transition-transform hover:scale-110 active:scale-95">
                                  {isTopicAll ? <CheckSquare size={18} className="text-emerald-400"/> : <Square size={18} className="text-zinc-600"/>}
                                </button>
                                <h4 className="text-sm font-bold text-zinc-400">{topic}</h4>
                              </div>
                              
                              <div className="space-y-1.5 pl-8">
                                {videos.map(video => {
                                  const isVidSelected = selectedVideoIds.has(video.id);
                                  return (
                                    <label key={video.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-300 group ring-1 ${isVidSelected ? 'bg-emerald-500/5 ring-emerald-500/20' : 'bg-transparent ring-transparent hover:bg-white/5 hover:ring-white/5'}`}>
                                      <input 
                                        type="checkbox" checked={isVidSelected} onChange={() => toggleVideo(video.id)}
                                        className="hidden"
                                      />
                                      <div className={`w-4 h-4 shrink-0 rounded-[4px] flex items-center justify-center ring-1 transition-all ${isVidSelected ? 'bg-emerald-500 ring-emerald-500 text-zinc-950' : 'ring-zinc-600 bg-black/50 group-hover:ring-emerald-500/50'}`}>
                                        {isVidSelected && <CheckSquare size={10} strokeWidth={4} />}
                                      </div>
                                      <span className={`text-xs font-medium truncate flex-1 transition-colors ${isVidSelected ? 'text-emerald-400' : 'text-zinc-300 group-hover:text-white'}`}>{video.title}</span>
                                      <span className={`text-[10px] font-mono shrink-0 bg-black/40 px-2 py-0.5 rounded ${isVidSelected ? 'text-emerald-500/70' : 'text-zinc-500'}`}>{video.duration}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 shrink-0">
                <button disabled={selectedVideoIds.size === 0} onClick={() => setStep(3)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  Configure Engine <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ENGINE TUNING */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-[600px] mx-auto text-center w-full mt-10">
            <div className="w-20 h-20 bg-orange-500/10 ring-1 ring-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(249,115,22,0.2)] transform -rotate-3">
              <Settings2 size={36} className="text-orange-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 mb-4 tracking-tight">Tune the Algorithm</h2>
            <p className="text-zinc-400 text-sm mb-10 font-medium leading-relaxed">How should the engine divide and conquer the selected payload across your timeline?</p>
            
            <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl flex flex-col gap-8 text-left">
              
              {/* DYNAMIC SUBJECT MIXING */}
              <div className={`bg-black/40 ring-1 ring-white/5 p-6 rounded-3xl relative overflow-hidden group transition-all duration-300 ${maxSubjectsLimit === 1 ? 'opacity-70 grayscale' : ''}`}>
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="flex justify-between items-center mb-5 relative z-10">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Layers size={14} className="text-indigo-400"/> Subject Mixing</span>
                  <span className="text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-lg ring-1 ring-indigo-500/20 text-xs shadow-inner">
                    {maxSubjectsLimit === 1 ? 'Locked' : `${subjectsPerDay} / Day`}
                  </span>
                </div>
                
                <p className="text-xs text-zinc-400 mb-6 leading-relaxed relative z-10 font-medium">
                  You selected content from <span className="text-zinc-200 font-bold bg-white/10 px-1.5 py-0.5 rounded">{selectedSubjectsCount}</span> subject(s). 
                  {maxSubjectsLimit === 1 ? " The engine will lock into deep focus mode." : " How many should we interleave per day?"}
                </p>
                
                <input 
                  type="range" 
                  min="1" 
                  max={maxSubjectsLimit} 
                  step="1" 
                  value={subjectsPerDay} 
                  onChange={e => setSubjectsPerDay(Number(e.target.value))} 
                  disabled={maxSubjectsLimit === 1}
                  className={`w-full accent-indigo-500 h-2 bg-zinc-800 rounded-lg appearance-none relative z-10 ${maxSubjectsLimit === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:accent-indigo-400 transition-all'}`} 
                />
                
                <div className="flex justify-between text-[9px] text-zinc-500 mt-4 font-bold px-1 uppercase tracking-widest relative z-10">
                  <span>Deep Focus</span>
                  <span>{maxSubjectsLimit > 1 ? `Max Mix (${maxSubjectsLimit})` : 'Limit Reached'}</span>
                </div>
              </div>

              {/* BRAIN SPEED */}
              <div className="bg-black/40 ring-1 ring-white/5 p-6 rounded-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="flex justify-between items-center mb-5 relative z-10">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-emerald-400"/> Brain Speed</span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg ring-1 ring-emerald-500/20 text-xs shadow-inner">{speed}x</span>
                </div>
                <p className="text-xs text-zinc-400 mb-6 leading-relaxed relative z-10 font-medium">Multiplier applied to all video durations for faster completion estimates.</p>
                <input type="range" min="1" max="2.5" step="0.25" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer relative z-10 hover:accent-emerald-400 transition-all" />
              </div>

              <button onClick={generateRoutine} className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black text-sm uppercase tracking-widest py-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 mt-2">
                <Activity size={18} /> Initialize Auto-Balancer
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: OUTPUT PREVIEW */}
        {step === 4 && generatedRoutine && (
          <div className="animate-in fade-in zoom-in-[0.98] duration-700 flex flex-col h-full">
            <div className="text-center mb-10 shrink-0">
              <div className="inline-flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-4 bg-emerald-500/10 px-4 py-2 rounded-xl ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Sparkles size={14}/> Matrix Generated Successfully
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 mb-2 tracking-tight">Automated Protocol</h2>
              <p className="text-zinc-400 text-sm font-medium">Perfectly balanced. Perfectly distributed across your timeline.</p>
            </div>

            <div className="bg-zinc-900/40 backdrop-blur-2xl ring-1 ring-white/10 rounded-[2rem] shadow-2xl overflow-hidden mb-8 flex flex-col flex-1 min-h-[50vh] max-h-[60vh]">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-12">
                {Object.entries(generatedRoutine).map(([date, blocks]) => {
                  
                  const dayMins = blocks.reduce((acc: number, b: any) => acc + b.capacityMins, 0);

                  return (
                    <div key={date} className="relative">
                      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md pt-2 pb-4 mb-6 border-b border-white/5 flex items-center justify-between">
                        <div className="bg-white/5 ring-1 ring-white/10 px-4 py-2 rounded-xl text-zinc-200 font-bold text-sm tracking-wide shadow-inner">
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-black/50 px-3 py-1.5 rounded-lg">{formatTime(dayMins)} Scheduled</span>
                      </div>

                      <div className="space-y-5 pl-4 sm:pl-6 border-l-2 border-zinc-800/50 ml-2 sm:ml-4">
                        {blocks.map((block: any, bIdx: number) => (
                          <div key={bIdx} className="relative pl-6 sm:pl-8">
                            {/* Timeline Dot */}
                            <div className={`absolute left-[-9px] sm:left-[-11px] top-5 w-4 h-4 rounded-full ring-4 ring-zinc-950 bg-${block.color}-500 shadow-[0_0_10px_currentColor]`}></div>
                            
                            <div className="bg-black/40 ring-1 ring-white/5 rounded-[1.5rem] p-5 sm:p-6 shadow-lg hover:ring-white/10 transition-all group">
                              
                              <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
                                <span className="text-xs font-bold text-zinc-300 bg-white/5 px-3 py-1.5 rounded-lg ring-1 ring-white/5">
                                  {block.start} - {block.end}
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-${block.color}-400 bg-${block.color}-500/10 ring-1 ring-${block.color}-500/20 shadow-inner`}>
                                  {block.tasks[0]?.subject || 'Study'}
                                </span>
                              </div>
                              
                              <div className="space-y-2">
                                {block.tasks.map((task: any, tIdx: number) => (
                                  <div key={tIdx} className="flex justify-between items-center bg-white/[0.02] ring-1 ring-white/5 p-3.5 rounded-xl group/task hover:bg-white/[0.04] hover:ring-white/10 transition-colors">
                                    <div className="flex-1 min-w-0 pr-4">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{task.topic}</span>
                                        {task.status !== 'Full' && <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold flex items-center gap-0.5 ring-1 ring-amber-500/20"><LinkIcon size={8}/> Linked</span>}
                                      </div>
                                      <h4 className="text-xs sm:text-sm font-bold text-zinc-300 truncate group-hover/task:text-white transition-colors">{task.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="text-[10px] font-mono text-zinc-400 font-bold bg-black/50 px-2.5 py-1 rounded-md ring-1 ring-white/5">{Math.round(task.durationMins)}m</span>
                                      <Link href={`/resources/${task.originalId}`} target="_blank" className="text-emerald-500 hover:text-emerald-400 p-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all hover:scale-110 active:scale-95">
                                        <Play size={12} fill="currentColor"/>
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="shrink-0">
              <button onClick={handleDeploy} disabled={isDeploying} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-widest py-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:scale-100">
                {isDeploying ? <Activity className="animate-spin" size={20} /> : <Zap size={20} />}
                {isDeploying ? 'Deploying to HUD...' : 'Save & Initialize Protocol'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}