'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, CheckCircle2, XCircle, MinusCircle, PlayCircle, Clock3,
  Trophy, Target, Percent, BarChart3, ChevronDown, ChevronUp, Flag,
  ListChecks, CircleDot, Sun, Moon, FileText
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

const pct = (value: number) => `${Number(value || 0).toFixed(2)}%`;

type Filter = 'overview' | 'all' | 'correct' | 'incorrect' | 'unattempted' | 'marked';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('attempt'));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('overview');
  const [openSolution, setOpenSolution] = useState<Record<string, boolean>>({});
  const [lightMode, setLightMode] = useState(false);
  const [solutionData, setSolutionData] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      try {
        const res = await fetch(`/api/test-series/attempts?testId=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const d = await res.json();
        if (!res.ok) {
          toast.error(d.error || 'Unable to load analysis.');
          setLoading(false);
          return;
        }
        setData(d);
        if (!selectedId && d.attempts?.length) setSelectedId(d.attempts[0].attemptId);
      } catch (e) {
        console.error(e);
        toast.error('Unable to load analysis.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const attempt = useMemo(
    () => data?.attempts?.find((a: any) => a.attemptId === selectedId) || data?.attempts?.[0],
    [data, selectedId]
  );

  const filteredReview = useMemo(() => {
    const review = attempt?.review || [];
    if (filter === 'correct') return review.filter((r: any) => r.result === 'correct');
    if (filter === 'incorrect') return review.filter((r: any) => r.result === 'incorrect');
    if (filter === 'unattempted') return review.filter((r: any) => r.result === 'not_answered');
    if (filter === 'marked') return review.filter((r: any) => r.markedForReview);
    return review;
  }, [attempt, filter]);

  if (loading) return <div className="min-h-full flex items-center justify-center text-emerald-400">Loading analysis...</div>;

  if (!data?.attempts?.length) return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10">
      <button onClick={() => router.push('/test-series/')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8"><ArrowLeft size={18}/> Back to Test Series</button>
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10 text-center">
        <h1 className="text-2xl font-black text-white">No Attempts Yet</h1>
        <p className="text-zinc-500 mt-2">Start this test to create your first result.</p>
        <button onClick={() => router.push('/test-series/')} className="mt-6 bg-emerald-500 text-black font-black px-6 py-3 rounded-xl">Start Test</button>
      </div>
    </div>
  );

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'all', label: 'All', count: attempt?.review?.length },
    { key: 'correct', label: 'Correct', count: attempt?.correct },
    { key: 'incorrect', label: 'Incorrect', count: attempt?.incorrect },
    { key: 'unattempted', label: 'Unattempted', count: attempt?.notAnswered },
    { key: 'marked', label: 'Marked For Review', count: attempt?.markedCount },
  ];

  return (
    <div className={lightMode ? 'min-h-screen bg-slate-100 text-slate-900' : 'min-h-screen bg-[#181818] text-white'}>
      <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-5 lg:py-7">
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            onClick={() => router.push('/test-series/')}
            className={lightMode ? 'inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition' : 'inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white transition'}
          >
            <ArrowLeft size={18}/> Results
          </button>
          <button
            onClick={() => router.push(`/test-series/${id}`)}
            className="rounded-lg bg-white text-zinc-900 px-5 py-2.5 text-sm font-black hover:bg-emerald-300 transition"
          >
            Reattempt Test
          </button>
          <button
            onClick={() => setLightMode((v) => !v)}
            aria-label="Toggle analysis theme"
            className={lightMode ? 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50' : 'inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-white hover:bg-white/10'}
          >
            {lightMode ? <Moon size={16}/> : <Sun size={16}/>} {lightMode ? 'Dark' : 'Light'}
          </button>
        </div>

        <div className={lightMode ? 'border-b border-slate-300 flex items-end gap-1 overflow-x-auto scrollbar-none' : 'border-b border-white/10 flex items-end gap-1 overflow-x-auto scrollbar-none'}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-bold transition ${filter === tab.key ? (lightMode ? 'text-slate-900' : 'text-white') : (lightMode ? 'text-slate-500 hover:text-slate-800' : 'text-zinc-500 hover:text-zinc-200')}`}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.key !== 'all' && tab.key !== 'overview' ? <span className="ml-1.5 text-xs opacity-60">{tab.count}</span> : null}
              {filter === tab.key && <span className={`absolute left-0 right-0 bottom-0 h-0.5 ${lightMode ? 'bg-slate-900' : 'bg-white'}`} />}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{data.test.title}</h1>
            <p className="text-zinc-500 text-sm mt-1">Attempt {attempt?.attemptNumber} · {new Date(attempt?.submittedAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-400">COMPLETED</span>
            <select
              value={attempt?.attemptId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className={lightMode ? 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none' : 'rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-white outline-none'}
            >
              {(data.attempts || []).map((a: any) => <option key={a.attemptId} value={a.attemptId}>Attempt {a.attemptNumber} · {a.score}/{a.maxMarks}</option>)}
            </select>
          </div>
        </div>

        {filter === 'overview' ? (
          <>
            <SectionTitle icon={<BarChart3 size={18}/>} title="Question Stats" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <Stat lightMode={lightMode} icon={<Trophy size={17}/>} label="Your Score" value={`${Number(attempt.score).toFixed(2)}`} sub={`/${attempt.maxMarks}`} tone="amber" />
              <Stat lightMode={lightMode} icon={<Target size={17}/>} label="Rank" value={`${attempt.rank ?? '—'}`} sub={attempt.totalRanked ? `/${attempt.totalRanked}` : ''} tone="purple" />
              <Stat lightMode={lightMode} icon={<Percent size={17}/>} label="Percentile" value={pct(attempt.percentile)} sub="" tone="blue" />
              <Stat lightMode={lightMode} icon={<CheckCircle2 size={17}/>} label="Correct" value={String(attempt.correct)} sub="" tone="green" />
              <Stat lightMode={lightMode} icon={<XCircle size={17}/>} label="Incorrect" value={String(attempt.incorrect)} sub="" tone="red" />
              <Stat lightMode={lightMode} icon={<MinusCircle size={17}/>} label="Unattempted" value={String(attempt.notAnswered)} sub="" tone="gray" />
              <Stat lightMode={lightMode} icon={<CircleDot size={17}/>} label="Accuracy" value={pct(attempt.accuracy)} sub="" tone="cyan" />
            </div>

            <div className="mt-8 grid lg:grid-cols-[1.4fr_.6fr] gap-4">
              <div className={lightMode ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-2xl border border-white/10 bg-[#222] p-5'}>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-black text-lg">Performance Breakdown</h2>
                    <p className="text-xs text-zinc-500 mt-1">How you performed across all {attempt.review.length} questions</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <Legend dot="bg-emerald-500" text="Correct" />
                    <Legend dot="bg-red-500" text="Incorrect" />
                    <Legend dot="bg-zinc-500" text="Unattempted" />
                  </div>
                </div>
                <div className={lightMode ? 'h-52 flex items-end justify-around gap-8 px-5 border-b border-slate-200' : 'h-52 flex items-end justify-around gap-8 px-5 border-b border-white/5'}>
                  <Bar value={attempt.correct} total={attempt.review.length} label="Correct" pct={attempt.correct / Math.max(1, attempt.review.length) * 100} tone="green" />
                  <Bar value={attempt.incorrect} total={attempt.review.length} label="Incorrect" pct={attempt.incorrect / Math.max(1, attempt.review.length) * 100} tone="red" />
                  <Bar value={attempt.notAnswered} total={attempt.review.length} label="Unattempted" pct={attempt.notAnswered / Math.max(1, attempt.review.length) * 100} tone="gray" />
                </div>
              </div>
              <div className={lightMode ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-2xl border border-white/10 bg-[#222] p-5'}>
                <h2 className="font-black text-lg">Attempt Summary</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryRow lightMode={lightMode} label="Total time" value={fmt(attempt.totalTimeSeconds)} />
                  <SummaryRow lightMode={lightMode} label="Questions" value={String(attempt.review.length)} />
                  <SummaryRow lightMode={lightMode} label="Marks gained" value={`+${attempt.positiveGained.toFixed(2)}`} good />
                  <SummaryRow lightMode={lightMode} label="Negative marks" value={`−${attempt.negativeLost.toFixed(2)}`} bad={attempt.negativeLost > 0} />
                  <SummaryRow lightMode={lightMode} label="Accuracy" value={pct(attempt.accuracy)} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <SectionTitle icon={<ListChecks size={18}/>} title="Question-wise Analysis" />
              <button onClick={() => setFilter('all')} className="text-sm font-bold text-emerald-400 hover:text-emerald-300">View All Questions →</button>
            </div>
            <QuestionList testId={id} review={attempt.review} openSolution={openSolution} setOpenSolution={setOpenSolution} solutionData={solutionData} setSolutionData={setSolutionData} lightMode={lightMode} />
          </>
        ) : (
          <>
            <SectionTitle icon={<ListChecks size={18}/>} title={`${tabs.find(t => t.key === filter)?.label || 'Questions'} Questions`} />
            {filteredReview.length ? (
              <QuestionList testId={id} review={filteredReview} openSolution={openSolution} setOpenSolution={setOpenSolution} solutionData={solutionData} setSolutionData={setSolutionData} lightMode={lightMode} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#222] p-12 text-center text-zinc-500">No questions in this category.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuestionList({ testId, review, openSolution, setOpenSolution, solutionData, setSolutionData, lightMode }: any) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-5 items-start">
      <div className="space-y-4">{review.map((r: any) => <QuestionCard key={r.id} testId={testId} r={r} open={!!openSolution[r.id]} lightMode={lightMode} solutionData={solutionData} setSolutionData={setSolutionData} onToggle={() => setOpenSolution((s: any) => ({ ...s, [r.id]: !s[r.id] }))} />)}</div>
      <QuestionNavigator review={review} lightMode={lightMode} />
    </div>
  );
}

function QuestionNavigator({ review, lightMode }: any) {
  const scrollTo = (id: string) => document.getElementById(`analysis-question-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <aside className="hidden lg:block sticky top-5"><div className={`rounded-2xl border p-4 ${lightMode ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#0f172a]'}`}><div className="flex items-center justify-between mb-3"><span className={`text-sm font-black ${lightMode ? 'text-slate-900' : 'text-white'}`}>Navigator</span><span className={`text-xs font-black ${lightMode ? 'text-slate-500' : 'text-zinc-400'}`}>{review.length}</span></div><div className="grid grid-cols-5 gap-2">{review.map((r: any) => <button key={r.id} onClick={() => scrollTo(r.id)} className={`h-8 rounded-lg border text-xs font-black transition ${r.result === 'correct' ? (lightMode ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10') : r.result === 'incorrect' ? (lightMode ? 'border-red-300 text-red-700 bg-red-50' : 'border-red-500/40 text-red-300 bg-red-500/10') : (lightMode ? 'border-slate-300 text-slate-600 bg-slate-50' : 'border-white/15 text-zinc-400 bg-white/[.02]')} ${r.markedForReview ? 'ring-1 ring-violet-400' : ''}`}>{r.number}</button>)}</div></div></aside>;
}

function QuestionCard({ testId, r, open, onToggle, lightMode, solutionData, setSolutionData }: any) {
  const resultClass = r.result === 'correct' ? (lightMode ? 'border-emerald-500/30' : 'border-emerald-500/20') : r.result === 'incorrect' ? (lightMode ? 'border-red-500/30' : 'border-red-500/20') : (lightMode ? 'border-slate-200' : 'border-white/10');
  const statusClass = r.result === 'correct' ? 'text-emerald-600 bg-emerald-500/10' : r.result === 'incorrect' ? 'text-red-600 bg-red-500/10' : (lightMode ? 'text-slate-500 bg-slate-200' : 'text-zinc-400 bg-zinc-500/10');
  const selected = new Set((r.selected || []).map(String));
  const answer = new Set((r.answer || []).map(String));
  const currentSolution = solutionData?.[r.id] || {};

  const toggleSolution = () => {
    // Show only the correct option/answer immediately. Do NOT fetch the
    // written solution or video URL here. The video is fetched only when
    // the user explicitly presses the Video Solution button.
    onToggle();
  };

  const fetchWrittenSolution = async () => {
    if (currentSolution?.solutionLoading || currentSolution?.solutionLoaded) return;
    if (!(currentSolution?.hasWrittenSolution ?? r.hasWrittenSolution)) {
      toast.error('No written or image solution is available for this question.');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please sign in again.'); return; }
      setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), solutionLoading: true, hasWrittenSolution: true } }));
      const res = await fetch(`/api/test-series/solution?testId=${encodeURIComponent(testId)}&questionId=${encodeURIComponent(r.id)}&mode=answer`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Unable to load solution.');
      const solutionHtml = d.solution?.solutionHtml || '';
      setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), solutionLoading: false, solutionLoaded: true, solutionHtml, hasWrittenSolution: Boolean(solutionHtml), hasVideo: Boolean(d.solution?.hasVideo) } }));
    } catch (e: any) {
      setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), solutionLoading: false } }));
      toast.error(e?.message || 'Unable to load solution.');
    }
  };

  const fetchVideo = async () => {
    if (currentSolution?.videoLoading || currentSolution?.videoUrl || !(currentSolution?.hasVideo ?? r.hasVideo)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please sign in again.'); return; }
      setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), videoLoading: true, hasVideo: true } }));
      const res = await fetch(`/api/test-series/solution?testId=${encodeURIComponent(testId)}&questionId=${encodeURIComponent(r.id)}&mode=video`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Unable to load video solution.');
      const videoUrl = d.solution?.videoUrl || null;
       if (!videoUrl) throw new Error('No video solution is available for this question.');
       setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), videoLoading: false, videoUrl, hasVideo: true } }));
    } catch (e: any) {
      setSolutionData((prev: any) => ({ ...prev, [r.id]: { ...(prev?.[r.id] || {}), videoLoading: false } }));
      toast.error(e?.message || 'Unable to load video solution.');
    }
  };

  return (
    <div id={`analysis-question-${r.id}`} className={`scroll-mt-5 rounded-2xl border ${resultClass} ${lightMode ? 'bg-white' : 'bg-[#222]'} overflow-hidden shadow-sm`}>
      <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${lightMode ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm ${lightMode ? 'bg-slate-100 text-slate-800' : 'bg-white/5'}`}>Q{r.number}</div>
          <div>
            <div className="font-black text-sm">Question {r.number}</div>
            <div className={`text-[11px] uppercase tracking-widest mt-0.5 ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>{r.type} · +{Number(r.positiveMarks || 0).toFixed(2)} marks{Number(r.negativeMarks || 0) > 0 ? ` · −${Number(r.negativeMarks).toFixed(2)}` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`rounded-full px-3 py-1.5 font-black ${statusClass}`}>{r.result === 'correct' ? '✓ Correct' : r.result === 'incorrect' ? '× Incorrect' : '— Unattempted'}</span>
          {r.markedForReview && <span className="rounded-full px-3 py-1.5 bg-violet-500/10 text-violet-600 font-bold"><Flag size={12} className="inline mr-1"/>Review</span>}
          <span className={lightMode ? 'text-slate-500' : 'text-zinc-500'}><Clock3 size={13} className="inline mr-1"/>{fmt(r.timeSpentSeconds)}</span>
          <b className={Number(r.marks) >= 0 ? 'text-emerald-500' : 'text-red-500'}>{Number(r.marks) > 0 ? '+' : ''}{Number(r.marks).toFixed(2)}</b>
        </div>
      </div>

      <div className="p-5 lg:p-7">
        <div className={`prose max-w-none text-[15px] leading-7 ${lightMode ? 'text-slate-800' : 'prose-invert'}`} dangerouslySetInnerHTML={{ __html: r.questionHtml || '' }} />

        {r.options?.length ? (
          <div className="mt-6 space-y-2.5">
            {r.options.map((o: any) => {
              const isCorrect = answer.has(String(o.key));
              const isSelected = selected.has(String(o.key));
              // Do not reveal correctness until Show Solution is pressed.
              const optionClass = open && isCorrect
                ? (lightMode ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-500/40 bg-emerald-500/10')
                : open && isSelected && !isCorrect
                  ? (lightMode ? 'border-red-500/50 bg-red-500/10' : 'border-red-500/40 bg-red-500/10')
                  : (lightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[.02]');
              return (
                <div key={o.key} className={`flex items-start gap-3 rounded-xl border p-3.5 ${optionClass}`}>
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${open && isCorrect ? 'bg-emerald-500 text-black' : open && isSelected && !isCorrect ? 'bg-red-500 text-white' : (lightMode ? 'border border-slate-300 text-slate-600' : 'border border-white/15 text-zinc-400')}`}>{o.key}</span>
                  <div className={`min-w-0 flex-1 text-sm leading-6 ${lightMode ? 'text-slate-800' : ''}`} dangerouslySetInnerHTML={{ __html: o.html || '' }} />
                  {open && <div className="shrink-0 text-[10px] font-black uppercase tracking-wide text-right">{isCorrect && <div className="text-emerald-500">Correct Answer</div>}{isSelected && !isCorrect && <div className="text-red-500">Your Answer</div>}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`mt-5 text-sm ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>Your answer: <b className={lightMode ? 'text-slate-900' : 'text-white'}>{r.selected?.length ? r.selected.join(', ') : 'Not answered'}</b></div>
        )}

        <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${lightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#1b1b1b]'}`}>
          <div className={`text-sm ${lightMode ? 'text-slate-600' : 'text-zinc-400'}`}>
            {open ? <>Correct answer: <b className="text-emerald-500">{r.answer?.length ? r.answer.join(', ') : '—'}</b>{r.selected?.length ? <span className="ml-3">Your answer: <b className={r.result === 'correct' ? 'text-emerald-500' : 'text-red-500'}>{r.selected.join(', ')}</b></span> : null}</> : <span>Answer hidden · Press <b className={lightMode ? 'text-slate-900' : 'text-white'}>Show Solution</b> to reveal the correct option.</span>}
          </div>
          <button onClick={toggleSolution} className="inline-flex items-center gap-2 rounded-lg bg-white text-zinc-900 px-4 py-2.5 text-sm font-black hover:bg-emerald-300 transition">{open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {open ? 'Hide Solution' : 'Show Solution'}</button>
        </div>

        {open && (
          <div className={`mt-4 rounded-xl border p-4 sm:p-5 ${lightMode ? 'border-emerald-500/30 bg-emerald-50' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-black text-sm text-emerald-500">Solution</div>
              <div className={`text-xs ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>Answer: <b className="text-emerald-500">{r.answer?.join(', ') || '—'}</b></div>
            </div>
            {currentSolution?.solutionLoading ? (
              <div className="rounded-lg border border-white/10 p-5 text-sm text-zinc-500">Loading answer…</div>
            ) : (
              <>
                <div className={`rounded-xl border p-4 ${lightMode ? 'border-emerald-500/20 bg-white' : 'border-white/10 bg-[#1b1b1b]'}`}>
                  <div className={`text-xs font-black uppercase tracking-widest mb-2 ${lightMode ? 'text-slate-500' : 'text-zinc-400'}`}>Correct Option</div>
                  <div className="text-lg font-black text-emerald-500">{r.answer?.length ? r.answer.join(', ') : '—'}</div>
                </div>
                {(currentSolution?.hasVideo ?? Boolean(r.hasVideo)) ? (
                  <div className="mt-4">
                    {!currentSolution?.videoUrl ? (
                      <button onClick={fetchVideo} disabled={currentSolution?.videoLoading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-60">
                        <PlayCircle size={16}/>{currentSolution?.videoLoading ? 'Loading Video…' : 'Video Solution'}
                      </button>
                    ) : (
                      <div>
                        <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-2 ${lightMode ? 'text-slate-500' : 'text-zinc-400'}`}><PlayCircle size={15} className="text-emerald-500"/> Video Solution</div>
                        <video controls playsInline preload="none" className="w-full max-h-[650px] rounded-xl bg-black" src={currentSolution.videoUrl} onError={() => toast.error('The video URL was fetched, but this browser could not play the video. Use Open Video below.')}>
                          <source src={currentSolution.videoUrl} type="video/mp4" />
                        </video>
                        <a href={currentSolution.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-black text-emerald-500 hover:bg-emerald-500/10">
                          <PlayCircle size={14} /> Open Video
                        </a>
                      </div>
                    )}
                  </div>
                ) : (currentSolution?.hasWrittenSolution ?? Boolean(r.hasWrittenSolution)) ? (
                  <div className="mt-4">
                    {!currentSolution?.solutionLoaded ? (
                      <button onClick={fetchWrittenSolution} disabled={currentSolution?.solutionLoading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-60">
                        <FileText size={16}/>{currentSolution?.solutionLoading ? 'Loading Solution…' : 'Written / Image Solution'}
                      </button>
                    ) : currentSolution?.solutionHtml ? (
                      <div className={`rounded-xl border p-4 ${lightMode ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#1b1b1b]'}`}>
                        <div className={`text-xs font-black uppercase tracking-widest mb-3 ${lightMode ? 'text-slate-500' : 'text-zinc-400'}`}>Written / Image Solution</div>
                        <div className="prose max-w-none text-sm leading-6 dark:prose-invert" dangerouslySetInnerHTML={{ __html: currentSolution.solutionHtml }} />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 p-4 text-sm text-zinc-500">No written or image solution content was found.</div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: any) {
  return <div className="flex items-center gap-2 mb-4"><span className="text-emerald-400">{icon}</span><h2 className="text-lg font-black">{title}</h2></div>;
}

function Stat({ icon, label, value, sub, tone, lightMode }: any) {
  const tones: Record<string, string> = { amber: 'text-amber-500 bg-amber-500/10', purple: 'text-purple-500 bg-purple-500/10', blue: 'text-blue-500 bg-blue-500/10', green: 'text-emerald-500 bg-emerald-500/10', red: 'text-red-500 bg-red-500/10', gray: 'text-zinc-500 bg-zinc-500/10', cyan: 'text-cyan-500 bg-cyan-500/10' };
  return <div className={`relative overflow-hidden rounded-2xl border p-4 min-h-[126px] ${lightMode ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-[#242424]'}`}><div className={`w-8 h-8 rounded-lg ${tones[tone]} flex items-center justify-center`}>{icon}</div><div className={`text-xs mt-3 ${lightMode ? 'text-slate-500' : 'text-zinc-500'}`}>{label}</div><div className="text-2xl font-black mt-1">{value}<span className={`text-sm font-bold ml-0.5 ${lightMode ? 'text-slate-400' : 'text-zinc-500'}`}>{sub}</span></div></div>;
}

function Bar({ value, label, pct: percent, tone }: any) {
  const h = Math.max(10, Math.min(92, percent));
  const bg: Record<string, string> = { green: 'bg-emerald-500', red: 'bg-red-500', gray: 'bg-zinc-500' };
  const text: Record<string, string> = { green: 'text-emerald-400', red: 'text-red-400', gray: 'text-zinc-400' };
  return <div className="flex h-full w-28 flex-col items-center justify-end"><div className={`mb-1 text-sm font-black ${text[tone]}`}>{value}</div><div className={`w-20 rounded-t-lg ${bg[tone]}`} style={{ height: `${h}%` }}><div className="h-full flex items-center justify-center text-xs font-black text-white">{Math.round(percent)}%</div></div><div className="mt-3 text-xs text-zinc-500">{label}</div></div>;
}

function Legend({ dot, text }: any) { return <span className="inline-flex items-center gap-1.5"><i className={`w-2 h-2 rounded-full ${dot}`}/>{text}</span>; }
function SummaryRow({ label, value, good, bad, lightMode }: any) { return <div className={`flex items-center justify-between border-b pb-3 ${lightMode ? 'border-slate-200' : 'border-white/5'}`}><span className={lightMode ? 'text-slate-500' : 'text-zinc-500'}>{label}</span><b className={good ? 'text-emerald-500' : bad ? 'text-red-500' : (lightMode ? 'text-slate-800' : 'text-zinc-100')}>{value}</b></div>; }
