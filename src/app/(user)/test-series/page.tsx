'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Clock3, FileQuestion, LockKeyhole, ShieldAlert, CheckCircle2, RotateCcw, Trophy, ArrowRight, Flag, Layers3, BookOpen, GraduationCap, ListTree, ChevronLeft, Sparkles, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

type MadeEasyCategory = 'topicwise' | 'subjectwise' | 'full_syllabus';

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
  const [selectedProvider, setSelectedProvider] = useState<'madeeasy' | 'prepfusion' | null>(null);

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
            <div key={t.id} className="group relative overflow-hidden bg-zinc-950/90 border border-white/10 hover:border-emerald-500/40 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {attempted && (
                <div className="px-3 pt-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black">
                      <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={14}/> ATTEMPTED</span>
                      <span className="text-zinc-500">Attempt {t.attempt_count}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-400">Score: <b className="text-white">{latestScore}/{maxMarks}</b></div>
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1.5 min-h-5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">{t.exam_name}</span>
                  {t.exam_year ? <span className="text-[9px] font-black rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-zinc-400">GATE {t.exam_year}</span> : null}
                  {t.test_number ? <span className="text-[9px] font-black rounded-full bg-white/5 border border-white/10 px-1.5 py-0.5 text-zinc-400">#{t.test_number}</span> : null}
                </div>

                <h2 className="text-base font-black leading-snug text-white mt-2 line-clamp-2 min-h-[2.5rem]">{t.title}</h2>

                {(t.subject || t.topic) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {t.subject && <span className="max-w-full truncate rounded-lg bg-white/[0.04] border border-white/5 px-2 py-1 text-[9px] font-bold text-zinc-400">{t.subject}</span>}
                    {t.topic && <span className="max-w-full truncate rounded-lg bg-white/[0.04] border border-white/5 px-2 py-1 text-[9px] font-bold text-zinc-500">{t.topic}</span>}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 mt-4 rounded-xl border border-white/5 bg-white/[0.025] p-2.5 text-center">
                  <div><b className="block text-sm text-white">{t.question_count}</b><span className="text-[9px] text-zinc-500">Questions</span></div>
                  <div className="border-x border-white/5"><b className="block text-sm text-white">{t.duration_minutes}m</b><span className="text-[9px] text-zinc-500">Time</span></div>
                  <div><b className="block text-sm text-white">{t.max_marks}</b><span className="text-[9px] text-zinc-500">Marks</span></div>
                </div>

                <div className="mt-3 flex gap-1.5">
                  <Link href={`/test-series/${t.id}`} className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-black py-2.5 text-xs font-black hover:bg-emerald-300 transition">
                    {attempted ? <><RotateCcw size={14}/> Reattempt</> : <>Start <ArrowRight size={14}/></>}
                  </Link>
                  {attempted && <Link href={`/test-series/${t.id}/analysis`} aria-label="View results" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 text-white hover:bg-white/5"><Trophy size={14}/></Link>}
                </div>
              </div>
            </div>
          );
        };

        const groupBySubject = (items: TestCard[]) => Array.from(new Set(items.map(t => t.subject || 'General / Unspecified'))).map(subject => ({ subject, items: items.filter(t => (t.subject || 'General / Unspecified') === subject) }));
        const categoryItems = (cat: string) => madeEasy.filter(t => t.test_category === cat);

        const categoryCard = (cat: MadeEasyCategory, title: string, subtitle: string, icon: React.ReactNode, items: TestCard[]) => (
          <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] to-zinc-950 p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center">{icon}</div>
              <div className="min-w-0"><h3 className="text-base font-black text-white">{title}</h3><p className="text-[10px] text-zinc-500 mt-0.5 truncate">{subtitle}</p></div>
              <span className="ml-auto shrink-0 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-black text-zinc-400">{items.length}</span>
            </div>
            <div className="mt-4 space-y-4">
              {groupBySubject(items).map(group => (
                <div key={group.subject}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-black text-violet-200"><BookOpen size={14}/>{group.subject}</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">{group.items.sort((a,b)=>(a.test_number||999)-(b.test_number||999)).map(renderTest)}</div>
                </div>
              ))}
              {!items.length && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">No {title.toLowerCase()} tests published yet.</div>}
            </div>
          </section>
        );

        const providerChoice = (provider: 'madeeasy' | 'prepfusion', title: string, description: string, count: number, icon: React.ReactNode, accent: string) => (
          <button
            type="button"
            onClick={() => setSelectedProvider(provider)}
            className={`group relative overflow-hidden text-left rounded-2xl border bg-zinc-950/90 p-4 md:p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${accent}`}
          >
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/[0.03] group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">{icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-[0.18em] font-black text-zinc-500">Choose provider</div>
                <h2 className="text-lg font-black text-white mt-0.5">{title}</h2>
              </div>
              <ArrowRight size={18} className="text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            <p className="relative text-[11px] leading-relaxed text-zinc-500 mt-3">{description}</p>
            <div className="relative mt-3 flex items-center justify-between">
              <span className="text-[10px] font-black text-zinc-400">{count} published {count === 1 ? 'test' : 'tests'}</span>
              <span className="text-[10px] font-black text-white/60 group-hover:text-white">Open series →</span>
            </div>
          </button>
        );

        if (!selectedProvider) {
          return (
            <section className="space-y-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.09] via-zinc-950 to-violet-500/[0.08] p-5 md:p-7">
                <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="relative flex items-start gap-4">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center"><Sparkles size={23}/></div>
                  <div>
                    <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Test Library</span><Zap size={13} className="text-amber-300" /></div>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-1">Choose your test series</h2>
                    <p className="text-xs md:text-sm text-zinc-500 mt-2 max-w-2xl">Pick a provider to jump directly into its test collection. Everything is arranged for quick scanning and fast test selection.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {providerChoice('madeeasy', 'MADE EASY', 'Topicwise, Single Subject and Full Syllabus tests.', madeEasy.length, <GraduationCap size={22} className="text-violet-300" />, 'border-violet-500/25 hover:border-violet-400/60')}
                {providerChoice('prepfusion', 'PREPFUSION', 'Standard GATE-style test series and practice tests.', prepfusion.length, <Layers3 size={22} className="text-emerald-300" />, 'border-emerald-500/25 hover:border-emerald-400/60')}
              </div>
            </section>
          );
        }

        const isMadeEasy = selectedProvider === 'madeeasy';
        return (
          <section className="space-y-5">
            <button type="button" onClick={() => setSelectedProvider(null)} className="inline-flex items-center gap-1.5 text-xs font-black text-zinc-400 hover:text-white transition">
              <ChevronLeft size={16}/> Back to providers
            </button>

            {isMadeEasy ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center"><GraduationCap size={19}/></div>
                  <div><h2 className="text-xl font-black text-white">MADE EASY Test Series</h2><p className="text-[10px] text-zinc-500 mt-0.5">Choose a test quickly from Topicwise, Single Subject or Full Syllabus.</p></div>
                  <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-zinc-400">{madeEasy.length} tests</span>
                </div>
                <div className="space-y-4">
                  {categoryCard('topicwise','Topicwise Tests','Part-syllabus tests grouped by subject and topic.',<ListTree size={18}/>,categoryItems('topicwise'))}
                  {categoryCard('subjectwise','Single Subject Tests','One subject at a time, with its test sequence.',<BookOpen size={18}/>,categoryItems('subjectwise'))}
                  {categoryCard('full_syllabus','Full Syllabus Tests','Full-syllabus tests grouped by subject.',<GraduationCap size={18}/>,categoryItems('full_syllabus'))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center"><Layers3 size={19}/></div>
                  <div><h2 className="text-xl font-black text-white">PREPFUSION Test Series</h2><p className="text-[10px] text-zinc-500 mt-0.5">Standard GATE-style test series.</p></div>
                  <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-zinc-400">{prepfusion.length} tests</span>
                </div>
                {prepfusion.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">{prepfusion.map(renderTest)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500">No PREPFUSION tests published yet.</div>}
              </div>
            )}
          </section>
        );
      })()}
      {!tests.length && <div className="text-zinc-500">No test series published yet.</div>}
    </div>
  );
}
