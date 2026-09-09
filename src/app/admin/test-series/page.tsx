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
    const solutionNode = article.querySelector(".solutionText, .solution, .solutionContent, [class*=\"solution\"]");
    const solution = cleanHtml(solutionNode?.innerHTML || '');
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

function parseMadeEasyHtml(html: string): { questions: DraftQuestion[]; allMarksPresent: boolean } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = Array.from(doc.querySelectorAll('section.qcard[data-qnum], .qcard[data-qnum]'));
  const questions = cards.map((card, index) => {
    const number = Number(card.getAttribute('data-qnum') || index + 1);
    const rawType = String(card.getAttribute('data-qtype') || 'MCQ').toUpperCase();
    const type: MarkType = rawType === 'MSQ' ? 'MSQ' : rawType === 'NAT' ? 'NAT' : 'MCQ';
    const questionHtml = cleanHtml(card.querySelector('.qtext')?.innerHTML || '');
    const options = Array.from(card.querySelectorAll(':scope .opts > .opt')).map((option, i) => ({
      key: String(option.getAttribute('data-opt') || String.fromCharCode(65 + i)).trim().toUpperCase(),
      html: cleanHtml((option.querySelector(':scope > div:not(.optionMarker)')?.innerHTML || option.querySelector('.optionContent')?.innerHTML || '').trim()),
    })).filter(o => o.html);
    let answer = String(card.getAttribute('data-correct') || '').split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (type === 'NAT' && !answer.length) {
      const nat = String(card.getAttribute('data-nat-low') || '').trim();
      if (nat) answer = [nat];
    }
    const right = readNumber(card, ['data-right']);
    const wrong = readNumber(card, ['data-wrong']);
    const marks = right != null && right > 0 ? right : null;
    const negativeMarks = wrong != null && wrong > 0 ? wrong : 0;
    const solutionNode = card.querySelector('.solutionText, .solution, .solutionContent');
    let solutionHtml = '';
    if (solutionNode) {
      const clone = solutionNode.cloneNode(true) as Element;
      clone.querySelector('summary')?.remove();
      solutionHtml = cleanHtml(clone.innerHTML || '');
    }
    const videoUrl = (card.querySelector('video.solutionVideo') as HTMLVideoElement | null)?.getAttribute('src') || undefined;
    return { id: `madeeasy-q-${number}-${index}`, number, type, questionHtml, options, answer, solutionHtml, videoUrl, marks, negativeMarks, marksDetected: marks != null };
  });
  return { questions, allMarksPresent: questions.length > 0 && questions.every(q => q.marksDetected) };
}

function parseAnyTestHtml(html: string): { questions: DraftQuestion[]; allMarksPresent: boolean; format: 'standard' | 'madeeasy' } {
  const standard = parseTestHtml(html);
  if (standard.questions.length) return { ...standard, format: 'standard' };
  const madeEasy = parseMadeEasyHtml(html);
  if (madeEasy.questions.length) return { ...madeEasy, format: 'madeeasy' };
  return { ...standard, format: 'standard' };
}

type MadeEasyCategory = 'topicwise' | 'subjectwise' | 'full_syllabus';

const MADE_EASY_EC_TOPICWISE_SYLLABUS: Record<number, string> = {
  1: 'Network-1: Circuit analysis methods: nodal and mesh analysis; Wye-Delta transformation; Network theorems—reciprocity, superposition, Thevenin and Norton; sinusoidal steady-state analysis, phasor/complex phasors, complex power, maximum power transfer.',
  2: 'Network-2: Time and frequency domain analysis of linear circuits: RL, AC, RLC circuit; solution of network equations using Laplace transform; linear 2-port network parameters; Wye-Delta transformation.',
  3: 'Control-1: Basic control system components; feedback principle; transfer function; block diagram representation; signal flow graph; transient and steady-state analysis of LTI systems; Routh-Hurwitz; root-locus plots.',
  4: 'Control-2: Frequency response; Nyquist stability criteria; Bode plots; lag, lead and lag-lead compensation; state variable model and solution of state equation of LTI systems.',
  5: 'Electronic Devices-1: Formation of energy bands in solids; energy bands in intrinsic and extrinsic semiconductors; equilibrium carrier concentration; direct and indirect band-gap semiconductors; carrier transport, diffusion current, drift current, mobility and resistivity; generation and recombination of carriers; Poisson and continuity equations; P-N junction; Zener diode.',
  6: 'Electronic Devices-2: BJT, MOS capacitor, MOSFET, scaling in MOSFET, LED, photo diode and solar cell.',
  7: 'Signals and Systems-1: Continuous-time signals; Fourier series and Fourier transform representations; Nyquist sampling theorem; sampling and reconstruction. Continuous LTI systems: definition and properties, causality, stability, impulse response.',
  8: 'Signals and Systems-2: Discrete-time signals: DTFT, DFT, z-transform. Discrete LTI systems: definition and properties, causality, stability, impulse response, convolution, poles and zeroes, FIR and IIR filter design.',
  9: 'Engineering Mathematics-1: Linear Algebra, Calculus, Vector Analysis.',
  10: 'Engineering Mathematics-2: Differential Equations, Complex Analysis, Probability and Statistics, Correlation and regression analysis.',
  11: 'General Aptitude (Part-1): Numerical Ability, Numerical computation, numerical estimation, and data interpretation.',
  12: 'General Aptitude (Part-2): Verbal Ability—English grammar, sentence completion, verbal analogies, word groups, instructions, critical reasoning, numerical reasoning, verbal deduction and spatial aptitude.',
  13: 'Analog circuit-1: Diode circuits—clipping, clamping and rectifiers; BJT and MOSFET amplifier biasing.',
  14: 'Analog circuit-2: BJT and MOSFET: AC coupling, small signal analysis, frequency response; current mirrors and differential amplifiers; dominant-pole compensation and phase margin analysis.',
  15: 'Analog circuit-3: Op-amp circuits—amplifiers, summers, differentiators, integrators, active filters, Schmitt triggers and oscillators.',
  16: 'COA: Semiconductor memories—ROM, SRAM, DRAM. Computer organization: machine instructions and addressing modes, ALU, data-path and control unit, instruction pipelining.',
  17: 'Digital circuits-1: Number representations—binary, integer and floating-point numbers. Combinatorial circuits: Boolean algebra, minimization of functions using Boolean identities and Karnaugh map, logic gates and their static CMOS implementations, arithmetic circuits, code converters, multiplexers, decoders.',
  18: 'Digital circuits-2: Sequential circuits—latches and flip-flops, counters, shift-registers, finite state machines, propagation delay, setup and hold time, critical path delay. Data converters: sample and hold circuits, ADCs and DACs.',
  19: 'Communications-1: Analog communications—amplitude modulation and demodulation, angle modulation and demodulation, spectra of AM and FM, superheterodyne receivers.',
  20: 'Communications-2: Random processes—autocorrelation and power spectral density, properties of white noise, filtering of random signals through LTI systems. Information theory: different types of source coding, entropy, mutual information and channel capacity theorem.',
  21: 'Communications-3: Digital communications—PCM, DPCM, digital modulation schemes (ASK, PSK, FSK, QAM), bandwidth, inter-symbol interference, MAP, ML detection, matched filter receiver, SNR and BER. Fundamentals of error correction, Hamming codes, CRC.',
  22: "Electromagnetics-1: Maxwell's equations—differential and integral forms and their interpretation, boundary conditions, wave equation, Poynting vector.",
  23: 'Electromagnetics-2: Plane waves and properties—reflection and refraction, polarization, phase and group velocity, propagation through various media, skin depth, rectangular and circular waveguides.',
  24: 'Electromagnetics-3: Transmission lines—equations, characteristic impedance, impedance matching, impedance transformation, S-parameters, Smith chart; light propagation in optical fibers, dipole and monopole antennas.',
};

function inferMadeEasyMeta(title: string) {
  const value = title.trim();
  const lower = value.toLowerCase();
  let category: MadeEasyCategory = 'full_syllabus';
  if (/\btopicwise\b|\btopic\s*wise\b/.test(lower)) category = 'topicwise';
  else if (/\bsingle\s+subject\b|\bsubjectwise\b|\bsubject\s*wise\b/.test(lower)) category = 'subjectwise';
  else if (/\bfull\s+syllabus\b/.test(lower)) category = 'full_syllabus';

  const numberMatch = lower.match(/\b(?:test|mock)(?:\s*[-#:]?\s*test)?\s*[-#:]?\s*(\d{1,3})\b/);
  const yearMatch = value.match(/\b(?:GATE\s*)?(20\d{2})\b/i);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const afterYear = yearMatch ? value.slice((yearMatch.index || 0) + yearMatch[0].length).trim() : '';
  const streamMatch = afterYear.match(/^(CE|ME|EE|EC|CS|IN|PI|CH|DA)\b/i);
  const stream = streamMatch ? streamMatch[1].toUpperCase() : null;
  let remainder = streamMatch ? afterYear.slice(streamMatch[0].length).trim() : '';
  remainder = remainder.replace(/^[-–—:|]+\s*/, '').trim();
  // Remove common trailing labels that may follow the actual subject/coverage title.
  remainder = remainder.replace(/\s+\b(?:part\s+syllabus|full\s+syllabus|single\s+subject|topicwise)\b.*$/i, '').trim();
  const subject = remainder || null;
  const topic = category === 'topicwise' ? (remainder ? remainder.split(/\s*:\s*/, 1)[0].trim() : null) : null;
  const testNumber = numberMatch ? Number(numberMatch[1]) : null;
  return { category, testNumber, year, stream, subject, topic };
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
  const [madeEasyFile, setMadeEasyFile] = useState<File | null>(null);
  const madeEasyFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[] | null>(null);
  const [marksMode, setMarksMode] = useState<'random' | 'edit' | null>(null);
  const [marksDetected, setMarksDetected] = useState(false);
  const [uploadFormat, setUploadFormat] = useState<'standard' | 'madeeasy'>('standard');
  const [madeEasyCategory, setMadeEasyCategory] = useState<MadeEasyCategory>('full_syllabus');
  const [madeEasyTestNumber, setMadeEasyTestNumber] = useState('');
  const [madeEasySubject, setMadeEasySubject] = useState('');
  const [madeEasyTopic, setMadeEasyTopic] = useState('');
  const [madeEasySyllabus, setMadeEasySyllabus] = useState('');
  const [madeEasyYear, setMadeEasyYear] = useState('');
  const [madeEasyStream, setMadeEasyStream] = useState('');
  const [usePdfSyllabus, setUsePdfSyllabus] = useState(true);
  const [madeEasyMetaManual, setMadeEasyMetaManual] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '', 'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' };
  const load = async () => {
    const res = await fetch('/api/test-series/admin', { headers: adminHeaders });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Unable to load admin data.'); return; }
    setRequests(data.requests || []); setTests(data.tests || []);
  };
  useEffect(() => { load(); }, []);

  const prepareMarks = (questions: DraftQuestion[], allPresent: boolean, format: 'standard' | 'madeeasy' = 'standard') => {
    setDraftQuestions(questions);
    setMarksDetected(allPresent);
    setUploadFormat(format);
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
      const res = await fetch('/api/test-series/upload', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ title, examName, durationMinutes: Number(duration), maxMarks: total, questions: draftQuestions, provider: uploadFormat === 'madeeasy' ? 'madeeasy' : 'prepfusion', testCategory: uploadFormat === 'madeeasy' ? madeEasyCategory : 'standard', testNumber: uploadFormat === 'madeeasy' && madeEasyTestNumber ? Number(madeEasyTestNumber) : null, subject: uploadFormat === 'madeeasy' ? madeEasySubject : '', topic: uploadFormat === 'madeeasy' ? madeEasyTopic : '', syllabus: uploadFormat === 'madeeasy' ? madeEasySyllabus : '', examYear: uploadFormat === 'madeeasy' && madeEasyYear ? Number(madeEasyYear) : null, stream: uploadFormat === 'madeeasy' ? madeEasyStream : '' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast.success(`Test published with ${draftQuestions.length} questions.`);
      setTitle(''); setExamName(''); setFile(null); setMadeEasyFile(null); setDraftQuestions(null); setMarksMode(null); setMarksDetected(false); setUploadFormat('standard'); setMadeEasyCategory('full_syllabus'); setMadeEasyTestNumber(''); setMadeEasySubject(''); setMadeEasyTopic(''); setMadeEasySyllabus(''); setMadeEasyYear(''); setMadeEasyStream(''); setUsePdfSyllabus(true); setMadeEasyMetaManual(false);
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
      const parsed = parseAnyTestHtml(html);
      if (!parsed.questions.length) throw new Error('No supported test-series questions were found. Upload the normal exported HTML or the MADE EASY index.html format.');
      prepareMarks(parsed.questions, parsed.allMarksPresent, parsed.format);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const uploadMadeEasy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madeEasyFile) return toast.error('Select the MADE EASY index.html file first.');
    setUploading(true);
    try {
      const html = await madeEasyFile.text();
      const parsed = parseMadeEasyHtml(html);
      if (!parsed.questions.length) throw new Error('This file does not match the MADE EASY index.html format.');
      const detectedTitle = (new DOMParser().parseFromString(html, 'text/html').title || '').trim();
      const effectiveTitle = title.trim() || detectedTitle;
      if (!title.trim() && detectedTitle) setTitle(detectedTitle);
      const inferred = inferMadeEasyMeta(effectiveTitle);
      if (!madeEasyMetaManual) {
        setMadeEasyCategory(inferred.category);
        if (inferred.testNumber != null) setMadeEasyTestNumber(String(inferred.testNumber));
        if (inferred.year != null) setMadeEasyYear(String(inferred.year));
        if (inferred.stream) setMadeEasyStream(inferred.stream);
        if (inferred.subject) {
          setMadeEasySubject(inferred.subject);
          if (!examName.trim()) setExamName(inferred.subject);
        }
        if (inferred.category === 'topicwise' && inferred.testNumber != null && inferred.testNumber >= 1 && inferred.testNumber <= 24 && inferred.stream === 'EC' && inferred.year === 2026 && usePdfSyllabus) {
          setMadeEasySyllabus(MADE_EASY_EC_TOPICWISE_SYLLABUS[inferred.testNumber] || '');
        } else if (inferred.category !== 'topicwise') {
          setMadeEasySyllabus('');
        }
      }
      prepareMarks(parsed.questions, parsed.allMarksPresent, 'madeeasy');
      toast.success(`MADE EASY format detected: ${parsed.questions.length} questions extracted.`);
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const updateRequest = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch('/api/test-series/admin', { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ id, status }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Update failed.'); else { toast.success(status === 'approved' ? 'Access approved.' : 'Access rejected.'); load(); }
  };

  const deleteSyllabus = async (id: string, testTitle: string) => {
    if (!window.confirm(`Delete syllabus information for \"${testTitle}\"? This permanently removes the stored syllabus text from this test.`)) return;
    const res = await fetch('/api/test-series/admin', { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ id, action: 'delete_syllabus' }) });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || 'Could not delete syllabus.');
    else { toast.success('Syllabus information permanently deleted.'); load(); }
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
    <form onSubmit={uploadMadeEasy} className="bg-gradient-to-br from-violet-950/40 to-gray-900 border border-violet-500/20 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-3 text-violet-300 font-black text-lg"><FileUp size={20}/> MADE EASY Test Series</div><p className="text-xs text-zinc-500 mt-1">Upload the original MADE EASY <b>index.html</b>. The importer converts its qcard structure internally to the same GateTracker question format.</p></div>
        <span className="px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-black uppercase">MADE EASY FORMAT</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Test title (optional: uses HTML title)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
        <input required value={examName} onChange={e=>setExamName(e.target.value)} placeholder="Exam name (e.g. GATE ECE)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
        <input required type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="Time in minutes" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
        <input required type="number" min="1" value={marks} onChange={e=>setMarks(e.target.value)} placeholder="Maximum marks" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
      </div>
      <div className="rounded-2xl border border-violet-500/20 bg-black/20 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-black text-white">MADE EASY Test Structure</div><div className="text-xs text-zinc-500 mt-1">Choose manually, or leave Auto from title to detect Topicwise / Single Subject / Full Syllabus.</div></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Page 19–20 schedule structure</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <select value={madeEasyCategory} onChange={e=>{setMadeEasyMetaManual(true);setMadeEasyCategory(e.target.value as MadeEasyCategory)}} className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white">
            <option value="topicwise">Topicwise</option><option value="subjectwise">Single Subject</option><option value="full_syllabus">Full Syllabus</option>
          </select>
          <input type="number" min="1" value={madeEasyTestNumber} onChange={e=>{setMadeEasyMetaManual(true);setMadeEasyTestNumber(e.target.value)}} placeholder="Test No. / SL No." className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
          <input type="number" min="2000" max="2100" value={madeEasyYear} onChange={e=>setMadeEasyYear(e.target.value)} placeholder="Year (auto from title)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
          <input value={madeEasyStream} onChange={e=>setMadeEasyStream(e.target.value.toUpperCase())} placeholder="Stream (EC / CE / ME...)" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
          <input value={madeEasySubject} onChange={e=>setMadeEasySubject(e.target.value)} placeholder="Subject / title subject" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
          <input value={madeEasyTopic} onChange={e=>setMadeEasyTopic(e.target.value)} placeholder="Topic" className="bg-black border border-gray-700 rounded-xl px-4 py-3 text-white"/>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 cursor-pointer">
          <input type="checkbox" checked={usePdfSyllabus} onChange={e=>{setUsePdfSyllabus(e.target.checked); if (!e.target.checked) setMadeEasySyllabus('');}} className="h-4 w-4 accent-violet-500"/>
          <span><b className="text-white text-sm">Use syllabus info from PDF</b><span className="block text-xs text-zinc-500 mt-0.5">For the supplied Electronics Engineering schedule: Topicwise Test 1–24 uses the syllabus from PDF page 19. Uncheck to leave it empty.</span></span>
        </label>
        <textarea value={madeEasySyllabus} onChange={e=>setMadeEasySyllabus(e.target.value)} placeholder="Syllabus / coverage" rows={3} className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white resize-y"/>
        <div className="text-xs text-zinc-500">Auto-detection example: “Topicwise Test-9 Part Syllabus GATE 2026 EC Engineering Mathematics-1” → Topicwise, Test 9, Year 2026, Stream EC, Subject Engineering Mathematics-1. You can correct any field manually before publishing. PDF pages 19–20 show Topicwise 1–24, Single Subject 25–36, Full Syllabus 37–44 and Mock Tests 45–48.</div>
      </div>
      <input ref={madeEasyFileInputRef} required type="file" accept=".html,text/html" onChange={e=>setMadeEasyFile(e.target.files?.[0] || null)} className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-gray-300"/>
      <button disabled={uploading} className="w-full flex items-center justify-center gap-2 bg-violet-500 text-white font-black rounded-xl py-3 disabled:opacity-50">{uploading ? <Loader2 className="animate-spin"/> : <FileUp size={18}/>} {uploading ? 'Reading MADE EASY HTML...' : 'Import MADE EASY index.html & Set Marks'}</button>
      <p className="text-xs text-zinc-500">Supports MCQ, MSQ and NAT. It extracts question text, embedded images, options, correct answers, positive/negative marks and written/image solutions when present.</p>
    </form>

    <form onSubmit={upload} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2 flex items-center gap-3 text-emerald-400 font-bold"><FileUp size={20}/> Publish New Test</div>
      <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><div className="font-black text-emerald-300">Standard Test Series</div><div className="text-xs text-zinc-500 mt-1">Rank Pulse / questionCard export with video or written solutions.</div></div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="font-black text-violet-300">MADE EASY Test Series</div><div className="text-xs text-zinc-500 mt-1">Upload the MADE EASY <b>index.html</b> format. Questions, options, answers, marks and image/written solutions are extracted automatically.</div></div>
      </div>
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
      <div className="p-5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><div className="text-lg font-black text-white">Question Marking</div><span className="px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-black uppercase">{uploadFormat === 'madeeasy' ? 'MADE EASY' : 'STANDARD'}</span></div><div className="text-xs text-zinc-500 mt-1">{draftQuestions.length} questions • {draftMcq} MCQ • {draftMsq} MSQ • {draftNat} NAT</div></div><div className={`text-sm font-black ${totalDraftMarks === Number(marks) ? 'text-emerald-400' : 'text-amber-400'}`}>Total: {totalDraftMarks} / {marks}</div></div>
      <div className="p-4 flex flex-wrap gap-3 border-b border-gray-800"><button type="button" onClick={resetRandom} className="px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-bold flex items-center gap-2"><RotateCcw size={15}/> Randomize Again</button><button type="button" onClick={publishPrepared} disabled={uploading || totalDraftMarks !== Number(marks)} className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-black flex items-center gap-2 disabled:opacity-40"><Save size={15}/> {uploading ? 'Publishing...' : 'Save Marks & Publish'}</button><button type="button" onClick={()=>{setDraftQuestions(null);setMarksMode(null)}} className="px-4 py-2 rounded-lg border border-white/10 text-zinc-300 font-bold">Cancel</button></div>
      <div className="max-h-[620px] overflow-auto divide-y divide-gray-800">{draftQuestions.map(q=><div key={q.id} className="p-4 flex flex-wrap items-center gap-4"><div className="w-16 font-black text-white">Q{q.number}</div><span className={`px-2 py-1 rounded-full text-[10px] font-black ${q.type==='MCQ'?'bg-cyan-500/10 text-cyan-300':q.type==='MSQ'?'bg-violet-500/10 text-violet-300':'bg-amber-500/10 text-amber-300'}`}>{q.type}</span><select value={q.marks ?? ''} onChange={e=>editMark(q.id,e.target.value)} className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-bold"><option value="">Select marks</option><option value="1">1 Mark</option><option value="2">2 Marks</option></select><span className="text-sm text-zinc-400">Positive: <b className="text-emerald-400">+{Number(q.marks || 0).toFixed(2)}</b></span><span className="text-sm text-zinc-400">Negative: <b className={q.type==='MCQ'?'text-red-400':'text-zinc-500'}>{q.type==='MCQ'?`-${negativeFor(q.type,Number(q.marks||1)).toFixed(2)}`:'0.00'}</b></span></div>)}</div>
      <div className="p-4 text-xs text-zinc-500 border-t border-gray-800">Changing a question from 1 → 2 automatically changes MCQ negative marking from −0.33 → −0.66. MSQ and NAT always remain −0.00.</div>
    </section>}

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 flex items-center gap-2"><ShieldCheck className="text-emerald-400"/> Access Requests</div>
      {requests.length === 0 ? <p className="p-5 text-gray-500">No access requests.</p> : <div className="divide-y divide-gray-800">{requests.map(r=><div key={r.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-mono text-sm text-white">{r.user_id}</div><div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock3 size={12}/> {new Date(r.requested_at).toLocaleString()}</div></div><div className="flex items-center gap-2">{r.status === 'pending' ? <><button onClick={()=>updateRequest(r.id,'approved')} className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold flex items-center gap-1"><Check size={16}/> Approve</button><button onClick={()=>updateRequest(r.id,'rejected')} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold flex items-center gap-1"><X size={16}/> Reject</button></> : <span className="text-xs font-black uppercase text-gray-400">{r.status}</span>}</div></div>)}</div>}
    </section>

    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-gray-800 font-bold text-white">Published Tests</div><div className="divide-y divide-gray-800">{tests.map(t=><div key={t.id} className="p-5 flex flex-wrap items-center justify-between gap-4"><div><div className="font-bold text-white">{t.title}</div><div className="text-xs text-gray-500 mt-1">{t.exam_name} • {t.question_count} questions • {t.duration_minutes} min • {t.max_marks} marks</div><div className="text-[11px] text-zinc-500 mt-2 flex flex-wrap gap-2"><span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{t.provider === 'madeeasy' ? 'MADE EASY' : 'PREPFUSION'}</span>{t.provider === 'madeeasy' && t.test_category && <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/10">{t.test_category === 'subjectwise' ? 'SINGLE SUBJECT' : t.test_category.replace('_',' ').toUpperCase()}</span>}{t.test_number ? <span>Test No. {t.test_number}</span> : null}{t.subject ? <span>• {t.subject}</span> : null}{t.topic ? <span>• {t.topic}</span> : null}</div></div><div className="flex items-center gap-3"><span className="text-xs text-emerald-400 font-bold">{t.is_published ? 'PUBLISHED' : 'DRAFT'}</span>{t.syllabus && <button type="button" onClick={()=>deleteSyllabus(t.id,t.title)} className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold hover:bg-amber-500/20">Delete Syllabus</button>}<button type="button" onClick={()=>deleteTest(t.id,t.title)} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 font-bold hover:bg-red-500/20">Delete</button></div></div>)}{!tests.length && <p className="p-5 text-gray-500">No tests published yet.</p>}</div></section>
  </div>;
}
