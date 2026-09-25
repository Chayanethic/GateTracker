'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Play,
  Target,
  Trophy,
  ChevronDown,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Props = {
  curriculum: any[];
  completedIds: Set<string>;
};

type DayActivity = {
  date_str: string;
  title: string;
  subject_name: string;
  topic_name: string;
  duration_mins: number;
  material_id: string;
};

type DaySummary = {
  minutes: number;
  lectures: number;
  activities: DayActivity[];
};

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const subjectColors = [
  { bar: 'from-cyan-400 to-blue-500', text: 'text-cyan-300', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20' },
  { bar: 'from-violet-400 to-fuchsia-500', text: 'text-violet-300', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
  { bar: 'from-amber-400 to-orange-500', text: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
  { bar: 'from-emerald-400 to-teal-500', text: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
  { bar: 'from-pink-400 to-rose-500', text: 'text-pink-300', bg: 'bg-pink-500/10', ring: 'ring-pink-500/20' },
  { bar: 'from-sky-400 to-indigo-500', text: 'text-sky-300', bg: 'bg-sky-500/10', ring: 'ring-sky-500/20' },
];

export default function DashboardStudyInsights({ curriculum, completedIds }: Props) {
  const [dailyTracking, setDailyTracking] = useState<Record<string, number>>({});
  const [activityByDay, setActivityByDay] = useState<Record<string, DayActivity[]>>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loading, setLoading] = useState(true);
  const [expandedProgressSubjects, setExpandedProgressSubjects] = useState<string[]>([]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = keyOf(today);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Keep a generous history so the calendar can move across months without another request.
      const from = keyOf(addDays(today, -365));
      const to = keyOf(addDays(today, 1));

      const [{ data: tracking }, { data: activities }] = await Promise.all([
        supabase
          .from('daily_tracking')
          .select('date_str, study_minutes')
          .eq('user_id', session.user.id)
          .gte('date_str', from)
          .lte('date_str', to),
        supabase
          .from('daily_lecture_activity')
          .select('date_str, material_id, title, subject_name, topic_name, duration_mins')
          .eq('user_id', session.user.id)
          .gte('date_str', from)
          .lte('date_str', to)
          .order('date_str', { ascending: false }),
      ]);

      if (!mounted) return;

      const trackingMap: Record<string, number> = {};
      (tracking || []).forEach((row: any) => {
        trackingMap[row.date_str] = Number(row.study_minutes || 0);
      });

      const activityMap: Record<string, DayActivity[]> = {};
      (activities || []).forEach((row: any) => {
        const item: DayActivity = {
          date_str: row.date_str,
          material_id: row.material_id,
          title: row.title || 'Lecture',
          subject_name: row.subject_name || 'Other',
          topic_name: row.topic_name || 'Other',
          duration_mins: Number(row.duration_mins || 0),
        };
        (activityMap[item.date_str] ||= []).push(item);
      });

      // If daily_tracking is missing for a day, calculate the visible study time from the lecture ledger.
      Object.entries(activityMap).forEach(([date, rows]) => {
        if (!trackingMap[date]) trackingMap[date] = rows.reduce((sum, row) => sum + row.duration_mins, 0);
      });

      setDailyTracking(trackingMap);
      setActivityByDay(activityMap);
      setSelectedDate(todayKey);
      setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [today, todayKey]);

  const subjectProgress = useMemo(() => {
    const groups = new Map<string, { total: number; completed: number; topics: Map<string, { total: number; completed: number }> }>();
    curriculum.forEach((m: any) => {
      const subject = m.subject_name || 'Other';
      const topic = m.topic_name || 'Other';
      const current = groups.get(subject) || { total: 0, completed: 0, topics: new Map() };
      current.total += 1;
      const done = completedIds.has(m.id);
      if (done) current.completed += 1;
      const topicStats = current.topics.get(topic) || { total: 0, completed: 0 };
      topicStats.total += 1;
      if (done) topicStats.completed += 1;
      current.topics.set(topic, topicStats);
      groups.set(subject, current);
    });
    return [...groups.entries()]
      .map(([subject, stats]) => ({
        subject,
        total: stats.total,
        completed: stats.completed,
        percent: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
        topics: [...stats.topics.entries()]
          .map(([topic, topicStats]) => ({ topic, ...topicStats, percent: topicStats.total ? Math.round((topicStats.completed / topicStats.total) * 100) : 0 }))
          .sort((a, b) => a.topic.localeCompare(b.topic)),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [curriculum, completedIds]);

  const recentDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(today, -6 + index));
  }, [today]);

  const selectedActivities = activityByDay[selectedDate] || [];
  const selectedMinutes = dailyTracking[selectedDate] || 0;
  const selectedDateLabel = selectedDate
    ? parseKey(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Select a day';

  const monthCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const maxCalendarMinutes = useMemo(() => {
    const values = monthCells.filter(Boolean).map(d => dailyTracking[keyOf(d as Date)] || 0);
    return Math.max(60, ...values);
  }, [monthCells, dailyTracking]);

  const monthTotal = useMemo(() => {
    return monthCells.filter(Boolean).reduce((sum, d) => sum + (dailyTracking[keyOf(d as Date)] || 0), 0);
  }, [monthCells, dailyTracking]);

  const selectedSubjectBreakdown = useMemo(() => {
    const map = new Map<string, { minutes: number; lectures: number }>();
    selectedActivities.forEach(activity => {
      const current = map.get(activity.subject_name) || { minutes: 0, lectures: 0 };
      current.minutes += activity.duration_mins;
      current.lectures += 1;
      map.set(activity.subject_name, current);
    });
    return [...map.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  }, [selectedActivities]);

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const moveMonth = (amount: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  };

  return (
    <section className="mt-8 space-y-6">
      {/* ALL SUBJECT PROGRESS */}
      <div className="overflow-hidden rounded-[1.5rem] bg-zinc-950/85 ring-1 ring-white/10 shadow-[0_14px_45px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-400"><BarChart3 size={12} /> Curriculum progress</div>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white">All subjects</h2>
            <p className="mt-0.5 text-[9px] text-zinc-600">Open any subject to see completed and remaining topics.</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-right ring-1 ring-white/10">
            <div className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Lectures</div>
            <div className="text-xs font-black text-white">{completedIds.size}/{curriculum.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjectProgress.map((item, index) => {
            const color = subjectColors[index % subjectColors.length];
            const open = expandedProgressSubjects.includes(item.subject);
            const remaining = item.total - item.completed;
            return (
              <div key={item.subject} className={`overflow-hidden rounded-xl ${color.bg} ring-1 ${color.ring} transition ${open ? 'sm:col-span-2 xl:col-span-1' : ''}`}>
                <button
                  type="button"
                  onClick={() => setExpandedProgressSubjects(prev => prev.includes(item.subject) ? prev.filter(s => s !== item.subject) : [...prev, item.subject])}
                  className="w-full p-3 text-left transition hover:bg-white/[0.025]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[11px] font-black text-zinc-100">{item.subject}</div>
                        {item.percent === 100 && <CheckCircle2 size={12} className="shrink-0 text-emerald-400" />}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                        <div className={`h-full rounded-full bg-gradient-to-r ${color.bar} transition-all duration-700`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-xs font-black ${item.percent === 100 ? 'text-emerald-300' : color.text}`}>{item.percent}%</div>
                      <div className="text-[7px] font-bold text-zinc-600">{item.completed}/{item.total}</div>
                    </div>
                    <ChevronDown size={13} className={`shrink-0 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[7px] font-black uppercase tracking-wider">
                    <span className="text-emerald-400/70">{item.topics.filter(t => t.percent === 100).length} topics complete</span>
                    <span className="text-zinc-600">{remaining} lectures remain</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-white/5 bg-black/10 px-3 pb-3">
                    <div className="mb-2 flex items-center justify-between pt-2 text-[7px] font-black uppercase tracking-widest text-zinc-600">
                      <span>Topic progress</span><span>{item.topics.length} topics</span>
                    </div>
                    <div className="grid gap-1.5">
                      {item.topics.map(topic => (
                        <Link key={topic.topic} href={`/resources?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(topic.topic)}`} className="flex items-center gap-2 rounded-lg bg-zinc-950/70 px-2.5 py-2 ring-1 ring-white/5 transition hover:ring-white/10">
                          {topic.percent === 100 ? <CheckCircle2 size={11} className="shrink-0 text-emerald-400" /> : topic.completed > 0 ? <div className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-cyan-400/70" /> : <Circle size={11} className="shrink-0 text-zinc-700" />}
                          <span className={`min-w-0 flex-1 truncate text-[9px] font-bold ${topic.percent === 100 ? 'text-emerald-300/80' : 'text-zinc-300'}`}>{topic.topic}</span>
                          <span className={`shrink-0 text-[8px] font-black ${topic.percent === 100 ? 'text-emerald-400' : color.text}`}>{topic.completed}/{topic.total}</span>
                          <span className="shrink-0 text-[7px] font-bold text-zinc-600">{topic.percent}%</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RECENT 7 DAYS */}
      <div className="overflow-hidden rounded-[1.75rem] bg-zinc-950/90 ring-1 ring-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400"><Flame size={13} /> Recent 7 days</div>
              <h2 className="mt-1 text-xl font-black text-white">Your study streak</h2>
              <p className="mt-1 text-[11px] text-zinc-500">Every day shows what you actually completed.</p>
            </div>
            <div className="hidden rounded-xl bg-emerald-500/10 px-3 py-2 text-right ring-1 ring-emerald-500/20 sm:block">
              <div className="text-[8px] font-black uppercase tracking-widest text-emerald-400/70">Active days</div>
              <div className="text-sm font-black text-emerald-300">{recentDays.filter(d => (dailyTracking[keyOf(d)] || 0) > 0).length}/7</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-7">
          {recentDays.map(day => {
            const key = keyOf(day);
            const minutes = dailyTracking[key] || 0;
            const activities = activityByDay[key] || [];
            const isSelected = selectedDate === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`group rounded-2xl p-3 text-left transition ${isSelected ? 'bg-emerald-500/10 ring-2 ring-emerald-400/50' : 'bg-white/[0.025] ring-1 ring-white/10 hover:bg-white/[0.045]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  {minutes > 0 ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-zinc-950"><Check size={11} strokeWidth={3} /></span> : <span className="h-5 w-5 rounded-full bg-zinc-900 ring-1 ring-white/10" />}
                </div>
                <div className={`mt-2 text-lg font-black ${isToday ? 'text-emerald-300' : 'text-zinc-100'}`}>{day.getDate()}</div>
                <div className="mt-2 text-[10px] font-bold text-zinc-500">{minutes ? formatMinutes(minutes) : 'No study'}</div>
                <div className="mt-2 line-clamp-2 min-h-7 text-[8px] font-semibold leading-relaxed text-zinc-600">
                  {activities.length ? [...new Set(activities.map(a => a.subject_name))].slice(0, 2).join(' • ') : 'Nothing logged'}
                </div>
              </button>
            );
          })}
        </div>

        {/* SELECTED DAY DETAIL */}
        <div className="border-t border-white/5 bg-black/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">Selected day</div>
              <h3 className="mt-1 text-lg font-black text-white">{selectedDateLabel}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black text-emerald-300 ring-1 ring-emerald-500/20">{formatMinutes(selectedMinutes)} studied</span>
                <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-[9px] font-black text-indigo-300 ring-1 ring-indigo-500/20">{selectedActivities.length} lectures</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedSubjectBreakdown.map(([subject, stats]) => (
                <span key={subject} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[8px] font-bold text-zinc-400 ring-1 ring-white/10">
                  {subject}: {formatMinutes(stats.minutes)}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {loading ? (
              <div className="rounded-xl bg-white/[0.025] p-5 text-center text-[10px] font-bold text-zinc-600">Loading your study history…</div>
            ) : selectedActivities.length === 0 ? (
              <div className="rounded-xl bg-white/[0.025] p-6 text-center ring-1 ring-white/5">
                <BookOpen size={18} className="mx-auto text-zinc-700" />
                <div className="mt-2 text-xs font-bold text-zinc-500">No lecture completion recorded for this day.</div>
              </div>
            ) : (
              selectedActivities.map((activity, index) => (
                <div key={`${activity.material_id}-${index}`} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-3 ring-1 ring-white/5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"><Check size={14} strokeWidth={3} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold text-zinc-200">{activity.title}</div>
                    <div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-600">{activity.subject_name} • {activity.topic_name}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[9px] font-black text-zinc-500"><Clock3 size={11} /> {formatMinutes(activity.duration_mins)}</div>
                  <Link href={`/resources/${activity.material_id}`} className="rounded-lg bg-indigo-500/10 p-2 text-indigo-300 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20" title="Open lecture">
                    <Play size={11} fill="currentColor" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BIG STUDY CALENDAR */}
      <div className="overflow-hidden rounded-[1.75rem] bg-zinc-950/90 ring-1 ring-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-400"><CalendarDays size={13} /> Study calendar</div>
              <h2 className="mt-1 text-xl font-black text-white">See your study hours every day</h2>
              <p className="mt-1 text-[11px] text-zinc-500">Click any date to open its study breakdown above.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-violet-500/10 px-3 py-2 text-right ring-1 ring-violet-500/20">
                <div className="text-[8px] font-black uppercase tracking-widest text-violet-400/70">Month total</div>
                <div className="text-sm font-black text-violet-300">{formatMinutes(monthTotal)}</div>
              </div>
              <button type="button" onClick={() => moveMonth(-1)} className="rounded-xl bg-white/[0.03] p-2.5 text-zinc-400 ring-1 ring-white/10 hover:text-white"><ChevronLeft size={15} /></button>
              <button type="button" onClick={() => moveMonth(1)} className="rounded-xl bg-white/[0.03] p-2.5 text-zinc-400 ring-1 ring-white/10 hover:text-white"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-white">{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-wider text-zinc-600"><span className="h-2 w-2 rounded-full bg-zinc-800" /> less <span className="h-2 w-2 rounded-full bg-emerald-500/60" /> more</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="px-1 py-2 text-center text-[8px] font-black uppercase tracking-widest text-zinc-600">{day}</div>)}
            {monthCells.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="min-h-[82px] rounded-xl bg-transparent" />;
              const key = keyOf(day);
              const minutes = dailyTracking[key] || 0;
              const ratio = Math.min(1, minutes / maxCalendarMinutes);
              const isSelected = selectedDate === key;
              const isToday = key === todayKey;
              const hasStudy = minutes > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelectedDate(key); setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1)); }}
                  className={`group min-h-[82px] rounded-xl p-2 text-left transition ${isSelected ? 'ring-2 ring-violet-400/70' : 'ring-1 ring-white/5 hover:ring-violet-400/30'} ${hasStudy ? 'bg-emerald-500/[0.05]' : 'bg-white/[0.018]'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black ${isToday ? 'text-emerald-300' : 'text-zinc-500'}`}>{day.getDate()}</span>
                    {hasStudy && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/50">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all" style={{ width: `${Math.max(hasStudy ? 8 : 0, ratio * 100)}%` }} />
                  </div>
                  <div className={`mt-2 text-[9px] font-black ${hasStudy ? 'text-emerald-300' : 'text-zinc-700'}`}>{hasStudy ? formatMinutes(minutes) : '—'}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-white/5 bg-black/10 p-5 sm:grid-cols-3 sm:p-6">
          <div className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-white/5"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Clock3 size={12} className="text-cyan-400" /> Total study</div><div className="mt-2 text-xl font-black text-white">{formatMinutes(monthTotal)}</div></div>
          <div className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-white/5"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Target size={12} className="text-violet-400" /> Study days</div><div className="mt-2 text-xl font-black text-white">{monthCells.filter(Boolean).filter(d => (dailyTracking[keyOf(d as Date)] || 0) > 0).length}</div></div>
          <div className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-white/5"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Trophy size={12} className="text-amber-400" /> Best day</div><div className="mt-2 text-xl font-black text-white">{formatMinutes(Math.max(0, ...monthCells.filter(Boolean).map(d => dailyTracking[keyOf(d as Date)] || 0)))}</div></div>
        </div>
      </div>
    </section>
  );
}
