'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Clock3, FileQuestion, LockKeyhole, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TestSeriesPage() {
  const [status, setStatus] = useState<'loading'|'none'|'pending'|'approved'|'rejected'>('loading');
  const [tests, setTests] = useState<any[]>([]);
  const [requesting, setRequesting] = useState(false);
  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: access } = await supabase.from('test_series_access_requests').select('status').eq('user_id', session.user.id).maybeSingle();
    const s = (access?.status || 'none') as any; setStatus(s);
    if (s === 'approved') { const { data } = await supabase.from('test_series').select('id,title,exam_name,duration_minutes,max_marks,question_count,created_at').eq('is_published',true).order('created_at',{ascending:false}); setTests(data || []); }
  };
  useEffect(()=>{
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  },[]);
  const request = async () => { setRequesting(true); const r=await fetch('/api/test-series/request-access',{method:'POST'}); const d=await r.json(); if(!r.ok) toast.error(d.error||'Request failed'); else {toast.success('Access request sent to admin.'); setStatus('pending');} setRequesting(false); };

  if (status === 'loading') return <div className="min-h-full flex items-center justify-center text-emerald-400">Checking test-series clearance...</div>;
  if (status !== 'approved') return <div className="min-h-full flex items-center justify-center p-6"><div className="max-w-lg w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 text-center shadow-2xl"><div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">{status==='pending'?<Clock3 className="text-amber-400" size={30}/>:status==='rejected'?<ShieldAlert className="text-red-400" size={30}/>:<LockKeyhole className="text-emerald-400" size={30}/>}</div><h1 className="text-2xl font-black text-white">Test Series Access</h1><p className="text-zinc-500 mt-3">{status==='pending'?'Your access request is waiting for admin approval.':status==='rejected'?'Your previous request was rejected. You can submit another request.':'This area is restricted. Request access once and an admin will approve your account.'}</p>{status!=='pending'&&<button onClick={request} disabled={requesting} className="mt-7 px-6 py-3 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50">{requesting?'Sending...':'Request Access'}</button>}</div></div>;

  return <div className="max-w-6xl mx-auto p-6 lg:p-10"><div className="mb-8"><div className="flex items-center gap-3"><FileQuestion className="text-emerald-400"/><h1 className="text-3xl font-black text-white">Test Series</h1><span className="text-xs font-black text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1">ACCESS APPROVED</span></div><p className="text-zinc-500 mt-2">Attempt the mock tests in a GATE-style timed environment.</p></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{tests.map(t=><Link key={t.id} href={`/test-series/${t.id}`} className="group bg-zinc-950 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-6 transition-all"><div className="text-xs font-black uppercase tracking-widest text-emerald-400">{t.exam_name}</div><h2 className="text-xl font-black text-white mt-3">{t.title}</h2><div className="grid grid-cols-3 gap-2 mt-6 text-xs text-zinc-500"><div><b className="block text-zinc-200">{t.question_count}</b>Questions</div><div><b className="block text-zinc-200">{t.duration_minutes}m</b>Time</div><div><b className="block text-zinc-200">{t.max_marks}</b>Marks</div></div><div className="mt-6 text-sm font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">Start Test →</div></Link>)}</div>{!tests.length&&<div className="text-zinc-500">No test series published yet.</div>}</div>;
}
