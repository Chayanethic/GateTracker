'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, FileUp, Loader2, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '').replace(/javascript:/gi, '');
}

function parseTestHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const articles = Array.from(doc.querySelectorAll('article.questionCard'));
  return articles.map((article, index) => {
    const number = Number(article.getAttribute('data-number') || index + 1);
    const type = ((article.getAttribute('data-type') || 'MCQ').toUpperCase()) as 'MCQ' | 'MSQ' | 'NAT';
    const questionHtml = cleanHtml(article.querySelector('.questionText')?.innerHTML || '');
    const options = Array.from(article.querySelectorAll(':scope .options > .option')).map((option, i) => ({
      key: String.fromCharCode(65 + i),
      html: cleanHtml(option.querySelector('.optionContent')?.innerHTML || ''),
    }));
    const answerText = article.querySelector('.answerValue')?.textContent?.trim() || '';
    const answer = answerText.split(',').map(s => s.trim()).filter(Boolean);
    const solution = cleanHtml(article.querySelector('.solutionText')?.innerHTML || '');
    const videoUrl = (article.querySelector('video.solutionVideo') as HTMLVideoElement | null)?.getAttribute('src') || undefined;
    return { id: `q-${number}-${index}`, number, type, questionHtml, options, answer, solutionHtml: solution, videoUrl };
  });
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '', 'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' };
  const load = async () => {
    const res = await fetch('/api/test-series/admin', { headers: adminHeaders });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Unable to load admin data.'); return; }
    setRequests(data.requests || []); setTests(data.tests || []);
  };
  useEffect(() => { load(); }, []);

  const updateRequest = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch('/api/test-series/admin', { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ id, status }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Update failed.'); else { toast.success(status === 'approved' ? 'Access approved.' : 'Access rejected.'); load(); }
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Select the exported HTML file first.');
    setUploading(true);
    try {
      const html = await file.text();
      const questions = parseTestHtml(html);
      if (!questions.length) throw new Error('No .questionCard questions were found in this HTML file.');
      const res = await fetch('/api/test-series/upload', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ title, examName, durationMinutes: Number(duration), maxMarks: Number(marks), questions }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast.success(`Test published with ${questions.length} questions.`);
      setTitle(''); setExamName(''); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const deleteTest = async (id: string, title: string) => {
    if (!window.confirm(`Delete \"${title}\"? This also removes its questions, answer keys and attempts.`)) return;
    const res = await fetch('/api/test-series/admin', { method: 'DELETE', headers: adminHeaders, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Delete failed.');
    else { toast.success('Test series deleted.'); load(); }
  };

  return <div className="max-w-6xl mx-auto space-y-10">
    <div><h1 className="text-3xl font-black text-white">Test Series Control</h1><p className="text-gray-500 mt-2">Upload the exported HTML and control candidate access.</p></div>
    <form onSubmit={upload} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2 flex items-center gap-3 text-emerald-400 font-bold"><FileUp size={20}/> Publish New Test</div>
      <input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (e.g. Full Mock Test 01)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required value={examName} onChange={e=>setExamName(e.target.value)} placeholder="Exam name (e.g. GATE ECE)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Time in minutes" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input required type="number" min="1" value={marks} onChange={e=>setMarks(e.target.value)} placeholder="Maximum marks" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      <input ref={fileInputRef} required type="file" accept=".html,text/html" onChange={e=>setFile(e.target.files?.[0] || null)} className="md:col-span-2 bg-black border border-gray-700 rounded-xl px-4 py-3 text-gray-300"/>
      <button disabled={uploading} className="md:col-span-2 flex items-center justify-center gap-2 bg-emerald-500 text-black font-black rounded-xl py-3 disabled:opacity-50">{uploading ? <Loader2 className="animate-spin"/> : <FileUp size={18}/>} {uploading ? 'Parsing & Publishing...' : 'Publish Test Series'}</button>
      <p className="md:col-span-2 text-xs text-gray-500">The importer reads the <code>questionCard</code>, MCQ/MSQ/NAT, answer key and solution/video structure used by your supplied export.</p>
    </form>

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 flex items-center gap-2"><ShieldCheck className="text-emerald-400"/> Access Requests</div>
      {requests.length === 0 ? <p className="p-5 text-gray-500">No access requests.</p> : <div className="divide-y divide-gray-800">{requests.map(r=><div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-mono text-sm text-white">{r.user_id}</div><div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock3 size={12}/> {new Date(r.requested_at).toLocaleString()}</div></div><div className="flex items-center gap-2">{r.status === 'pending' ? <><button onClick={()=>updateRequest(r.id,'approved')} className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold flex items-center gap-1"><Check size={16}/> Approve</button><button onClick={()=>updateRequest(r.id,'rejected')} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold flex items-center gap-1"><X size={16}/> Reject</button></> : <span className="text-xs font-black uppercase text-gray-400">{r.status}</span>}</div></div>)}</div>}
    </section>

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 font-bold text-white">Published Tests</div><div className="divide-y divide-gray-800">{tests.map(t=><div key={t.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-bold text-white">{t.title}</div><div className="text-xs text-gray-500 mt-1">{t.exam_name} • {t.question_count} questions • {t.duration_minutes} min • {t.max_marks} marks</div></div><div className="flex items-center gap-3"><span className="text-xs text-emerald-400 font-bold">{t.is_published ? 'PUBLISHED' : 'DRAFT'}</span><button type="button" onClick={()=>deleteTest(t.id,t.title)} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold hover:bg-red-500/20">Delete</button></div></div>)}{!tests.length && <p className="p-5 text-gray-500">No tests published yet.</p>}</div></section>
  </div>;
}
