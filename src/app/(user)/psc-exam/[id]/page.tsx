'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Bookmark,
  Send,
  Clock3,
  XCircle,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  RotateCcw,
  FileText,
  Eye,
  BookOpen,
  LayoutGrid,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type OptionItem = {
  id?: string;
  key: string;
  text?: string;
  imageUrl?: string;
  html: string;
};

type Q = {
  id: string;
  number: number;
  type: string;
  topic?: string;
  questionText?: string;
  questionImageUrl?: string;
  questionHtml: string;
  options: OptionItem[];
  marks?: number;
  negativeMarks?: number;
};

type PaletteState = 'answered' | 'review' | 'answeredReview' | 'current' | 'unanswered';

const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const formatDuration = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
};

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

export default function PscExamRunner() {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [startAt, setStartAt] = useState(0);
  const [lightMode, setLightMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [requestedQuestion, setRequestedQuestion] = useState<number | null>(null);
  const activeQuestionRef = useRef<string | null>(null);
  const questionStartedAtRef = useRef<number | null>(null);
  const questionTimeRef = useRef<Record<string, number>>({});
  const submittingRef = useRef(false);

  const questions: Q[] = test?.questions || [];
  const q = questions[current];

  // Group sections (e.g. English, Arithmetic, General Studies) so user can jump between sections
  const sections = useMemo(() => {
    const map = new Map<string, { name: string; firstIndex: number; count: number }>();
    questions.forEach((item: Q, idx: number) => {
      const sec = String(item.topic || '').trim() || 'General';
      const existing = map.get(sec);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(sec, { name: sec, firstIndex: idx, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [questions]);

  useEffect(() => {
    if (!id) {
      toast.error('Invalid exam link.');
      router.replace('/psc-exam');
      return;
    }

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Please sign in first.');
          router.replace('/login');
          return;
        }

        const res = await fetch(`/api/psc-exam/load?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const d = await res.json();

        if (!res.ok || !d.test) {
          toast.error(d.error || 'Exam unavailable or deleted.');
          router.replace('/psc-exam');
          return;
        }

        setTest(d.test);
        const requested = Number(searchParams.get('question') || '');
        if (Number.isFinite(requested) && requested > 0) {
          const idx = (d.test.questions || []).findIndex(
            (item: Q) => Number(item.number) === requested
          );
          if (idx >= 0) {
            setCurrent(idx);
            setRequestedQuestion(requested);
          }
        }
        setRemaining(Number(d.test.duration_minutes || 45) * 60);
      } catch (error) {
        console.error('Examination load failed:', error);
        toast.error('Unable to load examination.');
        router.replace('/psc-exam');
      }
    })();
  }, [id, router, searchParams]);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(Boolean(document.fullscreenElement));
    } catch {
      setIsFullscreen(false);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const flushQuestionTime = useCallback(() => {
    const qid = activeQuestionRef.current;
    const startedAt = questionStartedAtRef.current;
    if (!qid || startedAt === null) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (elapsed > 0) {
      questionTimeRef.current[qid] = (questionTimeRef.current[qid] || 0) + elapsed;
    }
    questionStartedAtRef.current = Date.now();
  }, []);

  const submitTest = useCallback(
    async (auto = false) => {
      if (submittingRef.current || submitted) return;
      if (!auto && !showSubmitModal) {
        setShowSubmitModal(true);
        return;
      }
      setShowSubmitModal(false);
      setShowMobilePalette(false);

      flushQuestionTime();
      submittingRef.current = true;
      setSubmitted(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        submittingRef.current = false;
        setSubmitted(false);
        return;
      }

      try {
        const res = await fetch('/api/psc-exam/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            testId: id,
            answers,
            timeSpentSeconds: Math.max(0, Math.floor((Date.now() - startAt) / 1000)),
            questionTimeSeconds: questionTimeRef.current,
            markedForReview: marked,
            bookmarked,
          }),
        });

        const d = await res.json();
        if (!res.ok) {
          toast.error(d.error || 'Submission failed');
          submittingRef.current = false;
          setSubmitted(false);
          return;
        }

        setResult(d);
        await exitFullscreen();
      } catch (error) {
        console.error('Submission failed:', error);
        toast.error('Submission failed. Please try again.');
        submittingRef.current = false;
        setSubmitted(false);
      }
    },
    [
      id,
      startAt,
      submitted,
      flushQuestionTime,
      answers,
      marked,
      bookmarked,
      exitFullscreen,
      showSubmitModal,
    ]
  );

  useEffect(() => {
    if (!started || submitted) return;
    const timer = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(timer);
          void submitTest(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, submitted, submitTest]);

  useEffect(() => {
    if (!started || submitted || !questions.length) return;
    const qid = questions[current]?.id;
    if (!qid) return;
    flushQuestionTime();
    activeQuestionRef.current = qid;
    questionStartedAtRef.current = Date.now();

    return () => {
      flushQuestionTime();
    };
  }, [current, started, submitted, test, flushQuestionTime, questions]);

  useEffect(() => {
    if (!started || submitted) return;
    const onVisibility = () => {
      if (document.hidden) {
        flushQuestionTime();
        questionStartedAtRef.current = null;
      } else if (activeQuestionRef.current) {
        questionStartedAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [started, submitted, flushQuestionTime]);

  const toggle = (key: string) => {
    if (!q || submitted) return;
    setAnswers((a) => {
      const old = a[q.id] || [];
      if (q.type === 'MSQ') {
        return {
          ...a,
          [q.id]: old.includes(key) ? old.filter((x: string) => x !== key) : [...old, key],
        };
      }
      return { ...a, [q.id]: old.includes(key) ? [] : [key] };
    });
  };

  const clearResponse = () => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: [] }));
  };

  const toggleMark = () => {
    if (!q) return;
    setMarked((m) => ({ ...m, [q.id]: !m[q.id] }));
  };

  const toggleBookmark = () => {
    if (!q || submitted) return;
    setBookmarked((b) => ({ ...b, [q.id]: !b[q.id] }));
  };

  const goTo = (index: number) => {
    flushQuestionTime();
    setCurrent(Math.max(0, Math.min(questions.length - 1, index)));
    setShowMobilePalette(false);
  };

  const startExam = async () => {
    setStarted(true);
    setStartAt(Date.now());
    await enterFullscreen();
  };

  const paletteState = (x: Q, i: number): PaletteState => {
    if (i === current) return 'current';
    if (marked[x.id] && (answers[x.id] || []).length > 0) return 'answeredReview';
    if (marked[x.id]) return 'review';
    if ((answers[x.id] || []).length > 0) return 'answered';
    return 'unanswered';
  };

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-emerald-400">
        Loading examination...
      </div>
    );
  }

  // Fully Scrollable & Mobile Responsive Pre-Exam Instruction Screen
  if (!started) {
    return (
      <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-zinc-950 text-white px-4 py-6 sm:px-6 sm:py-10">
        <div className="w-full max-w-3xl mx-auto pb-10">
          <div className="text-center mb-5 sm:mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1.5 text-[11px] font-black text-emerald-400">
              <FileText size={14} /> PSC / GATE CBT EXAMINATION
            </div>
            <h1 className="mt-3 text-xl sm:text-3xl md:text-4xl font-black tracking-tight leading-snug">
              {test.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              {test.category && (
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-zinc-300">
                  {test.category}
                </span>
              )}
              {test.stream && (
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-black text-cyan-300">
                  Stream: {test.stream}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/90 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/10">
              <InfoStat label="Questions" value={String(test.question_count)} />
              <InfoStat label="Duration" value={`${test.duration_minutes} min`} />
              <InfoStat label="Total Marks" value={String(test.max_marks)} />
              <InfoStat label="Mode" value="CBT Timed" />
            </div>

            <div className="p-5 sm:p-8">
              {sections.length > 1 && (
                <div className="mb-5">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
                    Exam Sections
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sections.map((sec) => (
                      <span
                        key={sec.name}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-300"
                      >
                        {sec.name}: {sec.count} Qs
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <h2 className="font-black text-lg sm:text-xl">Before You Begin</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
                <Instruction
                  icon={<Clock3 size={16} />}
                  text="The countdown timer starts immediately when you start the exam."
                />
                <Instruction
                  icon={<Maximize2 size={16} />}
                  text="Works seamlessly on both mobile phones and desktop fullscreen CBT mode."
                />
                <Instruction
                  icon={<Eye size={16} />}
                  text="Section-wise score, accuracy, and weak-area diagnosis are generated after submission."
                />
                <Instruction
                  icon={<Flag size={16} />}
                  text={
                    requestedQuestion
                      ? `Starting on Question ${requestedQuestion}. Use the Question Palette to jump to any question.`
                      : 'Use Mark for Review and the Question Palette to jump to any question.'
                  }
                />
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs sm:text-sm text-amber-200 leading-relaxed">
                Each question displays its exact positive and negative marks in the header bar.
                Unattempted questions carry zero marks.
              </div>

              <button
                onClick={startExam}
                className="mt-6 w-full rounded-2xl bg-emerald-400 py-4 text-sm sm:text-base font-black text-black hover:bg-emerald-300 active:scale-[0.99] transition shadow-lg shadow-emerald-500/20"
              >
                Start Examination
              </button>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => router.push(`/psc-exam/${id}/analysis`)}
                  className="w-full rounded-2xl border border-white/10 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/5"
                >
                  View Previous Results
                </button>
                <button
                  onClick={() => router.push('/psc-exam')}
                  className="w-full rounded-2xl border border-white/10 py-3 text-xs sm:text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  Back to PSC Exam Tests
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted && result) return <Result test={test} result={result} />;

  const answeredCount = questions.filter((x: Q) => (answers[x.id] || []).length > 0).length;
  const reviewCount = questions.filter((x: Q) => marked[x.id]).length;
  const unansweredCount = questions.length - answeredCount;
  const currentSection = String(q?.topic || '').trim() || 'General';

  return (
    <div
      className={
        lightMode
          ? 'min-h-[100dvh] flex flex-col bg-slate-100 text-slate-900'
          : 'min-h-[100dvh] flex flex-col bg-[#202020] text-white'
      }
    >
      {/* Top Exam Header Bar — Mobile & Desktop Responsive */}
      <header
        className={
          lightMode
            ? 'sticky top-0 z-50 bg-white border-b border-slate-300 shadow-sm'
            : 'sticky top-0 z-50 bg-[#1b1b1b] border-b border-white/10 shadow-lg'
        }
      >
        <div className="min-h-14 flex items-center justify-between px-2.5 sm:px-5 py-2 gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-black text-xs sm:text-sm truncate">{test.title}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-60 truncate">
              {test.category || 'PSC Exam'} {test.stream ? `• ${test.stream}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setShowQuestionPaper(true)}
              className={
                lightMode
                  ? 'hidden md:inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold hover:bg-slate-100'
                  : 'hidden md:inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10'
              }
            >
              <FileText size={14} /> Paper
            </button>

            <button
              onClick={() => setLightMode((v) => !v)}
              title={lightMode ? 'Dark mode' : 'Light mode'}
              className={
                lightMode
                  ? 'rounded-lg border border-slate-300 p-2 hover:bg-slate-100'
                  : 'rounded-lg border border-white/10 p-2 hover:bg-white/10'
              }
            >
              {lightMode ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            <button
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className={
                lightMode
                  ? 'hidden sm:inline-flex rounded-lg border border-slate-300 p-2'
                  : 'hidden sm:inline-flex rounded-lg border border-white/10 p-2'
              }
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <div
              className={`rounded-lg px-2.5 py-1.5 text-center font-mono text-xs sm:text-sm font-black tracking-wider border ${
                remaining <= 300
                  ? 'bg-red-600 border-red-500 text-white animate-pulse'
                  : lightMode
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-[#292929] border-white/10 text-white'
              }`}
            >
              {formatClock(remaining)}
            </div>

            <button
              onClick={() => setShowMobilePalette(true)}
              className="lg:hidden inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-black text-white"
              title="Open Question Palette"
            >
              <LayoutGrid size={14} />
              <span>
                {answeredCount}/{questions.length}
              </span>
            </button>

            <button
              onClick={() => void submitTest(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500"
            >
              <Send size={13} /> <span className="hidden sm:inline">SUBMIT</span>
              <span className="sm:hidden">Submit</span>
            </button>
          </div>
        </div>

        {/* Sub-Header: Section Tabs & Question Marks */}
        <div
          className={
            lightMode
              ? 'min-h-10 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-1.5 text-xs font-bold'
              : 'min-h-10 bg-[#292929] border-t border-white/5 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-1.5 text-xs font-bold'
          }
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full">
            {sections.length > 1 ? (
              sections.map((sec) => {
                const activeSec = currentSection === sec.name;
                return (
                  <button
                    key={sec.name}
                    type="button"
                    onClick={() => goTo(sec.firstIndex)}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                      activeSec
                        ? 'bg-[#1d4ed8] text-white shadow-sm'
                        : lightMode
                          ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-200'
                          : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {sec.name} ({sec.count})
                  </button>
                );
              })
            ) : (
              <span className="rounded-md bg-[#1d4ed8] text-white px-2.5 py-1 text-[11px] font-black">
                {q?.topic || test.category || 'General'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] sm:text-xs ml-auto">
            <span className="opacity-75">
              Q {current + 1}/{questions.length}
            </span>
            <span>
              | <b className="text-emerald-500">+{Number(q?.marks || 1).toFixed(2)}</b>
            </span>
            {Number(q?.negativeMarks || 0) > 0 && (
              <span>
                / <b className="text-red-500">−{Number(q?.negativeMarks || 0).toFixed(2)}</b>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main CBT Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="min-w-0 flex-1 overflow-y-auto pb-24 lg:pb-8 custom-scrollbar">
          <div
            className={
              lightMode
                ? 'px-3 sm:px-6 py-2.5 border-b border-slate-300 flex items-center justify-between text-xs sm:text-sm font-bold'
                : 'px-3 sm:px-6 py-2.5 border-b border-white/10 flex items-center justify-between text-xs sm:text-sm font-bold'
            }
          >
            <div className="flex items-center gap-2">
              <span>Question No.: {q?.number}</span>
              <span className="rounded bg-current/10 px-2 py-0.5 text-[10px] font-black uppercase">
                {q?.type}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowQuestionPaper(true)}
                className="md:hidden underline text-xs text-blue-400"
              >
                Full Paper
              </button>
              <span className="font-mono text-xs opacity-75">
                Time: {formatDuration(questionTimeRef.current[q?.id || ''] || 0)}
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-6">
            <div
              className={
                lightMode
                  ? 'rounded-2xl bg-white border border-slate-300 shadow-sm p-4 sm:p-7'
                  : 'rounded-2xl bg-[#242424] border border-white/10 shadow-xl p-4 sm:p-7'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-current/10">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      lightMode
                        ? 'rounded-lg bg-slate-100 border border-slate-300 px-2.5 py-1 text-xs font-black'
                        : 'rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-black'
                    }
                  >
                    Q{q?.number}
                  </span>
                  {q?.topic && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-400">
                      <BookOpen size={13} /> {q.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMark}
                    className={
                      marked[q?.id || '']
                        ? 'flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-black text-white'
                        : lightMode
                          ? 'flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black'
                          : 'flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black'
                    }
                  >
                    <Flag size={14} /> {marked[q?.id || ''] ? 'Marked' : 'Review'}
                  </button>
                  <button
                    onClick={toggleBookmark}
                    className={
                      bookmarked[q?.id || '']
                        ? 'flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-black'
                        : lightMode
                          ? 'flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black'
                          : 'flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-black'
                    }
                  >
                    <Bookmark size={14} fill={bookmarked[q?.id || ''] ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">
                      {bookmarked[q?.id || ''] ? 'Bookmarked' : 'Bookmark'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Question Text & Image with full <u> underline support */}
              {q?.questionHtml ? (
                <div
                  className={
                    lightMode
                      ? 'mt-5 prose max-w-none text-sm sm:text-base leading-7 text-slate-800 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4'
                      : 'mt-5 prose prose-invert max-w-none text-sm sm:text-base leading-7 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4'
                  }
                  dangerouslySetInnerHTML={{ __html: renderExamHtml(q.questionHtml) }}
                />
              ) : (
                <div className="mt-5 space-y-4">
                  <div
                    className="text-sm sm:text-base leading-7 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4"
                    dangerouslySetInnerHTML={{
                      __html: renderExamHtml(q?.questionText || ''),
                    }}
                  />
                  {q?.questionImageUrl && (
                    <div>
                      <img
                        src={q.questionImageUrl}
                        alt={`Question ${q.number}`}
                        loading="lazy"
                        className="max-w-full max-h-[380px] h-auto rounded-xl border border-white/10 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Options or NAT Input */}
              {q?.type === 'NAT' ? (
                <div className="mt-6 max-w-md">
                  <label className="text-xs font-black uppercase tracking-widest opacity-60">
                    Numerical Answer (NAT)
                  </label>
                  <input
                    inputMode="decimal"
                    value={(answers[q.id] || [])[0] || ''}
                    onChange={(e) =>
                      setAnswers((a) => ({
                        ...a,
                        [q.id]: e.target.value ? [e.target.value] : [],
                      }))
                    }
                    placeholder="Enter numerical answer (e.g. 2)"
                    className={
                      lightMode
                        ? 'mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono font-bold outline-none focus:border-blue-500'
                        : 'mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 font-mono font-bold text-white outline-none focus:border-blue-500'
                    }
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-2.5">
                  {q?.options?.map((o: OptionItem) => {
                    const optKey = String(o.key || o.id || '');
                    const selected = (answers[q.id] || []).includes(optKey);
                    return (
                      <button
                        key={optKey}
                        onClick={() => toggle(optKey)}
                        className={
                          selected
                            ? 'w-full text-left flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border-2 border-blue-500 bg-blue-500/10'
                            : lightMode
                              ? 'w-full text-left flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100'
                              : 'w-full text-left flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border border-white/10 bg-white/[.02] hover:bg-white/[.05]'
                        }
                      >
                        <span
                          className={
                            selected
                              ? 'w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black'
                              : lightMode
                                ? 'w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full border border-slate-400 flex items-center justify-center text-xs font-black'
                                : 'w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full border border-zinc-600 flex items-center justify-center text-xs font-black'
                          }
                        >
                          {optKey}
                        </span>
                        <span
                          className="text-sm leading-6 flex-1 break-words [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4"
                          dangerouslySetInnerHTML={{
                            __html: renderExamHtml(o.html || o.text || ''),
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Desktop Action Buttons */}
              <div className="hidden lg:flex mt-8 flex-wrap items-center justify-between gap-3 pt-4 border-t border-current/10">
                <button
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                  className="flex items-center gap-2 rounded-xl border border-current/20 px-4 py-3 text-sm font-bold disabled:opacity-30"
                >
                  <ChevronLeft size={17} /> Previous
                </button>

                <div className="flex gap-2.5">
                  <button
                    onClick={clearResponse}
                    className="flex items-center gap-2 rounded-xl border border-current/20 px-4 py-3 text-sm font-bold opacity-80 hover:opacity-100"
                  >
                    <RotateCcw size={15} /> Clear Response
                  </button>
                  {current < questions.length - 1 ? (
                    <button
                      onClick={() => goTo(current + 1)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-500"
                    >
                      Save &amp; Next <ChevronRight size={17} />
                    </button>
                  ) : (
                    <button
                      onClick={() => void submitTest(false)}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-black hover:bg-emerald-400"
                    >
                      <Send size={16} /> Finish &amp; Submit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Desktop Right Sidebar Question Palette */}
        <aside
          className={
            lightMode
              ? 'hidden lg:block w-[330px] shrink-0 overflow-y-auto bg-white border-l border-slate-300'
              : 'hidden lg:block w-[330px] shrink-0 overflow-y-auto bg-[#f1f7fb] text-slate-900 border-l border-black/10'
          }
        >
          <PaletteContent
            testTitle={test.title}
            questions={questions}
            paletteState={paletteState}
            goTo={goTo}
            answeredCount={answeredCount}
            reviewCount={reviewCount}
            unansweredCount={unansweredCount}
            onSubmit={() => void submitTest(false)}
          />
        </aside>
      </div>

      {/* Sticky Mobile Bottom Action Bar */}
      <div
        className={
          lightMode
            ? 'lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-300 px-3 py-2.5 flex items-center justify-between gap-2 shadow-2xl'
            : 'lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#181818]/95 backdrop-blur-md border-t border-white/10 px-3 py-2.5 flex items-center justify-between gap-2 shadow-2xl'
        }
      >
        <button
          disabled={current === 0}
          onClick={() => goTo(current - 1)}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-current/20 px-3 py-2.5 text-xs font-black disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        <button
          onClick={clearResponse}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-current/20 px-3 py-2.5 text-xs font-bold opacity-80"
        >
          <RotateCcw size={14} /> Clear
        </button>

        <button
          onClick={() => setShowMobilePalette(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2.5 text-xs font-black text-blue-400"
        >
          <LayoutGrid size={14} /> Palette
        </button>

        {current < questions.length - 1 ? (
          <button
            onClick={() => goTo(current + 1)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white"
          >
            Save &amp; Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => void submitTest(false)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-black"
          >
            <Send size={14} /> Submit
          </button>
        )}
      </div>

      {/* Mobile Slide-Over Question Palette Drawer */}
      {showMobilePalette && (
        <div className="lg:hidden fixed inset-0 z-[115] flex justify-end">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMobilePalette(false)}
          />
          <div className="relative z-10 w-[320px] max-w-[88vw] h-full bg-[#f1f7fb] text-slate-900 overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
              <span className="font-black text-sm text-slate-900">Question Palette</span>
              <button
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <PaletteContent
              testTitle={test.title}
              questions={questions}
              paletteState={paletteState}
              goTo={goTo}
              answeredCount={answeredCount}
              reviewCount={reviewCount}
              unansweredCount={unansweredCount}
              onSubmit={() => void submitTest(false)}
            />
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl my-auto overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <Send size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">Submit Examination</h2>
                  <p className="text-xs text-slate-500">
                    Review your attempt summary before final submission.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              {unansweredCount > 0 && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm text-amber-900">
                  <b>Attention:</b> You still have {unansweredCount} unanswered question
                  {unansweredCount === 1 ? '' : 's'}.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <ModalStat label="Answered" value={answeredCount} cls="text-emerald-600" />
                <ModalStat label="Unanswered" value={unansweredCount} cls="text-amber-600" />
                <ModalStat label="Review" value={reviewCount} cls="text-violet-600" />
                <ModalStat
                  label="Remaining"
                  value={formatClock(remaining)}
                  cls="text-blue-600 font-mono"
                />
              </div>
              <p className="mt-4 text-xs sm:text-sm leading-6 text-slate-600">
                Once submitted, your answers and section-wise performance will be evaluated and
                saved.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-xs sm:text-sm font-black hover:bg-slate-50"
                >
                  Return to Examination
                </button>
                <button
                  onClick={() => void submitTest(false)}
                  className="rounded-xl bg-red-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-sm hover:bg-red-700"
                >
                  Submit Examination
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Question Paper Modal */}
      {showQuestionPaper && (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm p-2 sm:p-6">
          <div
            className={
              lightMode
                ? 'h-full w-full overflow-hidden rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-2xl flex flex-col'
                : 'h-full w-full overflow-hidden rounded-2xl bg-[#181818] text-white border border-white/10 shadow-2xl flex flex-col'
            }
          >
            <div
              className={
                lightMode
                  ? 'flex items-center justify-between gap-4 border-b border-slate-300 bg-white px-4 py-3.5'
                  : 'flex items-center justify-between gap-4 border-b border-white/10 bg-[#181818] px-4 py-3.5'
              }
            >
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                  Question Paper
                </div>
                <h2 className="mt-0.5 text-sm sm:text-lg font-black truncate">{test.title}</h2>
              </div>
              <button
                onClick={() => setShowQuestionPaper(false)}
                className={
                  lightMode
                    ? 'rounded-lg border border-slate-300 p-2 hover:bg-slate-100'
                    : 'rounded-lg border border-white/10 p-2 hover:bg-white/10'
                }
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
              <div className="mx-auto max-w-5xl space-y-4">
                {questions.map((question: Q, idx: number) => (
                  <article
                    key={question.id}
                    className={
                      lightMode
                        ? 'rounded-2xl border border-slate-300 bg-slate-50 p-4 sm:p-6'
                        : 'rounded-2xl border border-white/10 bg-[#222] p-4 sm:p-6'
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm">Question {question.number}</span>
                        {question.topic && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                            {question.topic}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold opacity-75">
                        <span>{question.type}</span>
                        <span className="text-emerald-500">
                          +{Number(question.marks || 1).toFixed(2)}
                        </span>
                        {Number(question.negativeMarks || 0) > 0 && (
                          <span className="text-red-500">
                            −{Number(question.negativeMarks || 0).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setShowQuestionPaper(false);
                            goTo(idx);
                          }}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white"
                        >
                          Jump
                        </button>
                      </div>
                    </div>

                    <div
                      className={
                        lightMode
                          ? 'prose max-w-none mt-4 text-sm leading-7 text-slate-800 [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4'
                          : 'prose prose-invert max-w-none mt-4 text-sm leading-7 [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4'
                      }
                      dangerouslySetInnerHTML={{
                        __html: renderExamHtml(
                          question.questionHtml || question.questionText || ''
                        ),
                      }}
                    />

                    {question.type === 'NAT' ? (
                      <div className="mt-4 rounded-xl border border-current/10 p-3 text-xs opacity-70">
                        Numerical Answer Question
                      </div>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {question.options?.map((option: OptionItem) => (
                          <div
                            key={option.key}
                            className={
                              lightMode
                                ? 'flex gap-3 rounded-xl border border-slate-300 bg-white p-3'
                                : 'flex gap-3 rounded-xl border border-white/10 bg-black/10 p-3'
                            }
                          >
                            <span className="shrink-0 font-black text-xs">{option.key}.</span>
                            <span
                              className="text-xs sm:text-sm leading-6 [&_u]:underline [&_u]:decoration-2 [&_u]:underline-offset-4"
                              dangerouslySetInnerHTML={{
                                __html: renderExamHtml(option.html || option.text || ''),
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaletteContent({
  testTitle,
  questions,
  paletteState,
  goTo,
  answeredCount,
  reviewCount,
  unansweredCount,
  onSubmit,
}: {
  testTitle: string;
  questions: Q[];
  paletteState: (x: Q, i: number) => PaletteState;
  goTo: (index: number) => void;
  answeredCount: number;
  reviewCount: number;
  unansweredCount: number;
  onSubmit: () => void;
}) {
  return (
    <div className="p-4">
      <div className="rounded-xl bg-white p-3.5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="font-black text-xs text-slate-800">Candidate</div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
            LIVE CBT
          </span>
        </div>
        <div className="mt-1.5 text-xs text-slate-500 line-clamp-2">{testTitle}</div>
      </div>

      <div className="mt-3 rounded-xl bg-white p-3.5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <span className="font-black text-xs text-slate-800">
            Questions ({questions.length})
          </span>
          <Flag size={15} className="text-violet-600" />
        </div>

        <div className="grid grid-cols-5 gap-2 max-h-[340px] overflow-y-auto pr-1">
          {questions.map((x: Q, i: number) => {
            const state = paletteState(x, i);
            const cls =
              state === 'current'
                ? 'bg-blue-600 border-blue-700 text-white ring-2 ring-blue-200 ring-offset-1'
                : state === 'answeredReview'
                  ? 'bg-violet-600 border-violet-700 text-white'
                  : state === 'review'
                    ? 'bg-violet-100 border-violet-500 text-violet-800'
                    : state === 'answered'
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';

            return (
              <button
                key={x.id}
                onClick={() => goTo(i)}
                className={`h-9 rounded-lg border text-xs font-black ${cls}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <Legend cls="bg-emerald-500" text={`Answered (${answeredCount})`} />
          <Legend cls="bg-violet-600" text={`Marked (${reviewCount})`} />
          <Legend cls="bg-violet-100 border border-violet-500" text="Answered + Review" />
          <Legend
            cls="bg-white border border-slate-300"
            text={`Not Answered (${unansweredCount})`}
          />
          <Legend cls="bg-blue-600" text="Current" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Answered" value={answeredCount} />
        <MiniStat label="Review" value={reviewCount} />
        <MiniStat label="Left" value={unansweredCount} />
      </div>

      <button
        onClick={onSubmit}
        className="mt-4 w-full rounded-xl bg-red-600 py-3.5 text-xs sm:text-sm font-black text-white hover:bg-red-500"
      >
        Submit Examination
      </button>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3.5 sm:p-5 border-r border-b sm:border-b-0 border-white/10 last:border-r-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 font-black text-base sm:text-lg">{value}</div>
    </div>
  );
}

function Instruction({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3.5">
      <span className="mt-0.5 text-emerald-400 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 shrink-0 rounded-sm ${cls}`} />
      <span className="truncate">{text}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-2.5 text-center border border-slate-200">
      <div className="text-base font-black text-slate-900">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function Result({ test, result }: { test: any; result: any }) {
  const router = useRouter();
  const attempted = Number(result.correct || 0) + Number(result.incorrect || 0);
  const maxMarks = Number(result.maxMarks || 0);
  const score = Number(result.score || 0);
  const percentage = maxMarks > 0 ? Math.max(0, Math.min(100, (score / maxMarks) * 100)) : 0;

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              PSC Examination Result
            </div>
            <h1 className="mt-1 text-base sm:text-lg font-black truncate">{test.title}</h1>
          </div>
          <div className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
            SUBMITTED ✓
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-8 pb-16">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Your Score
                </div>
                <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
                  {score.toFixed(2)}{' '}
                  <span className="text-lg sm:text-xl font-bold text-slate-400">
                    / {maxMarks.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 text-xs sm:text-sm text-slate-500">
                  {percentage.toFixed(1)}% of maximum marks
                </div>
              </div>
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-[8px] border-blue-100 flex items-center justify-center text-center">
                <span className="text-lg sm:text-xl font-black text-blue-700">
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat label="Correct" value={String(result.correct || 0)} cls="text-emerald-600" />
              <SummaryStat label="Incorrect" value={String(result.incorrect || 0)} cls="text-red-600" />
              <SummaryStat
                label="Not Answered"
                value={String(result.notAnswered || 0)}
                cls="text-amber-600"
              />
              <SummaryStat label="Attempted" value={String(attempted)} cls="text-blue-600" />
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              Next Step
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-black">Section-wise &amp; Solution Review</h2>
            <p className="mt-2 text-xs sm:text-sm leading-6 text-slate-500">
              Open detailed analysis to see your section-wise scores (English, Arithmetic, General
              Studies, etc.), identify weak sections, and read question explanations.
            </p>
            <button
              onClick={() =>
                router.replace(`/psc-exam/${test.id}/analysis?attempt=${result.attemptId}`)
              }
              className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white hover:bg-blue-700"
            >
              Analyse Attempt &amp; Solutions
            </button>
            <button
              onClick={() => router.replace('/psc-exam')}
              className="mt-3 w-full rounded-xl border border-slate-300 py-3.5 text-sm font-bold hover:bg-slate-50"
            >
              Back to PSC Exam Tests
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

function ModalStat({
  label,
  value,
  cls,
}: {
  label: string;
  value: number | string;
  cls: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <div className={`text-base sm:text-lg font-black ${cls}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 sm:p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl sm:text-2xl font-black mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
