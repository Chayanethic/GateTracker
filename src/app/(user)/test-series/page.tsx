'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Clock3, FileQuestion, LockKeyhole, ShieldAlert, CheckCircle2, RotateCcw, Trophy, ArrowRight, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

type TestCard = {
  id: string;
  title: string;
  exam_name: string;
  duration_minutes: number;
  max_marks: number;
  question_count: number;
  created_at: string;
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
      setTests(Array.isArray(d.tests) ? d.tests : []);
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
          { user_id: session.user.id, status: 'pending', requested_at: new Date().toISOString(), reviewed_at: null },
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
            {status === 'pending' ? 'Your access request is waiting for admin approval.' : status === 'rejected' ? 'Your previous request was rejected. You can submit another request.' : 'This area is restricted. Request access once and an admin will approve your account.'}
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
    <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <FileQuestion className="text-emerald-400" size={18} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Test Series</h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-1">
              <CheckCircle2 size={11} /> ACCESS APPROVED
            </span>
          </div>
          <p className="text-zinc-500 mt-1.5 text-sm">Timed GATE-style examinations with complete attempt analysis.</p>
        </div>
        <div className="text-[11px] font-bold text-zinc-600">{tests.length} published test{tests.length === 1 ? '' : 's'}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {tests.map((t) => {
          const attempted = t.attempt_count > 0;
          const latestScore = Number(t.latest_attempt?.score || 0);
          const maxMarks = Number(t.latest_attempt?.max_marks || t.max_marks || 0);

          return (
            <article
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_10px_35px_rgba(0,0,0,.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100" />

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400 truncate">{t.exam_name}</div>
                    <h2 className="mt-1.5 text-base font-black text-white leading-snug line-clamp-2">{t.title}</h2>
                  </div>
                  {attempted ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-400">
                      <CheckCircle2 size={11} /> ATTEMPTED
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-zinc-500">NEW</span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/5 bg-white/[0.025] py-2.5">
                  <MiniStat icon={<ClipboardList size={13} />} value={String(t.question_count)} label="Questions" />
                  <MiniStat icon={<Clock3 size={13} />} value={`${t.duration_minutes}m`} label="Duration" />
                  <MiniStat icon={<Trophy size={13} />} value={String(t.max_marks)} label="Marks" />
                </div>

                {attempted ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2.5">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-zinc-600">Latest score</div>
                      <div className="mt-0.5 text-sm font-black text-white">{latestScore}<span className="text-zinc-600">/{maxMarks}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-widest text-zinc-600">Attempts</div>
                      <div className="mt-0.5 text-sm font-black text-emerald-400">{t.attempt_count}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 h-[44px] flex items-center rounded-xl bg-white/[0.02] px-3 text-[11px] text-zinc-600">
                    Not attempted yet · Start when ready
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/test-series/${t.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-black text-black transition hover:bg-emerald-300"
                  >
                    {attempted ? <><RotateCcw size={14} /> Reattempt</> : <>Start Test <ArrowRight size={14} /></>}
                  </Link>
                  {attempted && (
                    <Link
                      href={`/test-series/${t.id}/analysis`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white hover:bg-white/5"
                    >
                      <Trophy size={14} /> Results
                    </Link>
                  )}
                </div>

                {attempted && (
                  <div className="mt-2 text-center text-[10px] text-zinc-600">
                    {t.attempt_count === 1 ? 'Attempted 1 time' : `Attempted ${t.attempt_count} times`}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!tests.length && <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950 p-8 text-center text-sm text-zinc-500">No test series published yet.</div>}
    </div>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center text-center">
      <div className="flex items-center gap-1 text-zinc-600">{icon}<span className="text-[8px] uppercase tracking-wider">{label}</span></div>
      <div className="mt-0.5 text-xs font-black text-zinc-200">{value}</div>
    </div>
  );
}
