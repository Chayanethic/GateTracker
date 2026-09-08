'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Flag, PlayCircle, Search, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

type MarkedQuestion = {
  key: string; testId: string; testTitle: string; examName: string;
  attemptId: string; attemptNumber: number; totalAttempts: number;
  number: number; type: string; questionHtml: string;
  options: { key: string; html: string }[]; markedAt: string;
};

export default function MarkedQuestionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<MarkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [light, setLight] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      try {
        const res = await fetch('/api/test-series/marked', {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store'
        });
        const d = await res.json();
        if (!res.ok) { toast.error(d.error || 'Unable to load marked questions.'); return; }
        setItems(d.markedQuestions || []);
      } catch (e) {
        console.error(e); toast.error('Unable to load marked questions.');
      } finally { setLoading(false); }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x => `${x.testTitle} ${x.examName} ${x.number} ${x.type}`.toLowerCase().includes(q));
  }, [items, query]);

  const bg = light ? 'min-h-screen bg-slate-100 text-slate-900' : 'min-h-screen bg-[#181818] text-white';
  if (loading) return <div className={bg + ' flex items-center justify-center text-emerald-500'}>Loading marked questions...</div>;

  return (
    <div className={bg}>
      <div className="w-full px-4 sm:px-6 lg:px-10 py-5 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => router.push('/test-series')} className={light ? 'flex items-center gap-2 font-bold text-slate-600 hover:text-slate-900' : 'flex items-center gap-2 font-bold text-zinc-300 hover:text-white'}>
            <ArrowLeft size={18}/> Test Series
          </button>
          <button onClick={() => setLight(v => !v)} className={light ? 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-black text-slate-700' : 'inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-black'}>
            {light ? <Moon size={16}/> : <Sun size={16}/>} {light ? 'Dark' : 'Light'}
          </button>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-500"><Flag size={20}/><span className="text-xs font-black uppercase tracking-[.2em]">Review Bank</span></div>
            <h1 className="mt-2 text-3xl font-black">Marked For Review</h1>
            <p className={light ? 'mt-2 text-slate-500' : 'mt-2 text-zinc-500'}>Questions you marked for review in previous attempts. Pick any one to practice again.</p>
          </div>
          <div className={light ? 'flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2' : 'flex items-center gap-2 rounded-xl border border-white/10 bg-[#222] px-3 py-2'}>
            <Search size={16} className="text-zinc-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions" className={light ? 'w-44 bg-transparent outline-none text-sm text-slate-900' : 'w-44 bg-transparent outline-none text-sm text-white'} />
          </div>
        </div>

        <div className="mt-7 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(item => (
            <article key={item.key} className={light ? 'rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm' : 'rounded-2xl border border-white/10 bg-[#222] overflow-hidden'}>
              <div className={light ? 'px-5 py-4 border-b border-slate-200 flex items-center justify-between' : 'px-5 py-4 border-b border-white/10 flex items-center justify-between'}>
                <div><div className="font-black">Q{item.number} · {item.type}</div><div className="text-xs text-violet-500 mt-1">Marked in Attempt {item.attemptNumber}</div></div>
                <Flag size={17} className="text-violet-500" />
              </div>
              <div className="p-5">
                <div className={light ? 'prose max-w-none text-sm leading-6 text-slate-800' : 'prose prose-invert max-w-none text-sm leading-6'} dangerouslySetInnerHTML={{__html:item.questionHtml}} />
                {item.options?.length ? <div className="mt-5 space-y-2">{item.options.map(o => <div key={o.key} className={light ? 'flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm' : 'flex gap-3 rounded-lg border border-white/10 bg-white/[.02] p-3 text-sm'}><b>{o.key}.</b><span dangerouslySetInnerHTML={{__html:o.html}}/></div>)}</div> : null}
                <div className="mt-5 flex gap-2">
                  <button onClick={() => router.push(`/test-series/${item.testId}?question=${item.number}`)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-zinc-900 py-3 font-black hover:bg-emerald-300"><PlayCircle size={16}/> Attempt</button>
                  <button onClick={() => router.push(`/test-series/${item.testId}/analysis?attempt=${item.attemptId}`)} className={light ? 'rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold' : 'rounded-xl border border-white/10 px-4 py-3 text-sm font-bold'}>Analysis</button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && <div className={light ? 'mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500' : 'mt-8 rounded-2xl border border-white/10 bg-[#222] p-12 text-center text-zinc-500'}>{items.length ? 'No matching marked questions.' : 'No marked-for-review questions yet. Mark questions during an exam and submit it to save them here.'}</div>}
      </div>
    </div>
  );
}
