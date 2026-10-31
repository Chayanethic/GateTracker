'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Award,
  CheckCircle2,
  RotateCcw,
  Trophy,
  ArrowRight,
  Search,
  Sparkles,
  BookOpen,
  Layers3,
  RefreshCw,
} from 'lucide-react';

type PscTestCard = {
  id: string;
  title: string;
  category: string;
  stream: string;
  exam_name: string;
  duration_minutes: number;
  max_marks: number;
  question_count: number;
  topics: string[];
  created_at: string;
  attempt_count: number;
  latest_attempt?: {
    score: number;
    max_marks: number;
    submitted_at: string;
  } | null;
};

export default function PscExamTestPage() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<PscTestCard[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStream, setSelectedStream] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setTests([]);
        return;
      }

      const res = await fetch('/api/psc-exam/list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setTests(data.tests || []);
      }
    } catch (err) {
      console.error('Failed to load PSC exams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [tests]);

  const streams = useMemo(() => {
    const set = new Set<string>();
    tests.forEach((t) => {
      if (t.stream) set.add(t.stream.toUpperCase());
    });
    return ['ALL', ...Array.from(set)];
  }, [tests]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        t.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesStream =
        selectedStream === 'ALL' ||
        t.stream.toUpperCase() === selectedStream.toUpperCase();
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        [t.title, t.category, t.stream, ...(t.topics || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      return matchesCategory && matchesStream && matchesSearch;
    });
  }, [tests, selectedCategory, selectedStream, search]);

  return (
    <div className="max-w-7xl mx-auto p-5 md:p-8 lg:p-10 space-y-8">
      {/* Header Banner */}
      <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-zinc-950 p-6 md:p-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-400">
            <Award size={14} /> Computer Based Test Environment
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">
            PSC Exam Test Series
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-2xl">
            Attempt timed MCQ, NAT, and MSQ mock tests in a full GATE / PSC CBT examination
            environment with instant score evaluation and question-wise solution analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center">
            <div className="text-xl font-black text-white">{tests.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Available Exams
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
            <div className="text-xl font-black text-emerald-400">
              {tests.filter((t) => t.attempt_count > 0).length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Completed
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam title, topic (e.g. Algorithms, Data Structures), category, stream..."
              className="w-full bg-black border border-white/10 focus:border-emerald-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Stream Filter */}
            <div className="flex items-center gap-1 bg-black border border-white/10 rounded-xl p-1">
              {streams.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStream(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    selectedStream === st
                      ? 'bg-emerald-500 text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'All Streams' : st}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void load()}
              title="Refresh tests"
              className="p-2.5 rounded-xl border border-white/10 bg-black text-zinc-400 hover:text-white transition"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 mr-1">
              Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  selectedCategory === cat
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-emerald-400 font-bold text-sm">
          Loading PSC Exam Tests...
        </div>
      ) : !filteredTests.length ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-950/60 p-12 text-center">
          <Sparkles size={28} className="mx-auto text-zinc-600 mb-3" />
          <h2 className="text-lg font-black text-white">No PSC Exam Tests Found</h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            {tests.length === 0
              ? 'No exam papers have been published yet. Upload a JSON exam paper from the Admin "JSON Upload Exam" section to get started.'
              : 'No exams match your current search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((t) => {
            const attempted = t.attempt_count > 0;
            const latestScore = Number(t.latest_attempt?.score || 0);
            const maxMarks = Number(t.latest_attempt?.max_marks || t.max_marks || 0);

            return (
              <div
                key={t.id}
                className="group relative flex flex-col justify-between overflow-hidden bg-zinc-950/90 border border-white/10 hover:border-emerald-500/40 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5"
              >
                <div>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  {attempted && (
                    <div className="px-4 pt-4">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400">
                          <CheckCircle2 size={14} /> ATTEMPTED ({t.attempt_count})
                        </span>
                        <span className="text-xs text-zinc-300">
                          Score: <b className="text-white">{latestScore}</b>/{maxMarks}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        {t.category}
                      </span>
                      {t.stream && (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                          {t.stream}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-black leading-snug text-white mt-3 line-clamp-2">
                      {t.title}
                    </h2>

                    {t.topics?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.topics.slice(0, 4).map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] border border-white/5 px-2 py-1 text-[10px] font-bold text-zinc-400"
                          >
                            <BookOpen size={11} className="text-emerald-400" />
                            {topic}
                          </span>
                        ))}
                        {t.topics.length > 4 && (
                          <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-zinc-500">
                            +{t.topics.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-5 rounded-xl border border-white/5 bg-white/[0.025] p-3 text-center">
                      <div>
                        <b className="block text-sm text-white">{t.question_count}</b>
                        <span className="text-[10px] text-zinc-500">Questions</span>
                      </div>
                      <div className="border-x border-white/5">
                        <b className="block text-sm text-white">{t.duration_minutes}m</b>
                        <span className="text-[10px] text-zinc-500">Duration</span>
                      </div>
                      <div>
                        <b className="block text-sm text-emerald-400">{t.max_marks}</b>
                        <span className="text-[10px] text-zinc-500">Marks</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 flex gap-2">
                  <Link
                    href={`/psc-exam/${t.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 text-black py-3 text-xs font-black hover:bg-emerald-300 transition"
                  >
                    {attempted ? (
                      <>
                        <RotateCcw size={14} /> Reattempt Exam
                      </>
                    ) : (
                      <>
                        Start Exam <ArrowRight size={14} />
                      </>
                    )}
                  </Link>
                  {attempted && (
                    <Link
                      href={`/psc-exam/${t.id}/analysis`}
                      title="View Detailed Analysis"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 text-xs font-bold text-white hover:bg-white/10 transition"
                    >
                      <Trophy size={14} className="text-amber-400" /> Analysis
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
