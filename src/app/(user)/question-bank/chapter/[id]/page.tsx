'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Circle, Flag, Loader2, RotateCcw, Send, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type Q={id:string;question_number:number;question_type:string;question_html:string;options:any[];explanation_html:string;difficulty?:string|null;topic?:string|null;tags?:string[];marks?:number|null;negative_marks?:number|null;image_urls?:string[];option_image_urls?:Record<string,string>;progress?:any};

function optionHtml(o:any){return String(o?.html ?? o?.text ?? o?.content ?? o?.label ?? o ?? '')}
function optionKey(o:any,i:number){return String(o?.key ?? o?.id ?? i)}
function cleanAnswer(a:any):string[]{return Array.isArray(a)?a.map(String):a==null?[]:[String(a)]}

export default function ChapterPractice(){
  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const [questions,setQuestions]=useState<Q[]>([]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<string[]>([]);
  const [result,setResult]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [filter,setFilter]=useState<'all'|'unattempted'|'attempted'>('all');
  const [bookmarkedOnly,setBookmarkedOnly]=useState(false);

  const load=async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace('/login');return}
    const res=await fetch(`/api/question-bank/questions?chapterId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
    const d=await res.json();
    if(!res.ok){toast.error(d.error||'Unable to load questions.');return}
    setQuestions(d.questions||[]);
    setLoading(false);
  };
  useEffect(()=>{void load()},[id]);

  const visible=useMemo(()=>questions.filter(q=>{
    const attempted=(q.progress?.attempted_count||0)>0;
    if(filter==='attempted'&&!attempted)return false;
    if(filter==='unattempted'&&attempted)return false;
    if(bookmarkedOnly&&!q.progress?.bookmarked)return false;
    return true;
  }),[questions,filter,bookmarkedOnly]);

  useEffect(()=>{setIndex(0);setSelected([]);setResult(null)},[filter,bookmarkedOnly]);

  const q=visible[index];

  const submit=async()=>{
    if(!q){return}
    if(!selected.length){toast.error('Select an answer first.');return}
    setSubmitting(true);
    try{
      const {data:{session}}=await supabase.auth.getSession(); if(!session)return;
      const res=await fetch('/api/question-bank/attempt',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({questionId:q.id,answer:selected})});
      const d=await res.json(); if(!res.ok)throw new Error(d.error||'Submission failed');
      setResult(d);
      setQuestions(prev=>prev.map(x=>x.id===q.id?{...x,progress:{...x.progress,attempted_count:(x.progress?.attempted_count||0)+1,correct_count:(x.progress?.correct_count||0)+(d.correct?1:0),incorrect_count:(x.progress?.incorrect_count||0)+(d.correct?0:1),last_result:d.result}}:x));
    }catch(e:any){toast.error(e.message)}finally{setSubmitting(false)}
  };

  const toggleProgress=async(action:'bookmark'|'review',value:boolean)=>{
    if(!q)return;
    const {data:{session}}=await supabase.auth.getSession();if(!session)return;
    await fetch('/api/question-bank/attempt',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({questionId:q.id,action,value})});
    setQuestions(prev=>prev.map(x=>x.id===q.id?{...x,progress:{...x.progress,[action==='bookmark'?'bookmarked':'marked_for_review']:value}}:x));
  };

  const choose=(key:string)=>{
    if(result)return;
    setSelected(prev=>{
      if(q.question_type==='MSQ') return prev.includes(key)?prev.filter(x=>x!==key):[...prev,key];
      return [key];
    });
  };

  const move=(delta:number)=>{
    const next=Math.max(0,Math.min(visible.length-1,index+delta));
    setIndex(next);setSelected([]);setResult(null);
  };

  if(loading)return <div className="min-h-full flex items-center justify-center text-emerald-400"><Loader2 className="animate-spin mr-2"/>Loading questions…</div>;
  if(!q)return <div className="min-h-full flex flex-col items-center justify-center p-6 text-center"><div className="text-white font-black text-xl">No questions in this filter</div><button onClick={()=>{setFilter('all');setBookmarkedOnly(false)}} className="mt-4 px-4 py-2 bg-emerald-500 text-black rounded-xl font-bold">Show all</button></div>;

  const attemptedCount=questions.filter(x=>(x.progress?.attempted_count||0)>0).length;
  const correct=selected.length&&result?.correct;
  const isLast=index===visible.length-1;

  return <div className="max-w-7xl mx-auto p-4 md:p-7">
    <div className="flex items-center gap-3 mb-5"><button onClick={()=>router.push('/question-bank')} className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"><ArrowLeft size={18}/></button><div className="flex-1"><div className="text-[10px] uppercase tracking-[.25em] text-emerald-400 font-black">Question Bank</div><h1 className="text-xl md:text-2xl font-black text-white">Chapter Practice</h1></div><div className="text-xs text-zinc-600">{index+1} / {visible.length}</div></div>

    <div className="grid lg:grid-cols-[280px_1fr] gap-5">
      <aside className="bg-zinc-900/80 border border-white/5 rounded-2xl p-4 h-fit lg:sticky lg:top-5">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Metric label="Total" value={questions.length}/><Metric label="Attempted" value={attemptedCount}/><Metric label="Left" value={questions.length-attemptedCount}/>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all','unattempted','attempted'] as const).map(v=><button key={v} onClick={()=>setFilter(v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${filter===v?'bg-emerald-500 text-black':'bg-black/30 text-zinc-500'}`}>{v}</button>)}
          <button onClick={()=>setBookmarkedOnly(v=>!v)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${bookmarkedOnly?'bg-amber-400 text-black':'bg-black/30 text-zinc-500'}`}><Bookmark size={11} className="inline mr-1"/>Saved</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 max-h-[330px] overflow-y-auto pr-1">
          {visible.map((x,i)=><button key={x.id} onClick={()=>{setIndex(i);setSelected([]);setResult(null)}} className={`h-8 rounded-lg text-[10px] font-black ${i===index?'ring-2 ring-emerald-400 ':''}${x.progress?.last_result==='correct'?'bg-emerald-500/20 text-emerald-400':x.progress?.last_result==='incorrect'?'bg-red-500/20 text-red-400':x.progress?.attempted_count?'bg-amber-500/10 text-amber-400':'bg-black/30 text-zinc-600'}`}>{x.question_number}</button>)}
        </div>
      </aside>

      <main>
        <div className="bg-zinc-900/80 border border-white/5 rounded-3xl overflow-hidden">
          <div className="px-5 md:px-7 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black">{q.question_type}</span>
            {q.difficulty&&<span className="px-2.5 py-1 rounded-lg bg-white/5 text-zinc-500 text-[10px] font-black uppercase">{q.difficulty}</span>}
            {q.topic&&<span className="text-xs text-zinc-600">Topic: {q.topic}</span>}
            <div className="ml-auto flex gap-1">
              <button title="Bookmark" onClick={()=>void toggleProgress('bookmark',!q.progress?.bookmarked)} className={`p-2 rounded-lg ${q.progress?.bookmarked?'text-amber-400 bg-amber-400/10':'text-zinc-600 hover:text-white'}`}><Bookmark size={17} fill={q.progress?.bookmarked?'currentColor':'none'}/></button>
              <button title="Mark for review" onClick={()=>void toggleProgress('review',!q.progress?.marked_for_review)} className={`p-2 rounded-lg ${q.progress?.marked_for_review?'text-violet-400 bg-violet-400/10':'text-zinc-600 hover:text-white'}`}><Flag size={17} fill={q.progress?.marked_for_review?'currentColor':'none'}/></button>
            </div>
          </div>

          <div className="p-5 md:p-8">
            <div className="text-[11px] text-zinc-600 font-black uppercase tracking-wider mb-4">Question {q.question_number}</div>
            <div className="prose prose-invert max-w-none text-zinc-100 leading-7 [&_img]:max-w-full [&_img]:rounded-xl" dangerouslySetInnerHTML={{__html:q.question_html||''}}/>
            <div className="mt-7 space-y-3">
              {(q.options||[]).map((o,i)=>{
                const key=optionKey(o,i); const active=selected.includes(key); const correctKey=result?.correctAnswer?.map(String).includes(key);
                return <button key={key} disabled={Boolean(result)} onClick={()=>choose(key)} className={`w-full text-left p-4 rounded-2xl border transition ${result&&correctKey?'border-emerald-400/50 bg-emerald-500/10':result&&active&&!correctKey?'border-red-400/50 bg-red-500/10':active?'border-emerald-400/40 bg-emerald-500/[.07]':'border-white/5 bg-black/20 hover:border-white/15'}`}>
                  <div className="flex gap-3 items-start"><span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black ${active?'bg-emerald-500 text-black':'bg-white/5 text-zinc-500'}`}>{String.fromCharCode(65+i)}</span><div className="prose prose-invert max-w-none text-sm text-zinc-300 [&_img]:max-w-full [&_img]:rounded-lg" dangerouslySetInnerHTML={{__html:optionHtml(o)}}/></div>
                </button>
              })}
            </div>

            {result&&<div className={`mt-7 rounded-2xl p-5 border ${correct?'border-emerald-500/20 bg-emerald-500/[.06]':'border-red-500/20 bg-red-500/[.05]'}`}>
              <div className="flex items-center gap-2 font-black">{correct?<CheckCircle2 className="text-emerald-400"/>:<XCircle className="text-red-400" />}{correct?'Correct':'Incorrect'} <span className="text-xs text-zinc-600 ml-auto">{result.score>0?`+${result.score}`:result.score} marks</span></div>
              <div className="mt-4 pt-4 border-t border-white/5"><div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Explanation</div><div className="prose prose-invert max-w-none text-sm text-zinc-300 [&_img]:max-w-full [&_img]:rounded-xl" dangerouslySetInnerHTML={{__html:q.explanation_html||'<p>No explanation available.</p>'}}/></div>
            </div>}
          </div>

          <div className="px-5 md:px-7 py-4 border-t border-white/5 flex items-center gap-2">
            <button onClick={()=>move(-1)} disabled={index===0} className="px-4 py-2.5 rounded-xl bg-white/5 text-zinc-400 disabled:opacity-30"><ChevronLeft size={17}/></button>
            <button onClick={()=>{setSelected([]);setResult(null)}} className="px-4 py-2.5 rounded-xl bg-white/5 text-zinc-500 hover:text-white"><RotateCcw size={15}/></button>
            {!result?<button onClick={()=>void submit()} disabled={submitting} className="ml-auto px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-black flex items-center gap-2 disabled:opacity-50">{submitting?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}Submit</button>:<button onClick={()=>move(1)} disabled={isLast} className="ml-auto px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-black flex items-center gap-2 disabled:opacity-30">{isLast?'Finished':'Next'}<ChevronRight size={17}/></button>}
          </div>
        </div>
      </main>
    </div>
  </div>
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-black/20 p-3 text-center"><div className="text-lg font-black text-white">{value}</div><div className="text-[9px] uppercase font-black tracking-wider text-zinc-600">{label}</div></div>}
