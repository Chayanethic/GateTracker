'use client';

import Link from 'next/link';
import { BookOpen, CalendarDays, CheckCircle2, Plus, Target, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

type WeeklyTargetPanelProps = {
  goal: any | null;
  curriculum: any[];
  completedIds: Set<string>;
  today: string;
};

type WeeklyTarget = {
  id: string;
  subject: string;
  topic: string;
  materialIds: string[];
  startDate: string;
  endDate: string;
};

type TopicStat = WeeklyTarget & {
  total: number;
  completed: number;
};

const dateOnly = (value: string) => new Date(`${value}T00:00:00Z`);

const formatDate = (value: string) =>
  dateOnly(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getWeekRange = (today: string) => {
  const d = dateOnly(today);
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const toKey = (date: Date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dayOfMonth}`;
  };

  return { start: toKey(monday), end: toKey(sunday) };
};

const getLegacyTargets = (goal: any | null, curriculum: any[], completedIds: Set<string>): WeeklyTarget[] => {
  if (!goal?.routine_data) return [];

  const materialById = new Map(curriculum.map((m: any) => [m.id, m]));
  const grouped = new Map<string, WeeklyTarget>();
  const routine = goal.routine_data || {};

  Object.entries(routine).forEach(([dateStr, blocks]: [string, any]) => {
    if (dateStr.startsWith('__')) return;
    (blocks || []).forEach((block: any) => {
      (block?.tasks || []).forEach((task: any) => {
        const id = task.originalId || task.id;
        if (!id) return;
        const material = materialById.get(id);
        const subject = material?.subject_name || task.subject || 'Other';
        const topic = material?.topic_name || task.topic || 'Other';
        const key = `${subject}|||${topic}`;
        const existing = grouped.get(key);
        if (existing) {
          if (!existing.materialIds.includes(id)) existing.materialIds.push(id);
          return;
        }
        grouped.set(key, {
          id: `legacy-${key}`,
          subject,
          topic,
          materialIds: [id],
          startDate: goal.start_date || dateStr,
          endDate: goal.target_date || dateStr,
        });
      });
    });
  });

  return [...grouped.values()];
};

export default function WeeklyTargetPanel({ goal, curriculum, completedIds, today }: WeeklyTargetPanelProps) {
  const week = getWeekRange(today);
  const [localGoal, setLocalGoal] = useState<any | null>(goal);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const subjects = useMemo(
    () => [...new Set(curriculum.map((m: any) => m.subject_name).filter(Boolean))].sort(),
    [curriculum]
  );

  const topics = useMemo(
    () => [...new Set(
      curriculum
        .filter((m: any) => !selectedSubject || m.subject_name === selectedSubject)
        .map((m: any) => m.topic_name)
        .filter(Boolean)
    )].sort(),
    [curriculum, selectedSubject]
  );

  const materialForSelection = useMemo(
    () => curriculum.filter((m: any) => m.subject_name === selectedSubject && m.topic_name === selectedTopic),
    [curriculum, selectedSubject, selectedTopic]
  );

  const storedTargets: WeeklyTarget[] = useMemo(() => {
    const explicit = Array.isArray(localGoal?.routine_data?.__weekly_targets)
      ? localGoal.routine_data.__weekly_targets
      : [];
    const legacy = explicit.length === 0 ? getLegacyTargets(localGoal, curriculum, completedIds) : [];
    return [...explicit, ...legacy];
  }, [localGoal, curriculum, completedIds]);

  const topicStats: TopicStat[] = useMemo(() => storedTargets.map(target => {
    const ids = [...new Set(target.materialIds || [])];
    return {
      ...target,
      materialIds: ids,
      total: ids.length,
      completed: ids.filter(id => completedIds.has(id)).length,
    };
  }), [storedTargets, completedIds]);

  const subjectStats = useMemo(() => {
    const map = new Map<string, { subject: string; total: number; completed: number }>();
    curriculum.forEach((material: any) => {
      const subject = material.subject_name || 'Other';
      const current = map.get(subject) || { subject, total: 0, completed: 0 };
      current.total += 1;
      if (completedIds.has(material.id)) current.completed += 1;
      map.set(subject, current);
    });
    return [...map.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  }, [curriculum, completedIds]);

  const targetTotal = topicStats.reduce((sum, item) => sum + item.total, 0);
  const targetCompleted = topicStats.reduce((sum, item) => sum + item.completed, 0);
  const targetPercent = targetTotal ? Math.round((targetCompleted / targetTotal) * 100) : 0;

  const addTarget = async () => {
    if (!selectedSubject || !selectedTopic || materialForSelection.length === 0) {
      toast.error('Select a subject and topic first.');
      return;
    }

    if (topicStats.some(t => t.subject === selectedSubject && t.topic === selectedTopic)) {
      toast.error('This topic is already in this week\'s target.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');

      const newTarget: WeeklyTarget = {
        id: `weekly-${Date.now()}`,
        subject: selectedSubject,
        topic: selectedTopic,
        materialIds: materialForSelection.map((m: any) => m.id),
        startDate: week.start,
        endDate: week.end,
      };

      const currentRoutine = localGoal?.routine_data && typeof localGoal.routine_data === 'object'
        ? { ...localGoal.routine_data }
        : {};
      const currentTargets: WeeklyTarget[] = Array.isArray(currentRoutine.__weekly_targets)
        ? currentRoutine.__weekly_targets
        : getLegacyTargets(localGoal, curriculum, completedIds);

      const nextRoutine = {
        ...currentRoutine,
        __weekly_targets: [...currentTargets, newTarget],
      };

      let savedGoal = localGoal;
      if (localGoal?.id) {
        const { data, error } = await supabase
          .from('study_goals')
          .update({ routine_data: nextRoutine })
          .eq('id', localGoal.id)
          .eq('user_id', session.user.id)
          .select('*')
          .single();
        if (error) throw error;
        savedGoal = data;
      } else {
        const { data, error } = await supabase
          .from('study_goals')
          .insert({
            user_id: session.user.id,
            title: `Weekly Targets: ${formatDate(week.start)} – ${formatDate(week.end)}`,
            start_date: week.start,
            target_date: week.end,
            speed_multiplier: 1,
            routine_data: nextRoutine,
          })
          .select('*')
          .single();
        if (error) throw error;
        savedGoal = data;
      }

      setLocalGoal(savedGoal);
      setSelectedSubject('');
      setSelectedTopic('');
      setShowAdd(false);
      toast.success('Weekly target added.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Could not save the weekly target.');
    } finally {
      setSaving(false);
    }
  };

  const removeTarget = async (targetId: string) => {
    if (!localGoal?.id) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const nextTargets = storedTargets.filter(t => t.id !== targetId);
      const nextRoutine = { ...(localGoal.routine_data || {}), __weekly_targets: nextTargets };
      const { data, error } = await supabase
        .from('study_goals')
        .update({ routine_data: nextRoutine })
        .eq('id', localGoal.id)
        .eq('user_id', session.user.id)
        .select('*')
        .single();
      if (error) throw error;
      setLocalGoal(data);
      toast.success('Target removed.');
    } catch (error: any) {
      toast.error(error?.message || 'Could not remove target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-10 space-y-5">
      <div className="rounded-[1.5rem] bg-zinc-900/40 ring-1 ring-zinc-800/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-400 mb-2">
                <Target size={12} /> Weekly Target
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-100">This Week</h2>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-zinc-500">
                <CalendarDays size={12} /> {formatDate(week.start)} – {formatDate(week.end)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-[9px] uppercase tracking-widest font-black text-zinc-600">Completed</div>
                <div className="text-sm font-black text-emerald-400">{targetCompleted}/{targetTotal} · {targetPercent}%</div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(v => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                {showAdd ? <X size={13} /> : <Plus size={13} />}
                {showAdd ? 'Close' : 'Add Target'}
              </button>
            </div>
          </div>

          <div className="mt-4 h-2 rounded-full bg-black/60 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${targetPercent}%` }} />
          </div>
        </div>

        {showAdd && (
          <div className="p-5 sm:p-6 bg-black/20 border-b border-zinc-800/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-zinc-100">Add a target for this week</h3>
                <p className="text-[10px] text-zinc-500 mt-1">Choose a subject and a complete topic.</p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{formatDate(week.start)} – {formatDate(week.end)}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
              <select
                value={selectedSubject}
                onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                className="w-full rounded-xl bg-zinc-950 ring-1 ring-zinc-800 px-3 py-3 text-xs text-zinc-200 outline-none focus:ring-indigo-500/50"
              >
                <option value="">Select subject</option>
                {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>

              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                disabled={!selectedSubject}
                className="w-full rounded-xl bg-zinc-950 ring-1 ring-zinc-800 px-3 py-3 text-xs text-zinc-200 outline-none focus:ring-indigo-500/50 disabled:opacity-40"
              >
                <option value="">Select topic</option>
                {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>

              <button
                type="button"
                onClick={addTarget}
                disabled={saving || !selectedTopic}
                className="rounded-xl bg-indigo-500 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-400 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>

            {selectedTopic && (
              <p className="mt-3 text-[10px] text-zinc-600">This topic contains {materialForSelection.length} curriculum lecture{materialForSelection.length === 1 ? '' : 's'}.</p>
            )}
          </div>
        )}

        <div className="p-5 sm:p-6">
          {topicStats.length === 0 ? (
            <div className="rounded-xl bg-black/20 ring-1 ring-zinc-800/70 p-6 text-center">
              <p className="text-sm font-bold text-zinc-300">No weekly targets yet.</p>
              <p className="text-[10px] text-zinc-600 mt-1">Click <span className="text-zinc-400">Add Target</span> and choose a subject + topic.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topicStats.map(item => {
                const percent = item.total ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <div key={item.id} className="rounded-2xl bg-black/25 ring-1 ring-zinc-800/80 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{item.subject}</div>
                        <div className="text-sm font-bold text-zinc-100 mt-1 truncate">{item.topic}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`text-[10px] font-black ${percent === 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {item.completed}/{item.total} · {percent}%
                        </div>
                        {localGoal?.id && (
                          <button type="button" onClick={() => removeTarget(item.id)} disabled={saving} className="text-zinc-700 hover:text-rose-400 transition-colors" title="Remove target">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-zinc-900 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-zinc-600">
                      <span>{percent === 100 ? 'Target completed' : `${item.total - item.completed} lectures remaining`}</span>
                      <Link href="/resources" className="text-indigo-400 hover:text-indigo-300">Open Curriculum</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest">Curriculum Progress</h3>
            <p className="text-[10px] text-zinc-600 mt-1">Overall progress from your curriculum.</p>
          </div>
          <Link href="/resources" className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400">Open Curriculum</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {subjectStats.map(item => {
            const percent = item.total ? Math.round((item.completed / item.total) * 100) : 0;
            return (
              <Link key={item.subject} href="/resources" className="group rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800/80 hover:ring-zinc-700 p-4 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-zinc-200 truncate group-hover:text-white">{item.subject}</span>
                  <span className="text-xs font-black text-zinc-400">{percent}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/70 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-widest font-bold text-zinc-600">
                  <span>Lectures</span>
                  <span>{item.completed}/{item.total}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
