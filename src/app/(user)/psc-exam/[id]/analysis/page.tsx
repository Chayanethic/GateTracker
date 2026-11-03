'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock3,
  Trophy,
  Target,
  Percent,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Flag,
  ListChecks,
  CircleDot,
  Sun,
  Moon,
  BookOpen,
  LayoutGrid,
  X,
  AlertTriangle,
  Sparkles,
  Layers3,
} from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${m}m ${r}s`;
  if (m) return `${m}m ${r}s`;
  return `${r}s`;
};

const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

/**
 * Ensures <u>...</u> and previously escaped &lt;u&gt;...&lt;/u&gt; (plus <b>, <i>, <sub>, <sup>)
 * always render properly as underlined / formatted HTML in both new and already-uploaded exams.
 */
function renderExamHtml(raw: string): string {
  const str = String(raw || '').trim();
  if (!str) return '';
  return str
    .replace(
      /&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi,
      '<u class="underline decoration-2 underline-offset-4">$1</u>'
    )
    .replace(/<u>/gi, '<u class="underline decoration-2 underline-offset-4">')
    .replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<strong>$2</strong>')
    .replace(/&lt;(i|em)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<em>$2</em>')
    .replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/gi, '<sub>$1</sub>')
    .replace(/&lt;sup&gt;([\s\S]*?)&lt;\/sup&gt;/gi, '<sup>$1</sup>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>');
}

type Filter = 'overview' | 'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked';

type SectionBreakdown = {
  topic: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  maxMarks: number;
  scorePercent: number;
  accuracy: number;
  timeSeconds: number;
  status: 'strong' | 'moderate' | 'weak';
};

export default function PscAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('attempt'));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('overview');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [openSolution, setOpenSolution] = useState<Record<string, boolean>>({});
  const [lightMode, setLightMode] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      try {
        const res = await fetch(
          `/api/psc-exam/attempts?testId=${encodeURIComponent(id)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
          }
        );
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(d.error || 'Unable to load analysis.');
          setLoading(false);
          return;
        }
        setData(d);
        if (!selectedId && d.attempts?.length) {
          setSelectedId(d.attempts[0].attemptId);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error('Unable to load analysis.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const attempt = useMemo(
    () =>
      data?.attempts?.find((a: any) => a.attemptId === selectedId) ||
      data?.attempts?.[0],
    [data, selectedId]
  );

  // Compute Section-Wise Breakdown (e.g. English, Arithmetic, General Studies)
  const sectionStats = useMemo<SectionBreakdown[]>(() => {
    const review: any[] = attempt?.review || [];
    if (!review.length) return [];

    const map = new Map<
      string,
      {
        topic: string;
        totalQuestions: number;
        attempted: number;
        correct: number;
        incorrect: number;
        unattempted: number;
        score: number;
        maxMarks: number;
        timeSeconds: number;
      }
    >();

    review.forEach((r: any) => {
      const topic = String(r.topic || 'General').trim() || 'General';
      const entry = map.get(topic) || {
        topic,
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        score: 0,
        maxMarks: 0,
        timeSeconds: 0,
      };

      entry.totalQuestions += 1;
      entry.maxMarks += Number(r.positiveMarks || 1);
      entry.score += Number(r.marks || 0);
      entry.timeSeconds += Number(r.timeSpentSeconds || 0);

      if (r.result === 'correct') {
        entry.correct += 1;
        entry.attempted += 1;
      } else if (r.result === 'incorrect') {
        entry.incorrect += 1;
        entry.attempted += 1;
      } else {
        entry.unattempted += 1;
      }

      map.set(topic, entry);
    });

    const list = Array.from(map.values()).map((s) => {
      const score = Number(s.score.toFixed(2));
      const maxMarks = Number(s.maxMarks.toFixed(2));
      const scorePercent = maxMarks > 0 ? Math.max(0, (score / maxMarks) * 100) : 0;
      const accuracy = s.attempted > 0 ? (s.correct / s.attempted) * 100 : 0;
      let status: 'strong' | 'moderate' | 'weak' = 'moderate';
      if (scorePercent >= 65) status = 'strong';
      else if (scorePercent < 45) status = 'weak';
      return {
        ...s,
        score,
        maxMarks,
        scorePercent,
        accuracy,
        status,
      };
    });

    // If multiple sections exist and none were <45% but one is clearly the lowest (<65%), mark the lowest as weak
    if (list.length > 1 && !list.some((x) => x.status === 'weak')) {
      const sorted = [...list].sort((a, b) => a.scorePercent - b.scorePercent);
      if (sorted[0].scorePercent < 65) {
        sorted[0].status = 'weak';
      }
    }

    return list;
  }, [attempt]);

  const weakestSections = useMemo(
    () =>
      [...sectionStats]
        .filter((s) => s.status === 'weak')
        .sort((a, b) => a.scorePercent - b.scorePercent),
    [sectionStats]
  );

  const strongestSection = useMemo(() => {
    if (!sectionStats.length) return null;
    const sorted = [...sectionStats].sort((a, b) => b.scorePercent - a.scorePercent);
    return sorted[0].score > 0 ? sorted[0] : null;
  }, [sectionStats]);

  const filteredReview = useMemo(() => {
    let review: any[] = attempt?.review || [];
    if (selectedSection !== 'ALL') {
      review = review.filter(
        (r: any) => (String(r.topic || 'General').trim() || 'General') === selectedSection
      );
    }
    if (filter === 'correct') return review.filter((r: any) => r.result === 'correct');
    if (filter === 'incorrect') return review.filter((r: any) => r.result === 'incorrect');
    if (filter === 'unattempted')
      return review.filter((r: any) => r.result === 'not_answered');
    if (filter === 'marked') return review.filter((r: any) => r.markedForReview);
    return review;
  }, [attempt, filter, selectedSection]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-emerald-400">
        Loading analysis...
      </div>
    );
  }

  if (!data?.attempts?.length) {
    return (
      <div className="max-w-3xl mx-auto p-5 sm:p-10">
        <button
          onClick={() => router.push('/psc-exam')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 text-sm font-bold"
        >
          <ArrowLeft size={18} /> Back to PSC Exam Tests
        </button>
        <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 sm:p-10 text-center">
          <h1 className="text-xl sm:text-2xl font-black text-white">No Attempts Yet</h1>
          <p className="text-zinc-500 mt-2 text-sm">
            Start this exam to generate your solution analysis.
          </p>
          <button
            onClick={() => router.push(`/psc-exam/${id}`)}
            className="mt-6 bg-emerald-500 text-black font-black px-6 py-3 rounded-xl text-sm"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'all', label: 'All Questions', count: attempt?.review?.length },
    { key: 'correct', label: 'Correct', count: attempt?.correct },
    { key: 'incorrect', label: 'Incorrect', count: attempt?.incorrect },
    { key: 'unattempted', label: 'Unattempted', count: attempt?.notAnswered },
    { key: 'marked', label: 'Review', count: attempt?.markedCount },
  ];

  const expandAllSolutions = () => {
    const all: Record<string, boolean> = {};
    (attempt?.review || []).forEach((r: any) => {
      all[r.id] = true;
    });
    setOpenSolution(all);
  };

  const collapseAllSolutions = () => {
    setOpenSolution({});
  };

  return (
    <div
      className={
        lightMode
          ? 'min-h-screen bg-slate-100 text-slate-900 pb-20'
          : 'min-h-screen bg-[#181818] text-white pb-20'
      }
    >
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
          <button
            onClick={() => router.push('/psc-exam')}
            className={
              lightMode
                ? 'inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition'
                : 'inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-300 hover:text-white transition'
            }
          >
            <ArrowLeft size={17} /> Back to PSC Exams
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileNav(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400"
            >
              <LayoutGrid size={14} /> Navigator
            </button>
            <button
              onClick={() => router.push(`/psc-exam/${id}`)}
              className="rounded-lg bg-emerald-400 text-zinc-950 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-black hover:bg-emerald-300 transition"
            >
              Reattempt
            </button>
            <button
              onClick={() => setLightMode((v) => !v)}
              className={
                lightMode
                  ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 sm:px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50'
                  : 'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 sm:px-3 py-2 text-xs font-black text-white hover:bg-white/10'
              }
            >
              {lightMode ? <Moon size={15} /> : <Sun size={15} />}
              <span className="hidden sm:inline">{lightMode ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Filter Tabs */}
        <div
          className={
            lightMode
              ? 'border-b border-slate-300 flex items-end gap-1 overflow-x-auto scrollbar-none'
              : 'border-b border-white/10 flex items-end gap-1 overflow-x-auto scrollbar-none'
          }
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative whitespace-nowrap px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition ${
                filter === tab.key
                  ? lightMode
                    ? 'text-slate-900'
                    : 'text-white'
                  : lightMode
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.key !== 'overview' ? (
                <span className="ml-1 text-[11px] opacity-60">({tab.count})</span>
              ) : null}
              {filter === tab.key && (
                <span
                  className={`absolute left-0 right-0 bottom-0 h-0.5 ${
                    lightMode ? 'bg-slate-900' : 'bg-emerald-400'
                  }`}
                />
              )}
            </button>
          ))}
        </div>

        {/* Exam Title & Attempt Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 sm:py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {data.test.category && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                  {data.test.category}
                </span>
              )}
              {data.test.stream && (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase">
                  {data.test.stream}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight break-words">
              {data.test.title}
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1">
              Attempt {attempt?.attemptNumber} ·{' '}
              {new Date(attempt?.submittedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={expandAllSolutions}
              className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-black text-emerald-400 hover:bg-emerald-500/25"
            >
              Show All Solutions
            </button>
            <button
              type="button"
              onClick={collapseAllSolutions}
              className={
                lightMode
                  ? 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700'
                  : 'rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300'
              }
            >
              Hide All
            </button>
            <select
              value={attempt?.attemptId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className={
                lightMode
                  ? 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none'
                  : 'rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white outline-none'
              }
            >
              {(data.attempts || []).map((a: any) => (
                <option key={a.attemptId} value={a.attemptId}>
                  Attempt {a.attemptNumber} · {a.score}/{a.maxMarks}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filter === 'overview' && (
          <>
            <SectionTitle icon={<BarChart3 size={18} />} title="Overall Performance" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
              <Stat
                lightMode={lightMode}
                icon={<Trophy size={16} />}
                label="Your Score"
                value={`${Number(attempt.score).toFixed(2)}`}
                sub={`/${attempt.maxMarks}`}
                tone="amber"
              />
              <Stat
                lightMode={lightMode}
                icon={<Target size={16} />}
                label="Rank"
                value={`${attempt.rank ?? '—'}`}
                sub={attempt.totalRanked ? `/${attempt.totalRanked}` : ''}
                tone="purple"
              />
              <Stat
                lightMode={lightMode}
                icon={<Percent size={16} />}
                label="Percentile"
                value={pct(attempt.percentile)}
                sub=""
                tone="blue"
              />
              <Stat
                lightMode={lightMode}
                icon={<CheckCircle2 size={16} />}
                label="Correct"
                value={String(attempt.correct)}
                sub=""
                tone="green"
              />
              <Stat
                lightMode={lightMode}
                icon={<XCircle size={16} />}
                label="Incorrect"
                value={String(attempt.incorrect)}
                sub=""
                tone="red"
              />
              <Stat
                lightMode={lightMode}
                icon={<MinusCircle size={16} />}
                label="Unattempted"
                value={String(attempt.notAnswered)}
                sub=""
                tone="gray"
              />
              <Stat
                lightMode={lightMode}
                icon={<CircleDot size={16} />}
                label="Accuracy"
                value={pct(attempt.accuracy)}
                sub=""
                tone="cyan"
              />
            </div>

            {/* Section-Wise (Topic-Wise) Score & Weakness Breakdown */}
            {sectionStats.length > 0 && (
              <div className="mt-7">
                <SectionTitle
                  icon={<Layers3 size={18} />}
                  title="Section-Wise Score & Strength / Weakness Analysis"
                />

                {/* Diagnostic Alert Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {weakestSections.length > 0 ? (
                    <div
                      className={
                        lightMode
                          ? 'rounded-2xl border border-red-300 bg-red-50 p-4 flex items-start gap-3'
                          : 'rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3'
                      }
                    >
                      <AlertTriangle
                        size={20}
                        className="text-red-500 shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-wider text-red-500">
                          Weak Section Identified
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-medium mt-1 leading-relaxed ${
                            lightMode ? 'text-slate-800' : 'text-zinc-200'
                          }`}
                        >
                          You are weak in{' '}
                          <b className="text-red-400">
                            {weakestSections.map((w) => w.topic).join(', ')}
                          </b>{' '}
                          (scored{' '}
                          <b>
                            {weakestSections[0].score.toFixed(2)} /{' '}
                            {weakestSections[0].maxMarks}
                          </b>{' '}
                          marks from <b>{weakestSections[0].totalQuestions}</b> questions,{' '}
                          {pct(weakestSections[0].accuracy)} accuracy). Focus on practicing this
                          section.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={
                        lightMode
                          ? 'rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3'
                          : 'rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3'
                      }
                    >
                      <CheckCircle2
                        size={20}
                        className="text-emerald-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-500">
                          Balanced Performance
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-medium mt-1 ${
                            lightMode ? 'text-slate-800' : 'text-zinc-200'
                          }`}
                        >
                          Great job! You maintained a solid score across all sections of this
                          examination.
                        </p>
                      </div>
                    </div>
                  )}

                  {strongestSection && (
                    <div
                      className={
                        lightMode
                          ? 'rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3'
                          : 'rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex items-start gap-3'
                      }
                    >
                      <Sparkles
                        size={20}
                        className="text-emerald-400 shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          Strongest Section
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-medium mt-1 leading-relaxed ${
                            lightMode ? 'text-slate-800' : 'text-zinc-200'
                          }`}
                        >
                          Your best performance is in{' '}
                          <b className="text-emerald-400">{strongestSection.topic}</b> with{' '}
                          <b>
                            {strongestSection.score.toFixed(2)} /{' '}
                            {strongestSection.maxMarks}
                          </b>{' '}
                          marks ({pct(strongestSection.scorePercent)}) from{' '}
                          <b>{strongestSection.totalQuestions}</b> questions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {sectionStats.map((sec) => {
                    const isWeak = sec.status === 'weak';
                    const isStrong = sec.status === 'strong';
                    const isSelected = selectedSection === sec.topic;

                    return (
                      <div
                        key={sec.topic}
                        className={`rounded-2xl border p-4 sm:p-5 transition ${
                          isSelected
                            ? 'ring-2 ring-emerald-400'
                            : ''
                        } ${
                          lightMode
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-[#222] border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black text-base sm:text-lg">{sec.topic}</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {sec.totalQuestions} Questions • Max {sec.maxMarks} Marks
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${
                              isWeak
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : isStrong
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isWeak
                              ? 'Weak Section'
                              : isStrong
                                ? 'Strong Section'
                                : 'Moderate'}
                          </span>
                        </div>

                        <div className="mt-4 flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                              {sec.score.toFixed(2)}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-zinc-500">
                              {' '}
                              / {sec.maxMarks} Marks
                            </span>
                          </div>
                          <span className="text-xs font-black font-mono">
                            {pct(sec.scorePercent)}
                          </span>
                        </div>

                        {/* Section Score Bar */}
                        <div className="mt-2.5 h-2 rounded-full bg-black/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isWeak
                                ? 'bg-red-500'
                                : isStrong
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-400'
                            }`}
                            style={{
                              width: `${Math.max(4, Math.min(100, sec.scorePercent))}%`,
                            }}
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-4 gap-1.5 text-center rounded-xl bg-black/20 p-2.5 text-xs">
                          <div>
                            <b className="block text-emerald-400">{sec.correct}</b>
                            <span className="text-[10px] text-zinc-500">Correct</span>
                          </div>
                          <div>
                            <b className="block text-red-400">{sec.incorrect}</b>
                            <span className="text-[10px] text-zinc-500">Wrong</span>
                          </div>
                          <div>
                            <b className="block text-zinc-400">{sec.unattempted}</b>
                            <span className="text-[10px] text-zinc-500">Left</span>
                          </div>
                          <div>
                            <b className="block text-cyan-400">{Math.round(sec.accuracy)}%</b>
                            <span className="text-[10px] text-zinc-500">Acc.</span>
                          </div>
                        </div>

                        <div className="mt-3.5 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            <Clock3 size={12} className="inline mr-1" />
                            Time: {fmt(sec.timeSeconds)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSection(
                                selectedSection === sec.topic ? 'ALL' : sec.topic
                              );
                              document
                                .getElementById('solutions-section-anchor')
                                ?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="font-black text-emerald-400 hover:underline"
                          >
                            {selectedSection === sec.topic
                              ? 'Showing Section ✓'
                              : `Review ${sec.topic} →`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.4fr_.6fr] gap-4">
              <div
                className={
                  lightMode
                    ? 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm'
                    : 'rounded-2xl border border-white/10 bg-[#222] p-4 sm:p-5'
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="font-black text-base sm:text-lg">Performance Breakdown</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Across all {attempt.review.length} questions
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <Legend dot="bg-emerald-500" text="Correct" />
                    <Legend dot="bg-red-500" text="Incorrect" />
                    <Legend dot="bg-zinc-500" text="Unattempted" />
                  </div>
                </div>
                <div
                  className={
                    lightMode
                      ? 'h-44 sm:h-52 flex items-end justify-around gap-3 sm:gap-8 px-2 sm:px-5 border-b border-slate-200'
                      : 'h-44 sm:h-52 flex items-end justify-around gap-3 sm:gap-8 px-2 sm:px-5 border-b border-white/5'
                  }
                >
                  <Bar
                    value={attempt.correct}
                    label="Correct"
                    pct={(attempt.correct / Math.max(1, attempt.review.length)) * 100}
                    tone="green"
                  />
                  <Bar
                    value={attempt.incorrect}
                    label="Incorrect"
                    pct={(attempt.incorrect / Math.max(1, attempt.review.length)) * 100}
                    tone="red"
                  />
                  <Bar
                    value={attempt.notAnswered}
                    label="Unattempted"
                    pct={(attempt.notAnswered / Math.max(1, attempt.review.length)) * 100}
                    tone="gray"
                  />
                </div>
              </div>
              <div
                className={
                  lightMode
                    ? 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm'
                    : 'rounded-2xl border border-white/10 bg-[#222] p-4 sm:p-5'
                }
              >
                <h2 className="font-black text-base sm:text-lg">Attempt Summary</h2>
                <div className="mt-4 space-y-3 text-xs sm:text-sm">
                  <SummaryRow
                    lightMode={lightMode}
                    label="Total time"
                    value={fmt(attempt.totalTimeSeconds)}
                  />
                  <SummaryRow
                    lightMode={lightMode}
                    label="Questions"
                    value={String(attempt.review.length)}
                  />
                  <SummaryRow
                    lightMode={lightMode}
                    label="Marks gained"
                    value={`+${attempt.positiveGained.toFixed(2)}`}
                    good
                  />
                  <SummaryRow
                    lightMode={lightMode}
                    label="Negative marks"
                    value={`−${attempt.negativeLost.toFixed(2)}`}
                    bad={attempt.negativeLost > 0}
                  />
                  <SummaryRow
                    lightMode={lightMode}
                    label="Accuracy"
                    value={pct(attempt.accuracy)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Section-Wise Filter Bar for Question Solutions */}
        <div id="solutions-section-anchor" className="mt-8 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <SectionTitle
              icon={<ListChecks size={18} />}
              title={
                selectedSection === 'ALL'
                  ? 'Question-wise Solutions'
                  : `${selectedSection} — Question-wise Solutions (${filteredReview.length})`
              }
            />
          </div>

          {sectionStats.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500 mr-1">
                Section Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSection('ALL')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition ${
                  selectedSection === 'ALL'
                    ? 'bg-emerald-500 text-black border-emerald-500'
                    : lightMode
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
              >
                All Sections ({attempt.review.length})
              </button>
              {sectionStats.map((sec) => (
                <button
                  key={sec.topic}
                  type="button"
                  onClick={() => setSelectedSection(sec.topic)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition flex items-center gap-1.5 ${
                    selectedSection === sec.topic
                      ? 'bg-emerald-500 text-black border-emerald-500'
                      : lightMode
                        ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <span>
                    {sec.topic} ({sec.totalQuestions})
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedSection === sec.topic
                        ? 'bg-black/20 text-black'
                        : sec.status === 'weak'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {sec.score.toFixed(1)}/{sec.maxMarks}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredReview.length ? (
            <QuestionList
              review={filteredReview}
              openSolution={openSolution}
              setOpenSolution={setOpenSolution}
              lightMode={lightMode}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#222] p-10 text-center text-zinc-500 text-sm">
              No questions match this filter.
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-Over Question Navigator Drawer */}
      {showMobileNav && (
        <div className="lg:hidden fixed inset-0 z-[120] flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMobileNav(false)}
          />
          <div
            className={`relative z-10 w-[300px] max-w-[85vw] h-full overflow-y-auto p-4 shadow-2xl ${
              lightMode ? 'bg-white text-slate-900' : 'bg-[#0f172a] text-white'
            }`}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-current/10">
              <span className="font-black text-sm">
                Question Navigator ({filteredReview.length})
              </span>
              <button
                onClick={() => setShowMobileNav(false)}
                className="p-1.5 rounded-lg bg-current/10"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {filteredReview.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setShowMobileNav(false);
                    document
                      .getElementById(`analysis-question-${r.id}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`h-9 rounded-lg border text-xs font-black transition ${
                    r.result === 'correct'
                      ? lightMode
                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                        : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                      : r.result === 'incorrect'
                        ? lightMode
                          ? 'border-red-300 text-red-700 bg-red-50'
                          : 'border-red-500/40 text-red-300 bg-red-500/10'
                        : lightMode
                          ? 'border-slate-300 text-slate-600 bg-slate-50'
                          : 'border-white/15 text-zinc-400 bg-white/[.02]'
                  }`}
                >
                  {r.number}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionList({ review, openSolution, setOpenSolution, lightMode }: any) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_230px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        {review.map((r: any) => (
          <QuestionCard
            key={r.id}
            r={r}
            open={!!openSolution[r.id]}
            lightMode={lightMode}
            onToggle={() =>
              setOpenSolution((s: any) => ({ ...s, [r.id]: !s[r.id] }))
            }
          />
        ))}
      </div>
      <QuestionNavigator review={review} lightMode={lightMode} />
    </div>
  );
}

function QuestionNavigator({ review, lightMode }: any) {
  const scrollTo = (id: string) =>
    document
      .getElementById(`analysis-question-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <aside className="hidden lg:block sticky top-5">
      <div
        className={`rounded-2xl border p-4 ${
          lightMode
            ? 'border-slate-200 bg-white shadow-sm'
            : 'border-white/10 bg-[#0f172a]'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-sm font-black ${
              lightMode ? 'text-slate-900' : 'text-white'
            }`}
          >
            Navigator
          </span>
          <span
            className={`text-xs font-black ${
              lightMode ? 'text-slate-500' : 'text-zinc-400'
            }`}
          >
            {review.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {review.map((r: any) => (
            <button
              key={r.id}
              onClick={() => scrollTo(r.id)}
              className={`h-8 rounded-lg border text-xs font-black transition ${
                r.result === 'correct'
                  ? lightMode
                    ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                    : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                  : r.result === 'incorrect'
                    ? lightMode
                      ? 'border-red-300 text-red-700 bg-red-50'
                      : 'border-red-500/40 text-red-300 bg-red-500/10'
                    : lightMode
                      ? 'border-slate-300 text-slate-600 bg-slate-50'
                      : 'border-white/15 text-zinc-400 bg-white/[.02]'
              } ${r.markedForReview ? 'ring-1 ring-violet-400' : ''}`}
            >
              {r.number}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function QuestionCard({ r, open, onToggle, lightMode }: any) {
  const resultClass =
    r.result === 'correct'
      ? lightMode
        ? 'border-emerald-500/30'
        : 'border-emerald-500/20'
      : r.result === 'incorrect'
        ? lightMode
          ? 'border-red-500/30'
          : 'border-red-500/20'
        : lightMode
          ? 'border-slate-200'
          : 'border-white/10';
  const statusClass =
    r.result === 'correct'
      ? 'text-emerald-600 bg-emerald-500/10'
      : r.result === 'incorrect'
        ? 'text-red-600 bg-red-500/10'
        : lightMode
          ? 'text-slate-500 bg-slate-200'
          : 'text-zinc-400 bg-zinc-500/10';

  const selected = new Set((r.selected || []).map((x: any) => String(x).toUpperCase()));
  const answer = new Set((r.answer || []).map((x: any) => String(x).toUpperCase()));
  const hasExplanationContent = Boolean(
    (r.explanation && String(r.explanation).trim()) ||
      (r.solutionImageUrl && String(r.solutionImageUrl).trim()) ||
      (r.solutionHtml && String(r.solutionHtml).trim())
  );

  return (
    <div
      id={`analysis-question-${r.id}`}
      className={`scroll-mt-5 rounded-2xl border ${resultClass} ${
        lightMode ? 'bg-white' : 'bg-[#222]'
      } overflow-hidden shadow-sm`}
    >
      <div
        className={`px-3.5 sm:px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2.5 ${
          lightMode ? 'border-slate-200' : 'border-white/10'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-black text-xs sm:text-sm ${
              lightMode ? 'bg-slate-100 text-slate-800' : 'bg-white/5'
            }`}
          >
            Q{r.number}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm">Question {r.number}</span>
              {r.topic && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                  <BookOpen size={10} /> {r.topic}
                </span>
              )}
            </div>
            <div
              className={`text-[10px] sm:text-[11px] uppercase tracking-wider mt-0.5 ${
                lightMode ? 'text-slate-500' : 'text-zinc-500'
              }`}
            >
              {r.type} · +{Number(r.positiveMarks || 0).toFixed(2)}
              {Number(r.negativeMarks || 0) > 0
                ? ` · −${Number(r.negativeMarks).toFixed(2)}`
                : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass}`}>
            {r.result === 'correct'
              ? '✓ Correct'
              : r.result === 'incorrect'
                ? '× Incorrect'
                : '— Unattempted'}
          </span>
          {r.markedForReview && (
            <span className="rounded-full px-2.5 py-1 bg-violet-500/10 text-violet-500 text-[11px] font-bold">
              <Flag size={11} className="inline mr-1" />
              Review
            </span>
          )}
          <span className={`text-[11px] ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
            <Clock3 size={12} className="inline mr-1" />
            {fmt(r.timeSpentSeconds)}
          </span>
          <b className={Number(r.marks) >= 0 ? 'text-emerald-500' : 'text-red-500'}>
            {Number(r.marks) > 0 ? '+' : ''}
            {Number(r.marks).toFixed(2)}
          </b>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div
          className={`prose max-w-none text-sm sm:text-[15px] leading-7 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4 ${
            lightMode ? 'text-slate-800' : 'prose-invert'
          }`}
          dangerouslySetInnerHTML={{
            __html: renderExamHtml(r.questionHtml || r.questionText || ''),
          }}
        />

        {r.options?.length ? (
          <div className="mt-5 space-y-2">
            {r.options.map((o: any) => {
              const optKey = String(o.key || o.id || '').toUpperCase();
              const isCorrect = answer.has(optKey);
              const isSelected = selected.has(optKey);
              const optionClass =
                open && isCorrect
                  ? lightMode
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-emerald-500/40 bg-emerald-500/10'
                  : open && isSelected && !isCorrect
                    ? lightMode
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-red-500/40 bg-red-500/10'
                    : lightMode
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-white/10 bg-white/[.02]';
              return (
                <div
                  key={optKey}
                  className={`flex items-start gap-2.5 sm:gap-3 rounded-xl border p-3 ${optionClass}`}
                >
                  <span
                    className={`mt-0.5 w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                      open && isCorrect
                        ? 'bg-emerald-500 text-black'
                        : open && isSelected && !isCorrect
                          ? 'bg-red-500 text-white'
                          : lightMode
                            ? 'border border-slate-300 text-slate-600'
                            : 'border border-white/15 text-zinc-400'
                    }`}
                  >
                    {optKey}
                  </span>
                  <div
                    className={`min-w-0 flex-1 text-xs sm:text-sm leading-6 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4 ${
                      lightMode ? 'text-slate-800' : ''
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: renderExamHtml(o.html || o.text || ''),
                    }}
                  />
                  {open && (
                    <div className="shrink-0 text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-right">
                      {isCorrect && <div className="text-emerald-500">Correct</div>}
                      {isSelected && !isCorrect && (
                        <div className="text-red-500">Yours</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`mt-4 text-xs sm:text-sm ${lightMode ? 'text-slate-500' : 'text-zinc-400'}`}>
            Your numerical answer:{' '}
            <b className={lightMode ? 'text-slate-900' : 'text-white'}>
              {r.selected?.length ? r.selected.join(', ') : 'Not answered'}
            </b>
          </div>
        )}

        <div
          className={`mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border px-3.5 py-3 ${
            lightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#1b1b1b]'
          }`}
        >
          <div className={`text-xs sm:text-sm ${lightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
            {open ? (
              <>
                Correct answer:{' '}
                <b className="text-emerald-500">
                  {r.answer?.length ? r.answer.join(', ') : '—'}
                </b>
                {r.selected?.length ? (
                  <span className="ml-3">
                    Your answer:{' '}
                    <b
                      className={
                        r.result === 'correct' ? 'text-emerald-500' : 'text-red-500'
                      }
                    >
                      {r.selected.join(', ')}
                    </b>
                  </span>
                ) : null}
              </>
            ) : (
              <span>
                Answer hidden · Tap{' '}
                <b className={lightMode ? 'text-slate-900' : 'text-white'}>
                  Show Solution
                </b>{' '}
                to view answer
                {hasExplanationContent ? ' & explanation' : ''}.
              </span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-white text-zinc-900 px-4 py-2 text-xs sm:text-sm font-black hover:bg-emerald-300 transition shrink-0"
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{' '}
            {open ? 'Hide Solution' : 'Show Solution'}
          </button>
        </div>

        {open && (
          <div
            className={`mt-3.5 rounded-xl border p-3.5 sm:p-5 space-y-3.5 ${
              lightMode
                ? 'border-emerald-500/30 bg-emerald-50'
                : 'border-emerald-500/20 bg-emerald-500/5'
            }`}
          >
            <div
              className={`rounded-xl border p-3.5 ${
                lightMode
                  ? 'border-emerald-500/20 bg-white'
                  : 'border-white/10 bg-[#1b1b1b]'
              }`}
            >
              <div
                className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                  lightMode ? 'text-slate-500' : 'text-zinc-400'
                }`}
              >
                Correct Answer
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-500">
                {r.answer?.length ? r.answer.join(', ') : '—'}
              </div>
            </div>

            {hasExplanationContent && (
              <div
                className={`rounded-xl border p-3.5 sm:p-4 space-y-3 ${
                  lightMode ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#1b1b1b]'
                }`}
              >
                <div
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    lightMode ? 'text-slate-500' : 'text-emerald-400'
                  }`}
                >
                  Explanation
                </div>
                {r.explanation ? (
                  <div
                    className="text-xs sm:text-sm leading-relaxed break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4"
                    dangerouslySetInnerHTML={{
                      __html: renderExamHtml(r.explanation).replace(/\n/g, '<br/>'),
                    }}
                  />
                ) : r.solutionHtml ? (
                  <div
                    className="prose max-w-none text-xs sm:text-sm leading-6 dark:prose-invert break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4"
                    dangerouslySetInnerHTML={{ __html: renderExamHtml(r.solutionHtml) }}
                  />
                ) : null}
                {r.solutionImageUrl && (
                  <div>
                    <img
                      src={r.solutionImageUrl}
                      alt="Solution Visual"
                      loading="lazy"
                      className="max-w-full max-h-[380px] h-auto rounded-xl border border-white/10 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: any) {
  return (
    <div className="flex items-center gap-2 mb-3.5">
      <span className="text-emerald-400">{icon}</span>
      <h2 className="text-base sm:text-lg font-black">{title}</h2>
    </div>
  );
}

function Stat({ icon, label, value, sub, tone, lightMode }: any) {
  const tones: Record<string, string> = {
    amber: 'text-amber-500 bg-amber-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    green: 'text-emerald-500 bg-emerald-500/10',
    red: 'text-red-500 bg-red-500/10',
    gray: 'text-zinc-500 bg-zinc-500/10',
    cyan: 'text-cyan-500 bg-cyan-500/10',
  };
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 ${
        lightMode ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#242424]'
      }`}
    >
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${tones[tone]} flex items-center justify-center`}>
        {icon}
      </div>
      <div className={`text-[11px] mt-2.5 ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-black mt-0.5 truncate">
        {value}
        <span
          className={`text-xs font-bold ml-0.5 ${
            lightMode ? 'text-slate-400' : 'text-zinc-500'
          }`}
        >
          {sub}
        </span>
      </div>
    </div>
  );
}

function Bar({ value, label, pct: percent, tone }: any) {
  const h = Math.max(12, Math.min(92, percent));
  const bg: Record<string, string> = {
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    gray: 'bg-zinc-500',
  };
  const text: Record<string, string> = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    gray: 'text-zinc-400',
  };
  return (
    <div className="flex h-full w-20 sm:w-28 flex-col items-center justify-end">
      <div className={`mb-1 text-xs sm:text-sm font-black ${text[tone]}`}>{value}</div>
      <div className={`w-14 sm:w-20 rounded-t-lg ${bg[tone]}`} style={{ height: `${h}%` }}>
        <div className="h-full flex items-center justify-center text-[10px] sm:text-xs font-black text-white">
          {Math.round(percent)}%
        </div>
      </div>
      <div className="mt-2.5 text-[11px] sm:text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Legend({ dot, text }: any) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={`w-2 h-2 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function SummaryRow({ label, value, good, bad, lightMode }: any) {
  return (
    <div
      className={`flex items-center justify-between border-b pb-2.5 ${
        lightMode ? 'border-slate-200' : 'border-white/5'
      }`}
    >
      <span className={lightMode ? 'text-slate-500' : 'text-zinc-500'}>{label}</span>
      <b
        className={
          good
            ? 'text-emerald-500'
            : bad
              ? 'text-red-500'
              : lightMode
                ? 'text-slate-800'
                : 'text-zinc-100'
        }
      >
        {value}
      </b>
    </div>
  );
}
