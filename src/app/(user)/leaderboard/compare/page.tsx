'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, CalendarDays, GitCompareArrows, Users } from 'lucide-react';
import Link from 'next/link';

type Student = {
  user_id: string;
  display_name: string;
  branch: string | null;
  daily_minutes: number;
  week_minutes: number;
  month_minutes: number;
  rank: number;
};

type CompareRow = {
  date_str: string;
  user_id: string;
  display_name: string;
  branch: string | null;
  study_minutes: number;
};

type RangeKey = '30d' | '3m' | '6m' | '1y';

const SERIES_CLASSES = [
  // High-contrast colors so each student's line is easy to distinguish.
  { line: 'stroke-amber-400', dot: 'fill-amber-400', text: 'text-amber-400' },
  { line: 'stroke-rose-400', dot: 'fill-rose-400', text: 'text-rose-400' },
  { line: 'stroke-cyan-400', dot: 'fill-cyan-400', text: 'text-cyan-400' },
  { line: 'stroke-violet-400', dot: 'fill-violet-400', text: 'text-violet-400' },
  { line: 'stroke-orange-400', dot: 'fill-orange-400', text: 'text-orange-400' },
  { line: 'stroke-lime-400', dot: 'fill-lime-400', text: 'text-lime-400' },
];

const formatHours = (minutes: number) => {
  const mins = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startForRange = (range: RangeKey, end: Date) => {
  if (range === '30d') return addDays(end, -29);
  if (range === '3m') {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 2);
    start.setDate(1);
    return start;
  }
  if (range === '6m') {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    return start;
  }
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  start.setMonth(0);
  start.setDate(1);
  return start;
};

const displayMonth = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });

const displayDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ComparePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [range, setRange] = useState<RangeKey>('3m');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      const [{ data: sessionData }, { data, error: leaderboardError }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc('get_study_leaderboard'),
      ]);

      const session = sessionData.session;
      if (!session) {
        setLoadingStudents(false);
        return;
      }
      setMyUserId(session.user.id);

      if (leaderboardError) {
        console.error(leaderboardError);
        setError('Students could not be loaded. Run the supplied leaderboard SQL first.');
        setLoadingStudents(false);
        return;
      }

      const list = (data || []) as Student[];
      setStudents(list);

      const queryId = new URLSearchParams(window.location.search).get('userId');
      const validQueryId = queryId && list.some(student => student.user_id === queryId) ? queryId : null;
      const defaultIds = validQueryId && validQueryId !== session.user.id
        ? [session.user.id, validQueryId]
        : [session.user.id];
      setSelectedIds(defaultIds);
      setLoadingStudents(false);
    };

    loadStudents();
  }, []);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    return { startDate: startForRange(range, end), endDate: end };
  }, [range]);

  useEffect(() => {
    const loadGraph = async () => {
      if (selectedIds.length === 0) {
        setRows([]);
        return;
      }

      setLoadingGraph(true);
      setError(null);
      const { data, error: compareError } = await supabase.rpc('get_study_compare', {
        p_user_ids: selectedIds,
        p_start_date: formatDate(startDate),
        p_end_date: formatDate(endDate),
      });

      if (compareError) {
        console.error(compareError);
        setError('Comparison data could not be loaded. Run the updated leaderboard SQL in Supabase.');
        setRows([]);
      } else {
        setRows((data || []) as CompareRow[]);
      }
      setLoadingGraph(false);
    };

    loadGraph();
  }, [selectedIds, startDate, endDate]);

  const toggleStudent = (id: string) => {
    setSelectedIds(current => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter(item => item !== id);
      }
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  const selectedStudents = useMemo(
    () => selectedIds.map(id => students.find(student => student.user_id === id)).filter(Boolean) as Student[],
    [selectedIds, students]
  );

  const dates = useMemo(() => {
    const result: string[] = [];
    for (let current = new Date(startDate); current <= endDate; current = addDays(current, 1)) {
      result.push(formatDate(current));
    }
    return result;
  }, [startDate, endDate]);

  const series = useMemo(() => {
    return selectedStudents.map((student) => ({
      student,
      values: dates.map(date => {
        const row = rows.find(item => item.user_id === student.user_id && item.date_str === date);
        return Number(row?.study_minutes || 0) / 60;
      }),
    }));
  }, [dates, rows, selectedStudents]);

  const maxHours = useMemo(() => {
    const max = Math.max(1, ...series.flatMap(item => item.values));
    return Math.ceil(max);
  }, [series]);

  const width = 1000;
  const height = 390;
  const left = 58;
  const right = 24;
  const top = 22;
  const bottom = 55;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const xFor = (index: number) => left + (dates.length <= 1 ? plotWidth / 2 : (index / (dates.length - 1)) * plotWidth);
  const yFor = (hours: number) => top + plotHeight - (hours / maxHours) * plotHeight;

  const linePoints = (values: number[]) => values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ');

  const monthTicks = useMemo(() => {
    const seen = new Set<string>();
    return dates.map((date, index) => {
      const key = date.slice(0, 7);
      if (seen.has(key)) return null;
      seen.add(key);
      return { date, index, label: displayMonth(date) };
    }).filter(Boolean) as { date: string; index: number; label: string }[];
  }, [dates]);

  const dateTicks = useMemo(() => {
    const count = dates.length;
    if (count <= 12) return dates.map((date, index) => ({ date, index }));
    const step = Math.max(1, Math.floor(count / 8));
    const indexes = new Set<number>([0, count - 1]);
    for (let i = step; i < count - 1; i += step) indexes.add(i);
    return [...indexes].sort((a, b) => a - b).map(index => ({ date: dates[index], index }));
  }, [dates]);

  return (
    <div className="min-h-full bg-[#050505] text-zinc-200 px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/leaderboard" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-400 mb-4">
              <ArrowLeft size={14} /> Back to Leaderboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center">
                <GitCompareArrows className="text-emerald-400" size={22} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Study Comparison</h1>
                <p className="text-xs text-zinc-500 mt-1">Compare daily study hours against dates</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-500">
            <Users size={15} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Up to 5 students</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Choose students</p>
              <p className="text-xs text-zinc-600 mt-1">Your study line is included automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['30d', '3m', '6m', '1y'] as RangeKey[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${range === item ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.02] border-white/10 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {item === '30d' ? '30 Days' : item === '3m' ? '3 Months' : item === '6m' ? '6 Months' : '1 Year'}
                </button>
              ))}
            </div>
          </div>

          {loadingStudents ? (
            <div className="py-8 text-center text-xs text-zinc-600 animate-pulse">Loading students...</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {students.map(student => {
                const selected = selectedIds.includes(student.user_id);
                return (
                  <button
                    key={student.user_id}
                    type="button"
                    onClick={() => toggleStudent(student.user_id)}
                    className={`shrink-0 text-left px-3 py-3 rounded-xl border transition-colors ${selected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${selected ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                      <span className={`text-xs font-black ${selected ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {student.display_name}{student.user_id === myUserId ? ' (You)' : ''}
                      </span>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-zinc-600 mt-1 block">{(student.branch || '—').toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4 sm:p-6 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500"><CalendarDays size={14} /> Daily Study Hours</div>
              <h2 className="text-lg font-black mt-1">Study time vs date</h2>
              <p className="text-xs text-zinc-600 mt-1">Months are shown along the timeline: Aug, Sep, Oct, and so on.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {selectedStudents.map((student, index) => (
                <div key={student.user_id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${SERIES_CLASSES[index].dot}`} />
                  <span className="text-zinc-300 font-semibold">{student.display_name}</span>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="py-12 text-center text-xs text-red-400">{error}</div>
          ) : loadingGraph ? (
            <div className="py-20 text-center text-xs text-zinc-600 animate-pulse">Loading comparison graph...</div>
          ) : selectedStudents.length === 0 ? (
            <div className="py-20 text-center text-xs text-zinc-600">Select at least one student.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[720px] h-auto" role="img" aria-label="Study hours compared by date">
                {Array.from({ length: 5 }).map((_, index) => {
                  const hours = (maxHours / 4) * index;
                  const y = yFor(hours);
                  return (
                    <g key={index}>
                      <line x1={left} x2={width - right} y1={y} y2={y} className="stroke-white/5" strokeWidth="1" />
                      <text x={left - 10} y={y + 4} textAnchor="end" className="fill-zinc-600 text-[11px]">{hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`}</text>
                    </g>
                  );
                })}

                {monthTicks.map(tick => (
                  <line key={`month-line-${tick.date}`} x1={xFor(tick.index)} x2={xFor(tick.index)} y1={top} y2={height - bottom} className="stroke-white/10" strokeWidth="1" strokeDasharray="4 6" />
                ))}

                {series.map((item, seriesIndex) => (
                  <g key={item.student.user_id}>
                    <polyline
                      points={linePoints(item.values)}
                      fill="none"
                      className={SERIES_CLASSES[seriesIndex].line}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {item.values.map((value, index) => (
                      <circle
                        key={`${item.student.user_id}-${dates[index]}`}
                        cx={xFor(index)}
                        cy={yFor(value)}
                        r={value > 0 ? 3.5 : 2}
                        className={`${SERIES_CLASSES[seriesIndex].dot} stroke-zinc-950`}
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                ))}

                {dateTicks.map(tick => (
                  <g key={`date-${tick.date}`}>
                    <line x1={xFor(tick.index)} x2={xFor(tick.index)} y1={height - bottom} y2={height - bottom + 6} className="stroke-zinc-600" />
                    <text x={xFor(tick.index)} y={height - bottom + 22} textAnchor="middle" className="fill-zinc-600 text-[10px]">{displayDate(tick.date)}</text>
                  </g>
                ))}

                {monthTicks.map(tick => (
                  <text key={`month-${tick.date}`} x={xFor(tick.index)} y={height - 8} textAnchor="start" className="fill-zinc-400 text-[11px] font-bold">{tick.label}</text>
                ))}

                <line x1={left} x2={left} y1={top} y2={height - bottom} className="stroke-zinc-700" />
                <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} className="stroke-zinc-700" />
              </svg>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedStudents.map((student, index) => {
            const values = series.find(item => item.student.user_id === student.user_id)?.values || [];
            const totalMinutes = values.reduce((sum, hours) => sum + hours * 60, 0);
            const activeDays = values.filter(hours => hours > 0).length;
            const average = activeDays ? totalMinutes / activeDays : 0;
            return (
              <div key={student.user_id} className="rounded-2xl border border-white/5 bg-zinc-950/70 p-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${SERIES_CLASSES[index].dot}`} />
                  <p className="font-black truncate">{student.display_name}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div><p className="text-zinc-600 text-[9px] uppercase tracking-widest">Total</p><p className="font-black mt-1">{formatHours(totalMinutes)}</p></div>
                  <div><p className="text-zinc-600 text-[9px] uppercase tracking-widest">Active Days</p><p className="font-black mt-1">{activeDays}</p></div>
                  <div><p className="text-zinc-600 text-[9px] uppercase tracking-widest">Avg/Day</p><p className="font-black mt-1">{formatHours(average)}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
