'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Bookmark, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Flag, Loader2, RotateCcw, Send, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

type Q={id:string;question_number:number;question_type:string;question_html:string;options:any[];explanation_html:string;difficulty?:string|null;topic?:string|null;tags?:string[];marks?:number|null;negative_marks?:number|null;image_urls?:string[];option_image_urls?:Record<string,string>;progress?:any};

function optionHtml(o:any){return String(o?.html ?? o?.text ?? o?.content ?? o?.label ?? (typeof o === 'string' ? o : '') ?? '')}
function optionKey(o:any,i:number){return String(o?.key ?? o?.id ?? o?.value ?? i)}
function cleanAnswer(a:any):string[]{return Array.isArray(a)?a.map(String):a==null?[]:[String(a)]}
function optionImage(o:any,q:Q,i:number){
  const key=optionKey(o,i);
  const map:any=q.option_image_urls||{};
  const candidates:any[] = [
    o?.imageUrl, o?.image_url, o?.image, o?.src,
    map[key], map[String(i)], map[String(i+1)],
    map[String.fromCharCode(65+i)], map[String.fromCharCode(97+i)],
  ];
  if (typeof o === 'string' && (/^(https?:|data:image\/)/i.test(o))) candidates.unshift(o);
  const nested = o?.image && typeof o.image === 'object' ? (o.image.url ?? o.image.imageUrl ?? o.image.image_url ?? o.image.src) : '';
  candidates.unshift(nested);
  return String(candidates.find(v=>typeof v==='string' && v.trim()) || '');
}

function optionHtmlWithImage(o:any,q:Q,i:number){
  let html=optionHtml(o);
  const img=optionImage(o,q,i);
  if (img && !/<img\b/i.test(html)) html += `${html ? '<div>' : ''}<img src="${img}" alt="" class="qb-option-image" />${html ? '</div>' : ''}`;
  return {html,img};
}

export default function ChapterPractice(){
  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const [initialQuestionId,setInitialQuestionId]=useState<string|null>(null);
  const [questions,setQuestions]=useState<Q[]>([]);
  const [index,setIndex]=useState(0);
  const [selected,setSelected]=useState<string[]>([]);
  const [natValue,setNatValue]=useState('');
  const [result,setResult]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [filter,setFilter]=useState<'all'|'unattempted'|'attempted'>('all');
  const [bookmarkedOnly,setBookmarkedOnly]=useState(false);
  const [typeFilter,setTypeFilter]=useState<'all'|'MCQ'|'MSQ'|'NAT'>('all');
  const [reportOpen,setReportOpen]=useState(false);
  const [reportReason,setReportReason]=useState('');
  const [reportDetails,setReportDetails]=useState('');
  const [reporting,setReporting]=useState(false);

  const load=async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace('/login');return}
    const res=await fetch(`/api/question-bank/questions?chapterId=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
    const d=await res.json();
    if(!res.ok){toast.error(d.error||'Unable to load questions.');return}
    setQuestions(d.questions||[]);
    setLoading(false);
  };
  useEffect(()=>{
    const qs=new URLSearchParams(window.location.search);
    setInitialQuestionId(qs.get('questionId'));
    void load();
  },[id]);

  const visible=useMemo(()=>questions.filter(q=>{
    const attempted=(q.progress?.attempted_count||0)>0;
    if(filter==='attempted'&&!attempted)return false;
    if(filter==='unattempted'&&attempted)return false;
    if(bookmarkedOnly&&!q.progress?.bookmarked)return false;
    if(typeFilter!=='all'&&String(q.question_type).toUpperCase()!==typeFilter)return false;
    return true;
  }),[questions,filter,bookmarkedOnly,typeFilter]);

  useEffect(()=>{setIndex(0);setSelected([]);setNatValue('');setResult(null)},[filter,bookmarkedOnly,typeFilter]);
  useEffect(()=>{
    if(initialQuestionId && questions.length){
      const i=questions.findIndex(x=>x.id===initialQuestionId);
      if(i>=0){setIndex(i);setSelected([]);setNatValue('');setResult(null);}
    }
  },[questions,initialQuestionId]);
  const q=visible[index];

  const submit=async()=>{
    if(!q||submitting)return;
    const isNat=q.question_type==='NAT';
    const answer=isNat ? [natValue.trim()] : selected;
    if(!answer.length || !answer[0]){toast.error(isNat?'Enter a numerical answer first.':'Select an answer first.');return}
    if(isNat && !Number.isFinite(Number(natValue.trim()))){toast.error('Enter a valid number.');return}
    setSubmitting(true);
    try{
      const {data:{session}}=await supabase.auth.getSession(); if(!session)return;
      const res=await fetch('/api/question-bank/attempt',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({questionId:q.id,answer})});
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
    if(result||q?.question_type==='NAT')return;
    setSelected(prev=>q.question_type==='MSQ'?(prev.includes(key)?prev.filter(x=>x!==key):[...prev,key]):[key]);
  };
  const move=(delta:number)=>{
    const next=Math.max(0,Math.min(visible.length-1,index+delta));
    setIndex(next);setSelected([]);setNatValue('');setResult(null);
  };

  const reportQuestion=async()=>{
    if(!q||!reportReason.trim()||reporting)return;
    setReporting(true);
    try{
      const {data:{session}}=await supabase.auth.getSession(); if(!session)return;
      const res=await fetch('/api/question-bank/report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({questionId:q.id,reason:reportReason.trim(),details:reportDetails.trim()})});
      const d=await res.json(); if(!res.ok)throw new Error(d.error||'Unable to send report.');
      toast.success('Question report sent to the admin.'); setReportOpen(false); setReportReason(''); setReportDetails('');
    }catch(e:any){toast.error(e.message)}finally{setReporting(false)}
  };

  if(loading)return <div className="min-h-[70vh] flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" size={20}/>Loading questions…</div>;
  if(!q)return <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"><div className="text-slate-900 font-black text-xl">No questions in this filter</div><button onClick={()=>{setFilter('all');setBookmarkedOnly(false)}} className="mt-4 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-bold shadow-sm">Show all questions</button></div>;

  const attemptedCount=questions.filter(x=>(x.progress?.attempted_count||0)>0).length;
  const correct=Boolean(result?.correct);
  const isLast=index===visible.length-1;
  const progressPct=visible.length ? ((index+1)/visible.length)*100 : 0;
  const isNat=q.question_type==='NAT';
  const typeCounts={MCQ:questions.filter(x=>String(x.question_type).toUpperCase()==='MCQ').length,MSQ:questions.filter(x=>String(x.question_type).toUpperCase()==='MSQ').length,NAT:questions.filter(x=>String(x.question_type).toUpperCase()==='NAT').length};

  return <div className="qb-theme min-h-full bg-slate-50/70 text-slate-900">
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={()=>router.push('/question-bank')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition shadow-sm"><ArrowLeft size={16}/>Back</button>
        <div className="min-w-0 flex-1 flex items-center gap-2 text-xs text-slate-400">
          <span>GATE EC</span><span>/</span><span>Question Bank</span><span>/</span><span className="font-semibold text-slate-600 truncate">Chapter Practice</span>
        </div>
        <div className="hidden sm:block text-sm font-bold text-slate-500">{index+1} / {visible.length}</div>
      </div>

      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-5"><div className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out" style={{width:`${progressPct}%`}}/></div>

      <div className="grid xl:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <aside className="bg-white border border-slate-200 rounded-2xl shadow-sm xl:sticky xl:top-5 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Total" value={questions.length}/><Metric label="Attempted" value={attemptedCount}/><Metric label="Remaining" value={Math.max(0,questions.length-attemptedCount)}/>
            </div>
          </div>
          <div className="p-4 border-b border-slate-100">
            <div className="flex flex-wrap gap-2">
              {(['all','unattempted','attempted'] as const).map(v=><button key={v} onClick={()=>setFilter(v)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition ${filter===v?'bg-orange-500 text-white shadow-sm':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{v}</button>)}
              <button onClick={()=>setBookmarkedOnly(v=>!v)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition ${bookmarkedOnly?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Bookmark size={11} className="inline mr-1" fill={bookmarkedOnly?'currentColor':'none'}/>Saved</button>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Question type</div>
              <div className="flex flex-wrap gap-2">{(['all','MCQ','MSQ','NAT'] as const).map(v=><button key={v} onClick={()=>setTypeFilter(v)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition ${typeFilter===v?'bg-slate-800 text-white':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{v==='all'?`All (${questions.length})`:`${v} (${v==='MCQ'?typeCounts.MCQ:v==='MSQ'?typeCounts.MSQ:typeCounts.NAT})`}</button>)}</div>
            </div>
          </div>
          <div className="p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Question navigator</div>
            <div className="grid grid-cols-7 gap-1.5 max-h-[390px] overflow-y-auto pr-1">
              {visible.map((x,i)=>{
                const attempted=Boolean(x.progress?.attempted_count); const marked=x.progress?.marked_for_review;
                return <button key={x.id} title={`Question ${x.question_number}`} onClick={()=>{setIndex(i);setSelected([]);setNatValue('');setResult(null)}} className={`relative h-9 rounded-lg text-[10px] font-black transition-all ${i===index?'bg-orange-500 text-white shadow-md scale-[1.03]':x.progress?.last_result==='correct'?'bg-emerald-50 text-emerald-700 hover:bg-emerald-100':x.progress?.last_result==='incorrect'?'bg-red-50 text-red-600 hover:bg-red-100':attempted?'bg-amber-50 text-amber-700 hover:bg-amber-100':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{x.question_number}{marked&&<span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-500"/>}</button>
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 md:px-8 py-4 border-b border-slate-100 flex flex-wrap gap-2.5 items-center">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wide">{q.question_type}</span>
              {q.difficulty&&<span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${q.difficulty==='hard'?'bg-red-50 text-red-600':q.difficulty==='medium'?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>{q.difficulty}</span>}
              {q.topic&&<span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-xs">{q.topic}</span>}
              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black">{q.marks ?? 1} {Number(q.marks ?? 1)===1?'mark':'marks'}</span>
              <div className="ml-auto flex gap-1">
                <button title="Bookmark" onClick={()=>void toggleProgress('bookmark',!q.progress?.bookmarked)} className={`p-2 rounded-lg transition ${q.progress?.bookmarked?'text-amber-600 bg-amber-50':'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}><Bookmark size={17} fill={q.progress?.bookmarked?'currentColor':'none'}/></button>
                <button title="Mark for review" onClick={()=>void toggleProgress('review',!q.progress?.marked_for_review)} className={`p-2 rounded-lg transition ${q.progress?.marked_for_review?'text-violet-600 bg-violet-50':'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}><Flag size={17} fill={q.progress?.marked_for_review?'currentColor':'none'}/></button>
                <button title="Report question" onClick={()=>setReportOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"><AlertTriangle size={17}/></button>
              </div>
            </div>

            <div className="p-5 md:p-8 lg:p-10">
              <div className="flex items-center justify-between mb-5"><div className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Question {q.question_number}</div><div className="text-xs font-bold text-slate-400">{index+1} of {visible.length}</div></div>
              <div className="prose prose-slate max-w-none text-[15px] md:text-base leading-7 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-4" dangerouslySetInnerHTML={{__html:q.question_html||''}}/>

              {isNat ? <div className="mt-8 max-w-xl">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-3"><span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-black">#</span><div><div className="font-black text-slate-900">Numerical Answer</div><div className="text-xs text-slate-500">Enter your answer and submit.</div></div></div>
                  <input type="number" inputMode="decimal" step="any" value={natValue} disabled={Boolean(result)} onChange={e=>setNatValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!result)void submit()}} placeholder="Enter numerical value" className="w-full h-14 px-4 rounded-xl border border-slate-300 bg-white text-lg font-bold outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:bg-slate-100" />
                </div>
              </div> : <div className="mt-8 space-y-3">
                {(q.options||[]).map((o,i)=>{
                  const key=optionKey(o,i); const active=selected.includes(key); const correctKey=result?.correctAnswer?.map(String).includes(key); const {img,html}=optionHtmlWithImage(o,q,i);
                  return <button key={key} disabled={Boolean(result)} onClick={()=>choose(key)} className={`group w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all duration-200 ${result&&correctKey?'border-emerald-400 bg-emerald-50':result&&active&&!correctKey?'border-red-300 bg-red-50':active?'border-orange-400 bg-orange-50 shadow-sm':'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-px'}`}>
                    <div className="flex gap-3 md:gap-4 items-start"><span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-black border-2 transition ${active?'bg-orange-500 border-orange-500 text-white':'bg-white border-slate-300 text-slate-500 group-hover:border-orange-300'}`}>{result&&correctKey?<Check size={15}/>:String.fromCharCode(65+i)}</span><div className="min-w-0 flex-1 prose prose-slate max-w-none text-sm md:text-[15px] leading-6 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2" dangerouslySetInnerHTML={{__html:html}}/>{img&&!/<img\b/i.test(html)&&<img src={img} alt={`Option ${String.fromCharCode(65+i)}`} loading="lazy" className="block max-w-full w-auto max-h-72 object-contain rounded-lg border border-slate-100" onError={(e)=>{e.currentTarget.style.display='none'}}/>}</div>
                  </button>
                })}
              </div>}

              {result&&<div className={`mt-8 rounded-2xl p-5 md:p-6 border ${correct?'border-emerald-200 bg-emerald-50/70':'border-red-200 bg-red-50/70'}`}>
                <div className="flex items-center gap-3 font-black text-lg">{correct?<CheckCircle2 className="text-emerald-600"/>:<XCircle className="text-red-500"/>}<span>{correct?'Correct':'Incorrect'}</span><span className="text-sm font-bold text-slate-500 ml-auto">{result.score>0?`+${result.score}`:result.score} marks</span></div>
                {isNat&&result.natRange?.length>0&&<div className="mt-3 text-sm text-slate-600">Accepted range: <strong>{result.natRange.length===2?`${result.natRange[0]} – ${result.natRange[1]}`:result.natRange[0]}</strong></div>}
                <div className="mt-5 pt-5 border-t border-slate-200/80"><div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Explanation</div><div className="prose prose-slate max-w-none text-sm leading-6 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-4" dangerouslySetInnerHTML={{__html:q.explanation_html||'<p>No explanation available.</p>'}}/></div>
              </div>}
            </div>

            <div className="px-5 md:px-8 py-4 border-t border-slate-100 flex items-center gap-2 bg-slate-50/60">
              <button onClick={()=>move(-1)} disabled={index===0} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition"><ChevronLeft size={17}/>Previous</button>
              <button onClick={()=>{setSelected([]);setNatValue('');setResult(null)}} title="Reset answer" className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"><RotateCcw size={15}/></button>
              <div className="ml-auto flex items-center gap-2">{!result&&<button onClick={()=>void submit()} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black shadow-sm hover:shadow transition disabled:opacity-50">{submitting?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}Submit Answer</button>}<button onClick={()=>move(1)} disabled={isLast} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-black transition disabled:opacity-30">{isLast?'Last Question':'Next Question'}<ChevronRight size={17}/></button></div>
            </div>
          </div>
        </main>
      </div>
    </div>

    {reportOpen&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><AlertTriangle size={20}/></div><div className="flex-1"><h3 className="font-black text-slate-900 text-lg">Report Question {q.question_number}</h3><p className="text-xs text-slate-500 mt-1">Tell the admin what is wrong with this question.</p></div><button onClick={()=>setReportOpen(false)} className="text-slate-400 hover:text-slate-700">×</button></div>
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mt-6 mb-2">Reason</label>
        <select value={reportReason} onChange={e=>setReportReason(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-400"><option value="">Select a reason</option><option>Wrong answer</option><option>Question statement error</option><option>Option/image not loading</option><option>Explanation error</option><option>Typo / formatting</option><option>Other</option></select>
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mt-4 mb-2">Details (optional)</label>
        <textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={4} placeholder="Describe the issue…" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-400 resize-none"/>
        <div className="flex justify-end gap-2 mt-5"><button onClick={()=>setReportOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold">Cancel</button><button onClick={()=>void reportQuestion()} disabled={!reportReason.trim()||reporting} className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-black disabled:opacity-50">{reporting?'Sending…':'Send Report'}</button></div>
      </div>
    </div>}
  </div>
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center"><div className="text-lg font-black text-slate-900">{value}</div><div className="text-[9px] uppercase font-black tracking-wider text-slate-400">{label}</div></div>}
