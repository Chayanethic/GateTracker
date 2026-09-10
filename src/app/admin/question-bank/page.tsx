'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Database, FileJson, FolderOpen, Image as ImageIcon, Loader2, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

type Chapter = { id:string; name:string; description?:string|null; question_count:number; is_published:boolean; sort_order:number };
type Subject = { id:string; name:string; description?:string|null; stream:string; chapters:Chapter[]; is_published:boolean };

const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '',
  'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '',
});

function pickQuestions(chapter: any) {
  return Array.isArray(chapter?.questions) ? chapter.questions : [];
}

function chapterPayload(subject: any, chapter: any) {
  return {
    examKey: 'gate',
    stream: sessionStorage.getItem('adminStream') || 'ece',
    subject: { id: subject.id, name: subject.name || subject.title, description: subject.description, order: subject.order },
    chapter: { id: chapter.id, name: chapter.name || chapter.title, description: chapter.description, order: chapter.order },
    questions: pickQuestions(chapter),
  };
}

export default function AdminQuestionBank() {
  const input = useRef<HTMLInputElement>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done:0, total:0, label:'' });
  const [dragging, setDragging] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/question-bank/admin', { headers: adminHeaders(), cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Unable to load question bank.');
      setSubjects(d.subjects || []);
    } catch(e:any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.map(s => ({
      ...s,
      chapters: (s.chapters || []).filter(c => c.name.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    })).filter(s => s.name.toLowerCase().includes(q) || s.chapters.length);
  }, [subjects, search]);

  const importFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) { toast.error('Please choose a JSON file.'); return; }
    setImporting(true); setProgress({done:0,total:0,label:'Reading JSON…'});
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const sourceSubjects = Array.isArray(parsed?.subjects) ? parsed.subjects : [];
      if (!sourceSubjects.length) throw new Error('Expected the exported structure with subjects → chapters → questions.');
      const chapters: {s:any;c:any}[] = [];
      for (const s of sourceSubjects) for (const c of (s.chapters || [])) if (pickQuestions(c).length) chapters.push({s,c});
      if (!chapters.length) throw new Error('No chapter question arrays were found.');
      setProgress({done:0,total:chapters.length,label:'Starting import…'});

      for (let i=0;i<chapters.length;i++) {
        const {s,c}=chapters[i];
        setProgress({done:i,total:chapters.length,label:`${s.name || s.title} → ${c.name || c.title}`});
        const r = await fetch('/api/question-bank/admin/import', {
          method:'POST', headers:adminHeaders(), body:JSON.stringify(chapterPayload(s,c))
        });
        const d = await r.json();
        if (!r.ok) throw new Error(`${s.name || s.title} / ${c.name || c.title}: ${d.error || 'Import failed'}`);
        setProgress({done:i+1,total:chapters.length,label:`Imported ${d.imported} questions • ${d.imageUploads || 0} images`});
      }
      toast.success(`Imported ${chapters.length} chapters successfully.`);
      await load();
    } catch(e:any) {
      console.error(e);
      toast.error(e.message || 'Import failed.');
    } finally { setImporting(false); }
  };

  const toggle = async (kind:'subject'|'chapter', id:string, value:boolean) => {
    const r = await fetch('/api/question-bank/admin', {method:'PATCH',headers:adminHeaders(),body:JSON.stringify({kind,id,is_published:value})});
    const d=await r.json(); if(!r.ok){toast.error(d.error||'Update failed');return;} await load();
  };

  const remove = async (kind:'subject'|'chapter', id:string, name:string) => {
    if (!confirm(`Delete ${kind} "${name}" and its question data?`)) return;
    const r=await fetch('/api/question-bank/admin',{method:'DELETE',headers:adminHeaders(),body:JSON.stringify({kind,id})});
    const d=await r.json(); if(!r.ok){toast.error(d.error||'Delete failed');return;}
    toast.success('Deleted.'); await load();
  };

  const totalQuestions = subjects.reduce((n,s)=>n+(s.chapters||[]).reduce((m,c)=>m+(c.question_count||0),0),0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-3 text-emerald-400 mb-2"><BookOpen size={24}/><span className="text-xs font-black uppercase tracking-[.3em]">Question Bank</span></div>
          <h1 className="text-4xl font-black text-white tracking-tight">Question Bank Command Center</h1>
          <p className="text-zinc-500 mt-2 max-w-2xl">Import your exported subject → chapter → question JSON. Images embedded as Base64 are extracted automatically and stored as files; PostgreSQL keeps compact URLs and structured metadata.</p>
        </div>
        <button onClick={()=>input.current?.click()} disabled={importing} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50">
          <Upload size={18}/> Import JSON
        </button>
        <input ref={input} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0]; if(f) void importFile(f); e.currentTarget.value='';}}/>
      </div>

      <div
        onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files?.[0];if(f)void importFile(f)}}
        className={`mb-7 rounded-2xl border border-dashed p-6 text-center transition ${dragging?'border-emerald-400 bg-emerald-500/10':'border-white/10 bg-white/[.02]'}`}
      >
        <FileJson className="mx-auto text-zinc-500 mb-2" size={28}/>
        <p className="text-sm font-bold text-zinc-300">Drop the Question Bank JSON here</p>
        <p className="text-xs text-zinc-600 mt-1">The importer processes one chapter at a time. Do not upload Base64 images separately.</p>
      </div>

      {importing && (
        <div className="mb-7 bg-zinc-900 border border-emerald-500/20 rounded-2xl p-5">
          <div className="flex justify-between gap-4 text-sm"><span className="font-bold text-white flex items-center gap-2"><Loader2 size={16} className="animate-spin text-emerald-400"/> Importing…</span><span className="text-emerald-400 font-black">{progress.done}/{progress.total}</span></div>
          <div className="h-2 bg-black rounded-full mt-4 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{width:`${progress.total?progress.done/progress.total*100:5}%`}}/></div>
          <p className="text-xs text-zinc-500 mt-3 truncate">{progress.label}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
        <Stat icon={<Database size={18}/>} label="Subjects" value={subjects.length}/>
        <Stat icon={<FolderOpen size={18}/>} label="Chapters" value={subjects.reduce((n,s)=>n+(s.chapters?.length||0),0)}/>
        <Stat icon={<CheckCircle2 size={18}/>} label="Questions" value={totalQuestions}/>
      </div>

      <div className="flex items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 mb-5">
        <Search size={18} className="text-zinc-600"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject or chapter…" className="bg-transparent outline-none flex-1 text-sm text-white placeholder:text-zinc-600"/>
        <button onClick={()=>void load()} className="p-2 text-zinc-500 hover:text-white"><RefreshCw size={17}/></button>
      </div>

      {loading ? <div className="py-20 text-center text-emerald-400"><Loader2 className="animate-spin inline mr-2"/>Loading…</div> :
      !filtered.length ? <div className="py-20 text-center text-zinc-600">No question bank imported yet.</div> :
      <div className="space-y-3">
        {filtered.map(s=>(
          <div key={s.id} className="bg-zinc-900/80 border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <button onClick={()=>setExpanded(expanded===s.id?null:s.id)} className="p-2 text-zinc-500 hover:text-white">{expanded===s.id?<ChevronDown/>:<ChevronRight/>}</button>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400"><BookOpen size={19}/></div>
              <div className="flex-1 min-w-0"><div className="font-black text-white">{s.name}</div><div className="text-xs text-zinc-600">{s.chapters?.length||0} chapters • {(s.chapters||[]).reduce((n,c)=>n+c.question_count,0)} questions</div></div>
              <button onClick={()=>void toggle('subject',s.id,!s.is_published)} className={`text-[10px] font-black px-3 py-1.5 rounded-full ${s.is_published?'bg-emerald-500/10 text-emerald-400':'bg-zinc-800 text-zinc-500'}`}>{s.is_published?'PUBLISHED':'HIDDEN'}</button>
              <button onClick={()=>void remove('subject',s.id,s.name)} className="p-2 text-zinc-600 hover:text-red-400"><Trash2 size={17}/></button>
            </div>
            {expanded===s.id && <div className="border-t border-white/5 divide-y divide-white/5">
              {(s.chapters||[]).map(c=><div key={c.id} className="flex items-center gap-4 p-4 pl-16">
                <FolderOpen size={17} className="text-amber-400"/><div className="flex-1"><div className="text-sm font-bold text-zinc-200">{c.name}</div><div className="text-xs text-zinc-600">{c.question_count} questions</div></div>
                <button onClick={()=>void toggle('chapter',c.id,!c.is_published)} className={`text-[10px] font-black px-3 py-1.5 rounded-full ${c.is_published?'text-emerald-400 bg-emerald-500/10':'text-zinc-500 bg-zinc-800'}`}>{c.is_published?'VISIBLE':'HIDDEN'}</button>
                <button onClick={()=>void remove('chapter',c.id,c.name)} className="p-2 text-zinc-600 hover:text-red-400"><Trash2 size={16}/></button>
              </div>)}
            </div>}
          </div>
        ))}
      </div>}
    </div>
  );
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:number}) {
  return <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5"><div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">{icon}{label}</div><div className="text-3xl font-black text-white mt-2">{value.toLocaleString()}</div></div>
}
