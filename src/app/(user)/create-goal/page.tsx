'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Clock, BookOpen, Settings2, Sparkles, 
  ChevronRight, ArrowLeft, Target, Zap, Activity, 
  Plus, X, Printer, GripVertical, CalendarPlus, Wand2, Database, CheckCircle2, ChevronLeft
} from 'lucide-react';

// --- TYPES ---
type BlockColor = 'indigo' | 'emerald' | 'orange' | 'rose' | 'amber' | 'cyan';
type Task = { id: string; originalId: string; title: string; subject: string; topic: string; durationMins: number; status: string };
type TimeBlock = { id: string; start: string; end: string; type: 'Study' | 'Revise' | 'Solve'; capacityMins: number; color: BlockColor; tasks: Task[] };
type DaySchedule = { dateStr: string; blocks: TimeBlock[] };

const COLOR_MAP: Record<BlockColor, { bg: string, text: string, ring: string, light: string }> = {
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', ring: 'ring-indigo-500', light: 'bg-indigo-500/10' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500', light: 'bg-emerald-500/10' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500', light: 'bg-orange-500/10' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', ring: 'ring-rose-500', light: 'bg-rose-500/10' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500', light: 'bg-amber-500/10' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', ring: 'ring-cyan-500', light: 'bg-cyan-500/10' },
};

export default function GoalGenerator() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // --- TIMEZONE UTILS ---
  const getISTNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const getISTDateString = (date: Date) => {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayISTStr = getISTDateString(getISTNow());

  // --- BASE STATE ---
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [rawSyllabus, setRawSyllabus] = useState<any[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [speed, setSpeed] = useState<number>(1.25);

  // --- WORKSPACE STATE (DND Engine) ---
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [routineDays, setRoutineDays] = useState<DaySchedule[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(getISTNow());

  // Base blocks to copy into new days
  const baseBlocks: TimeBlock[] = [
    { id: 'b1', start: '07:00', end: '10:00', type: 'Study', capacityMins: 180, color: 'indigo', tasks: [] },
    { id: 'b2', start: '11:00', end: '13:00', type: 'Solve', capacityMins: 120, color: 'orange', tasks: [] },
    { id: 'b3', start: '18:00', end: '19:30', type: 'Revise', capacityMins: 90, color: 'emerald', tasks: [] },
  ];

  useEffect(() => {
    const fetchSyllabus = async () => {
      const { data } = await supabase.from('study_materials').select('*');
      if (data) setRawSyllabus(data);
    };
    fetchSyllabus();
    
    const now = getISTNow();
    setStartDate(getISTDateString(now));
    const future = new Date(now); future.setDate(future.getDate() + 30);
    setTargetDate(getISTDateString(future));
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
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

  // --- INITIALIZE WORKSPACE (Transition to Step 3) ---
  const initializeWorkspace = () => {
    const initialTasks: Task[] = rawSyllabus
      .filter(m => selectedTopics.has(m.topic_name))
      .map(m => ({
        id: `t_${Date.now()}_${Math.random()}`, originalId: m.id, title: m.title, 
        subject: m.subject_name, topic: m.topic_name, 
        durationMins: parseMins(m.duration) / speed, status: 'Full'
      }));
    setUnassignedTasks(initialTasks);

    const days = getDaysBetween(startDate, targetDate);
    const newRoutine: DaySchedule[] = [];
    let curDate = new Date(startDate);
    
    for (let i = 0; i < days; i++) {
      const dailyBlocks = baseBlocks.map(b => ({ ...b, tasks: [], id: `b_${Date.now()}_${Math.random()}` }));
      newRoutine.push({ dateStr: getISTDateString(curDate), blocks: dailyBlocks });
      curDate.setDate(curDate.getDate() + 1);
    }
    
    setRoutineDays(newRoutine);
    setCalendarMonth(new Date(startDate)); 
    setStep(3);
  };

  // --- REACTIVE GLOBAL STATS ---
  const matrixStats = useMemo(() => {
    let studyMins = 0, solveMins = 0, reviseMins = 0;
    routineDays.forEach(day => {
      day.blocks.forEach(b => {
        if (b.type === 'Study') studyMins += b.capacityMins;
        else if (b.type === 'Solve') solveMins += b.capacityMins;
        else if (b.type === 'Revise') reviseMins += b.capacityMins;
      });
    });

    const reqMins = rawSyllabus.filter(m => selectedTopics.has(m.topic_name)).reduce((a,b) => a + parseMins(b.duration), 0) / speed;
    return { studyMins, solveMins, reviseMins, reqMins, totalCap: studyMins + solveMins + reviseMins };
  }, [routineDays, rawSyllabus, selectedTopics, speed]);

  const dayHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    routineDays.forEach(day => { map[day.dateStr] = day.blocks.reduce((acc, b) => acc + b.capacityMins, 0) / 60; });
    return map;
  }, [routineDays]);

  // --- CONFIRMATION MODAL HELPER ---
  const getCoveredTasksSummary = () => {
    const summary: Record<string, Record<string, number>> = {};
    let totalTasks = 0;
    routineDays.forEach(day => {
      day.blocks.forEach(b => {
        b.tasks.forEach(t => {
           if (!summary[t.subject]) summary[t.subject] = {};
           if (!summary[t.subject][t.topic]) summary[t.subject][t.topic] = 0;
           summary[t.subject][t.topic]++;
           totalTasks++;
        });
      });
    });
    return { summary, totalTasks };
  };

  // --- CALENDAR RENDERER ---
  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  // --- DRAG AND DROP ENGINE ---
  const handleDragStart = (e: React.DragEvent, task: Task) => e.dataTransfer.setData('task', JSON.stringify(task));

  const handleDrop = (e: React.DragEvent, dateIndex: number, blockIndex: number) => {
    e.preventDefault();
    const taskData = e.dataTransfer.getData('task');
    if (!taskData) return;
    
    const task: Task = JSON.parse(taskData);
    const newRoutine = JSON.parse(JSON.stringify(routineDays)); 
    const targetBlock = newRoutine[dateIndex].blocks[blockIndex];
    
    const usedCapacity = targetBlock.tasks.reduce((sum: number, t: Task) => sum + t.durationMins, 0);
    const remainingSpace = targetBlock.capacityMins - usedCapacity;
    
    if (remainingSpace <= 0) {
      toast.error("Block is at maximum capacity!");
      return;
    }

    let newUnassigned = unassignedTasks.filter(t => t.id !== task.id);

    if (task.durationMins > remainingSpace) {
      const part1: Task = { ...task, id: `t_${Date.now()}_1`, durationMins: remainingSpace, status: 'Part 1' };
      const part2: Task = { ...task, id: `t_${Date.now()}_2`, durationMins: task.durationMins - remainingSpace, status: 'Remaining' };
      targetBlock.tasks.push(part1);
      newUnassigned = [part2, ...newUnassigned];
      toast.success("Task auto-split to fit block capacity.");
    } else {
      targetBlock.tasks.push(task);
    }
    
    setRoutineDays(newRoutine);
    setUnassignedTasks(newUnassigned);
  };

  const removeTaskFromBlock = (dateIndex: number, blockIndex: number, taskIndex: number) => {
    const newRoutine = [...routineDays];
    const task = newRoutine[dateIndex].blocks[blockIndex].tasks[taskIndex];
    newRoutine[dateIndex].blocks[blockIndex].tasks.splice(taskIndex, 1);
    setRoutineDays(newRoutine);
    setUnassignedTasks([task, ...unassignedTasks]);
  };

  // --- BLOCK EDITING ENGINE ---
  const updateBlock = (dIdx: number, bIdx: number, field: string, value: string) => {
    const newRoutine = [...routineDays];
    const block = newRoutine[dIdx].blocks[bIdx];
    
    if (field === 'start' || field === 'end') {
      (block as any)[field] = value;
      const s = new Date(`2000-01-01T${block.start}`);
      const e = new Date(`2000-01-01T${block.end}`);
      block.capacityMins = Math.max(0, (e.getTime() - s.getTime()) / 60000);
    } else {
      (block as any)[field] = value;
    }
    setRoutineDays(newRoutine);
  };

  const addBlock = (dIdx: number) => {
    const newRoutine = [...routineDays];
    newRoutine[dIdx].blocks.push({ id: `b_${Date.now()}`, start: '14:00', end: '15:00', type: 'Study', capacityMins: 60, color: 'cyan', tasks: [] });
    setRoutineDays(newRoutine);
  };

  const removeBlock = (dIdx: number, bIdx: number) => {
    const newRoutine = [...routineDays];
    const tasksToReturn = newRoutine[dIdx].blocks[bIdx].tasks;
    newRoutine[dIdx].blocks.splice(bIdx, 1);
    setRoutineDays(newRoutine);
    if (tasksToReturn.length > 0) setUnassignedTasks(prev => [...tasksToReturn, ...prev]);
  };

  const addDay = () => {
    const lastDateStr = routineDays.length > 0 ? routineDays[routineDays.length - 1].dateStr : targetDate;
    const nextDate = new Date(lastDateStr); nextDate.setDate(nextDate.getDate() + 1);
    
    setRoutineDays(prev => [...prev, { dateStr: getISTDateString(nextDate), blocks: baseBlocks.map(b => ({ ...b, tasks: [], id: `b_${Date.now()}_${Math.random()}` })) }]);
    setTargetDate(getISTDateString(nextDate));
    toast.success("Matrix Extended by 1 Day", { icon: '📅', style: {background:'#121214', color:'#10b981'} });
  };

  const autoFillRemaining = () => {
    let queue = [...unassignedTasks];
    const newRoutine = JSON.parse(JSON.stringify(routineDays)); 

    for (let d = 0; d < newRoutine.length; d++) {
      for (let b = 0; b < newRoutine[d].blocks.length; b++) {
        const block = newRoutine[d].blocks[b];
        if (block.type !== 'Study') continue;

        let usedSpace = block.tasks.reduce((sum: number, t: Task) => sum + t.durationMins, 0);
        while (usedSpace < block.capacityMins && queue.length > 0) {
          const spaceLeft = block.capacityMins - usedSpace;
          const task = queue.shift()!;

          if (task.durationMins <= spaceLeft) {
            block.tasks.push(task); usedSpace += task.durationMins;
          } else {
            const part1 = { ...task, id: `t_${Date.now()}_${Math.random()}`, durationMins: spaceLeft, status: 'Part 1' };
            const part2 = { ...task, id: `t_${Date.now()}_${Math.random()}`, durationMins: task.durationMins - spaceLeft, status: 'Remaining' };
            block.tasks.push(part1); usedSpace += spaceLeft;
            queue.unshift(part2); 
          }
        }
      }
    }
    
    setRoutineDays(newRoutine);
    setUnassignedTasks(queue);
    if (queue.length > 0) toast.error(`Overflow! ${queue.length} tasks unassigned. Add more days.`, { style: {background:'#121214', color:'#ef4444'} });
    else toast.success("Auto-Fill Complete!", { style: {background:'#121214', color:'#10b981'} });
  };

  // --- SAVE & DEPLOY ---
  const handleDeploy = async () => {
    setIsDeploying(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const finalRoutineJSON: Record<string, any[]> = {};
    routineDays.forEach(day => {
      finalRoutineJSON[day.dateStr] = day.blocks.map(b => ({
        id: b.id, start: b.start, end: b.end, type: b.type, durationMins: b.capacityMins, color: b.color,
        tasks: b.tasks.map(t => ({ id: t.originalId, title: t.title, subject: t.subject, topic: t.topic, minsAllocated: t.durationMins, status: t.status }))
      }));
    });

    const { error } = await supabase.from('study_goals').insert({
      user_id: session.user.id, title: `Mission: ${targetDate}`, start_date: startDate,
      target_date: targetDate, speed_multiplier: speed, routine_data: finalRoutineJSON
    });

    setIsDeploying(false);
    setShowConfirmModal(false);
    if (error) toast.error('Deployment Failed.');
    else { 
      toast.success('Matrix Locked & Saved!', { icon: '🔥', style: { background: '#121214', color: '#10b981' }});
      router.push('/dashboard'); 
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 selection:bg-emerald-500/30 pb-20 print:bg-white print:text-black relative">
      
      <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/80 py-4 px-4 sm:px-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors text-zinc-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Target className="text-emerald-500 shrink-0" /> <span className="hidden sm:inline">Routine Builder</span>
          </h1>
        </div>
      </header>

      <main className="mx-auto px-4 mt-8 print:m-0 print:max-w-none print:w-full print:px-0">
        
        {/* ========================================= */}
        {/* STEP 1: DATE BOUNDARIES                   */}
        {/* ========================================= */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[800px] mx-auto">
            <div className="text-center mb-10">
              <CalendarIcon size={48} className="text-emerald-500/50 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-2">Chrono-Boundaries</h2>
              <p className="text-zinc-500 text-sm">Define the starting line and your target deployment date.</p>
            </div>
            <div className="bg-[#121214] border border-zinc-800/80 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Initiation Date (IST)</label>
                  <input type="date" value={startDate} min={todayISTStr} onChange={e => setStartDate(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl p-4 text-zinc-100 outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Target Objective Date</label>
                  <input type="date" value={targetDate} min={startDate} onChange={e => setTargetDate(e.target.value)} className="w-full bg-[#09090b] border border-zinc-800 rounded-xl p-4 text-zinc-100 outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full mt-4 bg-zinc-100 hover:bg-white text-zinc-900 font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2">Confirm Boundaries <ChevronRight size={18} /></button>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* STEP 2: SYLLABUS SELECTION                */}
        {/* ========================================= */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[800px] mx-auto">
            <div className="text-center mb-10">
              <BookOpen size={48} className="text-emerald-500/50 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-2">Target Payload</h2>
              <p className="text-zinc-500 text-sm">Select the topics required for mission success.</p>
            </div>
            <div className="bg-[#121214] border border-zinc-800/80 p-5 sm:p-6 rounded-3xl shadow-xl">
              <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                {Array.from(new Set(rawSyllabus.map(m => m.subject_name))).map(subject => (
                  <div key={subject} className="bg-[#09090b] border border-zinc-800/80 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-2">{subject}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from(new Set(rawSyllabus.filter(m => m.subject_name === subject).map(m => m.topic_name))).map(topic => (
                        <label key={topic} className="flex items-center gap-3 p-3 hover:bg-zinc-900 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-zinc-800">
                          <input type="checkbox" checked={selectedTopics.has(topic)} onChange={(e) => { const newSet = new Set(selectedTopics); e.target.checked ? newSet.add(topic) : newSet.delete(topic); setSelectedTopics(newSet); }} className="w-4 h-4 accent-emerald-500 bg-zinc-800 border-zinc-700 rounded cursor-pointer shrink-0" />
                          <span className="text-zinc-300 text-sm font-medium leading-tight">{topic}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Speed Config before entering Workspace */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl mb-4">
                 <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> Brain Speed (Multiplier)</span>
                 <input type="number" step="0.01" min="0.5" max="4" value={speed} onChange={e => setSpeed(Number(e.target.value))} className="w-24 bg-zinc-950 border border-zinc-700 text-emerald-400 font-mono font-bold rounded-lg p-2 text-center outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <button disabled={selectedTopics.size === 0} onClick={initializeWorkspace} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                Launch Workspace <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* STEP 3: THE DND WORKSPACE                 */}
        {/* ========================================= */}
        {step === 3 && (
          <div className="animate-in fade-in duration-500 max-w-[1800px] mx-auto flex flex-col print:block">
            
            {/* GLOBAL STATS DASHBOARD (TOP) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 print:hidden">
               <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4 flex flex-col justify-center shadow-md">
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Required Payload</span>
                 <span className="text-xl font-bold text-zinc-200">{formatTime(matrixStats.reqMins)}</span>
               </div>
               <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4 flex flex-col justify-center shadow-md relative overflow-hidden">
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Capacity</span>
                 <span className={`text-xl font-bold ${matrixStats.reqMins > matrixStats.totalCap ? 'text-red-400' : 'text-emerald-400'}`}>{formatTime(matrixStats.totalCap)}</span>
                 {matrixStats.reqMins > matrixStats.totalCap && <div className="absolute top-0 right-0 w-full h-1 bg-red-500 animate-pulse"></div>}
               </div>
               <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                 <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Study Hrs</span>
                 <span className="text-xl font-bold text-indigo-400">{formatTime(matrixStats.studyMins)}</span>
               </div>
               <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 flex flex-col justify-center shadow-inner">
                 <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Practice Hrs</span>
                 <span className="text-xl font-bold text-orange-400">{formatTime(matrixStats.solveMins)}</span>
               </div>
               <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-center shadow-inner col-span-2 md:col-span-1">
                 <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Revise Hrs</span>
                 <span className="text-xl font-bold text-emerald-400">{formatTime(matrixStats.reviseMins)}</span>
               </div>
            </div>

            {/* ACTION TOOLBAR */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <button onClick={autoFillRemaining} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors shadow-sm">
                  <Wand2 size={16}/> Auto-Fill Payload
                </button>
                {unassignedTasks.length > 0 && <span className="text-xs font-bold text-red-400 flex items-center gap-1"><Activity size={14}/> Unassigned Tasks Left</span>}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button onClick={() => window.print()} className="flex-1 sm:flex-none bg-[#121214] border border-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"><Printer size={16}/> Print</button>
                {/* MODIFIED: This button now triggers the confirmation modal instead of saving directly */}
                <button onClick={() => setShowConfirmModal(true)} disabled={isDeploying} className="flex-1 sm:flex-none bg-zinc-100 hover:bg-white text-zinc-900 px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 transition-colors">
                  {isDeploying ? <Activity size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Save Matrix
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 print:block">
              
              {/* LEFT: SIDEBAR (Calendar Heatmap + Payload) */}
              <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 print:hidden">
                
                {/* 1. Mini Heatmap Calendar */}
                <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-4 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest"><CalendarIcon size={14} className="inline mr-1"/> Matrix Heatmap</h3>
                     <div className="flex gap-1">
                       <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-1 hover:bg-zinc-800 rounded"><ChevronLeft size={14}/></button>
                       <span className="text-xs font-bold text-zinc-300 w-20 text-center">{calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                       <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-1 hover:bg-zinc-800 rounded"><ChevronRight size={14}/></button>
                     </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[8px] font-bold text-zinc-600">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays().map((date, i) => {
                      if (!date) return <div key={`e-${i}`} className="h-8"></div>;
                      const dStr = getISTDateString(date);
                      const hrs = dayHoursMap[dStr] || 0;
                      const isActive = dStr >= startDate && dStr <= targetDate;
                      return (
                        <button key={dStr} disabled={!isActive} onClick={() => document.getElementById(`day-${dStr}`)?.scrollIntoView({behavior: 'smooth'})} className={`h-8 rounded flex flex-col items-center justify-center border transition-all ${!isActive ? 'opacity-10 border-transparent' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-500'}`}>
                          <span className="text-[10px] font-bold text-zinc-300">{date.getDate()}</span>
                          {hrs > 0 && <span className="text-[7px] font-bold text-emerald-500">{hrs.toFixed(0)}h</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Draggable Payload Bank */}
                <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl flex flex-col shadow-xl flex-1 overflow-hidden h-[50vh] lg:h-auto">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest"><Database size={14} className="inline mr-1"/> Payload Bank</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${unassignedTasks.length > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{unassignedTasks.length} Left</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {unassignedTasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                        <Sparkles size={28} className="opacity-50 mb-2"/>
                        <p className="text-[10px] uppercase tracking-widest font-bold">All assigned.</p>
                      </div>
                    ) : (
                      Object.entries(unassignedTasks.reduce((acc, task) => {
                        if (!acc[task.subject]) acc[task.subject] = []; acc[task.subject].push(task); return acc;
                      }, {} as Record<string, Task[]>)).map(([subj, tasks]) => (
                        <div key={subj}>
                          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 px-1">{subj}</div>
                          <div className="space-y-1.5">
                            {tasks.map(task => (
                              <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task)} className="bg-[#09090b] border border-zinc-800 hover:border-emerald-500/50 p-2.5 rounded-xl cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors shadow-sm">
                                <GripVertical size={14} className="text-zinc-600 shrink-0"/>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-[11px] font-bold text-zinc-200 truncate">{task.title}</h4>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-[8px] text-zinc-500 uppercase tracking-wider truncate pr-2">{task.topic}</span>
                                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded">{Math.round(task.durationMins)}m</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: TIMELINE CANVAS (Drop Targets) */}
              <div className="flex-1 bg-[#121214] border border-zinc-800/80 rounded-2xl flex flex-col shadow-xl overflow-hidden print:border-none print:shadow-none print:bg-white h-[80vh] lg:h-[calc(100vh-12rem)]">
                
                {/* Print Title */}
                <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                   <h1 className="text-3xl font-extrabold text-black uppercase tracking-tight">Mission IIT Bombay: Neural Matrix</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar print:overflow-visible print:p-0">
                  {routineDays.map((day, dIdx) => {
                    const isPast = day.dateStr < todayISTStr;
                    return (
                      <div key={dIdx} id={`day-${day.dateStr}`} className={`mb-10 print:mb-8 print:break-inside-avoid ${isPast ? 'opacity-50' : ''}`}>
                        
                        {/* Day Header */}
                        <div className="sticky top-0 z-10 bg-[#121214] pt-2 pb-3 mb-4 border-b border-zinc-800 flex items-center justify-between print:static print:bg-white print:border-gray-300">
                          <div className="flex items-center gap-3">
                            <div className="bg-zinc-900 border border-zinc-700 px-4 py-1.5 rounded-lg text-emerald-400 font-mono font-bold text-sm tracking-widest shadow-inner print:bg-gray-100 print:text-black print:border-gray-300">
                              {new Date(day.dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <span className="text-xs font-bold text-zinc-500 print:text-gray-500">{dayHoursMap[day.dateStr]?.toFixed(1) || 0} Hours Total</span>
                          </div>
                          <button onClick={() => addBlock(dIdx)} className="text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors print:hidden flex items-center gap-1"><Plus size={14}/> Add Block</button>
                        </div>

                        {/* Blocks */}
                        <div className="space-y-4 pl-3 sm:pl-5 border-l-2 border-zinc-800/50 ml-3 sm:ml-5 print:border-gray-300">
                          {day.blocks.map((block, bIdx) => {
                            const theme = COLOR_MAP[block.color as BlockColor] || COLOR_MAP.indigo;
                            const usedMins = block.tasks.reduce((sum, t) => sum + t.durationMins, 0);
                            const remMins = block.capacityMins - usedMins;
                            const isFull = remMins <= 0;

                            return (
                              <div key={block.id} className="relative pl-6 sm:pl-8 group">
                                <div className={`absolute left-[-7px] sm:left-[-9px] top-5 w-3 h-3 rounded-full ring-4 ring-[#121214] print:ring-white print:!bg-black ${theme.bg}`}></div>
                                
                                <div 
                                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                  onDrop={(e) => handleDrop(e, dIdx, bIdx)}
                                  className={`bg-[#09090b] border rounded-2xl p-4 sm:p-5 transition-all print:bg-white print:border-gray-300 print:shadow-sm ${isFull ? 'border-zinc-800' : 'border-zinc-700 border-dashed hover:border-emerald-500/50 hover:bg-emerald-500/5'}`}
                                >
                                  {/* Block Header / Inline Editor */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                      <select value={block.color} onChange={(e) => updateBlock(dIdx, bIdx, 'color', e.target.value)} className={`w-5 h-5 rounded-full appearance-none cursor-pointer outline-none print:hidden ${theme.bg}`}></select>
                                      
                                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 print:bg-transparent print:border-none print:p-0">
                                        <input type="time" value={block.start} onChange={(e) => updateBlock(dIdx, bIdx, 'start', e.target.value)} className="bg-transparent text-xs font-bold text-zinc-300 outline-none w-16 text-center print:text-black" />
                                        <span className="text-zinc-600 font-bold mx-1">-</span>
                                        <input type="time" value={block.end} onChange={(e) => updateBlock(dIdx, bIdx, 'end', e.target.value)} className="bg-transparent text-xs font-bold text-zinc-300 outline-none w-16 text-center print:text-black" />
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 sm:gap-3">
                                      <select value={block.type} onChange={(e) => updateBlock(dIdx, bIdx, 'type', e.target.value)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg outline-none appearance-none print:border print:border-gray-300 print:text-black ${theme.text} ${theme.light}`}>
                                        <option value="Study">Study Block</option>
                                        <option value="Solve">Solve Block</option>
                                        <option value="Revise">Revise Block</option>
                                      </select>
                                      <span className="text-xs font-mono font-bold text-zinc-500 w-12 text-right">{block.capacityMins}m</span>
                                      <button onClick={() => removeBlock(dIdx, bIdx)} className="text-zinc-600 hover:text-red-400 p-1 print:hidden"><X size={16}/></button>
                                    </div>
                                  </div>

                                  {/* Tasks inside block */}
                                  <div className="space-y-2 min-h-[40px]">
                                    {block.tasks.length === 0 ? (
                                      <div className="h-12 flex items-center justify-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl print:hidden">Drop Payload Here</div>
                                    ) : (
                                      block.tasks.map((task, tIdx) => (
                                        <div key={tIdx} className="flex justify-between items-center bg-[#121214] border border-zinc-800/50 p-3 rounded-xl group/task print:bg-gray-50 print:border-gray-200">
                                          <div className="flex-1 min-w-0 pr-3">
                                            <h4 className="text-xs font-bold text-zinc-200 truncate print:text-black">{task.title}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[9px] text-zinc-500 tracking-wide uppercase print:text-gray-500">{task.subject}</span>
                                              {task.status !== 'Full' && <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded font-bold ${theme.text} bg-zinc-900 print:bg-transparent print:border print:border-gray-300`}>{task.status}</span>}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs font-mono text-zinc-300 font-bold print:text-black">{Math.round(task.durationMins)}m</span>
                                            <button onClick={() => removeTaskFromBlock(dIdx, bIdx, tIdx)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-opacity print:hidden p-1"><X size={16}/></button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  
                                  {/* Capacity Bar */}
                                  <div className="mt-4 flex items-center gap-3 print:hidden">
                                    <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                      <div className={`h-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.2)] ${isFull ? 'bg-red-500' : theme.bg}`} style={{width: `${Math.min(100, (usedMins / block.capacityMins) * 100)}%`}}></div>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold w-12 text-right ${isFull ? 'text-red-400' : 'text-zinc-500'}`}>{remMins}m rem</span>
                                  </div>

                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Add Day Button */}
                  <div className="pt-6 pb-10 flex justify-center print:hidden">
                    <button onClick={addDay} className="flex items-center gap-2 text-sm font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-8 py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <CalendarPlus size={18}/> Extend Matrix by 1 Day
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ========================================= */}
      {/* CONFIRMATION MODAL OVERLAY                */}
      {/* ========================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#09090b]/80 backdrop-blur-sm animate-in fade-in duration-300 print:hidden">
          <div className="bg-[#121214] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 max-w-[650px] w-full shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Target size={32} className="text-emerald-500"/>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100">Confirm Neural Matrix</h2>
              <p className="text-sm text-zinc-500 mt-1">Review your deployment parameters before locking the routine.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 shrink-0">
              <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Duration</span>
                <span className="text-lg font-bold text-zinc-200">{getDaysBetween(startDate, targetDate)} Days</span>
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">Study Hrs</span>
                <span className="text-lg font-bold text-indigo-400">{formatTime(matrixStats.studyMins)}</span>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">Practice Hrs</span>
                <span className="text-lg font-bold text-orange-400">{formatTime(matrixStats.solveMins)}</span>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Revise Hrs</span>
                <span className="text-lg font-bold text-emerald-400">{formatTime(matrixStats.reviseMins)}</span>
              </div>
            </div>

            {/* Payload List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-[#09090b] border border-zinc-800 rounded-xl p-4">
               <div className="flex justify-between items-center mb-3 border-b border-zinc-800 pb-2">
                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Payload to be Deployed</h3>
                 <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{getCoveredTasksSummary().totalTasks} Assigned</span>
               </div>
               <div className="space-y-4">
                  {Object.entries(getCoveredTasksSummary().summary).map(([subj, topics]) => (
                     <div key={subj}>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{subj}</span>
                        <ul className="mt-1.5 space-y-1.5">
                           {Object.entries(topics).map(([topic, count]) => (
                              <li key={topic} className="flex justify-between items-center text-xs text-zinc-300 bg-[#121214] px-3 py-2 rounded-lg border border-zinc-800/50">
                                 <span>{topic}</span>
                                 <span className="text-[10px] text-zinc-500 font-mono">{count} block{count > 1 ? 's' : ''}</span>
                              </li>
                           ))}
                        </ul>
                     </div>
                  ))}
                  {Object.keys(getCoveredTasksSummary().summary).length === 0 && (
                     <div className="text-xs text-zinc-600 italic text-center py-6">No specific payload assigned. Matrix is running in free-study mode.</div>
                  )}
               </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
               <button onClick={() => setShowConfirmModal(false)} disabled={isDeploying} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-sm">
                  Abort & Modify Setup
               </button>
               <button onClick={handleDeploy} disabled={isDeploying} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  {isDeploying ? <Activity className="animate-spin" size={18}/> : <Zap size={18}/>}
                  {isDeploying ? 'Locking Matrix...' : 'Confirm & Deploy'}
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}