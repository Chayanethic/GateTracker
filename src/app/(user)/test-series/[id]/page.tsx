'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft, ChevronRight, Flag, Bookmark, Send, Clock3, XCircle, MinusCircle,
  PlayCircle, Sun, Moon, Maximize2, Minimize2, RotateCcw, HelpCircle,
  FileText, Eye, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

type Q = {
  id: string;
  number: number;
  type: string;
  questionHtml: string;
  options: { key: string; html: string }[];
  answer: string[];
  solutionHtml: string;
  videoUrl?: string;
  marks?: number;
  negativeMarks?: number;
};

type PaletteState = 'answered' | 'review' | 'current' | 'unanswered';

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

export default function TestRunner() {
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
  const [requestedQuestion, setRequestedQuestion] = useState<number | null>(null);
  const activeQuestionRef = useRef<string | null>(null);
  const questionStartedAtRef = useRef<number | null>(null);
  const questionTimeRef = useRef<Record<string, number>>({});
  const submittingRef = useRef(false);

  const questions: Q[] = test?.questions || [];
  const q = questions[current];

  useEffect(() => {
    if (!id) {
      toast.error('Invalid test link.');
      router.replace('/test-series');
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Please sign in first.');
          router.replace('/test-series');
          return;
        }

        const res = await fetch(`/api/test-series/load?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const d = await res.json();

        if (!res.ok || !d.test) {
          toast.error(d.error || 'Test unavailable or deleted.');
          router.replace('/test-series');
          return;
        }

        setTest(d.test);
        const requested = Number(searchParams.get('question') || '');
        if (Number.isFinite(requested) && requested > 0) {
          const idx = (d.test.questions || []).findIndex((item: Q) => Number(item.number) === requested);
          if (idx >= 0) { setCurrent(idx); setRequestedQuestion(requested); }
        }
        setRemaining(Number(d.test.duration_minutes || 0) * 60);
      } catch (error) {
        console.error('Examination load failed:', error);
        toast.error('Unable to load examination.');
        router.replace('/test-series');
      }
    })();
  }, [id, router, searchParams]);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(Boolean(document.fullscreenElement) || true);
    } catch {
      // Fullscreen can be denied by browser policy; the examination remains usable.
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

  const submitTest = useCallback(async (auto = false) => {
    if (submittingRef.current || submitted) return;
    if (!auto && !confirm('Submit test now? You will not be able to change answers.')) return;

    flushQuestionTime();
    submittingRef.current = true;
    setSubmitted(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Session expired. Please sign in again.');
      submittingRef.current = false;
      setSubmitted(false);
      return;
    }

    try {
      const res = await fetch('/api/test-series/submit', {
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

      // Keep the post-submit summary on this page. The candidate can then
      // explicitly open the detailed analysis for the exact submitted attempt.
      setResult(d);
      await exitFullscreen();
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Submission failed. Please try again.');
      submittingRef.current = false;
      setSubmitted(false);
    }
  }, [id, startAt, submitted, flushQuestionTime, router, answers, marked, bookmarked, exitFullscreen]);

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
  }, [current, started, submitted, test, flushQuestionTime]);

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
          [q.id]: old.includes(key) ? old.filter((x) => x !== key) : [...old, key],
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
  };

  const startExam = async () => {
    setStarted(true);
    setStartAt(Date.now());
    await enterFullscreen();
  };

  const paletteState = (x: Q, i: number): PaletteState => {
    if (i === current) return 'current';
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

  if (!started) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-5">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-400">
              <FileText size={15} /> GATE STYLE EXAMINATION
            </div>
            <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight">{test.title}</h1>
            <p className="mt-2 text-zinc-500">{test.exam_name}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/80 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/10">
              <InfoStat label="Questions" value={String(test.question_count)} />
              <InfoStat label="Duration" value={`${test.duration_minutes} min`} />
              <InfoStat label="Maximum Marks" value={String(test.max_marks)} />
              <InfoStat label="Mode" value="Timed" />
            </div>

            <div className="p-6 md:p-9">
              <h2 className="font-black text-xl">Before you begin</h2>
              <div className="mt-5 grid md:grid-cols-2 gap-3 text-sm text-zinc-400">
                <Instruction icon={<Clock3 size={17} />} text="The countdown starts immediately after you start." />
                <Instruction icon={<Maximize2 size={17} />} text="The exam opens in browser fullscreen mode." />
                <Instruction icon={<Eye size={17} />} text="Your time on every question is recorded." />
                <Instruction icon={<Flag size={17} />} text={requestedQuestion ? `You will start on Question ${requestedQuestion}. Use Mark for Review and the question palette to navigate.` : 'Use Mark for Review and the question palette to navigate.'} />
              </div>
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
                MCQ negative marking: 1-mark questions = −0.33 and 2-mark questions = −0.66. MSQ/NAT have no negative marking.
              </div>

              <button
                onClick={startExam}
                className="mt-7 w-full rounded-2xl bg-emerald-400 py-4 text-base font-black text-black hover:bg-emerald-300 transition"
              >
                Start Examination
              </button>

              <button
                onClick={() => router.push(`/test-series/${id}/analysis`)}
                className="mt-3 w-full rounded-2xl border border-white/10 py-3 font-bold text-white hover:bg-white/5"
              >
                View Previous Results
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted && result) return <Result test={test} result={result} />;

  const answeredCount = questions.filter((x) => (answers[x.id] || []).length > 0).length;
  const reviewCount = questions.filter((x) => marked[x.id]).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className={lightMode ? 'min-h-screen bg-slate-100 text-slate-900' : 'min-h-screen bg-[#202020] text-white'}>
      <header className={lightMode ? 'sticky top-0 z-50 bg-white border-b border-slate-300' : 'sticky top-0 z-50 bg-[#202020] border-b border-white/10'}>
        <div className="h-12 flex items-center justify-between px-3 md:px-5 gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="font-black text-sm truncate">{test.exam_name} — {test.title}</div>
          </div>

          <div className="hidden md:flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => setShowQuestionPaper(true)}
              className="px-3 py-2 underline underline-offset-4 hover:text-blue-500"
            >
              Question Paper
            </button>
            <button
              onClick={() => setShowQuestionPaper(true)}
              className="px-3 py-2 underline underline-offset-4 hover:text-blue-500"
            >
              View Instructions
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLightMode((v) => !v)}
              title={lightMode ? 'Dark mode' : 'Light mode'}
              className={lightMode ? 'rounded-lg border border-slate-300 p-2 hover:bg-slate-100' : 'rounded-lg border border-white/10 p-2 hover:bg-white/10'}
            >
              {lightMode ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className={lightMode ? 'rounded-lg border border-slate-300 p-2' : 'rounded-lg border border-white/10 p-2'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <div className={`min-w-[112px] rounded-lg px-3 py-2 text-center font-mono font-black tracking-wider ${remaining <= 300 ? 'bg-red-500 text-white' : lightMode ? 'bg-slate-200 text-slate-900' : 'bg-[#333] text-white'}`}>
              {formatClock(remaining)}
            </div>
            <button
              onClick={() => void submitTest(false)}
              className="hidden sm:flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-500"
            >
              <Send size={14} /> SUBMIT
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-black/10">
        <div className={lightMode ? 'h-12 bg-slate-200 flex items-center px-4 font-black text-sm' : 'h-12 bg-[#2b2b2b] flex items-center px-4 font-black text-sm'}>
          <span className={lightMode ? 'bg-blue-600 text-white h-12 flex items-center px-6 -ml-4' : 'bg-blue-600 text-white h-12 flex items-center px-6 -ml-4'}>
            {test.exam_name || 'General'}
          </span>
          <div className="ml-auto text-xs font-bold">
            Marks for correct answer: <span className="text-emerald-500">{Number(q?.marks || 0).toFixed(2)}</span>
            {q?.type === 'MCQ' && <> | Negative: <span className="text-red-500">{Number(q?.negativeMarks || 0).toFixed(2)}</span></>}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-96px)]">
        <main className="min-w-0 flex-1 min-h-0 h-[calc(100vh-96px)] overflow-y-auto custom-scrollbar">
          <div className={lightMode ? 'px-4 md:px-7 py-3 border-b border-slate-300 flex items-center justify-between text-sm font-bold' : 'px-4 md:px-7 py-3 border-b border-white/10 flex items-center justify-between text-sm font-bold'}>
            <span>Question No.: {q?.number}</span>
            <span className="font-mono text-xs">Your Time: {formatDuration(questionTimeRef.current[q?.id || ''] || 0)}</span>
          </div>

          <div className="p-4 md:p-6">
            <div className={lightMode ? 'min-h-[560px] rounded-xl bg-white border border-slate-300 shadow-sm' : 'min-h-[560px] rounded-xl bg-[#242424] border border-white/10 shadow-xl'}>
              <div className="p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={lightMode ? 'rounded-md bg-slate-100 border border-slate-300 px-3 py-1 text-xs font-black' : 'rounded-md bg-white/5 border border-white/10 px-3 py-1 text-xs font-black'}>Q{q?.number}</span>
                    <span className="text-xs font-black uppercase tracking-widest opacity-60">{q?.type}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={toggleMark}
                      className={marked[q?.id || ''] ? 'flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white' : lightMode ? 'flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black' : 'flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-black'}
                    >
                      <Flag size={15} /> {marked[q?.id || ''] ? 'Marked for Review' : 'Mark for Review'}
                    </button>
                    <button
                      onClick={toggleBookmark}
                      aria-label={bookmarked[q?.id || ''] ? 'Remove bookmark' : 'Bookmark this question'}
                      title={bookmarked[q?.id || ''] ? 'Bookmarked' : 'Bookmark'}
                      className={bookmarked[q?.id || ''] ? 'flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-black' : lightMode ? 'flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black' : 'flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-black'}
                    >
                      <Bookmark size={15} fill={bookmarked[q?.id || ''] ? 'currentColor' : 'none'} />
                      {bookmarked[q?.id || ''] ? 'Bookmarked' : 'Bookmark'}
                    </button>
                  </div>
                </div>

                <div className={lightMode ? 'mt-7 prose max-w-none text-sm leading-7 text-slate-800' : 'mt-7 prose prose-invert max-w-none text-sm leading-7'} dangerouslySetInnerHTML={{ __html: q?.questionHtml || '' }} />

                {q?.type === 'NAT' ? (
                  <div className="mt-8 max-w-md">
                    <label className="text-xs font-black uppercase tracking-widest opacity-60">Numerical Answer</label>
                    <input
                      inputMode="decimal"
                      value={(answers[q.id] || [])[0] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value ? [e.target.value] : [] }))}
                      placeholder="Enter your answer"
                      className={lightMode ? 'mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-blue-500' : 'mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-blue-500'}
                    />
                  </div>
                ) : (
                  <div className="mt-8 space-y-3">
                    {q?.options?.map((o) => {
                      const selected = (answers[q.id] || []).includes(o.key);
                      return (
                        <button
                          key={o.key}
                          onClick={() => toggle(o.key)}
                          className={selected
                            ? 'w-full text-left flex gap-4 p-4 rounded-xl border-2 border-blue-500 bg-blue-500/10'
                            : lightMode
                              ? 'w-full text-left flex gap-4 p-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100'
                              : 'w-full text-left flex gap-4 p-4 rounded-xl border border-white/10 bg-white/[.02] hover:bg-white/[.05]'}
                        >
                          <span className={selected ? 'w-8 h-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black' : lightMode ? 'w-8 h-8 shrink-0 rounded-full border border-slate-400 flex items-center justify-center text-xs font-black' : 'w-8 h-8 shrink-0 rounded-full border border-zinc-600 flex items-center justify-center text-xs font-black'}>
                            {o.key}
                          </span>
                          <span className="text-sm leading-6" dangerouslySetInnerHTML={{ __html: o.html }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
                  <button
                    disabled={current === 0}
                    onClick={() => goTo(current - 1)}
                    className="flex items-center gap-2 rounded-lg border border-current/20 px-4 py-3 text-sm font-bold disabled:opacity-30"
                  >
                    <ChevronLeft size={17} /> Previous
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={clearResponse}
                      className="flex items-center gap-2 rounded-lg border border-current/20 px-4 py-3 text-sm font-bold opacity-80 hover:opacity-100"
                    >
                      <RotateCcw size={15} /> Clear Response
                    </button>
                    <button
                      disabled={current === questions.length - 1}
                      onClick={() => goTo(current + 1)}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-30"
                    >
                      Save & Next <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className={lightMode ? 'w-full lg:w-[330px] lg:h-[calc(100vh-96px)] lg:overflow-y-auto bg-white border-l border-slate-300' : 'w-full lg:w-[330px] lg:h-[calc(100vh-96px)] lg:overflow-y-auto bg-[#f1f7fb] text-slate-900 border-l border-black/10'}>
          <div className="p-4 md:p-5">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="font-black text-sm">Candidate</div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">LIVE</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">{test.title}</div>
            </div>

            <div className="mt-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <span className="font-black text-sm">Question Palette</span>
                <Flag size={17} className="text-violet-600" />
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
                {questions.map((x, i) => {
                  const state = paletteState(x, i);
                  const cls =
                    state === 'current'
                      ? 'bg-blue-600 border-blue-700 text-white ring-2 ring-blue-200'
                      : state === 'review'
                        ? 'bg-violet-600 border-violet-700 text-white'
                        : state === 'answered'
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700';

                  return (
                    <button
                      key={x.id}
                      onClick={() => goTo(i)}
                      className={`aspect-square rounded-md border text-xs font-black ${cls}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <Legend cls="bg-emerald-500" text={`Answered (${answeredCount})`} />
                <Legend cls="bg-violet-600" text={`Review (${reviewCount})`} />
                <Legend cls="bg-white border border-slate-300" text={`Not Answered (${unansweredCount})`} />
                <Legend cls="bg-blue-600" text="Current" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat label="Answered" value={answeredCount} />
              <MiniStat label="Review" value={reviewCount} />
              <MiniStat label="Left" value={unansweredCount} />
            </div>

            <button
              onClick={() => void submitTest(false)}
              className="mt-4 w-full rounded-xl bg-red-600 py-3.5 text-sm font-black text-white hover:bg-red-500"
            >
              Submit Examination
            </button>

            <div className="mt-4 rounded-xl bg-white p-4 text-xs text-slate-500 border border-slate-200">
              <div className="font-black text-slate-800">Navigation help</div>
              <div className="mt-2">Blue = current · Green = answered · Purple = marked for review.</div>
            </div>
          </div>
        </aside>
      </div>

      {showQuestionPaper && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-3 md:p-6">
          <div className={lightMode
            ? 'h-full w-full overflow-hidden rounded-2xl bg-white text-slate-900 border border-slate-300 shadow-2xl'
            : 'h-full w-full overflow-hidden rounded-2xl bg-[#181818] text-white border border-white/10 shadow-2xl'}>
            <div className={lightMode
              ? 'sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-300 bg-white px-5 py-4'
              : 'sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#181818] px-5 py-4'}>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-blue-500">Question Paper</div>
                <h2 className="mt-1 text-lg md:text-xl font-black">{test.title}</h2>
              </div>
              <button
                onClick={() => setShowQuestionPaper(false)}
                className={lightMode ? 'rounded-lg border border-slate-300 p-2 hover:bg-slate-100' : 'rounded-lg border border-white/10 p-2 hover:bg-white/10'}
                aria-label="Close question paper"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="h-[calc(100%-76px)] overflow-y-auto p-4 md:p-7 custom-scrollbar">
              <div className="mx-auto max-w-5xl space-y-5">
                {questions.map((question) => (
                  <article
                    key={question.id}
                    className={lightMode
                      ? 'rounded-2xl border border-slate-300 bg-slate-50 p-5 md:p-7'
                      : 'rounded-2xl border border-white/10 bg-[#222] p-5 md:p-7'}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-4">
                      <div className="font-black">Question {question.number}</div>
                      <div className="flex items-center gap-3 text-xs font-bold opacity-70">
                        <span>{question.type}</span>
                        <span>+{Number(question.marks || 0).toFixed(2)}</span>
                        {question.type === 'MCQ' && <span className="text-red-500">−{Number(question.negativeMarks || 0).toFixed(2)}</span>}
                      </div>
                    </div>

                    <div
                      className={lightMode ? 'prose max-w-none mt-5 text-sm md:text-base leading-7 text-slate-800' : 'prose prose-invert max-w-none mt-5 text-sm md:text-base leading-7'}
                      dangerouslySetInnerHTML={{ __html: question.questionHtml || '' }}
                    />

                    {question.type === 'NAT' ? (
                      <div className="mt-5 rounded-xl border border-current/10 p-4 text-sm opacity-70">Numerical Answer</div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {question.options?.map((option) => (
                          <div key={option.key} className={lightMode ? 'flex gap-3 rounded-xl border border-slate-300 bg-white p-4' : 'flex gap-3 rounded-xl border border-white/10 bg-black/10 p-4'}>
                            <span className="shrink-0 font-black">{option.key}.</span>
                            <span className="text-sm leading-6" dangerouslySetInnerHTML={{ __html: option.html }} />
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

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 border-r border-white/10 last:border-r-0">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-black text-lg">{value}</div>
    </div>
  );
}

function Instruction({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
      <span className="mt-0.5 text-emerald-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <div className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${cls}`} />{text}</div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-white p-3 text-center border border-slate-200"><div className="text-lg font-black">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>;
}

function Result({ test, result }: { test: any; result: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="min-h-screen bg-[#171717] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-[#242424] shadow-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6 border-b border-white/10">
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-black">Test Submitted</div>
            <h1 className="text-2xl md:text-3xl font-black mt-2">{test.title}</h1>
            <p className="text-sm text-zinc-500 mt-1">Your attempt has been submitted successfully.</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryStat label="Score" value={`${Number(result.score || 0).toFixed(2)}/${result.maxMarks}`} cls="text-emerald-400" />
              <SummaryStat label="Correct" value={String(result.correct || 0)} cls="text-emerald-400" />
              <SummaryStat label="Incorrect" value={String(result.incorrect || 0)} cls="text-red-400" />
              <SummaryStat label="Not Answered" value={String(result.notAnswered || 0)} cls="text-amber-400" />
            </div>

            <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-zinc-300">
              Detailed question-wise solutions, marks, negative marking and time spent are available in Analysis.
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.replace(`/test-series/${test.id}/analysis?attempt=${result.attemptId}`)}
                className="flex-1 rounded-xl bg-white text-black py-3.5 font-black hover:bg-emerald-300 transition"
              >
                Analyse Attempt
              </button>
              <button
                onClick={() => router.replace('/test-series/')}
                className="rounded-xl border border-white/10 px-6 py-3.5 font-bold hover:bg-white/5"
              >
                Back to Test Series
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl bg-white/[.03] border border-white/10 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-2xl font-black mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
