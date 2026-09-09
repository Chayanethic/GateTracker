'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Clock3, FileQuestion, LockKeyhole, ShieldAlert, CheckCircle2, RotateCcw, Trophy, ArrowRight, Flag, Layers3, BookOpen, GraduationCap, ListTree } from 'lucide-react';
import toast from 'react-hot-toast';

type TestCard = {
  id: string;
  title: string;
  exam_name: string;
  duration_minutes: number;
  max_marks: number;
  question_count: number;
  created_at: string;
  provider?: 'prepfusion' | 'madeeasy' | string;
  test_category?: 'topicwise' | 'subjectwise' | 'full_syllabus' | 'standard' | string;
  test_number?: number | null;
  subject?: string | null;
  topic?: string | null;
  syllabus?: string | null;
  exam_year?: number | null;
  stream?: string | null;
  attempt_count: number;
  latest_attempt?: {
    score: number;
    max_marks: number;
    submitted_at: string;
  } | null;
};

export default function TestSeriesPage() {
  const [status, setStatus] = useState<'loading'|'none'|'pending'|'approved'|'rejected'>('loading');
  const [tests, setTests] = useState<TestCard[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [markedCount, setMarkedCount] = useState(0);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setStatus('none');
      setTests([]);
      return;
    }

    const { data: access, error: accessError } = await supabase
      .from('test_series_access_requests')
      .select('status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (accessError) {
      console.error('Test-series access check failed:', accessError);
      return;
    }

    const s = (access?.status || 'none') as 'none' | 'pending' | 'approved' | 'rejected';
    setStatus(s);

    if (s !== 'approved') {
      setTests([]);
      return;
    }

    try {
      const res = await fetch('/api/test-series/list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const d = await res.json();

      if (!res.ok) {
        console.error('Published tests load failed:', d.error);
        setTests([]);
        return;
      }

      setTests(d.tests || []);

      try {
        const markedRes = await fetch('/api/test-series/marked', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const markedData = await markedRes.json();
        if (markedRes.ok) setMarkedCount(Array.isArray(markedData.markedQuestions) ? markedData.markedQuestions.length : 0);
      } catch (markedError) {
        console.error('Marked questions load failed:', markedError);
      }
    } catch (error) {
      console.error('Published tests load failed:', error);
      setTests([]);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const request = async () => {
    setRequesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first.');
        return;
      }

      const { error } = await supabase
        .from('test_series_access_requests')
        .upsert(
          {
            user_id: session.user.id,
            status: 'pending',
            requested_at: new Date().toISOString(),
            reviewed_at: null,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        toast.error(error.message || 'Request failed.');
        return;
      }

      toast.success('Access request sent to admin.');
      setStatus('pending');
    } catch (error: any) {
      toast.error(error?.message || 'Request failed.');
    } finally {
      setRequesting(false);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-full flex items-center justify-center text-emerald-400">Checking test-series clearance...</div>;
  }

  if (status !== 'approved') {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
            {status === 'pending' ? <Clock3 className="text-amber-400" size={30} /> : status === 'rejected' ? <ShieldAlert className="text-red-400" size={30} /> : <LockKeyhole className="text-emerald-400" size={30} />}
          </div>
          <h1 className="text-2xl font-black text-white">Test Series Access</h1>
          <p className="text-zinc-500 mt-3">
            {status === 'pending'
              ? 'Your access request is waiting for admin approval.'
              : status === 'rejected'
                ? 'Your previous request was rejected. You can submit another request.'
                : 'This area is restricted. Request access once and an admin will approve your account.'}
          </p>
          {status !== 'pending' && (
            <button onClick={request} disabled={requesting} className="mt-7 px-6 py-3 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50">
              {requesting ? 'Sending...' : 'Request Access'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-5 md:p-8 lg:p-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <FileQuestion className="text-emerald-400" />
            <h1 className="text-3xl font-black text-white">Test Series</h1>
            <span className="text-xs font-black text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1">ACCESS APPROVED</span>
          </div>
          <p className="text-zinc-500 mt-2">GATE-style timed examinations with detailed attempt analysis.</p>
        </div>
        <div className="text-xs text-zinc-500">{tests.length} published test{tests.length === 1 ? '' : 's'}</div>
      </div>

      <Link
        href="/test-series/marked"
        className="mb-6 group flex items-center justify-between gap-4 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 px-5 py-4 hover:border-violet-400/40 hover:bg-violet-500/15 transition-all"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center"><Flag size={20}/></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h2 className="font-black text-white">Bookmarked Questions</h2><span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-black text-violet-300">{markedCount}</span></div>
            <p className="text-xs text-zinc-500 mt-1 truncate">Open your saved review questions, read the options, analyse the old attempt, or attempt the question again.</p>
          </div>
        </div>
        <ArrowRight size={18} className="shrink-0 text-violet-400 group-hover:translate-x-1 transition-transform"/>
      </Link>

      {(() => {
        const prepfusion = tests.filter(t => t.provider !== 'madeeasy');
        const madeEasy = tests.filter(t => t.provider === 'madeeasy');
        const renderTest = (t: TestCard) => {
          const attempted = t.attempt_count > 0;
          const latestScore = Number(t.latest_attempt?.score || 0);
          const maxMarks = Number(t.latest_attempt?.max_marks || t.max_marks || 0);
          return (
            <div key={t.id} className="group relative overflow-hidden bg-zinc-950 border border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all">
              {attempted && <div className="px-5 pt-5"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-emerald-400 text-xs font-black"><CheckCircle2 size={17}/> ATTEMPTED</div><span className="text-xs text-zinc-500">Attempt {t.attempt_count}</span></div><div className="mt-2 text-sm text-zinc-400">Latest score: <b className="text-white">{latestScore}/{maxMarks}</b></div><div className="mt-1 text-xs text-zinc-500">{t.attempt_count === 1 ? '1 time already attempted' : `${t.attempt_count} times already attempted`}</div></div></div>}
              <div className="p-6"><div className="flex flex-wrap gap-2"><div className="text-xs font-black uppercase tracking-widest text-emerald-400">{t.exam_name}</div>{t.exam_year ? <span className="text-[10px] font-black rounded-full bg-white/5 border border-white/10 px-2 py-1 text-zinc-400">GATE {t.exam_year}</span> : null}{t.stream ? <span className="text-[10px] font-black rounded-full bg-white/5 border border-white/10 px-2 py-1 text-zinc-400">{t.stream}</span> : null}{t.test_number ? <span className="text-[10px] font-black rounded-full bg-white/5 border border-white/10 px-2 py-1 text-zinc-400">Test No. {t.test_number}</span> : null}</div><h2 className="text-xl font-black text-white mt-3">{t.title}</h2>{(t.subject || t.topic || t.syllabus) && <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/5 p-3 text-xs text-zinc-400 space-y-1">{t.subject && <div><b className="text-zinc-200">Subject:</b> {t.subject}</div>}{t.topic && <div><b className="text-zinc-200">Topic:</b> {t.topic}</div>}{t.syllabus && <div><b className="text-zinc-200">Syllabus:</b> {t.syllabus}</div>}</div>}<div className="grid grid-cols-3 gap-2 mt-6 text-xs text-zinc-500"><div><b className="block text-zinc-200">{t.question_count}</b>Questions</div><div><b className="block text-zinc-200">{t.duration_minutes}m</b>Time</div><div><b className="block text-zinc-200">{t.max_marks}</b>Marks</div></div><div className="mt-6 flex gap-2"><Link href={`/test-series/${t.id}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 font-black hover:bg-emerald-300 transition">{attempted ? <><RotateCcw size={16}/> Reattempt</> : <>Start Test <ArrowRight size={16}/></>}</Link>{attempted && <Link href={`/test-series/${t.id}/analysis`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/5"><Trophy size={16}/> Results</Link>}</div></div>
            </div>
          );
        };
        const groupBySubject = (items: TestCard[]) => Array.from(new Set(items.map(t => t.subject || 'General / Unspecified'))).map(subject => ({ subject, items: items.filter(t => (t.subject || 'General / Unspecified') === subject) }));
        const categoryItems = (cat: string) => madeEasy.filter(t => t.test_category === cat);
        const categoryCard = (cat: MadeEasyCategory, title: string, subtitle: string, icon: React.ReactNode, items: TestCard[]) => (
          <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] to-zinc-950 p-5 md:p-6">
            <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-300 flex items-center justify-center">{icon}</div><div><h3 className="text-xl font-black text-white">{title}</h3><p className="text-xs text-zinc-500 mt-1">{subtitle}</p></div><span className="ml-auto rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-black text-zinc-400">{items.length} tests</span></div>
            <div className="mt-6 space-y-6">{groupBySubject(items).map(group => <div key={group.subject}><div className="flex items-center gap-2 mb-3 text-sm font-black text-violet-200"><BookOpen size={16}/>{group.subject}</div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{group.items.sort((a,b)=>(a.test_number||999)-(b.test_number||999)).map(renderTest)}</div></div>)}{!items.length && <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">No {title.toLowerCase()} tests published yet.</div>}</div>
          </section>
        );
        return <div className="space-y-10">
          {prepfusion.length > 0 && <section><div className="flex items-center gap-3 mb-5"><div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Layers3 size={21}/></div><div><h2 className="text-2xl font-black text-white">PREPFUSION Test Series</h2><p className="text-xs text-zinc-500 mt-1">Standard test-series structure. Topicwise / subjectwise grouping is not applied here.</p></div></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{prepfusion.map(renderTest)}</div></section>}
          {madeEasy.length > 0 && <section><div className="flex items-center gap-3 mb-5"><div className="w-11 h-11 rounded-2xl bg-violet-500/10 text-violet-300 flex items-center justify-center"><GraduationCap size={21}/></div><div><h2 className="text-2xl font-black text-white">MADE EASY Test Series</h2><p className="text-xs text-zinc-500 mt-1">Organized exactly into the three MADE EASY buckets requested: Topicwise, Single Subject and Full Syllabus.</p></div></div><div className="space-y-6">{categoryCard('topicwise','Topicwise Tests','Part-syllabus tests grouped by subject and topic.',<ListTree size={22}/>,categoryItems('topicwise'))}{categoryCard('subjectwise','Single Subject Tests','One subject at a time, with its test sequence.',<BookOpen size={22}/>,categoryItems('subjectwise'))}{categoryCard('full_syllabus','Full Syllabus Tests','Full-syllabus tests grouped by subject.',<GraduationCap size={22}/>,categoryItems('full_syllabus'))}</div></section>}
        </div>;
      })()}

      {!tests.length && <div className="text-zinc-500">No test series published yet.</div>}
    </div>
  );
}
