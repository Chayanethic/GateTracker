'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, CalendarDays, CheckCircle2, Filter, Play, Target, Timer, Trophy, Zap, Clock3 } from 'lucide-react';
import Link from 'next/link';

type Material = { id: string; title?: string; subject_name?: string; topic_name?: string; duration?: string | number; lecture_no?: number };
type Progress = { material_id: string; completed?: boolean };
type Tracking = { subject_name: string; topic_name: string; enabled: boolean; started_at: string | null; completed_at: string | null; best_elapsed_minutes?: number | null; best_lecture_minutes?: number | null; best_pace_hours_per_day?: number | null; record_at?: string | null };
type Activity = { material_id: string; date_str: string; topic_name?: string; subject_name?: string; duration_mins?: number };

type DayPlan = { day: number; minutes: number; lectures: Material[] };
type TopicRow = Tracking & {
  materials: Material[];
  completedIds: Set<string>;
  completedCount: number;
  totalCount: number;
  totalLectureMins: number;
  completedLectureMins: number;
  elapsedMins: number;
  studyDates: string[];
  lastStudyDate: string | null;
  remainingLectureMins: number;
  bestElapsedMins: number | null;
  bestLectureMins: number | null;
  bestPaceHoursPerDay: number | null;
  projectedRemainingDays: number | null;
  dayPlan: DayPlan[];
  isRecord: boolean;
};

const mins = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const raw = String(v).trim();
  const p = raw.split(':').map(Number);
  if (p.length === 3 && p.every(Number.isFinite)) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2 && p.every(Number.isFinite)) return p[0] + p[1] / 60;
  const hm = raw.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?/i);
  if (hm && (hm[1] || hm[2])) return Number(hm[1] || 0) * 60 + Number(hm[2] || 0);
  return Number(raw) || 0;
};

const fmt = (m: number) => {
  const total = Math.max(0, Math.round(m));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  if (d) return `${d}d ${h}h ${mm}m`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
};

const fmtRecordDays = (m: number) => {
  const total = Math.max(0, Math.round(m));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes && parts.length < 2) parts.push(`${minutes} min`);
  return parts.length ? parts.join(' ') : '0 min';
};

const fmtHours = (m: number) => {
  const h = m / 60;
  if (h >= 10) return `${h.toFixed(0)}h`;
  return `${h.toFixed(1)}h`;
};

const dateLabel = (s: string | null) => {
  if (!s) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${s}T12:00:00+05:30`));
};

const elapsed = (start: string | null, end: string | null) => {
  if (!start) return 0;
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, (b - a) / 60000);
};

const buildDayPlan = (remaining: Material[], remainingMins: number, paceHoursPerDay: number | null): DayPlan[] => {
  if (!remaining.length || remainingMins <= 0 || !paceHoursPerDay || paceHoursPerDay <= 0) return [];
  const days = Math.max(1, Math.ceil((remainingMins / 60) / paceHoursPerDay));
  const targetPerDay = remainingMins / days;
  const plan: DayPlan[] = [];
  let index = 0;

  for (let day = 1; day <= days && index < remaining.length; day++) {
    const lectures: Material[] = [];
    let total = 0;
    const daysLeft = days - day + 1;
    const target = index === 0 ? targetPerDay : Math.max(remainingMins / daysLeft, targetPerDay * 0.8);

    while (index < remaining.length) {
      const lecture = remaining[index];
      const lectureMins = mins(lecture.duration);
      if (lectures.length && total + lectureMins > target && days - day + 1 > 1) break;
      lectures.push(lecture);
      total += lectureMins;
      index++;
      if (total >= target && days - day + 1 > 1) break;
    }
    if (lectures.length) plan.push({ day, minutes: total, lectures });
  }

  // Safety: if rounding/long lectures left anything, put them on the last day.
  if (index < remaining.length) {
    const extra = remaining.slice(index);
    const extraMins = extra.reduce((s, m) => s + mins(m.duration), 0);
    const last = plan[plan.length - 1];
    if (last) {
      last.lectures.push(...extra);
      last.minutes += extraMins;
    } else {
      plan.push({ day: 1, minutes: extraMins, lectures: extra });
    }
  }
  return plan;
};

export default function TopicTrackerPage() {
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'longest' | 'shortest' | 'recent'>('longest');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [, setNow] = useState(Date.now());

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: profile } = await supabase.from('user_profiles').select('branch').eq('user_id', session.user.id).maybeSingle();
    const [{ data: tracking }, { data: materials }, { data: progress }, { data: activity }] = await Promise.all([
      supabase.from('topic_tracking').select('*').eq('user_id', session.user.id).eq('enabled', true),
      supabase.from('study_materials').select('id,title,subject_name,topic_name,duration,lecture_no').eq('stream', profile?.branch || ''),
      supabase.from('user_progress').select('material_id,completed').eq('user_id', session.user.id).eq('completed', true),
      supabase.from('daily_lecture_activity').select('material_id,date_str,topic_name,subject_name,duration_mins').eq('user_id', session.user.id),
    ]);

    const allMaterials = (materials || []) as Material[];
    const completed = (progress || []) as Progress[];
    const done = new Set(completed.map(p => String(p.material_id)));
    const activities = (activity || []) as Activity[];
    const next: TopicRow[] = [];

    for (const tr of ((tracking || []) as Tracking[])) {
      const topicMats = allMaterials
        .filter(m => m.subject_name === tr.subject_name && m.topic_name === tr.topic_name)
        .sort((a, b) => (a.lecture_no ?? 999999) - (b.lecture_no ?? 999999));
      const completedMats = topicMats.filter(m => done.has(String(m.id)));
      const completedIds = new Set(completedMats.map(m => String(m.id)));
      const dates = Array.from(new Set(
        activities
          .filter(a => a.subject_name === tr.subject_name && a.topic_name === tr.topic_name && completedIds.has(String(a.material_id)))
          .map(a => a.date_str)
      )).sort();
      const finished = topicMats.length > 0 && completedMats.length === topicMats.length;
      const completedAt = finished ? (tr.completed_at || `${dates[dates.length - 1] || new Date().toISOString().slice(0, 10)}T23:59:59.000Z`) : null;

      if (finished && tr.completed_at !== completedAt) {
        await supabase.from('topic_tracking').update({ completed_at: completedAt }).eq('user_id', session.user.id).eq('subject_name', tr.subject_name).eq('topic_name', tr.topic_name);
      }

      const totalLectureMins = topicMats.reduce((s, m) => s + mins(m.duration), 0);
      const completedLectureMins = completedMats.reduce((s, m) => s + mins(m.duration), 0);
      const remainingLectureMins = Math.max(0, totalLectureMins - completedLectureMins);
      const elapsedMins = elapsed(tr.started_at, completedAt);
      const bestElapsedMins = tr.best_elapsed_minutes == null ? null : Number(tr.best_elapsed_minutes);
      const bestLectureMins = tr.best_lecture_minutes == null ? null : Number(tr.best_lecture_minutes);
      const bestPaceHoursPerDay = bestElapsedMins && bestElapsedMins > 0
        ? (bestLectureMins || totalLectureMins) / 60 / (bestElapsedMins / 1440)
        : (tr.best_pace_hours_per_day == null ? null : Number(tr.best_pace_hours_per_day));
      const projectedRemainingDays = bestPaceHoursPerDay && remainingLectureMins > 0
        ? (remainingLectureMins / 60) / bestPaceHoursPerDay
        : null;
      const remainingMats = topicMats.filter(m => !completedIds.has(String(m.id)));
      const dayPlan = buildDayPlan(remainingMats, remainingLectureMins, bestPaceHoursPerDay);
      const isRecord = !!completedAt && !!bestElapsedMins && elapsedMins <= bestElapsedMins + 0.5;

      next.push({
        ...tr,
        completed_at: completedAt,
        materials: topicMats,
        completedIds,
        completedCount: completedMats.length,
        totalCount: topicMats.length,
        totalLectureMins,
        completedLectureMins,
        elapsedMins,
        studyDates: dates,
        lastStudyDate: dates[dates.length - 1] || null,
        remainingLectureMins,
        bestElapsedMins,
        bestLectureMins,
        bestPaceHoursPerDay,
        projectedRemainingDays,
        dayPlan,
        isRecord,
      });
    }

    setRows(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(() => rows
    .filter(r => filter === 'all' || (filter === 'active' ? !r.completed_at : !!r.completed_at))
    .sort((a, b) => sort === 'shortest' ? a.elapsedMins - b.elapsedMins : sort === 'recent' ? new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime() : b.elapsedMins - a.elapsedMins), [rows, sort, filter]);

  const records = useMemo(() => rows
    .filter(r => r.bestElapsedMins != null)
    .sort((a, b) => (a.bestElapsedMins || Infinity) - (b.bestElapsedMins || Infinity)), [rows]);

  const stats = useMemo(() => ({ active: rows.filter(r => !r.completed_at).length, completed: rows.filter(r => !!r.completed_at).length }), [rows]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/resources" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-400 mb-3"><ArrowLeft size={13}/> Curriculum</Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3"><Target className="text-amber-400"/> Topic Time Mirror</h1>
            <p className="text-xs text-zinc-500 mt-2 max-w-3xl">Don't compete with the clock. Compete with your own fastest chapter record. See the lecture hours left, your best pace, and exactly what to finish each day.</p>
          </div>
          <div className="flex gap-2 text-[9px] font-black uppercase tracking-wider">
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400">{stats.active} Active</div>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400">{stats.completed} Finished</div>
          </div>
        </div>

        {records.length > 0 && (
          <section className="mb-6 rounded-3xl bg-gradient-to-br from-yellow-500/10 via-zinc-900/60 to-rose-500/10 ring-1 ring-yellow-400/20 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-yellow-300"><Trophy size={14}/> Your best chapter records</div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
              {records.slice(0, 6).map(r => {
                const recordMins = r.bestElapsedMins || 0;
                const lectureMins = r.bestLectureMins || r.totalLectureMins || 0;
                const dailyHours = r.bestPaceHoursPerDay || (recordMins > 0 ? (lectureMins / 60) / (recordMins / 1440) : 0);
                return (
                  <div key={`${r.subject_name}::${r.topic_name}`} className="rounded-2xl bg-black/30 ring-1 ring-white/10 p-4">
                    <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">{r.subject_name}</div>
                    <div className="mt-1 font-black text-zinc-100 truncate">{r.topic_name}</div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-yellow-500/10 ring-1 ring-yellow-400/15 p-2.5">
                        <div className="text-[7px] font-black uppercase tracking-wider text-yellow-300/70">Record</div>
                        <div className="mt-1 text-[11px] font-black text-yellow-300">{fmtRecordDays(recordMins)}</div>
                      </div>
                      <div className="rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/15 p-2.5">
                        <div className="text-[7px] font-black uppercase tracking-wider text-cyan-300/70">Lectures</div>
                        <div className="mt-1 text-[11px] font-black text-cyan-300">{fmtHours(lectureMins)}</div>
                      </div>
                      <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/15 p-2.5">
                        <div className="text-[7px] font-black uppercase tracking-wider text-emerald-300/70">Daily pace</div>
                        <div className="mt-1 text-[11px] font-black text-emerald-300">{dailyHours ? `${dailyHours.toFixed(1)}h` : '—'}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-zinc-500">
                      🏆 Fastest completion: <b className="text-zinc-300">{fmtRecordDays(recordMins)}</b> · <b className="text-yellow-300">{dailyHours ? `${dailyHours.toFixed(1)} lecture h/day` : '—'}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="rounded-2xl bg-zinc-900/50 ring-1 ring-white/10 p-4 mb-5 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500"><Filter size={13}/> Sort mirror</div>
          <div className="flex flex-wrap gap-2">
            {(['longest','shortest','recent'] as const).map(v => <button key={v} onClick={() => setSort(v)} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider ${sort === v ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-black/30 text-zinc-500 ring-1 ring-white/5'}`}>{v === 'longest' ? 'Longest time' : v === 'shortest' ? 'Shortest time' : 'Recently started'}</button>)}
            <span className="w-px bg-white/10 mx-1" />
            {(['all','active','completed'] as const).map(v => <button key={v} onClick={() => setFilter(v)} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider ${filter === v ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30' : 'bg-black/30 text-zinc-500 ring-1 ring-white/5'}`}>{v}</button>)}
          </div>
        </div>

        {loading ? <div className="py-20 text-center text-xs font-black uppercase tracking-widest text-zinc-600 animate-pulse">Building your mirror...</div> : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 py-20 text-center">
            <Target className="mx-auto text-zinc-700 mb-3" size={30}/>
            <p className="text-sm font-black text-zinc-400">No tracked topics yet</p>
            <p className="text-xs text-zinc-600 mt-2">Open Curriculum → choose a topic → press Track Topic.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {visible.map(r => {
              const percent = r.totalCount ? Math.round((r.completedCount / r.totalCount) * 100) : 0;
              const targetDays = r.dayPlan.length || (r.projectedRemainingDays ? Math.max(1, Math.ceil(r.projectedRemainingDays)) : null);
              const dailyHours = targetDays ? (r.remainingLectureMins / 60) / targetDays : null;
              return <article key={`${r.subject_name}::${r.topic_name}`} className={`rounded-3xl bg-zinc-900/40 ring-1 ${r.completed_at ? (r.isRecord ? 'ring-yellow-400/30' : 'ring-emerald-500/25') : 'ring-amber-500/20'} overflow-hidden`}>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">{r.subject_name}</div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-100">{r.topic_name}</h2>
                      <div className="flex flex-wrap gap-2 mt-3 text-[9px] font-bold text-zinc-500">
                        <span className="px-2.5 py-1.5 rounded-lg bg-black/30 ring-1 ring-white/5 flex items-center gap-1.5"><CalendarDays size={11}/> Started {dateLabel(r.started_at?.slice(0,10) || null)}</span>
                        {r.completed_at ? <span className={`px-2.5 py-1.5 rounded-lg ${r.isRecord ? 'bg-yellow-500/10 ring-1 ring-yellow-400/25 text-yellow-300' : 'bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400'} flex items-center gap-1.5`}><CheckCircle2 size={11}/> {r.isRecord ? 'NEW RECORD' : 'Finished'} {dateLabel(r.completed_at.slice(0,10))}</span> : <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400 flex items-center gap-1.5"><Timer size={11}/> In progress</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:min-w-[360px]">
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Lectures</div><div className="text-lg font-black text-zinc-200 mt-1">{r.completedCount}/{r.totalCount}</div></div>
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Remaining lecture</div><div className="text-lg font-black text-rose-300 mt-1">{fmtHours(r.remainingLectureMins)}</div></div>
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Completion</div><div className="text-lg font-black text-emerald-400 mt-1">{percent}%</div></div>
                    </div>
                  </div>

                  <div className="mt-6 h-2 rounded-full bg-black/50 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }}/></div>

                  {r.completed_at ? (
                    <div className={`mt-6 rounded-2xl p-5 ring-1 ${r.isRecord ? 'bg-yellow-500/10 ring-yellow-400/30' : 'bg-zinc-950/60 ring-white/10'}`}>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500"><Trophy size={13} className={r.isRecord ? 'text-yellow-300' : 'text-amber-400'}/>{r.isRecord ? 'New personal record established' : 'Personal record'}</div>
                      <p className="mt-2 text-base sm:text-lg font-black text-zinc-100">{r.isRecord ? `🔥 You completed ${fmtHours(r.bestLectureMins || r.totalLectureMins)} of ${r.topic_name} in ${fmt(r.bestElapsedMins || r.elapsedMins)}.` : `Your fastest ${r.topic_name} record is ${fmt(r.bestElapsedMins || r.elapsedMins)} for ${fmtHours(r.bestLectureMins || r.totalLectureMins)} of lectures.`}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Best pace: <b className="text-yellow-300">{r.bestPaceHoursPerDay ? `${r.bestPaceHoursPerDay.toFixed(1)} lecture h/day` : '—'}</b>. Beat this exact time on your next run to set a new record.</p>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl bg-rose-500/10 ring-1 ring-rose-400/25 p-5">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-rose-300"><Zap size={13}/> Your fastest pace is the target</div>
                      {r.bestElapsedMins && r.bestPaceHoursPerDay ? (
                        <>
                          <p className="mt-2 text-base sm:text-lg font-black text-zinc-100">{r.remainingLectureMins > 0 ? `You have ${fmtHours(r.remainingLectureMins)} of lecture left. Your previous fastest record is ${fmtRecordDays(r.bestElapsedMins)} for ${fmtHours(r.bestLectureMins || r.totalLectureMins)} of lectures.` : `You are at the finish line for ${r.topic_name}.`}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">Your best pace is <b className="text-yellow-300">{r.bestPaceHoursPerDay.toFixed(1)} lecture h/day</b>. At that pace, you can finish the remaining lectures in about <b className="text-cyan-300">{targetDays} day{targetDays === 1 ? '' : 's'}</b> — roughly <b className="text-emerald-300">{dailyHours?.toFixed(1)}h/day</b>. Don't match the slow version of you — chase the fastest version.</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm font-black text-zinc-200">Finish this chapter once to create your first shortest-time record. Then every future run has a real target to beat.</p>
                      )}

                      {r.bestElapsedMins && r.bestPaceHoursPerDay && r.remainingLectureMins > 0 && r.dayPlan.length > 0 && (
                        <div className="mt-5">
                          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                            <div>
                              <div className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Beat your record plan</div>
                              <div className="text-xs text-zinc-400 mt-1">{fmtHours(r.remainingLectureMins)} remaining → about {targetDays} days at your best pace.</div>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-400/20 text-cyan-300 text-[9px] font-black">≈ {dailyHours?.toFixed(1)}h/day</div>
                          </div>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {r.dayPlan.map(day => (
                              <div key={day.day} className="rounded-xl bg-black/30 ring-1 ring-white/5 p-3">
                                <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Day {day.day}</span><span className="text-[9px] font-black text-cyan-300">{fmtHours(day.minutes)}</span></div>
                                <div className="mt-2 space-y-1.5">
                                  {day.lectures.map((m, i) => <div key={m.id} className="text-[9px] text-zinc-400 truncate"><span className="text-zinc-600">{m.lecture_no ?? i + 1}.</span> {m.title || 'Lecture'} <span className="text-zinc-700">({fmt(mins(m.duration))})</span></div>)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 grid lg:grid-cols-[1fr_auto] gap-5 items-end">
                    <div>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2"><CalendarDays size={12}/> Studied on</div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.studyDates.length ? r.studyDates.map(d => <span key={d} className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/10 text-[9px] font-bold">{dateLabel(d)}</span>) : <span className="text-[9px] text-zinc-700">No completed lecture has been logged yet.</span>}
                      </div>
                    </div>
                    <Link href="/resources" className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest"><Play size={12} fill="currentColor"/> Continue in Curriculum</Link>
                  </div>
                </div>
              </article>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
