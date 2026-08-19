'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText,
  Flame, GraduationCap, Plus, Save, Trash2, Trophy, Video, X, Target,
  BarChart3, ChevronLeft, ChevronRight, FlameKindling, Sparkles, Pencil,
  BookOpen, Timer, CalendarRange, Brain, ShieldCheck, ListChecks
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
  duration_mins: number | null;
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

type Resolution = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

type ResolutionCheck = {
  id: string;
  resolution_id: string;
  date_str: string;
  completed: boolean;
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

// Tabbed navigation — replaces the old long single-page scroll so each
// area of the dashboard gets focused space instead of competing for it.
const SECTION_NAV = [
  { id: 'today', label: 'Today', icon: Clock3, accent: 'emerald' },
  { id: 'ledger', label: 'Ledger & Notes', icon: FileText, accent: 'rose' },
  { id: 'targets', label: 'Targets', icon: Target, accent: 'indigo' },
  { id: 'graphs', label: 'Graphs', icon: BarChart3, accent: 'violet' },
  { id: 'exams', label: 'Exams', icon: GraduationCap, accent: 'amber' },
  { id: 'sacrifice', label: 'Sacrifice', icon: Flame, accent: 'orange' },
] as const;

type SectionId = typeof SECTION_NAV[number]['id'];

const ACCENT_STYLES: Record<string, { bg: string; ring: string; text: string; solid: string; solidHover: string }> = {
  emerald: { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/25', text: 'text-emerald-400', solid: 'bg-emerald-600', solidHover: 'hover:bg-emerald-500' },
  rose:    { bg: 'bg-rose-500/10',    ring: 'ring-rose-500/25',    text: 'text-rose-400',    solid: 'bg-rose-600',    solidHover: 'hover:bg-rose-500' },
  indigo:  { bg: 'bg-indigo-500/10',  ring: 'ring-indigo-500/25',  text: 'text-indigo-300',  solid: 'bg-indigo-600',  solidHover: 'hover:bg-indigo-500' },
  violet:  { bg: 'bg-violet-500/10',  ring: 'ring-violet-500/25',  text: 'text-violet-300',  solid: 'bg-violet-600',  solidHover: 'hover:bg-violet-500' },
  amber:   { bg: 'bg-amber-500/10',   ring: 'ring-amber-500/25',   text: 'text-amber-400',   solid: 'bg-amber-500',   solidHover: 'hover:bg-amber-400' },
  orange:  { bg: 'bg-orange-500/10',  ring: 'ring-orange-500/25',  text: 'text-orange-400',  solid: 'bg-orange-500',  solidHover: 'hover:bg-orange-400' },
};

export default function DailyTrackerPage() {
  const router = useRouter();
  const today = getISTDateString();

  const [selectedDate, setSelectedDate] = useState(today);
  const [activeSection, setActiveSection] = useState<SectionId>('today');
  const [logs, setLogs] = useState<LectureLog[]>([]);
  const [allLogs, setAllLogs] = useState<LectureLog[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState<WeeklyTarget | null>(null);
  const [sacrifices, setSacrifices] = useState<Sacrifice[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [resolutionChecks, setResolutionChecks] = useState<ResolutionCheck[]>([]);
  const [practiceMinutes, setPracticeMinutes] = useState(0);
  const [allPractice, setAllPractice] = useState<{ date_str: string; practice_minutes: number }[]>([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [savingPractice, setSavingPractice] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionDescription, setResolutionDescription] = useState('');
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
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
    duration_mins: '',
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
      { data: resolutionData },
      { data: resolutionCheckData },
      { data: practiceData },
      { data: branchData },
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
      supabase.from('user_sacrifice_resolutions')
        .select('*')
        .eq('user_id', uid)
        .eq('active', true)
        .order('created_at', { ascending: true }),
      supabase.from('user_sacrifice_resolution_checks')
        .select('*')
        .eq('user_id', uid)
        .gte('date_str', addDays(selectedDate, -30))
        .lte('date_str', selectedDate),
      supabase.from('daily_practice_activity')
        .select('*')
        .eq('user_id', uid),
      supabase.from('user_profiles').select('branch').eq('user_id', uid).maybeSingle(),
      supabase.from('study_materials')
        .select('id,title,subject_name,topic_name,duration,stream')
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
    setResolutions((resolutionData || []) as Resolution[]);
    setResolutionChecks((resolutionCheckData || []) as ResolutionCheck[]);
    const practiceRows = (practiceData || []) as { date_str: string; practice_minutes: number }[];
    setAllPractice(practiceRows);
    const selectedPractice = practiceRows.find(row => row.date_str === selectedDate);
    setPracticeMinutes(Number(selectedPractice?.practice_minutes || 0));
    setPracticeInput(selectedPractice ? String(selectedPractice.practice_minutes || '') : '');
    const branch = (branchData as any)?.branch;
    const branchMaterials = branch ? (materialData || []).filter((m: any) => m.stream === branch) : (materialData || []);
    setMaterials(branchMaterials as Material[]);
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

  const weekPracticeMinutes = useMemo(() => allPractice.filter(row => row.date_str >= currentWeek && row.date_str < addDays(currentWeek, 7)).reduce((sum, row) => sum + Number(row.practice_minutes || 0), 0), [allPractice, currentWeek]);
  const monthPracticeMinutes = useMemo(() => allPractice.filter(row => row.date_str.startsWith(currentMonth)).reduce((sum, row) => sum + Number(row.practice_minutes || 0), 0), [allPractice, currentMonth]);

  const monthLogs = useMemo(
    () => allLogs.filter(log => log.date_str.startsWith(currentMonth)),
    [allLogs, currentMonth]
  );

  const weekLogs = useMemo(
    () => allLogs.filter(log => log.date_str >= currentWeek && log.date_str < addDays(currentWeek, 7)),
    [allLogs, allPractice, exams, currentWeek]
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
      const dayPractice = Number(allPractice.find(row => row.date_str === date)?.practice_minutes || 0);
      const dayExams = exams.filter(exam => exam.exam_date === date);
      return {
        date,
        lectureMinutes: dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
        practiceMinutes: dayPractice,
        minutes: dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0) + dayPractice,
        videos: dayLogs.length,
        exams: dayExams,
      };
    }),
    [allLogs, allPractice, exams, currentWeek]
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


  const savePractice = async () => {
    const minutes = Math.max(0, Math.round(Number(practiceInput) || 0));
    setSavingPractice(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingPractice(false); return; }

    const { data, error } = await supabase
      .from('daily_practice_activity')
      .upsert({
        user_id: session.user.id,
        date_str: selectedDate,
        practice_minutes: minutes,
      }, { onConflict: 'user_id,date_str' })
      .select()
      .single();

    if (error) toast.error(error.message);
    else {
      setPracticeMinutes(Number(data.practice_minutes || 0));
      setPracticeInput(String(data.practice_minutes || ''));
      setAllPractice(prev => [...prev.filter(row => row.date_str !== selectedDate), { date_str: selectedDate, practice_minutes: Number(data.practice_minutes || 0) }]);
      toast.success('Practice time saved.');
    }
    setSavingPractice(false);
  };

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

  const addResolution = async () => {
    const title = resolutionText.trim();
    if (!title) {
      toast.error('Enter a resolution first.');
      return;
    }

    setSavingResolution(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSavingResolution(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_sacrifice_resolutions')
      .insert({
        user_id: session.user.id,
        title,
        description: resolutionDescription.trim() || null,
        active: true,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      setResolutions(prev => [...prev, data as Resolution]);
      setResolutionText('');
      setResolutionDescription('');
      setShowResolutionForm(false);
      toast.success('Resolution added.');
    }
    setSavingResolution(false);
  };

  const toggleResolution = async (resolution: Resolution) => {
    if (selectedDate !== today) {
      toast.error('Sacrifice resolutions can only be checked for today.');
      return;
    }

    const existing = resolutionChecks.find(
      check => check.resolution_id === resolution.id && check.date_str === selectedDate
    );

    if (existing) {
      const { error } = await supabase
        .from('user_sacrifice_resolution_checks')
        .delete()
        .eq('id', existing.id);

      if (error) {
        toast.error(error.message);
        return;
      }
      setResolutionChecks(prev => prev.filter(check => check.id !== existing.id));
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('user_sacrifice_resolution_checks')
      .insert({
        user_id: session.user.id,
        resolution_id: resolution.id,
        date_str: selectedDate,
        completed: true,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setResolutionChecks(prev => [...prev, data as ResolutionCheck]);
  };

  const deleteResolution = async (id: string) => {
    const { error } = await supabase
      .from('user_sacrifice_resolutions')
      .update({ active: false })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setResolutions(prev => prev.filter(item => item.id !== id));
    setResolutionChecks(prev => prev.filter(item => item.resolution_id !== id));
    toast.success('Resolution removed.');
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
      duration_mins: examForm.duration_mins === '' ? 0 : Math.max(0, Number(examForm.duration_mins)),
      notes: examForm.notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setExamForm({ exam_name: '', exam_date: today, score: '', total_marks: '', duration_mins: '', notes: '' });
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

  const selectedResolutionIds = new Set(
    resolutionChecks
      .filter(check => check.date_str === selectedDate && check.completed)
      .map(check => check.resolution_id)
  );

  const resolutionStats = resolutions.map(resolution => {
    const checks = resolutionChecks.filter(
      check => check.resolution_id === resolution.id && check.completed
    );
    return {
      ...resolution,
      completedCount: checks.length,
      last30Percent: Math.round((checks.length / 31) * 100),
    };
  });

  const sacrificeGraphDays = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(selectedDate, -(13 - i));
    const completed = resolutions.filter(resolution =>
      resolutionChecks.some(
        check =>
          check.resolution_id === resolution.id &&
          check.date_str === date &&
          check.completed
      )
    ).length;
    return {
      date,
      completed,
      total: resolutions.length,
    };
  });

  const maxSacrificeGraph = Math.max(1, ...sacrificeGraphDays.map(day => day.completed));

  const activeMeta = SECTION_NAV.find(s => s.id === activeSection)!;
  const activeAccent = ACCENT_STYLES[activeMeta.accent];

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-300 font-sans pb-16">
      {/* Ambient backdrop glow — a single quiet signature, not scattered decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/[0.06] blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#050608]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 bg-black/40 hover:bg-white/10 ring-1 ring-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
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
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:ring-zinc-700 transition-all"
          >
            <Video size={13} /> Continue Lectures
          </Link>
        </div>
      </header>

      <main className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* ============ ALWAYS-VISIBLE SNAPSHOT ============ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Selected Day', value: formatMinutes(dailyMinutes), icon: Clock3, accent: 'emerald' },
            { label: 'Lectures Done', value: logs.length, icon: CheckCircle2, accent: 'indigo' },
            { label: 'Active Days', value: activeDays, icon: Flame, accent: 'orange' },
            { label: 'This Month', value: formatMinutes(monthlyMinutes), icon: Target, accent: 'violet' },
          ].map(({ label, value, icon: Icon, accent }) => {
            const a = ACCENT_STYLES[accent];
            return (
              <div
                key={label}
                className="group relative bg-zinc-900/40 ring-1 ring-zinc-800 rounded-2xl p-4 hover:ring-zinc-700 hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${a.bg} blur-2xl opacity-60 group-hover:opacity-100 transition-opacity`} />
                <div className={`relative w-9 h-9 rounded-xl ${a.bg} ring-1 ${a.ring} flex items-center justify-center mb-3`}>
                  <Icon size={16} className={a.text} />
                </div>
                <div className="relative text-xl font-black text-zinc-100">{value}</div>
                <div className="relative text-[8px] uppercase tracking-widest font-bold text-zinc-600 mt-1">{label}</div>
              </div>
            );
          })}
        </section>

        {/* ============ TAB NAVIGATION ============ */}
        <nav className="sticky top-[73px] z-30 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-zinc-900/60 backdrop-blur-xl ring-1 ring-zinc-800 rounded-2xl p-1.5">
            {SECTION_NAV.map(({ id, label, icon: Icon, accent }) => {
              const isActive = id === activeSection;
              const a = ACCENT_STYLES[accent];
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    isActive
                      ? `${a.bg} ${a.text} ring-1 ${a.ring}`
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ============ ACTIVE SECTION CONTENT ============ */}
        <div className="space-y-6 animate-[fadeIn_.25s_ease]">

        {activeSection === 'today' && (
          <div className="space-y-6">
            {/* Date navigator + daily progress */}
            <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em]">
                    <CalendarDays size={11} /> Daily Report
                  </div>
                  <h2 className="font-black text-zinc-100 text-base mt-1">{getDateLabel(selectedDate)}</h2>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-zinc-950 ring-1 ring-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-300 outline-none focus:ring-emerald-500/40"
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

            {/* Quick jump into the rest of the dashboard from today's view */}
            <section className="grid sm:grid-cols-3 gap-3">
              <button
                onClick={() => setActiveSection('ledger')}
                className="text-left bg-zinc-900/40 ring-1 ring-zinc-800 hover:ring-rose-500/30 rounded-2xl p-4 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FileText size={15} className="text-rose-400" />
                </div>
                <div className="text-xs font-black text-zinc-200">Log &amp; Reflect</div>
                <div className="text-[9px] text-zinc-600 mt-1">{logs.length} lecture{logs.length === 1 ? '' : 's'} logged today</div>
              </button>
              <button
                onClick={() => setActiveSection('targets')}
                className="text-left bg-zinc-900/40 ring-1 ring-zinc-800 hover:ring-indigo-500/30 rounded-2xl p-4 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Target size={15} className="text-indigo-300" />
                </div>
                <div className="text-xs font-black text-zinc-200">Targets</div>
                <div className="text-[9px] text-zinc-600 mt-1">{weekTargetMinutes ? `${pct(weekMinutes, weekTargetMinutes)}% of week done` : 'No target set yet'}</div>
              </button>
              <button
                onClick={() => setActiveSection('sacrifice')}
                className="text-left bg-zinc-900/40 ring-1 ring-zinc-800 hover:ring-orange-500/30 rounded-2xl p-4 transition-all group"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Flame size={15} className="text-orange-400" />
                </div>
                <div className="text-xs font-black text-zinc-200">Sacrifice Log</div>
                <div className="text-[9px] text-zinc-600 mt-1">
                  {sacrifices.filter(s => s.date_str === selectedDate).length ? 'Written for today' : 'Nothing written yet'}
                </div>
              </button>
            </section>
          </div>
        )}

        {activeSection === 'ledger' && (
          <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6">
            {/* Lecture ledger */}
            <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em]">
                    <ListChecks size={11} /> Completed Lectures
                  </div>
                  <h2 className="font-black text-zinc-100 text-sm mt-1">What I Completed — {getDateLabel(selectedDate)}</h2>
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
                      <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800/80 hover:ring-zinc-700 transition-colors">
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

            {/* Practice */}
            <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 flex items-center justify-center">
                  <Brain size={15} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-black text-zinc-100 text-sm">Practice Time</h2>
                  <p className="text-[9px] text-zinc-600">Practice, problem solving, revision or PYQs for this day.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="number" min="0" value={practiceInput} onChange={e => setPracticeInput(e.target.value)} placeholder="Minutes" className="flex-1 bg-zinc-950/70 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-cyan-500/40" />
                <button onClick={savePractice} disabled={savingPractice} className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest">
                  {savingPractice ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div className="mt-3 text-[9px] text-cyan-400 font-black uppercase tracking-widest">{formatMinutes(practiceMinutes)} practice logged</div>
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
                className="mt-3 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
              >
                <Save size={13} /> {savingNote ? 'Saving...' : 'Save Daily Report'}
              </button>
            </section>
          </div>
        )}

        {activeSection === 'targets' && (
          <div className="grid lg:grid-cols-[1.35fr_0.9fr] gap-6">
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
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors"
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
                      className="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-colors"
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
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
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
                  className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800 text-zinc-500 hover:text-white transition-colors"
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
                    className="w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-indigo-500/40"
                  />
                  <input
                    type="number"
                    value={weeklyForm.target_videos}
                    onChange={e => setWeeklyForm({ ...weeklyForm, target_videos: e.target.value })}
                    placeholder={`Weekly videos (auto: ${autoWeeklyVideos})`}
                    className="w-full bg-zinc-950 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-indigo-500/40"
                  />
                  <button
                    onClick={saveWeeklyTarget}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest transition-colors"
                  >
                    Save Weekly Target
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeSection === 'graphs' && (
          <div className="space-y-6">
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
                    <button onClick={() => shiftWeek(-1)} className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800 hover:ring-zinc-700 transition-colors">
                      <ChevronLeft size={13} />
                    </button>
                    <button onClick={() => shiftWeek(1)} className="p-2 rounded-lg bg-zinc-950 ring-1 ring-zinc-800 hover:ring-zinc-700 transition-colors">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="h-64 flex items-end gap-2 sm:gap-4 border-b border-zinc-800 pb-1">
                  {dailySeries.map(day => {
                    const exam = day.exams[0];
                    const barHeight = Math.max(day.minutes ? 6 : 2, (day.minutes / maxWeek) * 180);
                    const lectureHeight = day.minutes ? (day.lectureMinutes / day.minutes) * barHeight : 0;
                    const practiceHeight = day.minutes ? (day.practiceMinutes / day.minutes) * barHeight : 0;
                    const examText = day.exams.length
                      ? day.exams.map(item => `${item.exam_name}: ${item.duration_mins || 0}m, ${item.score ?? '—'} / ${item.total_marks ?? '—'}`).join(' | ')
                      : 'No exam';
                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        className="flex-1 h-full flex flex-col justify-end gap-1 group min-w-0"
                        title={`${day.date} • Lecture ${formatMinutes(day.lectureMinutes)} • Practice ${formatMinutes(day.practiceMinutes)} • ${examText}`}
                      >
                        <div className="h-8 flex items-end justify-center">
                          {exam && <span className="max-w-full truncate px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[7px] font-black ring-1 ring-amber-500/20">{exam.exam_name}</span>}
                        </div>
                        <div className="text-[8px] text-zinc-500 opacity-0 group-hover:opacity-100 truncate">
                          {formatMinutes(day.minutes)}
                        </div>
                        <div className="w-full max-w-12 mx-auto flex flex-col justify-end rounded-t-lg overflow-hidden transition-all bg-zinc-950 ring-1 ring-zinc-800/80" style={{ height: `${barHeight}px` }}>
                          <div className="bg-cyan-400/80" style={{ height: `${practiceHeight}px` }} />
                          <div className={`${day.date === selectedDate ? 'bg-emerald-400' : 'bg-indigo-500/80 group-hover:bg-indigo-400'}`} style={{ height: `${lectureHeight}px` }} />
                        </div>
                        <div className="text-[8px] uppercase font-black text-zinc-600">
                          {dateObj(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-[8px] uppercase tracking-widest font-black text-zinc-600">
                  <span><i className="inline-block w-2 h-2 rounded-sm bg-indigo-500 mr-1" />Lecture</span>
                  <span><i className="inline-block w-2 h-2 rounded-sm bg-cyan-400 mr-1" />Practice</span>
                  <span className="text-amber-400">Exam label = name • hover = duration + marks</span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                    <div className="text-lg font-black text-white">{formatMinutes(weekMinutes)}</div>
                    <div className="text-[8px] uppercase tracking-widest text-zinc-600">study</div>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 p-3">
                    <div className="text-lg font-black text-white">{weekPracticeMinutes ? formatMinutes(weekPracticeMinutes) : '0m'}</div>
                    <div className="text-[8px] uppercase tracking-widest text-zinc-600">practice</div>
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
          </div>
        )}

        {activeSection === 'exams' && (
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
                className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-amber-500/20 transition-colors"
              >
                {showExamForm ? <X size={12} /> : <Plus size={12} />} {showExamForm ? 'Close' : 'Add Exam'}
              </button>
            </div>

            {showExamForm && (
              <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input value={examForm.exam_name} onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })} placeholder="Exam name" className="lg:col-span-2 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
                <input type="date" value={examForm.exam_date} onChange={e => setExamForm({ ...examForm, exam_date: e.target.value })} className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
                <input type="number" value={examForm.score} onChange={e => setExamForm({ ...examForm, score: e.target.value })} placeholder="Score" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
                <input type="number" value={examForm.total_marks} onChange={e => setExamForm({ ...examForm, total_marks: e.target.value })} placeholder="Total marks" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
                <input type="number" min="0" value={examForm.duration_mins} onChange={e => setExamForm({ ...examForm, duration_mins: e.target.value })} placeholder="Exam minutes" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
                <textarea value={examForm.notes} onChange={e => setExamForm({ ...examForm, notes: e.target.value })} placeholder="Short note (optional)" className="sm:col-span-2 lg:col-span-4 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none resize-none h-12 focus:ring-amber-500/40" />
                <button onClick={addExam} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Save Result</button>
              </div>
            )}

            <div className="p-4 space-y-2">
              {exams.length === 0 ? (
                <div className="py-10 text-center text-[10px] uppercase tracking-widest text-zinc-700">No exams recorded yet.</div>
              ) : (
                exams.map(exam => {
                  const scorePct = getScorePercent(exam);
                  return (
                    <div key={exam.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800 hover:ring-zinc-700 transition-colors">
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
                        {scorePct !== null && <div className="text-[8px] font-bold text-emerald-400">{scorePct}%</div>}
                        {exam.duration_mins ? <div className="text-[8px] text-zinc-600 mt-1">{formatMinutes(Number(exam.duration_mins))} exam</div> : null}
                      </div>
                      <button onClick={() => deleteExam(exam.id)} className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {activeSection === 'sacrifice' && (
          <div className="space-y-6">
            <section className="grid lg:grid-cols-[1.2fr_.8fr] gap-6">
              <section className="bg-gradient-to-br from-orange-500/10 via-zinc-900/50 to-rose-500/5 ring-1 ring-orange-500/15 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-orange-400" />
                      <h2 className="font-black text-zinc-100">My Sacrifice Resolutions</h2>
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1">
                      Create the habits you are deliberately giving up, then tick them every day you keep the promise.
                    </p>
                    {selectedDate !== today && <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-amber-400">Historical days are view-only. Resolution checks can only be recorded for today.</div>}
                  </div>
                  <button
                    onClick={() => setShowResolutionForm(v => !v)}
                    className="px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-orange-500/20 transition-colors"
                  >
                    {showResolutionForm ? <X size={12} /> : <Plus size={12} />}
                    {showResolutionForm ? 'Close' : 'New Resolution'}
                  </button>
                </div>

                {showResolutionForm && (
                  <div className="mt-5 p-4 rounded-2xl bg-zinc-950/70 ring-1 ring-zinc-800 space-y-3">
                    <input
                      value={resolutionText}
                      onChange={e => setResolutionText(e.target.value)}
                      placeholder="e.g. No afternoon sleep"
                      className="w-full bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-orange-500/40"
                    />
                    <input
                      value={resolutionDescription}
                      onChange={e => setResolutionDescription(e.target.value)}
                      placeholder="Optional reason or rule"
                      className="w-full bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-orange-500/40"
                    />
                    <button
                      onClick={addResolution}
                      disabled={savingResolution || !resolutionText.trim()}
                      className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-zinc-950 text-[9px] font-black uppercase tracking-widest transition-colors"
                    >
                      {savingResolution ? 'Saving...' : 'Create Resolution'}
                    </button>
                  </div>
                )}

                <div className="mt-5 space-y-2">
                  {resolutions.length === 0 ? (
                    <div className="py-10 text-center rounded-2xl bg-zinc-950/50 ring-1 ring-zinc-800">
                      <FlameKindling size={22} className="text-orange-400/60 mx-auto mb-2" />
                      <p className="text-xs font-bold text-zinc-500">No resolutions yet.</p>
                      <p className="text-[9px] text-zinc-700 mt-1">Create your first rule and start building your record.</p>
                    </div>
                  ) : resolutions.map(resolution => {
                    const checked = selectedResolutionIds.has(resolution.id);
                    const stat = resolutionStats.find(item => item.id === resolution.id);
                    return (
                      <div key={resolution.id} className={`p-3 rounded-xl ring-1 transition-all ${
                        checked ? 'bg-orange-500/10 ring-orange-500/30' : 'bg-zinc-950/60 ring-zinc-800'
                      }`}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleResolution(resolution)}
                            disabled={selectedDate !== today}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-all ${selectedDate !== today ? 'opacity-35 cursor-not-allowed' : ''} ${
                              checked
                                ? 'bg-orange-500 text-zinc-950 ring-orange-400'
                                : 'bg-zinc-900 text-zinc-600 ring-zinc-800 hover:text-orange-400 hover:ring-orange-500/30'
                            }`}
                            title={checked ? 'Undo today' : 'I kept this resolution today'}
                          >
                            <CheckCircle2 size={17} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-zinc-200">{resolution.title}</div>
                            {resolution.description && (
                              <div className="text-[8px] text-zinc-600 mt-1 truncate">{resolution.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[8px] uppercase tracking-widest text-orange-400 font-black">
                                {stat?.completedCount || 0} days kept
                              </span>
                              <span className="text-[8px] text-zinc-700">•</span>
                              <span className="text-[8px] text-zinc-600">
                                {checked ? 'Kept today' : 'Not checked today'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteResolution(resolution.id)}
                            className="p-2 text-zinc-700 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Remove resolution"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20 flex items-center justify-center">
                    <Flame size={15} className="text-orange-400" />
                  </div>
                  <div>
                    <h2 className="font-black text-zinc-100 text-sm">Today's Score</h2>
                    <p className="text-[9px] text-zinc-600">{getDateLabel(selectedDate)}</p>
                  </div>
                </div>

                <div className="flex items-end gap-3">
                  <div className="text-4xl font-black text-orange-400">
                    {resolutions.length ? Math.round((selectedResolutionIds.size / resolutions.length) * 100) : 0}%
                  </div>
                  <div className="text-[9px] text-zinc-600 pb-1">
                    {selectedResolutionIds.size}/{resolutions.length} resolutions kept
                  </div>
                </div>

                <div className="h-2 bg-zinc-950 rounded-full mt-4 overflow-hidden ring-1 ring-zinc-800">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${resolutions.length ? (selectedResolutionIds.size / resolutions.length) * 100 : 0}%` }}
                  />
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-zinc-950/70 ring-1 ring-zinc-800">
                  <div className="text-[8px] uppercase tracking-widest text-zinc-600">Your record</div>
                  <div className="text-xl font-black text-zinc-100 mt-1">
                    {resolutionStats.reduce((sum, item) => sum + item.completedCount, 0)} total kept days
                  </div>
                  <div className="text-[9px] text-zinc-700 mt-1">Across all active resolutions</div>
                </div>
              </section>
            </section>

            <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-orange-400" />
                    <h2 className="font-black text-zinc-100">Sacrifice Graph</h2>
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-1">
                    How consistently you kept your resolutions over the last 14 days.
                  </p>
                </div>
                <div className="text-[9px] text-zinc-600">
                  {resolutions.length} active {resolutions.length === 1 ? 'resolution' : 'resolutions'}
                </div>
              </div>

              <div className="h-52 flex items-end gap-1 sm:gap-2 border-b border-zinc-800 pb-1">
                {sacrificeGraphDays.map(day => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    title={`${day.date}: ${day.completed}/${day.total} resolutions kept`}
                    className="flex-1 h-full flex flex-col justify-end gap-2 group"
                  >
                    <div className="text-[8px] text-zinc-600 opacity-0 group-hover:opacity-100">
                      {day.completed}/{day.total}
                    </div>
                    <div
                      className={`w-full max-w-10 mx-auto rounded-t-lg transition-all ${
                        day.date === selectedDate ? 'bg-orange-400' : 'bg-orange-500/60 group-hover:bg-orange-400'
                      }`}
                      style={{
                        height: `${Math.max(day.completed ? 8 : 2, (day.completed / maxSacrificeGraph) * 155)}px`,
                      }}
                    />
                    <div className="text-[8px] uppercase font-black text-zinc-600">
                      {dateObj(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid lg:grid-cols-2 gap-6">
              <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <h2 className="font-black text-zinc-100">Resolution Records</h2>
                </div>
                <div className="space-y-3">
                  {resolutionStats.length === 0 ? (
                    <div className="text-[9px] text-zinc-700 text-center py-8">Create a resolution to see its record.</div>
                  ) : resolutionStats.map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-300 truncate pr-3">{item.title}</span>
                        <span className="text-[9px] font-black text-orange-400">{item.completedCount} days</span>
                      </div>
                      <div className="h-2 bg-zinc-950 rounded-full overflow-hidden ring-1 ring-zinc-800">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${Math.min(100, item.last30Percent)}%` }}
                        />
                      </div>
                      <div className="text-[8px] text-zinc-700 mt-1">Last 31 days</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-gradient-to-br from-orange-500/10 via-zinc-900/50 to-rose-500/5 ring-1 ring-orange-500/15 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-orange-400" />
                      <h2 className="font-black text-zinc-100">Today's Sacrifice Note</h2>
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1">Write the personal sacrifice behind today's checkmarks.</p>
                  </div>
                </div>

                <textarea
                  value={sacrificeText}
                  onChange={e => setSacrificeText(e.target.value)}
                  placeholder="Today I sacrificed ______ because I wanted to study..."
                  className="mt-5 w-full min-h-[110px] bg-zinc-950/70 ring-1 ring-zinc-800 rounded-xl p-4 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none resize-none focus:ring-orange-500/30"
                />

                <button
                  onClick={addSacrifice}
                  disabled={savingSacrifice || !sacrificeText.trim()}
                  className="mt-3 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-zinc-950 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={13} /> {savingSacrifice ? 'Saving...' : 'Add to My Sacrifice Log'}
                </button>

                <div className="mt-5 space-y-2 max-h-52 overflow-y-auto">
                  {sacrifices.filter(item => item.date_str === selectedDate).map(item => (
                    <div key={item.id} className="p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800 flex gap-3">
                      <Flame size={14} className="text-orange-400 mt-0.5 shrink-0" />
                      <div className="flex-1 text-[10px] leading-relaxed text-zinc-300">{item.content}</div>
                      <button
                        onClick={() => deleteSacrifice(item.id)}
                        className="text-zinc-700 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {sacrifices.filter(item => item.date_str === selectedDate).length === 0 && (
                    <div className="text-[9px] text-zinc-700 text-center py-5">No written sacrifice for this day.</div>
                  )}
                </div>
              </section>
            </section>
          </div>
        )}



        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
