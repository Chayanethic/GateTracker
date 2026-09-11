'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  /**
   * Load the complete question-bank structure.
   *
   * Important:
   * We intentionally fetch this again whenever the page becomes active
   * so that attempted/saved/progress values are not stale after returning
   * from a chapter.
   */
  const loadStructure = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSubjects([]);
        setSelectedSubject(null);
        setLoading(false);
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

      setSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
    } catch (error) {
      console.error('Failed to load question bank structure:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Initial structure load.
   */
  useEffect(() => {
    void loadStructure(true);
  }, [loadStructure]);

  /**
   * Refresh whenever the user comes back to this page/tab.
   *
   * This fixes the situation where a question was attempted inside
   * a chapter but the subject/chapter progress on this page still
   * displayed the old values.
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, [loadStructure]);

  /**
   * Keep selected subject synchronized with the URL.
   *
   * useSearchParams is important here because router.push()
   * does not necessarily trigger a browser popstate event.
   */
  useEffect(() => {
    if (!subjectIdFromUrl) {
      setSelectedSubject(null);
      return;
    }

    if (!subjects.length) {
      return;
    }

    const match = subjects.find(
      (subject) => String(subject.id) === String(subjectIdFromUrl)
    );

    setSelectedSubject(match || null);
  }, [subjectIdFromUrl, subjects]);

  /**
   * Search subjects and their chapters.
   */
  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return subjects;
    }

    return subjects.filter((subject) => {
      const subjectMatches = subject.name
        .toLowerCase()
        .includes(query);

      const chapterMatches = (subject.chapters || []).some((chapter) =>
        chapter.name.toLowerCase().includes(query)
      );

      return subjectMatches || chapterMatches;
    });
  }, [subjects, search]);

  /**
   * Total saved questions across all subjects.
   */
  const totalSaved = useMemo(() => {
    return subjects.reduce(
      (total, subject) => total + Number(subject.saved_count || 0),
      0
    );
  }, [subjects]);

  /**
   * Subject details page.
   */
  if (selectedSubject) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link
              href="/question-bank"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All Subjects
            </Link>
          </div>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <BookOpen className="h-6 w-6" />
                  </div>

                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedSubject.name}
                    </h1>

                    {selectedSubject.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {selectedSubject.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  label="Questions"
                  value={Number(selectedSubject.total_questions || 0)}
                />

                <Metric
                  label="Attempted"
                  value={Number(selectedSubject.attempted_count || 0)}
                />

                <Metric
                  label="Remaining"
                  value={Number(selectedSubject.remaining_count || 0)}
                />

                <Metric
                  label="Saved"
                  value={Number(selectedSubject.saved_count || 0)}
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Overall Progress
                </span>

                <span className="font-semibold text-slate-900 dark:text-white">
                  {Number(selectedSubject.progress_percent || 0)}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Number(selectedSubject.progress_percent || 0)
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <TypeBadge
                label="MCQ"
                value={Number(selectedSubject.mcq_count || 0)}
              />

              <TypeBadge
                label="MSQ"
                value={Number(selectedSubject.msq_count || 0)}
              />

              <TypeBadge
                label="NAT"
                value={Number(selectedSubject.nat_count || 0)}
              />

              <TypeBadge
                label="Saved"
                value={Number(selectedSubject.saved_count || 0)}
                icon={<Bookmark className="h-3.5 w-3.5" />}
              />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Chapters
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose a chapter to practice questions.
                </p>
              </div>
            </div>

            {selectedSubject.chapters?.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedSubject.chapters.map((chapter) => (
                  <Link
                    key={chapter.id}
                    href={`/question-bank/chapter/${encodeURIComponent(
                      chapter.id
                    )}?subjectId=${encodeURIComponent(selectedSubject.id)}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                          {chapter.name}
                        </h3>

                        {chapter.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                            {chapter.description}
                          </p>
                        )}
                      </div>

                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <SmallMetric
                        label="Total"
                        value={Number(chapter.question_count || 0)}
                      />

                      <SmallMetric
                        label="Attempted"
                        value={Number(chapter.attempted_count || 0)}
                      />

                      <SmallMetric
                        label="Remaining"
                        value={Number(chapter.remaining_count || 0)}
                      />
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          Progress
                        </span>

                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {Number(chapter.progress_percent || 0)}%
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                Number(chapter.progress_percent || 0)
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <TypeBadge
                        label="MCQ"
                        value={Number(chapter.mcq_count || 0)}
                      />

                      <TypeBadge
                        label="MSQ"
                        value={Number(chapter.msq_count || 0)}
                      />

                      <TypeBadge
                        label="NAT"
                        value={Number(chapter.nat_count || 0)}
                      />

                      {Number(chapter.saved_count || 0) > 0 && (
                        <TypeBadge
                          label="Saved"
                          value={Number(chapter.saved_count || 0)}
                          icon={<Bookmark className="h-3.5 w-3.5" />}
                        />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="No published chapters are available for this subject yet." />
            )}
          </section>
        </div>
      </main>
    );
  }

  /**
   * Main Question Bank home page.
   */
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <BookOpen className="h-6 w-6" />
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Question Bank
                  </h1>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Practice questions chapter by chapter and track your
                    progress.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/question-bank/saved"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
            >
              <Bookmark className="h-4 w-4" />
              Saved Questions
              {totalSaved > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {totalSaved}
                </span>
              )}
            </Link>
          </div>

          <div className="mt-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search subject or chapter..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Question Bank...
            </div>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? 'No subjects or chapters match your search.'
                : 'No published subjects are available yet.'
            }
          />
        ) : (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  All Subjects
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {filteredSubjects.length}{' '}
                  {filteredSubjects.length === 1
                    ? 'subject'
                    : 'subjects'}{' '}
                  available
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/question-bank?subjectId=${encodeURIComponent(
                    subject.id
                  )}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        <BookOpen className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                          {subject.name}
                        </h3>

                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {subject.chapters?.length || 0}{' '}
                          {subject.chapters?.length === 1
                            ? 'chapter'
                            : 'chapters'}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                  </div>

                  {subject.description && (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      {subject.description}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <SmallMetric
                      label="Questions"
                      value={Number(subject.total_questions || 0)}
                    />

                    <SmallMetric
                      label="Attempted"
                      value={Number(subject.attempted_count || 0)}
                    />

                    <SmallMetric
                      label="Remaining"
                      value={Number(subject.remaining_count || 0)}
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Progress
                      </span>

                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {Number(subject.progress_percent || 0)}%
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(subject.progress_percent || 0)
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <TypeBadge
                      label="MCQ"
                      value={Number(subject.mcq_count || 0)}
                    />

                    <TypeBadge
                      label="MSQ"
                      value={Number(subject.msq_count || 0)}
                    />

                    <TypeBadge
                      label="NAT"
                      value={Number(subject.nat_count || 0)}
                    />

                    {Number(subject.saved_count || 0) > 0 && (
                      <TypeBadge
                        label="Saved"
                        value={Number(subject.saved_count || 0)}
                        icon={<Bookmark className="h-3.5 w-3.5" />}
                      />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function TypeBadge({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {icon}
      {label}: {value}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <BookOpen className="h-6 w-6" />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
          {message}
        </p>
      </div>
    </div>
  );
}
