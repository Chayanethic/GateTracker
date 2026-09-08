'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, FileUp, Loader2, ShieldCheck, X, Sparkles, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

type MarkType = 'MCQ' | 'MSQ' | 'NAT';
type DraftQuestion = {
  id: string;
  number: number;
  type: MarkType;
  questionHtml: string;
  options: { key: string; html: string }[];
  answer: string[];
  solutionHtml: string;
  videoUrl?: string;
  marks: number | null;
  negativeMarks: number;
  marksDetected: boolean;
};

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '').replace(/javascript:/gi, '');
}

function readNumber(el: Element | null, names: string[]) {
  if (!el) return null;
  for (const name of names) {
    const raw = el.getAttribute(name);
    if (raw != null && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
  }
  return null;
}

function negativeFor(type: MarkType, marks: number) {
  if (type !== 'MCQ') return 0;
  // User requested the familiar two-decimal display: 1 -> 0.33, 2 -> 0.66.
  return Math.floor((marks / 3) * 100) / 100;
}

function parseTestHtml(html: string): { questions: DraftQuestion[]; allMarksPresent: boolean } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const articles = Array.from(doc.querySelectorAll('article.questionCard'));
  const questions = articles.map((article, index) => {
    const number = Number(article.getAttribute('data-number') || index + 1);
    const type = ((article.getAttribute('data-type') || 'MCQ').toUpperCase()) as MarkType;
    const questionHtml = cleanHtml(article.querySelector('.questionText')?.innerHTML || '');
    const options = Array.from(article.querySelectorAll(':scope .options > .option')).map((option, i) => ({
      key: String.fromCharCode(65 + i),
      html: cleanHtml(option.querySelector('.optionContent')?.innerHTML || ''),
    }));
    const answerText = article.querySelector('.answerValue')?.textContent?.trim() || '';
    const answer = answerText.split(',').map(s => s.trim()).filter(Boolean);
    const solution = cleanHtml(article.querySelector('.solutionText')?.innerHTML || '');
    const videoUrl = (article.querySelector('video.solutionVideo') as HTMLVideoElement | null)?.getAttribute('src') || undefined;
    const marks = readNumber(article, ['data-marks', 'data-positive-marks', 'data-positive-marks-value']);
    const negative = readNumber(article, ['data-negative-marks', 'data-negative']);
    const marksDetected = marks != null;
    return {
      id: `q-${number}-${index}`,
      number,
      type,
      questionHtml,
      options,
      answer,
      solutionHtml: solution,
      videoUrl,
      marks,
      negativeMarks: negative != null ? Math.max(0, negative) : (marks != null ? negativeFor(type, marks) : 0),
      marksDetected,
    };
  });
  return { questions, allMarksPresent: questions.length > 0 && questions.every(q => q.marksDetected) };
}

function randomOneTwo(count: number, target: number) {
  if (!Number.isInteger(target) || target < count || target > count * 2) {
    throw new Error(`For automatic 1/2-mark distribution, Maximum Marks must be between ${count} and ${count * 2}.`);
  }
  const twos = target - count;
  const values = Array.from({ length: count }, (_, i) => (i < twos ? 2 : 1));
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
  }
  return values;
}

export default function AdminTestSeries() {
  const [title, setTitle] = useState('');
  const [examName, setExamName] = useState('');
  const [duration, setDuration] = useState('180');
  const [marks, setMarks] = useState('100');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[] | null>(null);
  const [marksMode, setMarksMode] = useState<'random' | 'edit' | null>(null);
  const [marksDetected, setMarksDetected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '', 'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' };
  const load = async () => {
    const res = await fetch('/api/test-series/admin', { headers: adminHeaders });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Unable to load admin data.'); return; }
    setRequests(data.requests || []); setTests(data.tests || []);
  };
  useEffect(() => { load(); }, []);

  const prepareMarks = (questions: DraftQuestion[], allPresent: boolean) => {
    setDraftQuestions(questions);
    setMarksDetected(allPresent);
    if (allPresent) {
      setMarksMode('edit');
      toast.success('Marks found in HTML. Review them before publishing.');
      return;
    }
    setMarksMode(null);
    toast('Marks were not found for every question. Choose automatic random 1/2-mark distribution or edit them manually.', { icon: '⚠️', duration: 5000 });
  };

  const randomizeMarks = () => {
    if (!draftQuestions?.length) return;
    try {
      const values = randomOneTwo(draftQuestions.length, Number(marks));
      setDraftQuestions(draftQuestions.map((q, i) => ({ ...q, marks: values[i], negativeMarks: negativeFor(q.type, values[i]) })));
      setMarksMode('edit');
      toast.success('Random 1/2-mark distribution applied.');
    } catch (e: any) { toast.error(e.message); }
  };

  const editMark = (id: string, value: string) => {
    const next = Number(value);
    if (![1, 2].includes(next)) return;
    setDraftQuestions(prev => prev?.map(q => q.id === id ? ({ ...q, marks: next, negativeMarks: negativeFor(q.type, next) }) : q) || null);
  };

  const resetRandom = () => {
    if (!draftQuestions?.length) return;
    try {
      const values = randomOneTwo(draftQuestions.length, Number(marks));
      setDraftQuestions(draftQuestions.map((q, i) => ({ ...q, marks: values[i], negativeMarks: negativeFor(q.type, values[i]) })));
      toast.success('Marks randomized again.');
    } catch (e: any) { toast.error(e.message); }
  };

  const publishPrepared = async () => {
    if (!draftQuestions?.length) return;
    if (draftQuestions.some(q => q.marks == null)) return toast.error('Every question must have a mark value.');
    const total = draftQuestions.reduce((sum, q) => sum + Number(q.marks), 0);
    if (total !== Number(marks)) return toast.error(`Question marks total ${total}, but Maximum Marks is ${marks}. Edit the marks so the total matches.`);
    setUploading(true);
    try {
      const res = await fetch('/api/test-series/upload', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ title, examName, durationMinutes: Number(duration), maxMarks: total, questions: draftQuestions }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast.success(`Test published with ${draftQuestions.length} questions.`);
      setTitle(''); setExamName(''); setFile(null); setDraftQuestions(null); setMarksMode(null); setMarksDetected(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Select the exported HTML file first.');
    setUploading(true);
    try {
      const html = await file.text();
      const parsed = parseTestHtml(html);
      if (!parsed.questions.length) throw new Error('No .questionCard questions were found in this HTML file.');
      prepareMarks(parsed.questions, parsed.allMarksPresent);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const updateRequest = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch('/api/test-series/admin', { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ id, status }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Update failed.'); else { toast.success(status === 'approved' ? 'Access approved.' : 'Access rejected.'); load(); }
  };

  const deleteTest = async (id: string, testTitle: string) => {
    if (!window.confirm(`Delete "${testTitle}"? This also removes its questions, answer keys and attempts.`)) return;
    const res = await fetch('/api/test-series/admin', { method: 'DELETE', headers: adminHeaders, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Delete failed.');
    else { toast.success('Test series deleted.'); load(); }
  };

  const totalDraftMarks = draftQuestions?.reduce((s, q) => s + Number(q.marks || 0), 0) || 0;
  const draftMcq = draftQuestions?.filter(q => q.type === 'MCQ').length || 0;
  const draftMsq = draftQuestions?.filter(q => q.type === 'MSQ').length || 0;
  const draftNat = draftQuestions?.filter(q => q.type === 'NAT').length || 0;

  return <div className="max-w-6xl mx-auto space-y-10">
    <div><h1 className="text-3xl font-black text-white">Test Series Control</h1><p className="text-gray-500 mt-2">Upload the exported HTML, define per-question marks, and control candidate access.</p></div>
    <form onSubmit={upload} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2 flex items-center gap-3 text-emerald-400 font-bold"><FileUp size={20}/> Publish New Test</div>
      <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (e.g. Full Mock Test 01)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required value={examName} onChange={e=>setExamName(e.target.value)} placeholder="Exam name (e.g. GATE ECE)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Time in minutes" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required type="number" min="1" value={marks} onChange={e=>setMarks(e.target.value)} placeholder="Maximum marks" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input ref={fileInputRef} required type="file" accept=".html,text/html" onChange={e=>setFile(e.target.files?.[0] || null)} className="md:col-span-2 bg-black border border-gray-700 rounded-xl px-4 py-3 text-gray-300"/>
      <button disabled={uploading} className="md:col-span-2 flex items-center justify-center gap-2 bg-emerald-500 text-black font-black rounded-xl py-3 disabled:opacity-50">{uploading ? <Loader2 className="animate-spin"/> : <FileUp size={18}/>} {uploading ? 'Reading HTML...' : 'Read HTML & Set Marks'}</button>
      <p className="md:col-span-2 text-xs text-gray-500">If the export does not contain marks for every question, the next step will let you randomly distribute 1/2 marks or edit every question manually. MCQ negative marks are automatically 0.33 for 1 mark and 0.66 for 2 marks; MSQ/NAT have no negative marks.</p>
    </form>

    {draftQuestions && !marksMode && !marksDetected && <section className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-6 space-y-5">
      <div><div className="flex items-center gap-2 text-amber-300 font-black text-lg"><Sparkles size={19}/> Marks not found in HTML</div><p className="text-sm text-amber-100/70 mt-2">This export does not define marks for every question. You can automatically distribute 1 and 2 marks randomly while keeping the total equal to Maximum Marks ({marks}), or edit them yourself.</p></div>
      <div className="grid sm:grid-cols-3 gap-3 text-sm"><div className="bg-black/30 rounded-xl p-4"><b className="text-white">{draftQuestions.length}</b><span className="text-zinc-500 ml-2">Questions</span></div><div className="bg-black/30 rounded-xl p-4"><b className="text-cyan-300">{draftMcq}</b><span className="text-zinc-500 ml-2">MCQ</span></div><div className="bg-black/30 rounded-xl p-4"><b className="text-violet-300">{draftMsq}</b><span className="text-zinc-500 ml-2">MSQ</span></div></div>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={randomizeMarks} className="px-5 py-3 rounded-xl bg-emerald-500 text-black font-black flex items-center gap-2"><Sparkles size={17}/> Randomly Distribute 1 / 2 Marks</button><button type="button" onClick={()=>{setDraftQuestions(draftQuestions.map(q=>({...q,marks:q.marks ?? 1,negativeMarks:negativeFor(q.type,q.marks ?? 1)})));setMarksMode('edit')}} className="px-5 py-3 rounded-xl border border-white/10 text-white font-bold">Edit Marks Manually</button></div>
      <p className="text-xs text-zinc-500">Automatic distribution requires Maximum Marks to be between {draftQuestions.length} and {draftQuestions.length * 2}, because each question is assigned either 1 or 2 marks.</p>
    </section>}

    {draftQuestions && marksMode === 'edit' && <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3"><div><div className="text-lg font-black text-white">Question Marking</div><div className="text-xs text-zinc-500 mt-1">{draftQuestions.length} questions • {draftMcq} MCQ • {draftMsq} MSQ • {draftNat} NAT</div></div><div className={`text-sm font-black ${totalDraftMarks === Number(marks) ? 'text-emerald-400' : 'text-amber-400'}`}>Total: {totalDraftMarks} / {marks}</div></div>
      <div className="p-4 flex flex-wrap gap-3 border-b border-gray-800"><button type="button" onClick={resetRandom} className="px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-bold flex items-center gap-2"><RotateCcw size={15}/> Randomize Again</button><button type="button" onClick={publishPrepared} disabled={uploading || totalDraftMarks !== Number(marks)} className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-black flex items-center gap-2 disabled:opacity-40"><Save size={15}/> {uploading ? 'Publishing...' : 'Save Marks & Publish'}</button><button type="button" onClick={()=>{setDraftQuestions(null);setMarksMode(null)}} className="px-4 py-2 rounded-lg border border-white/10 text-zinc-300 font-bold">Cancel</button></div>
      <div className="max-h-[620px] overflow-auto divide-y divide-gray-800">{draftQuestions.map(q=><div key={q.id} className="p-4 flex flex-wrap items-center gap-4"><div className="w-16 font-black text-white">Q{q.number}</div><span className={`px-2 py-1 rounded-full text-[10px] font-black ${q.type==='MCQ'?'bg-cyan-500/10 text-cyan-300':q.type==='MSQ'?'bg-violet-500/10 text-violet-300':'bg-amber-500/10 text-amber-300'}`}>{q.type}</span><select value={q.marks ?? ''} onChange={e=>editMark(q.id,e.target.value)} className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-bold"><option value="">Select marks</option><option value="1">1 Mark</option><option value="2">2 Marks</option></select><span className="text-sm text-zinc-400">Positive: <b className="text-emerald-400">+{Number(q.marks || 0).toFixed(2)}</b></span><span className="text-sm text-zinc-400">Negative: <b className={q.type==='MCQ'?'text-red-400':'text-zinc-500'}>{q.type==='MCQ'?`-${negativeFor(q.type,Number(q.marks||1)).toFixed(2)}`:'0.00'}</b></span></div>)}</div>
      <div className="p-4 text-xs text-zinc-500 border-t border-gray-800">Changing a question from 1 → 2 automatically changes MCQ negative marking from −0.33 → −0.66. MSQ and NAT always remain −0.00.</div>
    </section>}

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 flex items-center gap-2"><ShieldCheck className="text-emerald-400"/> Access Requests</div>
      {requests.length === 0 ? <p className="p-5 text-gray-500">No access requests.</p> : <div className="divide-y divide-gray-800">{requests.map(r=><div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-mono text-sm text-white">{r.user_id}</div><div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock3 size={12}/> {new Date(r.requested_at).toLocaleString()}</div></div><div className="flex items-center gap-2">{r.status === 'pending' ? <><button onClick={()=>updateRequest(r.id,'approved')} className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold flex items-center gap-1"><Check size={16}/> Approve</button><button onClick={()=>updateRequest(r.id,'rejected')} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold flex items-center gap-1"><X size={16}/> Reject</button></> : <span className="text-xs font-black uppercase text-gray-400">{r.status}</span>}</div></div>)}</div>}
    </section>

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 font-bold text-white">Published Tests</div><div className="divide-y divide-gray-800">{tests.map(t=><div key={t.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-bold text-white">{t.title}</div><div className="text-xs text-gray-500 mt-1">{t.exam_name} • {t.question_count} questions • {t.duration_minutes} min • {t.max_marks} marks</div></div><div className="flex items-center gap-3"><span className="text-xs text-emerald-400 font-bold">{t.is_published ? 'PUBLISHED' : 'DRAFT'}</span><button type="button" onClick={()=>deleteTest(t.id,t.title)} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold hover:bg-red-500/20">Delete</button></div></div>)}{!tests.length && <p className="p-5 text-gray-500">No tests published yet.</p>}</div></section>
  </div>;
}
