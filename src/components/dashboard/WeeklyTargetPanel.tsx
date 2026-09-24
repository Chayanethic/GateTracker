'use client';

import Link from 'next/link';
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, Target, Play } from 'lucide-react';

type WeeklyTargetPanelProps = {
  goal: any | null;
  curriculum: any[];
  completedIds: Set<string>;
  today: string;
};

type TopicStat = {
  subject: string;
  topic: string;
  total: number;
  completed: number;
  materialIds: string[];
};

const dateOnly = (value: string) => new Date(`${value}T00:00:00Z`);

const formatDate = (value: string) =>
  dateOnly(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getWeekRange = (today: string) => {
  const d = dateOnly(today);
  const day = d.getUTCDay(); // Sunday = 0
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

export default function WeeklyTargetPanel({ goal, curriculum, completedIds, today }: WeeklyTargetPanelProps) {
  const week = getWeekRange(today);

  const targetStart = goal ? (goal.start_date > week.start ? goal.start_date : week.start) : week.start;
  const targetEnd = goal ? (goal.target_date < week.end ? goal.target_date : week.end) : week.end;

  const weekTasks: any[] = [];
  if (goal?.routine_data && targetStart <= targetEnd) {
    const cursor = dateOnly(targetStart);
    const end = dateOnly(targetEnd);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const blocks = goal.routine_data[key] || [];
      blocks.forEach((block: any) => {
        (block.tasks || []).forEach((task: any) => {
          if (task.originalId) weekTasks.push({ ...task, dateStr: key });
        });
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const materialById = new Map(curriculum.map((m: any) => [m.id, m]));
  const uniqueTargetIds = [...new Set(weekTasks.map(t => t.originalId))] as string[];

  const topicMap = new Map<string, TopicStat>();
  uniqueTargetIds.forEach(id => {
    const material = materialById.get(id);
    const task = weekTasks.find(t => t.originalId === id);
    const subject = material?.subject_name || task?.subject || 'Other';
    const topic = material?.topic_name || task?.topic || 'Other';
    const key = `${subject}|||${topic}`;
    const existing = topicMap.get(key) || { subject, topic, total: 0, completed: 0, materialIds: [] };
    existing.total += 1;
    existing.completed += completedIds.has(id) ? 1 : 0;
    existing.materialIds.push(id);
    topicMap.set(key, existing);
  });

  const topicStats = [...topicMap.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));

  const subjectMap = new Map<string, { subject: string; total: number; completed: number }>();
  curriculum.forEach((material: any) => {
    const subject = material.subject_name || 'Other';
    const existing = subjectMap.get(subject) || { subject, total: 0, completed: 0 };
    existing.total += 1;
    if (completedIds.has(material.id)) existing.completed += 1;
    subjectMap.set(subject, existing);
  });
  const subjectStats = [...subjectMap.values()].sort((a, b) => a.subject.localeCompare(b.subject));

  const targetTotal = uniqueTargetIds.length;
  const targetCompleted = uniqueTargetIds.filter(id => completedIds.has(id)).length;
  const targetPercent = targetTotal ? Math.round((targetCompleted / targetTotal) * 100) : 0;

  return (
    <section className="mb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center">
              <Target size={13} className="text-indigo-400" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Weekly Target</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">This Week's Mission</h2>
          <p className="text-[11px] text-zinc-500 mt-1">Plan from your created target, then continue directly in Curriculum.</p>
        </div>
        <Link href="/resources" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800 hover:ring-emerald-500/40 hover:bg-emerald-500/5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-emerald-400 transition-all">
          <BookOpen size={13} /> Open Curriculum <ChevronRight size={13} />
        </Link>
      </div>

      {!goal ? (
        <div className="rounded-[1.5rem] bg-zinc-900/40 ring-1 ring-zinc-800/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-200">No active target for this week.</p>
            <p className="text-[11px] text-zinc-500 mt-1">Create a target by selecting subjects/topics and a date range.</p>
          </div>
          <Link href="/create-goal" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors">
            <Target size={13} /> Create Target
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-[1.75rem] bg-zinc-900/40 ring-1 ring-zinc-800/80 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-zinc-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] font-black text-zinc-500 mb-2">
                  <CalendarDays size={12} className="text-indigo-400" />
                  {formatDate(targetStart)} — {formatDate(targetEnd)}
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-100 truncate">{goal.title || 'Study Target'}</h3>
                <p className="text-[10px] text-zinc-500 mt-1">{targetTotal} curriculum modules scheduled this week</p>
              </div>

              <div className="w-full lg:w-[280px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Weekly Progress</span>
                  <span className="text-xs font-black text-emerald-400">{targetCompleted}/{targetTotal} • {targetPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/60 overflow-hidden ring-1 ring-white/5">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${targetPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {topicStats.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">No curriculum modules are scheduled in this week's target.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {topicStats.map((item) => {
                    const percent = item.total ? Math.round((item.completed / item.total) * 100) : 0;
                    return (
                      <Link key={`${item.subject}-${item.topic}`} href="/resources" className="group rounded-2xl bg-black/30 ring-1 ring-zinc-800/80 hover:ring-indigo-500/40 p-4 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80 truncate">{item.subject}</div>
                            <div className="text-sm font-bold text-zinc-200 mt-1 leading-snug">{item.topic}</div>
                          </div>
                          <div className={`shrink-0 flex items-center gap-1 text-[9px] font-black ${percent === 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {percent === 100 && <CheckCircle2 size={12} />}
                            {item.completed}/{item.total}
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[8px] font-bold uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400">
                          <span>{percent}% complete</span>
                          <span className="flex items-center gap-1"><Play size={9} /> Curriculum</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest">Curriculum Progress</h3>
                <p className="text-[10px] text-zinc-600 mt-1">Overall completion fetched from your curriculum modules.</p>
              </div>
              <Link href="/resources" className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400">View all</Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {subjectStats.map((item) => {
                const percent = item.total ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <Link key={item.subject} href="/resources" className="rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800/80 hover:ring-zinc-700 p-4 transition-all group">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-bold text-zinc-300 truncate group-hover:text-white">{item.subject}</span>
                      <span className="text-[10px] font-black text-zinc-400">{percent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-black/70 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-2 text-[8px] uppercase tracking-widest text-zinc-600 font-bold">{item.completed}/{item.total} modules complete</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
