'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BookOpen, ChevronRight, CircleCheck, CircleDashed, Loader2, Search } from 'lucide-react';

type Chapter={id:string;name:string;description?:string|null;question_count:number;is_published:boolean};
type Subject={id:string;name:string;description?:string|null;chapters:Chapter[]};

export default function QuestionBankHome(){
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'all'|'started'>('all');

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session)return;
    const res=await fetch('/api/question-bank/structure',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
    const d=await res.json(); if(res.ok)setSubjects(d.subjects||[]);
    setLoading(false);
  })()},[]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return subjects.map(s=>({...s,chapters:(s.chapters||[]).filter(c=>!q||s.name.toLowerCase().includes(q)||c.name.toLowerCase().includes(q))}))
      .filter(s=>(!q||s.name.toLowerCase().includes(q)||s.chapters.length));
  },[subjects,search]);

  if(loading)return <div className="min-h-full flex items-center justify-center text-emerald-400"><Loader2 className="animate-spin mr-2"/>Loading Question Bank…</div>;

  return <div className="max-w-7xl mx-auto p-5 md:p-8 lg:p-10">
    <div className="mb-8">
      <div className="flex items-center gap-3 text-emerald-400"><BookOpen size={24}/><span className="text-xs font-black uppercase tracking-[.3em]">Practice Engine</span></div>
      <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mt-2">Question Bank</h1>
      <p className="text-zinc-500 mt-2 max-w-2xl">Practice chapter-wise, track attempted questions, revisit mistakes, and learn from the explanation after every submission.</p>
    </div>
    <div className="flex flex-wrap gap-2 mb-5">
      <button onClick={()=>setTab('all')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab==='all'?'bg-emerald-500 text-black':'bg-zinc-900 text-zinc-500'}`}>All Chapters</button>
      <button onClick={()=>setTab('started')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab==='started'?'bg-emerald-500 text-black':'bg-zinc-900 text-zinc-500'}`}>Attempted / Progress</button>
    </div>
    <div className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-2xl px-4 py-3 mb-7"><Search size={18} className="text-zinc-600"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject or chapter…" className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-zinc-600"/></div>
    <div className="space-y-5">
      {filtered.map(s=><section key={s.id} className="bg-zinc-900/70 border border-white/5 rounded-3xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><BookOpen size={19}/></div><div><h2 className="font-black text-white">{s.name}</h2><p className="text-[11px] text-zinc-600">{s.chapters?.length||0} chapters</p></div></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {(s.chapters||[]).map(c=><Link key={c.id} href={`/question-bank/chapter/${c.id}`} className="group p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[.04] transition">
            <div className="flex items-start gap-3"><div className="flex-1"><div className="font-bold text-zinc-200 group-hover:text-white">{c.name}</div><div className="text-xs text-zinc-600 mt-1">{c.question_count} questions</div></div><ChevronRight size={18} className="text-zinc-700 group-hover:text-emerald-400"/></div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-600"><CircleDashed size={14}/> Practice chapter</div>
          </Link>)}
        </div>
      </section>)}
      {!filtered.length&&<div className="py-20 text-center text-zinc-600">No matching chapters.</div>}
    </div>
  </div>
}
