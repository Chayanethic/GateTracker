'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock3, Filter, Play, Target, Timer, Trophy } from 'lucide-react';
import Link from 'next/link';

type Material = { id: string; title?: string; subject_name?: string; topic_name?: string; duration?: string | number; lecture_no?: number };
type Progress = { material_id: string; completed?: boolean };
type Tracking = { subject_name: string; topic_name: string; enabled: boolean; started_at: string | null; completed_at: string | null };
type Activity = { material_id: string; date_str: string; topic_name?: string; subject_name?: string; duration_mins?: number };

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
};

const mins = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const p = String(v).split(':').map(Number);
  if (p.some(Number.isNaN)) return 0;
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] + p[1] / 60;
  return Number(p[0]) || 0;
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

export default function TopicTrackerPage() {
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'longest' | 'shortest' | 'recent'>('longest');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const [{ data: tracking }, { data: materials }, { data: progress }, { data: activity }] = await Promise.all([
      supabase.from('topic_tracking').select('*').eq('user_id', session.user.id).eq('enabled', true),
      supabase.from('study_materials').select('id,title,subject_name,topic_name,duration,lecture_no').eq('stream', (await supabase.from('user_profiles').select('branch').eq('user_id', session.user.id).maybeSingle()).data?.branch || ''),
      supabase.from('user_progress').select('material_id,completed').eq('user_id', session.user.id).eq('completed', true),
      supabase.from('daily_lecture_activity').select('material_id,date_str,topic_name,subject_name,duration_mins').eq('user_id', session.user.id),
    ]);

    const allMaterials = (materials || []) as Material[];
    const completed = (progress || []) as Progress[];
    const done = new Set(completed.map(p => String(p.material_id)));
    const activities = (activity || []) as Activity[];
    const next: TopicRow[] = [];

    for (const tr of ((tracking || []) as Tracking[])) {
      const topicMats = allMaterials.filter(m => m.subject_name === tr.subject_name && m.topic_name === tr.topic_name);
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

      next.push({
        ...tr,
        completed_at: completedAt,
        materials: topicMats,
        completedIds,
        completedCount: completedMats.length,
        totalCount: topicMats.length,
        totalLectureMins: topicMats.reduce((s, m) => s + mins(m.duration), 0),
        completedLectureMins: completedMats.reduce((s, m) => s + mins(m.duration), 0),
        elapsedMins: elapsed(tr.started_at, completedAt),
        studyDates: dates,
        lastStudyDate: dates[dates.length - 1] || null,
      });
    }

    setRows(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows
    .filter(r => filter === 'all' || (filter === 'active' ? !r.completed_at : !!r.completed_at))
    .sort((a, b) => sort === 'shortest' ? a.elapsedMins - b.elapsedMins : sort === 'recent' ? new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime() : b.elapsedMins - a.elapsedMins), [rows, sort, filter]);

  const stats = useMemo(() => ({ active: rows.filter(r => !r.completed_at).length, completed: rows.filter(r => !!r.completed_at).length }), [rows]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/resources" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-emerald-400 mb-3"><ArrowLeft size={13}/> Curriculum</Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3"><Target className="text-amber-400"/> Topic Time Mirror</h1>
            <p className="text-xs text-zinc-500 mt-2 max-w-2xl">Start a topic once, then let Curriculum completion build the record automatically. See exactly when you started, which days you studied it, and how long the topic took.</p>
          </div>
          <div className="flex gap-2 text-[9px] font-black uppercase tracking-wider">
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400">{stats.active} Active</div>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400">{stats.completed} Finished</div>
          </div>
        </div>

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
          <div className="space-y-4">
            {visible.map(r => {
              const percent = r.totalCount ? Math.round((r.completedCount / r.totalCount) * 100) : 0;
              return <article key={`${r.subject_name}::${r.topic_name}`} className={`rounded-3xl bg-zinc-900/40 ring-1 ${r.completed_at ? 'ring-emerald-500/25' : 'ring-amber-500/20'} overflow-hidden`}>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">{r.subject_name}</div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-100">{r.topic_name}</h2>
                      <div className="flex flex-wrap gap-2 mt-3 text-[9px] font-bold text-zinc-500">
                        <span className="px-2.5 py-1.5 rounded-lg bg-black/30 ring-1 ring-white/5 flex items-center gap-1.5"><CalendarDays size={11}/> Started {dateLabel(r.started_at?.slice(0,10) || null)}</span>
                        {r.completed_at ? <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={11}/> Finished {dateLabel(r.completed_at.slice(0,10))}</span> : <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400 flex items-center gap-1.5"><Timer size={11}/> Still running</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[470px]">
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Time taken</div><div className="text-lg font-black text-amber-400 mt-1">{fmt(r.elapsedMins)}</div></div>
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Lectures</div><div className="text-lg font-black text-zinc-200 mt-1">{r.completedCount}/{r.totalCount}</div></div>
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Lecture time</div><div className="text-lg font-black text-indigo-300 mt-1">{fmt(r.completedLectureMins)}</div></div>
                      <div className="p-3 rounded-xl bg-black/30 ring-1 ring-white/5"><div className="text-[8px] uppercase font-black text-zinc-600">Study days</div><div className="text-lg font-black text-emerald-400 mt-1">{r.studyDates.length}</div></div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider mb-2"><span className="text-zinc-500">Curriculum completion</span><span className={r.completed_at ? 'text-emerald-400' : 'text-zinc-400'}>{percent}%</span></div>
                    <div className="h-2 rounded-full bg-black/50 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }}/></div>
                  </div>

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
