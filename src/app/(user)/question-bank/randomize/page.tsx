'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, Dices, Loader2, Play, Shuffle } from 'lucide-react';
import toast from 'react-hot-toast';

type Chapter={id:string;name:string;question_count:number;is_published:boolean};
type Subject={id:string;name:string;chapters:Chapter[];total_questions:number};

export default function RandomizeSetup(){
  const router=useRouter();
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [mode,setMode]=useState<'practice'|'test'>('practice');
  const [count,setCount]=useState(20);
  const [minutes,setMinutes]=useState(40);
  const [open,setOpen]=useState<Record<string,boolean>>({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace('/login');return;}
    const res=await fetch('/api/question-bank/structure',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
    const d=await res.json();
    if(!res.ok){toast.error(d.error||'Unable to load subjects.');return;}
    setSubjects(d.subjects||[]); setLoading(false);
  })()},[router]);

  const selectedQuestions=useMemo(()=>subjects.flatMap(s=>s.chapters).filter(c=>selected.includes(c.id)).reduce((n,c)=>n+Number(c.question_count||0),0),[subjects,selected]);
  const allSelected=subjects.length>0 && subjects.every(s=>s.chapters.length>0 && s.chapters.every(c=>selected.includes(c.id)));
  const maxCount=Math.max(1,Math.min(200,selectedQuestions));

  useEffect(()=>{if(selectedQuestions && count>selectedQuestions)setCount(selectedQuestions)},[selectedQuestions,count]);
  useEffect(()=>{if(mode==='test' && minutes<Math.max(1,count))setMinutes(Math.max(1,count))},[mode,count,minutes]);

  const toggleChapter=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const toggleSubject=(s:Subject)=>{
    const ids=s.chapters.map(c=>c.id); const all=ids.every(id=>selected.includes(id));
    setSelected(prev=>all?prev.filter(id=>!ids.includes(id)):[...new Set([...prev,...ids])]);
  };
  const toggleAll=()=>{
    if(allSelected){setSelected([]);return;}
    setSelected(subjects.flatMap(s=>s.chapters.map(c=>c.id)));
  };

  const start=()=>{
    if(!selected.length){toast.error('Select at least one subject or chapter.');return;}
    const actual=Math.min(Math.max(1,count),selectedQuestions);
    const params=new URLSearchParams({chapters:selected.join(','),count:String(actual),mode});
    if(mode==='test')params.set('minutes',String(Math.max(actual,minutes)));
    router.push(`/question-bank/random?${params.toString()}`);
  };

  if(loading)return <div className="qb-theme min-h-full flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/>Loading Randomizer…</div>;

  return <div className="qb-theme min-h-full bg-slate-50/70 text-slate-900"><div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
    <button onClick={()=>router.push('/question-bank')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm"><ArrowLeft size={16}/>Question Bank</button>
    <div className="mt-6 flex items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center"><Dices size={24}/></div><div><div className="text-xs font-black uppercase tracking-[.25em] text-orange-500">Random Question Engine</div><h1 className="text-3xl md:text-4xl font-black tracking-tight mt-1">Randomize Practice / Test</h1><p className="text-slate-500 mt-2 max-w-2xl">Choose a full subject, individual chapters, or any combination. Questions will be randomly selected from your chosen pool.</p></div></div>

    <div className="grid lg:grid-cols-[1fr_340px] gap-5 mt-7">
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 flex items-center gap-3"><div><h2 className="font-black text-lg">Choose Subjects & Chapters</h2><p className="text-xs text-slate-500 mt-1">Selecting the subject checkbox selects every chapter in that subject.</p></div><button onClick={toggleAll} className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-black"><Check size={14}/>{allSelected?'Clear all':'Select all'}</button></div>
        <div className="divide-y divide-slate-100">{subjects.map(s=>{
          const ids=s.chapters.map(c=>c.id); const chosen=ids.filter(id=>selected.includes(id)).length; const all=ids.length>0&&chosen===ids.length; const partly=chosen>0&&!all; const expanded=open[s.id]??true;
          return <div key={s.id}>
            <div className="px-5 md:px-6 py-4 flex items-center gap-3 hover:bg-slate-50">
              <button type="button" onClick={()=>setOpen(p=>({...p,[s.id]:!expanded}))} className="p-1 text-slate-400"><ChevronDown size={18} className={`transition ${expanded?'':'-rotate-90'}`}/></button>
              <button type="button" onClick={()=>toggleSubject(s)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${all?'bg-orange-500 border-orange-500 text-white':partly?'bg-orange-100 border-orange-400 text-orange-600':'border-slate-300 bg-white'}`}>{(all||partly)&&<Check size={13}/>}</button>
              <button type="button" onClick={()=>setOpen(p=>({...p,[s.id]:!expanded}))} className="text-left flex-1"><div className="font-black">{s.name}</div><div className="text-xs text-slate-500 mt-0.5">{chosen}/{ids.length} chapters selected • {s.total_questions||0} questions</div></button>
              <span className="text-xs font-black text-slate-400">{chosen?`${chosen} selected`:''}</span>
            </div>
            {expanded&&<div className="px-5 md:px-6 pb-4 pl-14 grid sm:grid-cols-2 gap-2">{s.chapters.map(c=>{const checked=selected.includes(c.id);return <button key={c.id} type="button" onClick={()=>toggleChapter(c.id)} className={`flex items-center gap-3 text-left p-3 rounded-xl border transition ${checked?'border-orange-300 bg-orange-50':'border-slate-200 bg-white hover:border-slate-300'}`}><span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked?'bg-orange-500 border-orange-500 text-white':'border-slate-300'}`}>{checked&&<Check size={13}/>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold truncate">{c.name}</span><span className="block text-[11px] text-slate-400 mt-0.5">{c.question_count||0} questions</span></span></button>})}</div>}
          </div>})}</div>
      </section>

      <aside className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 h-fit lg:sticky lg:top-5">
        <h2 className="font-black text-lg">Build your session</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100"><button onClick={()=>setMode('practice')} className={`py-2.5 rounded-lg text-sm font-black ${mode==='practice'?'bg-white shadow-sm text-orange-600':'text-slate-500'}`}>Practice</button><button onClick={()=>setMode('test')} className={`py-2.5 rounded-lg text-sm font-black ${mode==='test'?'bg-white shadow-sm text-orange-600':'text-slate-500'}`}>Test</button></div>
        <div className="mt-5"><label className="text-xs font-black uppercase tracking-wider text-slate-500">Questions</label><input type="number" min={1} max={maxCount} value={count} onChange={e=>setCount(Math.max(1,Math.min(maxCount,Number(e.target.value)||1)))} className="mt-2 w-full h-12 rounded-xl border border-slate-200 px-3 text-lg font-black outline-none focus:border-orange-400"/><div className="text-[11px] text-slate-400 mt-2">Available from selection: <b>{selectedQuestions}</b></div></div>
        {mode==='test'&&<div className="mt-4"><label className="text-xs font-black uppercase tracking-wider text-slate-500">Time limit (minutes)</label><input type="number" min={Math.max(1,count)} max={600} value={minutes} onChange={e=>setMinutes(Math.max(count,Math.min(600,Number(e.target.value)||count)))} className="mt-2 w-full h-12 rounded-xl border border-slate-200 px-3 text-lg font-black outline-none focus:border-orange-400"/><div className="text-[11px] text-slate-400 mt-2">Minimum is 1 minute per question.</div></div>}
        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Selected chapters</span><b>{selected.length}</b></div><div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Question pool</span><b>{selectedQuestions}</b></div><div className="flex justify-between text-sm mt-2"><span className="text-slate-500">Random questions</span><b>{Math.min(count,selectedQuestions)}</b></div></div>
        <button disabled={!selected.length||!selectedQuestions} onClick={start} className="mt-5 w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black shadow-sm disabled:opacity-40"><Play size={17} fill="currentColor"/>Start {mode==='test'?'Test':'Practice'}</button>
      </aside>
    </div>
  </div></div>;
}
