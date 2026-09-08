'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, PlayCircle, Clock3 } from 'lucide-react';
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

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('attempt'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const res = await fetch(`/api/test-series/attempts?testId=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Unable to load analysis.'); setLoading(false); return; }
      setData(d);
      if (!selectedId && d.attempts?.length) setSelectedId(d.attempts[0].attemptId);
      setLoading(false);
    })();
  }, [id, router]);

  const attempt = useMemo(
    () => data?.attempts?.find((a: any) => a.attemptId === selectedId) || data?.attempts?.[0],
    [data, selectedId]
  );

  if (loading) return <div className="min-h-full flex items-center justify-center text-emerald-400">Loading analysis...</div>;

  if (!data?.attempts?.length) return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10">
      <button onClick={() => router.push(`/test-series/${id}`)} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8"><ArrowLeft size={18}/> Back to Test</button>
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-10 text-center">
        <h1 className="text-2xl font-black text-white">No Attempts Yet</h1>
        <p className="text-zinc-500 mt-2">Start this test to create your first result.</p>
        <button onClick={() => router.push(`/test-series/${id}`)} className="mt-6 bg-emerald-500 text-black font-black px-6 py-3 rounded-xl">Start Test</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-5 lg:p-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button onClick={() => router.push(`/test-series/${id}`)} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-3"><ArrowLeft size={18}/> Back to Test</button>
          <h1 className="text-3xl font-black text-white">{data.test.title} — Analysis</h1>
          <p className="text-zinc-500 mt-1">Choose an attempt to view its complete question-by-question analysis.</p>
        </div>
        <button onClick={() => router.push(`/test-series/${id}`)} className="bg-emerald-500 text-black font-black px-5 py-3 rounded-xl">Start Another Attempt</button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.attempts.map((a: any) => (
          <button key={a.attemptId} onClick={() => setSelectedId(a.attemptId)}
            className={`min-w-[180px] text-left p-4 rounded-2xl border ${a.attemptId === attempt?.attemptId ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-zinc-950'}`}>
            <div className="text-xs text-zinc-500">Attempt {a.attemptNumber}</div>
            <div className="text-2xl font-black text-white mt-1">{a.score}/{a.maxMarks}</div>
            <div className="text-xs text-zinc-500 mt-1">{new Date(a.submittedAt).toLocaleString()}</div>
          </button>
        ))}
      </div>

      {attempt && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Marks" value={`${attempt.score}/${attempt.maxMarks}`} cls="text-emerald-400"/>
            <Stat label="Correct" value={`✅ ${attempt.correct}`} cls="text-emerald-400"/>
            <Stat label="Incorrect" value={`❌ ${attempt.incorrect}`} cls="text-red-400"/>
            <Stat label="Not Answered" value={`— ${attempt.notAnswered}`} cls="text-amber-400"/>
            <Stat label="Total Time" value={fmt(attempt.totalTimeSeconds)} cls="text-blue-400"/>
          </div>

          <div className="space-y-4">
            {attempt.review.map((r: any) => (
              <div key={r.id} className="bg-zinc-950 border border-white/10 rounded-2xl p-5 lg:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-black text-white text-lg">Q{r.number} <span className="text-xs text-zinc-500 ml-2">{r.type}</span></div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={r.result === 'correct' ? 'text-emerald-400' : r.result === 'incorrect' ? 'text-red-400' : 'text-amber-400'}>
                      {r.result === 'correct' ? '✅ Correct' : r.result === 'incorrect' ? '❌ Incorrect' : 'Not Answered'}
                    </span>
                    <span className="text-zinc-400">+{Number(r.positiveMarks || 0).toFixed(2)} / <span className={r.type === 'MCQ' ? 'text-red-400' : 'text-zinc-500'}>−{Number(r.negativeMarks || 0).toFixed(2)}</span></span>
                    <b className={r.marks >= 0 ? 'text-emerald-400' : 'text-red-400'}>{r.marks > 0 ? '+' : ''}{Number(r.marks).toFixed(2)} marks</b>
                    <span className="text-zinc-400"><Clock3 size={14} className="inline mr-1"/> {fmt(r.timeSpentSeconds)}</span>
                  </div>
                </div>
                <div className="mt-5 text-sm text-zinc-400">Your answer: <b className="text-white">{r.selected?.length ? r.selected.join(', ') : 'Not answered'}</b> · Correct answer: <b className="text-emerald-400">{r.answer?.join(', ') || '—'}</b></div>

                <details className="mt-5 border border-white/10 rounded-xl overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 text-emerald-400 font-bold">View Solution</summary>
                  <div className="p-5 border-t border-white/10">
                    <div className="prose prose-invert max-w-none text-sm leading-7" dangerouslySetInnerHTML={{__html: r.solutionHtml || '<span class="text-zinc-500">No written solution provided.</span>'}}/>
                    {r.videoUrl && (
                      <div className="mt-5">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black mb-2"><PlayCircle size={15}/> VIDEO SOLUTION</div>
                        <video controls playsInline preload="metadata" className="w-full max-h-[650px] rounded-xl bg-black" src={r.videoUrl}/>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({label,value,cls}:{label:string;value:string;cls:string}) {
  return <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4"><div className="text-xs text-zinc-500">{label}</div><div className={`text-xl font-black mt-1 ${cls}`}>{value}</div></div>;
}
