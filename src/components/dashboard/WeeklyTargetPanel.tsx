'use client';

import Link from 'next/link';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Flame,
  Play,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { syncDailyLectureCompletion } from '../../lib/dataService';
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

type TopicGroup = {
  subject: string;
  topic: string;
  materials: any[];
  completed: number;
};

type SubjectGroup = {
  subject: string;
  topics: TopicGroup[];
  completed: number;
  total: number;
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

  const key = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  return { start: key(monday), end: key(sunday) };
};

const getLegacyTargets = (goal: any | null, curriculum: any[]): WeeklyTarget[] => {
  if (!goal?.routine_data) return [];

  const materialById = new Map(curriculum.map((m: any) => [m.id, m]));
  const grouped = new Map<string, WeeklyTarget>();

  Object.entries(goal.routine_data).forEach(([dateStr, blocks]: [string, any]) => {
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

const colorFor = (index: number) => {
  const colors = [
    { dot: 'bg-cyan-400', bar: 'from-cyan-400 to-blue-500', soft: 'bg-cyan-500/10 ring-cyan-500/20', text: 'text-cyan-300' },
    { dot: 'bg-violet-400', bar: 'from-violet-400 to-fuchsia-500', soft: 'bg-violet-500/10 ring-violet-500/20', text: 'text-violet-300' },
    { dot: 'bg-amber-400', bar: 'from-amber-400 to-orange-500', soft: 'bg-amber-500/10 ring-amber-500/20', text: 'text-amber-300' },
    { dot: 'bg-emerald-400', bar: 'from-emerald-400 to-teal-500', soft: 'bg-emerald-500/10 ring-emerald-500/20', text: 'text-emerald-300' },
    { dot: 'bg-pink-400', bar: 'from-pink-400 to-rose-500', soft: 'bg-pink-500/10 ring-pink-500/20', text: 'text-pink-300' },
  ];
  return colors[index % colors.length];
};

export default function WeeklyTargetPanel({ goal, curriculum, completedIds, today }: WeeklyTargetPanelProps) {
  const week = getWeekRange(today);
  const [localGoal, setLocalGoal] = useState<any | null>(goal);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set(completedIds));
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
    const hasExplicitTargets = Array.isArray(localGoal?.routine_data?.__weekly_targets);
    const explicit = hasExplicitTargets ? localGoal.routine_data.__weekly_targets : [];
    const all = hasExplicitTargets ? explicit : getLegacyTargets(localGoal, curriculum);
    return all.filter((target: WeeklyTarget) => {
      const start = target.startDate || week.start;
      const end = target.endDate || week.end;
      return start <= week.end && end >= week.start;
    });
  }, [localGoal, curriculum, week.start, week.end]);

  const subjectGroups: SubjectGroup[] = useMemo(() => {
    const subjectsMap = new Map<string, Map<string, TopicGroup>>();

    storedTargets.forEach(target => {
      const materialMap = new Map(curriculum.map((m: any) => [m.id, m]));
      const materials = [...new Set(target.materialIds || [])]
        .map(id => materialMap.get(id))
        .filter(Boolean);

      const key = `${target.subject}|||${target.topic}`;
      if (!subjectsMap.has(target.subject)) subjectsMap.set(target.subject, new Map());
      const topicMap = subjectsMap.get(target.subject)!;
      const current = topicMap.get(key);

      if (current) {
        const ids = new Set(current.materials.map(m => m.id));
        current.materials = [...current.materials, ...materials.filter(m => !ids.has(m.id))];
        current.completed = current.materials.filter(m => localCompleted.has(m.id)).length;
      } else {
        topicMap.set(key, {
          subject: target.subject,
          topic: target.topic,
          materials,
          completed: materials.filter(m => localCompleted.has(m.id)).length,
        });
      }
    });

    return [...subjectsMap.entries()].map(([subject, topicMap]) => {
      const topics = [...topicMap.values()];
      const total = topics.reduce((sum, topic) => sum + topic.materials.length, 0);
      const completed = topics.reduce((sum, topic) => sum + topic.completed, 0);
      return { subject, topics, completed, total };
    });
  }, [storedTargets, curriculum, localCompleted]);

  const targetTotal = subjectGroups.reduce((sum, subject) => sum + subject.total, 0);
  const targetCompleted = subjectGroups.reduce((sum, subject) => sum + subject.completed, 0);
  const targetPercent = targetTotal ? Math.round((targetCompleted / targetTotal) * 100) : 0;
  const allDone = targetTotal > 0 && targetCompleted === targetTotal;

  const toggleSubject = (subject: string) => {
    setExpandedSubjects(prev => prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]);
  };

  const toggleTopic = (key: string) => {
    setExpandedTopics(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const addTarget = async () => {
    if (!selectedSubject || !selectedTopic || materialForSelection.length === 0) {
      toast.error('Select a subject and topic first.');
      return;
    }
    if (subjectGroups.some(s => s.topics.some(t => t.subject === selectedSubject && t.topic === selectedTopic))) {
      toast.error('This topic is already in this week’s target.');
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
        : getLegacyTargets(localGoal, curriculum);
      const nextRoutine = { ...currentRoutine, __weekly_targets: [...currentTargets, newTarget] };

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
      toast.success('Target added to this week.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Could not save the weekly target.');
    } finally {
      setSaving(false);
    }
  };

  const removeTarget = async (subject: string, topic: string) => {
    if (!localGoal?.id) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');
      const allTargets: WeeklyTarget[] = Array.isArray(localGoal.routine_data?.__weekly_targets)
        ? localGoal.routine_data.__weekly_targets
        : [];
      const nextTargets = allTargets.filter(t => !(t.subject === subject && t.topic === topic));
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

  const toggleLecture = async (material: any) => {
    const id = material.id;
    if (!id || togglingId) return;
    setTogglingId(id);

    const wasDone = localCompleted.has(id);
    const next = new Set(localCompleted);
    if (wasDone) next.delete(id); else next.add(id);
    setLocalCompleted(next);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again.');

      if (wasDone) {
        const { error } = await supabase.from('user_progress').delete().match({
          user_id: session.user.id,
          material_id: id,
        });
        if (error) throw error;
        await syncDailyLectureCompletion(session.user.id, material, false);
      } else {
        const { error } = await supabase.from('user_progress').upsert({
          user_id: session.user.id,
          material_id: id,
          completed: true,
        });
        if (error) throw error;
        await syncDailyLectureCompletion(session.user.id, material, true);
      }
    } catch (error: any) {
      setLocalCompleted(localCompleted);
      toast.error(error?.message || 'Could not update progress.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section className="mb-6">
      <div className="relative overflow-hidden rounded-[1.5rem] bg-zinc-950/90 ring-1 ring-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative border-b border-white/5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-cyan-400">
                <Target size={13} /> Weekly Target
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">Your targets</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold text-zinc-400 ring-1 ring-white/10">
                  {formatDate(week.start)} – {formatDate(week.end)}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] text-zinc-600">Pick a topic. Finish the lectures. Watch the bar move.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className={`rounded-xl px-3 py-2 text-right ring-1 ${allDone ? 'bg-emerald-500/10 ring-emerald-400/30' : 'bg-white/[0.03] ring-white/10'}`}>
                <div className="flex items-center justify-end gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  {allDone && <Sparkles size={11} className="text-emerald-400" />} This week
                </div>
                <div className={`text-lg font-black ${allDone ? 'text-emerald-300' : 'text-white'}`}>{targetCompleted}<span className="text-zinc-600">/{targetTotal}</span></div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(v => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-2.5 text-[8px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:brightness-110"
              >
                {showAdd ? <X size={14} /> : <Plus size={14} />}
                {showAdd ? 'Close' : 'Add target'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/70 ring-1 ring-white/5">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${allDone ? 'from-emerald-400 to-cyan-400' : 'from-cyan-400 via-blue-500 to-violet-500'}`}
                style={{ width: `${targetPercent}%` }}
              />
            </div>
            <span className={`min-w-10 text-right text-xs font-black ${allDone ? 'text-emerald-300' : 'text-cyan-300'}`}>{targetPercent}%</span>
          </div>

          {allDone && (
            <div className="mt-2 flex items-center gap-2 text-[9px] font-bold text-emerald-300">
              <Flame size={13} /> Weekly target cleared. Add another topic or keep the momentum going.
            </div>
          )}
        </div>

        {showAdd && (
          <div className="relative border-b border-white/5 bg-white/[0.025] p-4">
            <div className="mb-3">
              <h3 className="text-xs font-black text-white">Add a subject + topic</h3>
              <p className="mt-0.5 text-[9px] text-zinc-600">The complete topic is added to this week automatically.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select
                value={selectedSubject}
                onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}
                className="w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-cyan-400/50"
              >
                <option value="">Choose subject</option>
                {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                disabled={!selectedSubject}
                className="w-full rounded-lg bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-zinc-200 outline-none ring-1 ring-white/10 focus:ring-violet-400/50 disabled:opacity-40"
              >
                <option value="">Choose topic</option>
                {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>
              <button
                type="button"
                onClick={addTarget}
                disabled={saving || !selectedTopic}
                className="rounded-lg bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
            {selectedTopic && <p className="mt-3 text-[10px] text-zinc-600">{materialForSelection.length} lecture{materialForSelection.length === 1 ? '' : 's'} will appear below.</p>}
          </div>
        )}

        <div className="relative p-3">
          {subjectGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <Target size={25} className="mx-auto text-zinc-700" />
              <p className="mt-3 text-sm font-black text-zinc-300">No targets yet</p>
              <p className="mt-1 text-[10px] text-zinc-600">Add your first subject and topic above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subjectGroups.map((subjectGroup, subjectIndex) => {
                const subjectOpen = expandedSubjects.includes(subjectGroup.subject);
                const subjectPercent = subjectGroup.total ? Math.round((subjectGroup.completed / subjectGroup.total) * 100) : 0;
                const color = colorFor(subjectIndex);

                return (
                  <div key={subjectGroup.subject} className="overflow-hidden rounded-xl bg-zinc-900/70 ring-1 ring-white/10 transition hover:ring-white/15">
                    <button
                      type="button"
                      onClick={() => toggleSubject(subjectGroup.subject)}
                      className="flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition hover:bg-white/[0.025]"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${color.soft} ring-1`}>
                        {subjectPercent === 100 ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Target size={16} className={color.text} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-black text-white">{subjectGroup.subject}</span>
                          <span className="rounded-full bg-black/30 px-2 py-0.5 text-[8px] font-black text-zinc-500">{subjectGroup.topics.length} topic{subjectGroup.topics.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/60">
                          <div className={`h-full rounded-full bg-gradient-to-r ${color.bar} transition-all duration-500`} style={{ width: `${subjectPercent}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-xs font-black ${subjectPercent === 100 ? 'text-emerald-300' : 'text-zinc-200'}`}>{subjectPercent}%</div>
                        <div className="text-[8px] font-bold text-zinc-600">{subjectGroup.completed}/{subjectGroup.total}</div>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-zinc-600 transition-transform ${subjectOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {subjectOpen && (
                      <div className="border-t border-white/5 bg-black/10 p-2 sm:p-3">
                        {subjectGroup.topics.map((topicGroup, topicIndex) => {
                          const topicKey = `${topicGroup.subject}|||${topicGroup.topic}`;
                          const topicOpen = expandedTopics.includes(topicKey);
                          const topicPercent = topicGroup.materials.length ? Math.round((topicGroup.completed / topicGroup.materials.length) * 100) : 0;
                          const topicColor = colorFor(subjectIndex + topicIndex);

                          return (
                            <div key={topicKey} className="mb-2 overflow-hidden rounded-lg bg-zinc-950/80 ring-1 ring-white/5 last:mb-0">
                              <div className="flex items-center gap-2 px-2.5 py-2.5">
                                <button type="button" onClick={() => toggleTopic(topicKey)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                  <ChevronDown size={14} className={`shrink-0 text-zinc-600 transition-transform ${topicOpen ? 'rotate-180' : ''}`} />
                                  <span className="truncate text-[10px] font-bold text-zinc-200">{topicGroup.topic}</span>
                                </button>
                                <span className={`shrink-0 text-[8px] font-black ${topicPercent === 100 ? 'text-emerald-400' : topicColor.text}`}>{topicGroup.completed}/{topicGroup.materials.length}</span>
                                <div className="hidden w-20 overflow-hidden rounded-full bg-black sm:block">
                                  <div className={`h-1.5 rounded-full bg-gradient-to-r ${topicColor.bar}`} style={{ width: `${topicPercent}%` }} />
                                </div>
                                {localGoal?.id && (
                                  <button type="button" onClick={() => removeTarget(topicGroup.subject, topicGroup.topic)} disabled={saving} title="Remove target" className="p-1 text-zinc-700 transition hover:text-rose-400">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>

                              {topicOpen && (
                                <div className="border-t border-white/5 p-2">
                                  {topicGroup.materials.map((material: any, lectureIndex: number) => {
                                    const done = localCompleted.has(material.id);
                                    const busy = togglingId === material.id;
                                    const locked = !!material.is_paid;
                                    return (
                                      <div key={material.id} className={`group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition ${done ? 'bg-emerald-500/[0.06]' : 'hover:bg-white/[0.035]'}`}>
                                        <button
                                          type="button"
                                          disabled={busy || locked}
                                          onClick={() => toggleLecture(material)}
                                          aria-label={done ? `Mark ${material.title} incomplete` : `Mark ${material.title} complete`}
                                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 transition ${done ? 'bg-emerald-500 text-zinc-950 ring-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.25)]' : 'bg-black text-zinc-600 ring-white/10 hover:text-emerald-400 hover:ring-emerald-500/40'} ${busy ? 'animate-pulse' : ''}`}
                                        >
                                          {done ? <Check size={14} strokeWidth={3} /> : <Circle size={13} />}
                                        </button>

                                        <div className="min-w-0 flex-1">
                                          <div className={`truncate text-[11px] font-bold ${done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                            {material.title || `Lecture ${lectureIndex + 1}`}
                                          </div>
                                          <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-zinc-600">
                                            Lecture {material.lecture_no || lectureIndex + 1}{material.duration ? ` • ${material.duration}` : ''}
                                          </div>
                                        </div>

                                        <Link
                                          href={`/resources/${material.id}`}
                                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[8px] font-black uppercase tracking-wider transition ${done ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15' : 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20'}`}
                                        >
                                          <Play size={10} fill="currentColor" /> Watch
                                        </Link>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-900/50 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-500"><CheckCircle2 size={12} className="text-emerald-400" /> Curriculum progress</div>
          <div className="mt-2 text-sm font-black text-zinc-200">{targetCompleted} of {targetTotal} target lectures completed</div>
          <div className="mt-2 text-[10px] text-zinc-600">Ticking a lecture here updates the same progress used by Curriculum.</div>
        </div>
        <Link href="/resources" className="group rounded-xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 p-4 ring-1 ring-indigo-500/15 transition hover:ring-cyan-400/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-cyan-300"><Sparkles size={12} /> Keep going</div>
            <Play size={13} className="text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
          </div>
          <div className="mt-2 text-sm font-black text-zinc-200">Open full Curriculum</div>
          <div className="mt-1 text-[10px] text-zinc-600">Jump into any subject, topic, or lecture.</div>
        </Link>
      </div>
    </section>
  );
}
