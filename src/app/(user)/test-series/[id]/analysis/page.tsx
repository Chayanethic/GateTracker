'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, CheckCircle2, XCircle, MinusCircle, PlayCircle, Clock3,
  Trophy, Target, Percent, BarChart3, ChevronDown, ChevronUp, Flag,
  ListChecks, CircleDot
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
    <div className="min-h-full bg-[#181818] text-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7">
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            onClick={() => router.push('/test-series/')}
            className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft size={18}/> Results
          </button>
          <button
            onClick={() => router.push(`/test-series/${id}`)}
            className="rounded-lg bg-white text-zinc-900 px-5 py-2.5 text-sm font-black hover:bg-emerald-300 transition"
          >
            Reattempt Test
          </button>
        </div>

        <div className="border-b border-white/10 flex items-end gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-bold transition ${filter === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.key !== 'all' && tab.key !== 'overview' ? <span className="ml-1.5 text-xs opacity-60">{tab.count}</span> : null}
              {filter === tab.key && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-white" />}
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
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-white outline-none"
            >
              {(data.attempts || []).map((a: any) => <option key={a.attemptId} value={a.attemptId}>Attempt {a.attemptNumber} · {a.score}/{a.maxMarks}</option>)}
            </select>
          </div>
        </div>

        {filter === 'overview' ? (
          <>
            <SectionTitle icon={<BarChart3 size={18}/>} title="Question Stats" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <Stat icon={<Trophy size={17}/>} label="Your Score" value={`${Number(attempt.score).toFixed(2)}`} sub={`/${attempt.maxMarks}`} tone="amber" />
              <Stat icon={<Target size={17}/>} label="Rank" value={`${attempt.rank ?? '—'}`} sub={attempt.totalRanked ? `/${attempt.totalRanked}` : ''} tone="purple" />
              <Stat icon={<Percent size={17}/>} label="Percentile" value={pct(attempt.percentile)} sub="" tone="blue" />
              <Stat icon={<CheckCircle2 size={17}/>} label="Correct" value={String(attempt.correct)} sub="" tone="green" />
              <Stat icon={<XCircle size={17}/>} label="Incorrect" value={String(attempt.incorrect)} sub="" tone="red" />
              <Stat icon={<MinusCircle size={17}/>} label="Unattempted" value={String(attempt.notAnswered)} sub="" tone="gray" />
              <Stat icon={<CircleDot size={17}/>} label="Accuracy" value={pct(attempt.accuracy)} sub="" tone="cyan" />
            </div>

            <div className="mt-8 grid lg:grid-cols-[1.4fr_.6fr] gap-4">
              <div className="rounded-2xl border border-white/10 bg-[#222] p-5">
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
                <div className="h-52 flex items-end justify-around gap-8 px-5 border-b border-white/5">
                  <Bar value={attempt.correct} total={attempt.review.length} label="Correct" pct={attempt.correct / Math.max(1, attempt.review.length) * 100} tone="green" />
                  <Bar value={attempt.incorrect} total={attempt.review.length} label="Incorrect" pct={attempt.incorrect / Math.max(1, attempt.review.length) * 100} tone="red" />
                  <Bar value={attempt.notAnswered} total={attempt.review.length} label="Unattempted" pct={attempt.notAnswered / Math.max(1, attempt.review.length) * 100} tone="gray" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#222] p-5">
                <h2 className="font-black text-lg">Attempt Summary</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryRow label="Total time" value={fmt(attempt.totalTimeSeconds)} />
                  <SummaryRow label="Questions" value={String(attempt.review.length)} />
                  <SummaryRow label="Marks gained" value={`+${attempt.positiveGained.toFixed(2)}`} good />
                  <SummaryRow label="Negative marks" value={`−${attempt.negativeLost.toFixed(2)}`} bad={attempt.negativeLost > 0} />
                  <SummaryRow label="Accuracy" value={pct(attempt.accuracy)} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <SectionTitle icon={<ListChecks size={18}/>} title="Question-wise Analysis" />
              <button onClick={() => setFilter('all')} className="text-sm font-bold text-emerald-400 hover:text-emerald-300">View All Questions →</button>
            </div>
            <QuestionList review={attempt.review} openSolution={openSolution} setOpenSolution={setOpenSolution} />
          </>
        ) : (
          <>
            <SectionTitle icon={<ListChecks size={18}/>} title={`${tabs.find(t => t.key === filter)?.label || 'Questions'} Questions`} />
            {filteredReview.length ? (
              <QuestionList review={filteredReview} openSolution={openSolution} setOpenSolution={setOpenSolution} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#222] p-12 text-center text-zinc-500">No questions in this category.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuestionList({ review, openSolution, setOpenSolution }: any) {
  return <div className="space-y-4">{review.map((r: any) => <QuestionCard key={r.id} r={r} open={!!openSolution[r.id]} onToggle={() => setOpenSolution((s: any) => ({ ...s, [r.id]: !s[r.id] }))} />)}</div>;
}

function QuestionCard({ r, open, onToggle }: any) {
  const resultClass = r.result === 'correct' ? 'border-emerald-500/20' : r.result === 'incorrect' ? 'border-red-500/20' : 'border-white/10';
  const statusClass = r.result === 'correct' ? 'text-emerald-400 bg-emerald-500/10' : r.result === 'incorrect' ? 'text-red-400 bg-red-500/10' : 'text-zinc-400 bg-zinc-500/10';
  const selected = new Set((r.selected || []).map(String));
  const answer = new Set((r.answer || []).map(String));

  return (
    <div className={`rounded-2xl border ${resultClass} bg-[#222] overflow-hidden`}>
      <div className="px-5 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center font-black text-sm">Q{r.number}</div>
          <div>
            <div className="font-black text-sm">Question {r.number}</div>
            <div className="text-[11px] uppercase tracking-widest text-zinc-500 mt-0.5">{r.type} · +{Number(r.positiveMarks || 0).toFixed(2)} marks{Number(r.negativeMarks || 0) > 0 ? ` · −${Number(r.negativeMarks).toFixed(2)}` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`rounded-full px-3 py-1.5 font-black ${statusClass}`}>
            {r.result === 'correct' ? '✓ Correct' : r.result === 'incorrect' ? '× Incorrect' : '— Unattempted'}
          </span>
          {r.markedForReview && <span className="rounded-full px-3 py-1.5 bg-violet-500/10 text-violet-300 font-bold"><Flag size={12} className="inline mr-1"/>Review</span>}
          <span className="text-zinc-500"><Clock3 size={13} className="inline mr-1"/>{fmt(r.timeSpentSeconds)}</span>
          <b className={Number(r.marks) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{Number(r.marks) > 0 ? '+' : ''}{Number(r.marks).toFixed(2)}</b>
        </div>
      </div>

      <div className="p-5 lg:p-7">
        <div className="prose prose-invert max-w-none text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: r.questionHtml || '' }} />

        {r.options?.length ? (
          <div className="mt-6 space-y-2.5">
            {r.options.map((o: any) => {
              const isCorrect = answer.has(String(o.key));
              const isSelected = selected.has(String(o.key));
              return (
                <div key={o.key} className={`flex items-start gap-3 rounded-xl border p-3.5 ${isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : isSelected ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-white/[.02]'}`}>
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${isCorrect ? 'bg-emerald-500 text-black' : isSelected ? 'bg-red-500 text-white' : 'border border-white/15 text-zinc-400'}`}>{o.key}</span>
                  <div className="min-w-0 flex-1 text-sm leading-6" dangerouslySetInnerHTML={{ __html: o.html || '' }} />
                  <div className="shrink-0 text-[10px] font-black uppercase tracking-wide text-right">
                    {isCorrect && <div className="text-emerald-400">Correct Answer</div>}
                    {isSelected && !isCorrect && <div className="text-red-400">Your Answer</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 text-sm text-zinc-500">Your answer: <b className="text-white">{r.selected?.length ? r.selected.join(', ') : 'Not answered'}</b></div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
          <div className="text-sm text-zinc-400">
            Correct answer: <b className="text-emerald-400">{r.answer?.length ? r.answer.join(', ') : '—'}</b>
            {r.selected?.length ? <span className="ml-3">Your answer: <b className={r.result === 'correct' ? 'text-emerald-400' : 'text-red-400'}>{r.selected.join(', ')}</b></span> : null}
          </div>
          <button onClick={onToggle} className="inline-flex items-center gap-2 rounded-lg bg-white text-zinc-900 px-4 py-2.5 text-sm font-black hover:bg-emerald-300 transition">
            {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} {open ? 'Hide Solution' : 'Show Solution'}
          </button>
        </div>

        {open && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-black text-sm text-emerald-400">Solution</div>
              <div className="text-xs text-zinc-500">Answer: <b className="text-emerald-400">{r.answer?.join(', ') || '—'}</b></div>
            </div>
            {r.videoUrl ? (
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 mb-2"><PlayCircle size={15} className="text-emerald-400"/> Video Solution</div>
                <video controls playsInline preload="metadata" className="w-full max-h-[650px] rounded-xl bg-black" src={r.videoUrl}/>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/10 p-4 text-sm text-zinc-500">No video solution is available for this question.</div>
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

function Stat({ icon, label, value, sub, tone }: any) {
  const tones: Record<string, string> = { amber: 'text-amber-400 bg-amber-500/10', purple: 'text-purple-400 bg-purple-500/10', blue: 'text-blue-400 bg-blue-500/10', green: 'text-emerald-400 bg-emerald-500/10', red: 'text-red-400 bg-red-500/10', gray: 'text-zinc-400 bg-zinc-500/10', cyan: 'text-cyan-400 bg-cyan-500/10' };
  return <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#242424] p-4 min-h-[126px]`}><div className={`w-8 h-8 rounded-lg ${tones[tone]} flex items-center justify-center`}>{icon}</div><div className="text-xs text-zinc-500 mt-3">{label}</div><div className="text-2xl font-black mt-1">{value}<span className="text-sm font-bold text-zinc-500 ml-0.5">{sub}</span></div></div>;
}

function Bar({ value, label, pct: percent, tone }: any) {
  const h = Math.max(10, Math.min(92, percent));
  const bg: Record<string, string> = { green: 'bg-emerald-500', red: 'bg-red-500', gray: 'bg-zinc-500' };
  const text: Record<string, string> = { green: 'text-emerald-400', red: 'text-red-400', gray: 'text-zinc-400' };
  return <div className="flex h-full w-28 flex-col items-center justify-end"><div className={`mb-1 text-sm font-black ${text[tone]}`}>{value}</div><div className={`w-20 rounded-t-lg ${bg[tone]}`} style={{ height: `${h}%` }}><div className="h-full flex items-center justify-center text-xs font-black text-white">{Math.round(percent)}%</div></div><div className="mt-3 text-xs text-zinc-500">{label}</div></div>;
}

function Legend({ dot, text }: any) { return <span className="inline-flex items-center gap-1.5"><i className={`w-2 h-2 rounded-full ${dot}`}/>{text}</span>; }
function SummaryRow({ label, value, good, bad }: any) { return <div className="flex items-center justify-between border-b border-white/5 pb-3"><span className="text-zinc-500">{label}</span><b className={good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-zinc-100'}>{value}</b></div>; }
