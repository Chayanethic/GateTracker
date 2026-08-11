'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText,
  Flame, GraduationCap, Plus, Save, Trash2, Trophy, Video, X, Target,
  BarChart3, ChevronLeft, ChevronRight, FlameKindling, Sparkles, Pencil,
  BookOpen, Timer, CalendarRange, Brain, ShieldCheck
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getISTDateString } from '../../../lib/dataService';

type LectureLog = {
  id: string;
  material_id: string;
  date_str: string;
  title: string;
  subject_name: string;
  topic_name: string;
  duration_mins: number;
};

type Exam = {
  id: string;
  exam_name: string;
  exam_date: string;
  score: number | null;
  total_marks: number | null;
  notes: string | null;
};

type Material = {
  id: string;
  title: string;
  subject_name: string;
  topic_name: string;
  duration: string | number | null;
};

type MonthlyTarget = {
  id: string;
  month_str: string;
  target_minutes: number;
  target_videos: number;
  selected_material_ids: string[];
};

type WeeklyTarget = {
  id: string;
  week_start: string;
  month_str: string;
  target_minutes: number;
  target_videos: number;
};

type Sacrifice = {
  id: string;
  date_str: string;
  content: string;
  created_at: string;
};

const formatMinutes = (mins: number) => {
  const total = Math.round(mins || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const getDateLabel = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const pct = (a: number, b: number) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const dateObj = (dateStr: string) => new Date(`${dateStr}T12:00:00`);
const monthStr = (dateStr: string) => dateStr.slice(0, 7);
const addDays = (dateStr: string, amount: number) => {
  const d = dateObj(dateStr);
  d.setDate(d.getDate() + amount);
  return getISTDateString(d);
};
const getWeekStart = (dateStr: string) => {
  const d = dateObj(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return getISTDateString(d);
};
const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export default function DailyTrackerPage() {
  const router = useRouter();
  const today = getISTDateString();

  const [selectedDate, setSelectedDate] = useState(today);
  const [logs, setLogs] = useState<LectureLog[]>([]);
  const [allLogs, setAllLogs] = useState<LectureLog[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState<WeeklyTarget | null>(null);
  const [sacrifices, setSacrifices] = useState<Sacrifice[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [showCurriculum, setShowCurriculum] = useState(false);
  const [sacrificeText, setSacrificeText] = useState('');
  const [savingSacrifice, setSavingSacrifice] = useState(false);
  const [examForm, setExamForm] = useState({
    exam_name: '',
    exam_date: today,
    score: '',
    total_marks: '',
    notes: '',
  });

  const [targetForm, setTargetForm] = useState({ target_minutes: '', target_videos: '' });
  const [weeklyForm, setWeeklyForm] = useState({ target_minutes: '', target_videos: '' });

  const dateStrip = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - 3 + i);
      return getISTDateString(d);
    });
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    const uid = session.user.id;
    const currentMonth = monthStr(selectedDate);
    const currentWeek = getWeekStart(selectedDate);

    const [
      { data: lectureData, error: lectureError },
      { data: examData },
      { data: tracking },
      { data: monthData },
      { data: weekData },
      { data: sacrificeData },
      { data: materialData },
      { data: progressData },
    ] = await Promise.all([
      supabase.from('daily_lecture_activity')
        .select('*')
        .eq('user_id', uid)
        .order('date_str', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('user_exam_scores')
        .select('*')
        .eq('user_id', uid)
        .order('exam_date', { ascending: false }),
      supabase.from('daily_tracking')
        .select('date_str, notes')
        .eq('user_id', uid)
        .eq('date_str', selectedDate)
        .maybeSingle(),
      supabase.from('user_monthly_targets')
        .select('*')
        .eq('user_id', uid)
        .eq('month_str', currentMonth)
        .maybeSingle(),
      supabase.from('user_weekly_targets')
        .select('*')
        .eq('user_id', uid)
        .eq('week_start', currentWeek)
        .maybeSingle(),
      supabase.from('user_daily_sacrifices')
        .select('*')
        .eq('user_id', uid)
        .order('date_str', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('study_materials')
        .select('id,title,subject_name,topic_name,duration')
        .order('subject_name', { ascending: true })
        .order('title', { ascending: true }),
      supabase.from('user_progress')
        .select('material_id')
        .eq('user_id', uid)
        .eq('completed', true),
    ]);

    if (lectureError) {
      console.error(lectureError);
      toast.error('Daily tracker database is not ready. Run the SQL for the tracker tables.');
    }

    const fetchedLogs = (lectureData || []) as LectureLog[];
    setAllLogs(fetchedLogs);
    setLogs(fetchedLogs.filter(log => log.date_str === selectedDate));
    setExams((examData || []) as Exam[]);
    setNote(tracking?.notes || '');
    setMonthlyTarget((monthData || null) as MonthlyTarget | null);
    setWeeklyTarget((weekData || null) as WeeklyTarget | null);
    setSacrifices((sacrificeData || []) as Sacrifice[]);
    setMaterials((materialData || []) as Material[]);
    setCompletedIds(new Set((progressData || []).map((row: any) => String(row.material_id))));

    setTargetForm(monthData
      ? { target_minutes: String(monthData.target_minutes || ''), target_videos: String(monthData.target_videos || '') }
      : { target_minutes: '', target_videos: '' });

    setWeeklyForm(weekData
      ? { target_minutes: String(weekData.target_minutes || ''), target_videos: String(weekData.target_videos || '') }
      : { target_minutes: '', target_videos: '' });

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const dailyMinutes = useMemo(
    () => logs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
    [logs]
  );

  const activeDays = useMemo(
    () => new Set(allLogs.map(log => log.date_str)).size,
    [allLogs]
  );

  const currentMonth = monthStr(selectedDate);
  const currentWeek = getWeekStart(selectedDate);
  const weekEnd = addDays(currentWeek, 6);

  const monthLogs = useMemo(
    () => allLogs.filter(log => log.date_str.startsWith(currentMonth)),
    [allLogs, currentMonth]
  );

  const weekLogs = useMemo(
    () => allLogs.filter(log => log.date_str >= currentWeek && log.date_str < addDays(currentWeek, 7)),
    [allLogs, currentWeek]
  );

  const monthlyMinutes = useMemo(
    () => monthLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
    [monthLogs]
  );

  const weekMinutes = useMemo(
    () => weekLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
    [weekLogs]
  );

  const monthVideos = monthLogs.length;
  const weekVideos = weekLogs.length;

  const selectedTargetIds = new Set(monthlyTarget?.selected_material_ids || []);
  const selectedTargetMaterials = materials.filter(m => selectedTargetIds.has(String(m.id)));
  const targetCompletedVideos = selectedTargetMaterials.filter(m => monthLogs.some(log => String(log.material_id) === String(m.id))).length;
  const weekTargetCompletedVideos = selectedTargetMaterials.filter(m => weekLogs.some(log => String(log.material_id) === String(m.id))).length;

  const targetMinutes = monthlyTarget?.target_minutes || 0;
  const targetVideos = monthlyTarget?.target_videos || 0;

  // If no custom weekly target exists, divide the monthly target across four study blocks.
  const autoWeeklyMinutes = targetMinutes ? Math.ceil(targetMinutes / 4) : 0;
  const autoWeeklyVideos = targetVideos ? Math.ceil(targetVideos / 4) : 0;
  const weekTargetMinutes = weeklyTarget?.target_minutes || autoWeeklyMinutes;
  const weekTargetVideos = weeklyTarget?.target_videos || autoWeeklyVideos;

  const daysLeftWeek = Math.max(
    1,
    Math.min(
      7,
      Math.floor((dateObj(weekEnd).getTime() - dateObj(selectedDate).getTime()) / 86400000) + 1
    )
  );

  const remainingWeekMinutes = Math.max(0, weekTargetMinutes - weekMinutes);
  const todayNeeded = remainingWeekMinutes / daysLeftWeek;

  const dailySeries = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeek, i);
      const dayLogs = allLogs.filter(log => log.date_str === date);
      return {
        date,
        minutes: dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
        videos: dayLogs.length,
      };
    }),
    [allLogs, currentWeek]
  );

  const monthSeries = useMemo(
    () => Array.from({ length: daysInMonth(currentMonth) }, (_, i) => {
      const date = `${currentMonth}-${String(i + 1).padStart(2, '0')}`;
      const dayLogs = monthLogs.filter(log => log.date_str === date);
      return {
        date,
        minutes: dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
        videos: dayLogs.length,
      };
    }),
    [monthLogs, currentMonth]
  );

  const maxWeek = Math.max(1, ...dailySeries.map(day => day.minutes));
  const maxMonth = Math.max(1, ...monthSeries.map(day => day.minutes));

  const monthExams = exams.filter(exam => exam.exam_date.startsWith(currentMonth));
  const weekExams = exams.filter(
    exam => exam.exam_date >= currentWeek && exam.exam_date < addDays(currentWeek, 7)
  );

  const dailyPercent = Math.min(100, Math.round((dailyMinutes / 360) * 100));

  const recentDays = useMemo(() => {
    // Keep date arithmetic inside the existing pure-ish helper instead of
    // constructing/mutating Date objects directly inside this memo. This is
    // compatible with the React Compiler used by the current Next.js build.
    return Array.from({ length: 28 }, (_, i) => {
      const date = addDays(today, -(27 - i));
      const minutes = allLogs
        .filter(log => log.date_str === date)
        .reduce((sum, log) => sum + Number(log.duration_mins || 0), 0);
      return { date, minutes };
    });
  }, [allLogs, today]);


  const saveNote = async () => {
    setSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('daily_tracking').upsert({
      user_id: session.user.id,
      date_str: selectedDate,
      notes: note,
    }, { onConflict: 'user_id,date_str' });

    if (error) toast.error(error.message);
    else toast.success('Daily report saved.');
    setSavingNote(false);
  };  const saveMonthlyTarget = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('user_monthly_targets')
      .upsert({
        user_id: session.user.id,
        month_str: currentMonth,
        target_minutes: Number(targetForm.target_minutes) || 0,
        target_videos: Number(targetForm.target_videos) || 0,
        selected_material_ids: Array.from(selectedTargetIds),
      }, { onConflict: 'user_id,month_str' })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setMonthlyTarget(data as MonthlyTarget);
    setShowTargetForm(false);
    toast.success('Monthly target saved.');
  };

  const saveWeeklyTarget = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('user_weekly_targets')
      .upsert({
        user_id: session.user.id,
        week_start: currentWeek,
        month_str: currentMonth,
        target_minutes: Number(weeklyForm.target_minutes) || 0,
        target_videos: Number(weeklyForm.target_videos) || 0,
      }, { onConflict: 'user_id,week_start' })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setWeeklyTarget(data as WeeklyTarget);
    setShowWeeklyForm(false);
    toast.success('Weekly target saved.');
  };

  const toggleMaterial = (id: string) => {
    const next = new Set(selectedTargetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    setMonthlyTarget(prev => prev
      ? { ...prev, selected_material_ids: Array.from(next) }
      : {
          id: '',
          month_str: currentMonth,
          target_minutes: Number(targetForm.target_minutes) || 0,
          target_videos: Number(targetForm.target_videos) || 0,
          selected_material_ids: Array.from(next),
        }
    );
  };

  const addSacrifice = async () => {
    if (!sacrificeText.trim()) return;
    setSavingSacrifice(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSavingSacrifice(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_daily_sacrifices')
      .insert({
        user_id: session.user.id,
        date_str: selectedDate,
        content: sacrificeText.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      setSacrifices(prev => [data as Sacrifice, ...prev]);
      setSacrificeText('');
      toast.success('Sacrifice saved.');
    }

    setSavingSacrifice(false);
  };

  const deleteSacrifice = async (id: string) => {
    const { error } = await supabase
      .from('user_daily_sacrifices')
      .delete()
      .eq('id', id);

    if (error) toast.error(error.message);
    else setSacrifices(prev => prev.filter(item => item.id !== id));
  };

  const shiftWeek = (amount: number) => {
    setSelectedDate(addDays(selectedDate, amount * 7));
  };

  const addExam = async () => {
    if (!examForm.exam_name.trim() || !examForm.exam_date) {
      toast.error('Enter the exam name and date.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('user_exam_scores').insert({
      user_id: session.user.id,
      exam_name: examForm.exam_name.trim(),
      exam_date: examForm.exam_date,
      score: examForm.score === '' ? null : Number(examForm.score),
      total_marks: examForm.total_marks === '' ? null : Number(examForm.total_marks),
      notes: examForm.notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setExamForm({ exam_name: '', exam_date: today, score: '', total_marks: '', notes: '' });
    setShowExamForm(false);
    await loadData();
    toast.success('Exam result added.');
  };

  const deleteExam = async (id: string) => {
    const { error } = await supabase.from('user_exam_scores').delete().eq('id', id);
    if (error) toast.error(error.message);
    else setExams(prev => prev.filter(exam => exam.id !== id));
  };

  const getScorePercent = (exam: Exam) => {
    if (exam.score === null || exam.total_marks === null || !exam.total_marks) return null;
    return Math.round((Number(exam.score) / Number(exam.total_marks)) * 100);
  };


  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans pb-20">
      <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 bg-black/40 hover:bg-white/10 ring-1 ring-white/10 rounded-lg text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">
                <Activity size={11} /> Personal Study Ledger
              </div>
              <h1 className="text-lg sm:text-xl font-black text-zinc-100 tracking-tight">Daily Tracker</h1>
            </div>
          </div>
          <Link
            href="/resources"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            <Video size={13} /> Continue Lectures
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Snapshot */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Selected Day', value: formatMinutes(dailyMinutes), icon: Clock3, box: 'bg-emerald-500/10 ring-emerald-500/20', iconText: 'text-emerald-400' },
            { label: 'Lectures Done', value: logs.length, icon: CheckCircle2, box: 'bg-indigo-500/10 ring-indigo-500/20', iconText: 'text-indigo-400' },
            { label: 'Active Days', value: activeDays, icon: Flame, box: 'bg-orange-500/10 ring-orange-500/20', iconText: 'text-orange-400' },
            { label: 'This Month', value: formatMinutes(monthlyMinutes), icon: Target, box: 'bg-violet-500/10 ring-violet-500/20', iconText: 'text-violet-400' },
          ].map(({ label, value, icon: Icon, box, iconText }) => (
            <div key={label} className="bg-zinc-900/50 ring-1 ring-zinc-800 rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl ${box} ring-1 flex items-center justify-center mb-3`}>
                <Icon size={16} className={iconText} />
              </div>
              <div className="text-xl font-black text-zinc-100">{value}</div>
              <div className="text-[8px] uppercase tracking-widest font-bold text-zinc-600 mt-1">{label}</div>
            </div>
          ))}
        </section>

        {/* Date navigator */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-zinc-100 text-sm">Daily Report</h2>
              <p className="text-[10px] text-zinc-600 mt-1">{getDateLabel(selectedDate)}</p>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-zinc-950 ring-1 ring-zinc-800 rounded-lg px-2 py-2 text-[10px] text-zinc-300 outline-none"
            />
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {dateStrip.map(date => {
              const dayLogs = allLogs.filter(log => log.date_str === date);
              const mins = dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0);
              const active = date === selectedDate;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`min-w-0 rounded-xl p-2.5 text-center ring-1 transition-all ${
                    active ? 'bg-emerald-500/10 ring-emerald-500/40' : 'bg-zinc-950/70 ring-zinc-800 hover:ring-zinc-600'
                  }`}
                >
                  <div className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-black mt-1 ${active ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {new Date(`${date}T12:00:00`).getDate()}
                  </div>
                  <div className={`text-[8px] font-bold mt-1 ${mins ? 'text-emerald-500' : 'text-zinc-700'}`}>
                    {mins ? formatMinutes(mins) : isToday ? 'Today' : '—'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-2">
              <span className="text-zinc-500">6-hour study target</span>
              <span className="text-emerald-400">{dailyPercent}%</span>
            </div>
            <div className="h-2 bg-zinc-950 rounded-full ring-1 ring-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dailyPercent}%` }} />
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6">
          {/* Lecture ledger */}
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-black text-zinc-100 text-sm">What I Completed</h2>
                <p className="text-[9px] text-zinc-600 mt-1">Every completed lecture is stamped with its date.</p>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400 text-[9px] font-black">
                {formatMinutes(dailyMinutes)}
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {loading ? (
                <div className="py-16 text-center text-[10px] uppercase tracking-widest text-zinc-600 animate-pulse">Loading ledger...</div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 ring-1 ring-zinc-800 flex items-center justify-center mx-auto mb-3">
                    <CalendarDays size={20} className="text-zinc-700" />
                  </div>
                  <p className="text-sm font-bold text-zinc-500">Nothing logged for this day.</p>
                  <p className="text-[9px] text-zinc-700 mt-1">Tick a lecture as completed from Curriculum to create the entry.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800/80">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-200 truncate">{log.title}</div>
                        <div className="text-[8px] uppercase tracking-widest text-zinc-600 mt-1 truncate">
                          {log.subject_name} {log.topic_name ? `• ${log.topic_name}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                        <Clock3 size={11} /> {formatMinutes(Number(log.duration_mins))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center">
                <FileText size={15} className="text-rose-400" />
              </div>
              <div>
                <h2 className="font-black text-zinc-100 text-sm">Daily Reflection</h2>
                <p className="text-[9px] text-zinc-600">Write what actually happened.</p>
              </div>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did you study? What went well? What should you fix tomorrow?"
              className="flex-1 min-h-[170px] bg-zinc-950/70 ring-1 ring-zinc-800 rounded-xl p-4 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:ring-emerald-500/40 resize-none"
            />
            <button
              onClick={saveNote}
              disabled={savingNote}
              className="mt-3 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Save size={13} /> {savingNote ? 'Saving...' : 'Save Daily Report'}
            </button>
          </section>
        </div>

        {/* Monthly target + weekly target */}
        <section className="grid lg:grid-cols-[1.35fr_0.9fr] gap-6">
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-emerald-400" />
                  <h2 className="font-black text-zinc-100">
                    {dateObj(`${currentMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} Big Target
                  </h2>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">
                  Set the big goal, then break it into weekly actions.
                </p>
              </div>
              <button
                onClick={() => setShowTargetForm(v => !v)}
                className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
              >
                <Pencil size={12} /> {showTargetForm ? 'Close' : 'Set / Edit Target'}
              </button>
            </div>

            <div className="p-5 grid sm:grid-cols-3 gap-5 items-center">
              <div>
                <div className="text-2xl font-black text-white">{formatMinutes(monthlyMinutes)}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600 mt-1">
                  of {formatMinutes(targetMinutes)} target
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">
                  {targetVideos ? `${targetCompletedVideos}/${targetVideos}` : monthVideos}
                </div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600 mt-1">
                  target videos
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400">
                  {targetMinutes ? pct(monthlyMinutes, targetMinutes) : 0}%
                </div>
                <div className="h-2 bg-zinc-950 rounded-full ring-1 ring-zinc-800 overflow-hidden mt-3">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${targetMinutes ? pct(monthlyMinutes, targetMinutes) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {showTargetForm && (
              <div className="border-t border-zinc-800 p-5 bg-zinc-950/40 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Monthly study target (minutes)
                    <input
                      type="number"
                      value={targetForm.target_minutes}
                      onChange={e => setTargetForm({ ...targetForm, target_minutes: e.target.value })}
                      placeholder="Example: 3600 = 60h"
                      className="mt-2 w-full bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-emerald-500/40"
                    />
                  </label>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    Monthly video target
                    <input
                      type="number"
                      value={targetForm.target_videos}
                      onChange={e => setTargetForm({ ...targetForm, target_videos: e.target.value })}
                      placeholder="Example: 80"
                      className="mt-2 w-full bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-emerald-500/40"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-zinc-200">Pick videos from curriculum</div>
                    <div className="text-[9px] text-zinc-600">Selected: {selectedTargetIds.size}</div>
                  </div>
                  <button
                    onClick={() => setShowCurriculum(v => !v)}
                    className="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 text-[9px] font-black uppercase tracking-widest"
                  >
                    {showCurriculum ? 'Hide curriculum' : 'Choose videos'}
                  </button>
                </div>

                {showCurriculum && (
                  <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-zinc-800 bg-zinc-950/70 p-2 space-y-1">
                    {materials.map(material => (
                      <label
                        key={material.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTargetIds.has(String(material.id))}
                          onChange={() => toggleMaterial(String(material.id))}
                          className="accent-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold text-zinc-200 truncate">{material.title}</div>
                          <div className="text-[8px] text-zinc-600">
                            {material.subject_name}
                            {material.topic_name ? ` • ${material.topic_name}` : ''}
                            {material.duration ? ` • ${material.duration}` : ''}
                          </div>
                        </div>
                        {completedIds.has(String(material.id)) && (
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        )}
                      </label>
                    ))}
                    {materials.length === 0 && (
                      <div className="py-8 text-center text-[9px] text-zinc-700">
                        No curriculum videos found.
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={saveMonthlyTarget}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Save size={13} /> Save Monthly Goal
                </button>
              </div>
            )}
          </section>

          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FlameKindling size={16} className="text-orange-400" />
                  <h2 className="font-black text-zinc-100">This Week</h2>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">
                  {getDateLabel(currentWeek)} – {getDateLabel(weekEnd)}
                </p>
              </div>
              <button
                onClick={() => setShowWeeklyForm(v => !v)}
                className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800 text-zinc-500 hover:text-white"
              >
                <Pencil size={13} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-black text-white">{formatMinutes(weekMinutes)}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">
                  of {formatMinutes(weekTargetMinutes)}
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-indigo-300">
                  {weekTargetMinutes ? pct(weekMinutes, weekTargetMinutes) : 0}%
                </div>
                <div className="h-2 bg-zinc-950 rounded-full mt-3 overflow-hidden ring-1 ring-zinc-800">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${weekTargetMinutes ? pct(weekMinutes, weekTargetMinutes) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-2xl bg-orange-500/5 ring-1 ring-orange-500/10">
              <div className="text-[8px] uppercase tracking-widest font-black text-orange-400">Today's required pace</div>
              <div className="text-2xl font-black text-zinc-100 mt-1">
                {weekTargetMinutes ? formatMinutes(todayNeeded) : 'Set monthly target'}
              </div>
              <div className="text-[9px] text-zinc-600 mt-1">
                {weekTargetMinutes
                  ? `${formatMinutes(remainingWeekMinutes)} remaining across ${daysLeftWeek} day${daysLeftWeek > 1 ? 's' : ''}.`
                  : 'A weekly target will be derived from your monthly goal.'}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                <div className="text-sm font-black text-white">{weekVideos}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">videos done</div>
              </div>
              <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                <div className="text-sm font-black text-indigo-300">
                  {weekTargetVideos ? `${weekTargetCompletedVideos}/${weekTargetVideos}` : '—'}
                </div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">video target</div>
              </div>
            </div>

            {showWeeklyForm && (
              <div className="mt-5 pt-5 border-t border-zinc-800 space-y-3">
                <div className="text-[9px] text-zinc-600">
                  Default is derived from your monthly target. Edit it when a week needs a different workload.
                </div>
                <input
                  type="number"
                  value={weeklyForm.target_minutes}
                  onChange={e => setWeeklyForm({ ...weeklyForm, target_minutes: e.target.value })}
                  placeholder={`Weekly minutes (auto: ${autoWeeklyMinutes})`}
                  className="w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none"
                />
                <input
                  type="number"
                  value={weeklyForm.target_videos}
                  onChange={e => setWeeklyForm({ ...weeklyForm, target_videos: e.target.value })}
                  placeholder={`Weekly videos (auto: ${autoWeeklyVideos})`}
                  className="w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none"
                />
                <button
                  onClick={saveWeeklyTarget}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest"
                >
                  Save Weekly Target
                </button>
              </div>
            )}
          </section>
        </section>

        {/* Weekly graph + today's pace */}
        <section className="grid lg:grid-cols-[1.45fr_.8fr] gap-6">
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-400" />
                  <h2 className="font-black text-zinc-100">Weekly Study Graph</h2>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">Daily study hours and lecture output.</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800">
                  <ChevronLeft size={13} />
                </button>
                <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800">
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="h-64 flex items-end gap-2 sm:gap-4 border-b border-zinc-800 pb-1">
              {dailySeries.map(day => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className="flex-1 h-full flex flex-col justify-end gap-2 group"
                  title={`${day.date}: ${formatMinutes(day.minutes)} • ${day.videos} videos`}
                >
                  <div className="text-[8px] text-zinc-600 opacity-0 group-hover:opacity-100">
                    {formatMinutes(day.minutes)}
                  </div>
                  <div
                    className={`w-full max-w-12 mx-auto rounded-t-lg transition-all ${
                      day.date === selectedDate ? 'bg-emerald-400' : 'bg-indigo-500/70 group-hover:bg-indigo-400'
                    }`}
                    style={{ height: `${Math.max(day.minutes ? 4 : 1, (day.minutes / maxWeek) * 190)}px` }}
                  />
                  <div className="text-[8px] uppercase font-black text-zinc-600">
                    {dateObj(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                <div className="text-lg font-black text-white">{formatMinutes(weekMinutes)}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">study</div>
              </div>
              <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                <div className="text-lg font-black text-white">{weekVideos}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">videos</div>
              </div>
              <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                <div className="text-lg font-black text-white">{weekExams.length}</div>
                <div className="text-[8px] uppercase tracking-widest text-zinc-600">exams</div>
              </div>
            </div>
          </section>

          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Timer size={16} className="text-emerald-400" />
              <h2 className="font-black text-zinc-100">Today's Pace</h2>
            </div>
            <div className="text-[8px] uppercase tracking-widest text-zinc-600">Selected day</div>
            <div className="text-3xl font-black text-white mt-1">{formatMinutes(dailyMinutes)}</div>

            <div className="mt-5 text-[9px] text-zinc-500">Weekly target progress</div>
            <div className="h-2 bg-zinc-950 rounded-full mt-2 overflow-hidden ring-1 ring-zinc-800">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${weekTargetMinutes ? pct(weekMinutes, weekTargetMinutes) : 0}%` }}
              />
            </div>

            <div className="flex justify-between text-[8px] text-zinc-600 mt-2">
              <span>{formatMinutes(weekMinutes)} done</span>
              <span>{formatMinutes(remainingWeekMinutes)} left</span>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-zinc-950/70 ring-1 ring-zinc-800">
              <div className="text-[8px] uppercase tracking-widest text-zinc-600">Needed per remaining day</div>
              <div className="text-sm font-black text-zinc-200 mt-1">
                {weekTargetMinutes ? formatMinutes(todayNeeded) : 'Set a monthly target'}
              </div>
            </div>
          </section>
        </section>

        {/* Monthly graph */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-violet-400" />
                <h2 className="font-black text-zinc-100">Month at a Glance</h2>
              </div>
              <p className="text-[9px] text-zinc-600 mt-1">One bar per day. Select a bar to open that day's report.</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-violet-300">{formatMinutes(monthlyMinutes)}</div>
              <div className="text-[8px] text-zinc-600">{monthVideos} videos • {monthExams.length} exams</div>
            </div>
          </div>

          <div className="h-40 flex items-end gap-0.5 sm:gap-1 overflow-hidden">
            {monthSeries.map(day => (
              <button
                key={day.date}
                title={`${day.date}: ${formatMinutes(day.minutes)} • ${day.videos} videos`}
                onClick={() => setSelectedDate(day.date)}
                className={`flex-1 min-w-[5px] max-w-7 rounded-t-sm ${
                  day.date === selectedDate ? 'bg-emerald-400' : 'bg-violet-500/55 hover:bg-violet-400/80'
                }`}
                style={{ height: `${Math.max(day.minutes ? 3 : 1, (day.minutes / maxMonth) * 125)}px` }}
              />
            ))}
          </div>

          <div className="flex justify-between mt-2 text-[8px] text-zinc-700">
            <span>1</span>
            <span>{Math.ceil(daysInMonth(currentMonth) / 2)}</span>
            <span>{daysInMonth(currentMonth)}</span>
          </div>
        </section>

        {/* 28 day activity */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center">
              <Activity size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-zinc-100 text-sm">28-Day Consistency</h2>
              <p className="text-[9px] text-zinc-600">A visual record of the days you actually studied.</p>
            </div>
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
            {recentDays.map(day => {
              const level = day.minutes === 0 ? 0 : day.minutes < 60 ? 1 : day.minutes < 180 ? 2 : day.minutes < 360 ? 3 : 4;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  title={`${day.date}: ${formatMinutes(day.minutes)}`}
                  className={`aspect-square rounded-lg ring-1 transition-all hover:scale-105 ${
                    level === 0 ? 'bg-zinc-950 ring-zinc-800' :
                    level === 1 ? 'bg-emerald-950 ring-emerald-900' :
                    level === 2 ? 'bg-emerald-900 ring-emerald-800' :
                    level === 3 ? 'bg-emerald-700 ring-emerald-600' :
                    'bg-emerald-500 ring-emerald-400'
                  } ${selectedDate === day.date ? 'outline outline-2 outline-white/50 outline-offset-2' : ''}`}
                />
              );
            })}
          </div>
        </section>

        {/* Exams */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center">
                <GraduationCap size={16} className="text-amber-400" />
              </div>
              <div>
                <h2 className="font-black text-zinc-100 text-sm">Exam Scoreboard</h2>
                <p className="text-[9px] text-zinc-600">Record every mock, GATE test, or other exam.</p>
              </div>
            </div>
            <button
              onClick={() => setShowExamForm(v => !v)}
              className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
            >
              {showExamForm ? <X size={12} /> : <Plus size={12} />} {showExamForm ? 'Close' : 'Add Exam'}
            </button>
          </div>

          {showExamForm && (
            <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input value={examForm.exam_name} onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })} placeholder="Exam name" className="lg:col-span-2 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
              <input type="date" value={examForm.exam_date} onChange={e => setExamForm({ ...examForm, exam_date: e.target.value })} className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <input type="number" value={examForm.score} onChange={e => setExamForm({ ...examForm, score: e.target.value })} placeholder="Score" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <input type="number" value={examForm.total_marks} onChange={e => setExamForm({ ...examForm, total_marks: e.target.value })} placeholder="Total marks" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <textarea value={examForm.notes} onChange={e => setExamForm({ ...examForm, notes: e.target.value })} placeholder="Short note (optional)" className="sm:col-span-2 lg:col-span-4 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none resize-none h-12" />
              <button onClick={addExam} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-widest">Save Result</button>
            </div>
          )}

          <div className="p-4 space-y-2">
            {exams.length === 0 ? (
              <div className="py-10 text-center text-[10px] uppercase tracking-widest text-zinc-700">No exams recorded yet.</div>
            ) : (
              exams.map(exam => {
                const pct = getScorePercent(exam);
                return (
                  <div key={exam.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Trophy size={15} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <div className="text-xs font-bold text-zinc-200">{exam.exam_name}</div>
                      <div className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">{getDateLabel(exam.exam_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-zinc-100">
                        {exam.score === null ? '—' : `${exam.score}${exam.total_marks !== null ? ` / ${exam.total_marks}` : ''}`}
                      </div>
                      {pct !== null && <div className="text-[8px] font-bold text-emerald-400">{pct}%</div>}
                    </div>
                    <button onClick={() => deleteExam(exam.id)} className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

        </section>

        {/* Today's sacrifice */}
        <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-6">
          <section className="bg-gradient-to-br from-orange-500/10 via-zinc-900/50 to-rose-500/5 ring-1 ring-orange-500/15 rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-orange-400" />
                  <h2 className="font-black text-zinc-100">Today's Sacrifice</h2>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">Write what you deliberately gave up for your study goal.</p>
              </div>
              <Sparkles size={17} className="text-orange-400" />
            </div>

            <textarea
              value={sacrificeText}
              onChange={e => setSacrificeText(e.target.value)}
              placeholder="Today I sacrificed ______ because I wanted to study..."
              className="mt-5 w-full min-h-[120px] bg-zinc-950/70 ring-1 ring-zinc-800 rounded-xl p-4 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none resize-none focus:ring-orange-500/30"
            />

            <button
              onClick={addSacrifice}
              disabled={savingSacrifice || !sacrificeText.trim()}
              className="mt-3 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-zinc-950 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={13} /> {savingSacrifice ? 'Saving...' : 'Add to My Sacrifice Log'}
            </button>
          </section>

          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={16} className="text-orange-400" />
              <div>
                <h2 className="font-black text-zinc-100">Sacrifice History</h2>
                <p className="text-[9px] text-zinc-600">{getDateLabel(selectedDate)}</p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sacrifices.filter(item => item.date_str === selectedDate).map(item => (
                <div key={item.id} className="p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800 flex gap-3">
                  <Flame size={14} className="text-orange-400 mt-0.5 shrink-0" />
                  <div className="flex-1 text-[10px] leading-relaxed text-zinc-300">{item.content}</div>
                  <button
                    onClick={() => deleteSacrifice(item.id)}
                    className="text-zinc-700 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {sacrifices.filter(item => item.date_str === selectedDate).length === 0 && (
                <div className="text-[9px] text-zinc-700 text-center py-8">
                  No sacrifice written for this day.
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
