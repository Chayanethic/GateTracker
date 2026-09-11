'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';

type Chapter = {
  id: string;
  name: string;
  description?: string | null;
  question_count: number;
  attempted_count?: number;
  remaining_count?: number;
  progress_percent?: number;
  is_published: boolean;
  mcq_count?: number;
  msq_count?: number;
  nat_count?: number;
  saved_count?: number;
};

type Subject = {
  id: string;
  name: string;
  description?: string | null;
  chapters: Chapter[];
  total_questions?: number;
  attempted_count?: number;
  remaining_count?: number;
  progress_percent?: number;
  mcq_count?: number;
  msq_count?: number;
  nat_count?: number;
  saved_count?: number;
};

export default function QuestionBankHome() {
  const searchParams = useSearchParams();
  const subjectIdFromUrl = searchParams.get('subjectId');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] =
    useState<Subject | null>(null);

  /*
   * Load latest Question Bank structure.
   *
   * This is the important fix.
   * The chapter page already saves the attempt to the database.
   * We simply fetch the structure again when coming back so that
   * subject/chapter attempted counts and progress are fresh.
   */
  const loadStructure = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSubjects([]);
        setSelectedSubject(null);
        return;
      }

      const response = await fetch('/api/question-bank/structure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          'Failed to load question bank structure:',
          data?.error || response.statusText
        );
        return;
      }

      const freshSubjects = Array.isArray(data?.subjects)
        ? data.subjects
        : [];

      setSubjects(freshSubjects);

      /*
       * If the page was opened from a chapter using:
       *
       * /question-bank?subjectId=...
       *
       * make sure the selected subject also uses the newly
       * fetched progress values.
       */
      if (subjectIdFromUrl) {
        const freshSelectedSubject = freshSubjects.find(
          (subject: Subject) =>
            String(subject.id) === String(subjectIdFromUrl)
        );

        if (freshSelectedSubject) {
          setSelectedSubject(freshSelectedSubject);
        }
      }
    } catch (error) {
      console.error(
        'Failed to load question bank structure:',
        error
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [subjectIdFromUrl]);

  /*
   * Initial load.
   */
  useEffect(() => {
    void loadStructure(true);
  }, [loadStructure]);

  /*
   * Refresh when the Question Bank page becomes visible/focused.
   *
   * This handles cases where the user returns to this page
   * using browser navigation or another tab.
   */
  useEffect(() => {
    const handleFocus = () => {
      void loadStructure(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadStructure(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [loadStructure]);

  /*
   * If chapter page navigates back to:
   *
   * /question-bank?subjectId=...
   *
   * Next.js updates searchParams even when the page component
   * itself is preserved. Make sure the correct subject is selected.
   */
  useEffect(() => {
    if (!subjectIdFromUrl) {
      return;
    }

    const match = subjects.find(
      (subject) =>
        String(subject.id) === String(subjectIdFromUrl)
    );

    if (match) {
      setSelectedSubject(match);
    }
  }, [subjectIdFromUrl, subjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return subjects.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.chapters || []).some((c) =>
          c.name.toLowerCase().includes(q)
        )
    );
  }, [subjects, search]);

  const totalSaved = subjects.reduce(
    (n, s) => n + Number(s.saved_count || 0),
    0
  );

  if (loading)
    return (
      <div className="qb-theme min-h-full flex items-center justify-center text-slate-500">
        <Loader2 className="animate-spin mr-2" />
        Loading Question Bank…
      </div>
    );

  if (selectedSubject) {
    /*
     * Always use the latest subject from `subjects`.
     *
     * This prevents the UI from displaying the old object that
     * was selected before the question was attempted.
     */
    const s =
      subjects.find((x) => x.id === selectedSubject.id) ||
      selectedSubject;

    const chapters = (s.chapters || []).filter(
      (c) =>
        !search.trim() ||
        c.name
          .toLowerCase()
          .includes(search.trim().toLowerCase())
    );

    const total = s.total_questions ?? 0;
    const attempted = s.attempted_count ?? 0;
    const pct =
      s.progress_percent ??
      (total
        ? Math.round((attempted / total) * 100)
        : 0);

    return (
      <div className="qb-theme min-h-full bg-slate-50/70 text-slate-900">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={async () => {
                /*
                 * IMPORTANT:
                 * Refresh before going back to the subject list.
                 *
                 * This is the main fix for:
                 *
                 * Chapter:
                 * Attempted = 1
                 *
                 * but Subject/Home:
                 * Attempted = 0
                 *
                 * The attempt is already stored in DB, so we only
                 * need to reload the structure here.
                 */
                await loadStructure(false);

                setSelectedSubject(null);
                setSearch('');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <span className="text-xs text-slate-400">
              Question Bank /
            </span>

            <span className="text-xs font-bold text-slate-700">
              {s.name}
            </span>
          </div>

          <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                <BookOpen size={21} />
              </div>

              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-black">
                  {s.name}
                </h1>

                <p className="text-sm text-slate-500 mt-1">
                  {s.chapters?.length || 0} chapters • {total}{' '}
                  questions
                </p>
              </div>

              <div className="hidden sm:flex gap-7 text-center">
                <ProgressStat
                  label="Questions"
                  value={total}
                />

                <ProgressStat
                  label="Attempted"
                  value={attempted}
                />

                <ProgressStat
                  label="Remaining"
                  value={Math.max(0, total - attempted)}
                />

                <ProgressStat
                  label="Saved"
                  value={s.saved_count || 0}
                />

                <ProgressStat
                  label="Progress"
                  value={`${pct}%`}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                <span>
                  {attempted}/{total} attempted
                </span>

                <span>{pct}%</span>
              </div>

              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{
                    width: `${pct}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <TypeStat
              label="MCQ"
              value={s.mcq_count || 0}
            />

            <TypeStat
              label="MSQ"
              value={s.msq_count || 0}
            />

            <TypeStat
              label="NAT"
              value={s.nat_count || 0}
            />
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-5 shadow-sm">
            <Search
              size={18}
              className="text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chapters…"
              className="bg-transparent outline-none flex-1 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black">
              Chapters
            </h2>

            <Link
              href="/question-bank/saved"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-black"
            >
              <Bookmark
                size={14}
                fill="currentColor"
              />
              Saved {s.saved_count || 0}
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {chapters.map((c) => {
              const ct = c.question_count || 0;
              const ca = c.attempted_count || 0;

              const cp =
                c.progress_percent ??
                (ct
                  ? Math.round((ca / ct) * 100)
                  : 0);

              return (
                <Link
                  key={c.id}
                  href={`/question-bank/chapter/${c.id}?subjectId=${encodeURIComponent(
                    String(s.id)
                  )}`}
                  className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-300 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-black text-slate-800">
                        {c.name}
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        {ct} questions
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="text-slate-400 group-hover:text-orange-500"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                    <MiniStat
                      label="MCQ"
                      value={c.mcq_count || 0}
                    />

                    <MiniStat
                      label="MSQ"
                      value={c.msq_count || 0}
                    />

                    <MiniStat
                      label="NAT"
                      value={c.nat_count || 0}
                    />

                    <MiniStat
                      label="Saved"
                      value={c.saved_count || 0}
                    />
                  </div>

                  <div className="mt-4 flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <span>
                      {ca}/{ct} attempted
                    </span>

                    <span>{cp}%</span>
                  </div>

                  <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400"
                      style={{
                        width: `${cp}%`,
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          {!chapters.length && (
            <div className="py-16 text-center text-slate-500">
              No matching chapters.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="qb-theme min-h-full bg-slate-50/70 text-slate-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-5">
          <div className="flex items-center gap-3 text-orange-500">
            <BookOpen size={24} />

            <span className="text-xs font-black uppercase tracking-[.3em]">
              Practice Engine
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2">
            Question Bank
          </h1>

          <p className="text-slate-500 mt-2 max-w-2xl">
            Practice chapter-wise and track MCQ, MSQ, NAT,
            attempted and saved questions.
          </p>
        </div>

        <Link
          href="/question-bank/saved"
          className="group flex items-center gap-4 bg-white border border-amber-200 rounded-2xl p-5 mb-6 shadow-sm hover:border-amber-300 transition"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Bookmark
              size={22}
              fill="currentColor"
            />
          </div>

          <div className="flex-1">
            <div className="font-black text-lg">
              Saved Questions
            </div>

            <div className="text-sm text-slate-500 mt-1">
              All questions you bookmarked across every subject.
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-amber-600">
              {totalSaved}
            </div>

            <div className="text-[9px] uppercase font-black tracking-widest text-slate-400">
              Saved
            </div>
          </div>

          <ChevronRight className="text-slate-400 group-hover:text-amber-600" />
        </Link>

        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-7 shadow-sm">
          <Search
            size={18}
            className="text-slate-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects…"
            className="bg-transparent outline-none flex-1 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <h2 className="text-lg font-black mb-3">
          Subjects
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((s) => {
            const total = s.total_questions ?? 0;
            const attempted = s.attempted_count ?? 0;

            const pct =
              s.progress_percent ??
              (total
                ? Math.round(
                    (attempted / total) * 100
                  )
                : 0);

            return (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSubject(s);
                  setSearch('');
                }}
                className="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-orange-300 hover:shadow-md transition"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg">
                        {s.name}
                      </h3>

                      <ChevronRight
                        size={17}
                        className="ml-auto text-slate-400"
                      />
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                      {s.chapters?.length || 0} chapters •{' '}
                      {total} questions
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 mt-5 text-center">
                  <MiniStat
                    label="Questions"
                    value={total}
                  />

                  <MiniStat
                    label="Attempted"
                    value={attempted}
                  />

                  <MiniStat
                    label="MCQ"
                    value={s.mcq_count || 0}
                  />

                  <MiniStat
                    label="MSQ"
                    value={s.msq_count || 0}
                  />

                  <MiniStat
                    label="NAT"
                    value={s.nat_count || 0}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <span>
                    {s.saved_count || 0} saved
                  </span>

                  <span>{pct}% progress</span>
                </div>

                <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500"
                    style={{
                      width: `${pct}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {!filtered.length && (
          <div className="py-20 text-center text-slate-500">
            No matching subjects.
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="text-lg font-black">
        {value}
      </div>

      <div className="text-[9px] uppercase font-black tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="text-sm font-black">
        {value}
      </div>

      <div className="text-[8px] uppercase font-black tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

function TypeStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
      <div className="text-xl font-black">
        {value}
      </div>

      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
        {label}
      </div>
    </div>
  );
}
