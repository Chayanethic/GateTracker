'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileJson,
  Upload,
  Trash2,
  Eye,
  Plus,
  Image as ImageIcon,
  Save,
  CheckCircle2,
  Loader2,
  Download,
  Sparkles,
  X,
  Edit3,
  Clock3,
  Layers3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  defaultNegativeForMarks,
  parseIncomingExamJson,
  PscExamPaper,
  PscQuestion,
  PscQuestionType,
  SAMPLE_PSC_EXAM_JSON,
} from '@/lib/pscExam';

type PublishedExamSummary = {
  id: string;
  title: string;
  category: string;
  stream: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  isPublished: boolean;
  createdAt: string;
};

export default function AdminPscExamPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [publishedExams, setPublishedExams] = useState<PublishedExamSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPaperId, setLoadingPaperId] = useState<string | null>(null);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);

  // JSON upload / paste state
  const [jsonText, setJsonText] = useState('');
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Active draft/loaded exam paper state
  const [paper, setPaper] = useState<PscExamPaper | null>(null);
  const [expandedEditIds, setExpandedEditIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const adminHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '',
    'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '',
  });

  const loadPublishedExams = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/psc-exam/admin', {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load exams.');
      setPublishedExams(data.exams || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load published exams.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadPublishedExams();
  }, []);

  const recalcTotalMarks = (questions: PscQuestion[]) =>
    Number(questions.reduce((sum, q) => sum + Number(q.marks || 0), 0).toFixed(2));

  const handleFileSelect = async (file: File) => {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const parsed = parseIncomingExamJson(raw);
      setEditingPaperId(null);
      setPaper(parsed);
      setExpandedEditIds({});
      toast.success(
        `Loaded "${parsed.title}" (${parsed.questions.length} questions, ${parsed.totalMarks} marks). Preview & customize below!`
      );
    } catch (e: any) {
      toast.error(
        e instanceof SyntaxError
          ? 'Invalid JSON syntax. Please check the file format.'
          : e.message || 'Could not parse JSON file.'
      );
    }
  };

  const handleParsePastedJson = () => {
    if (!jsonText.trim()) {
      toast.error('Paste the JSON content first.');
      return;
    }
    try {
      const raw = JSON.parse(jsonText);
      const parsed = parseIncomingExamJson(raw);
      setEditingPaperId(null);
      setPaper(parsed);
      setExpandedEditIds({});
      setShowRawJsonModal(false);
      toast.success(`Loaded "${parsed.title}" (${parsed.questions.length} questions).`);
    } catch (e: any) {
      toast.error(
        e instanceof SyntaxError
          ? 'Invalid JSON syntax. Please check your JSON.'
          : e.message || 'Could not parse JSON.'
      );
    }
  };

  const handleLoadSampleJson = () => {
    const parsed = parseIncomingExamJson(SAMPLE_PSC_EXAM_JSON);
    setEditingPaperId(null);
    setPaper(parsed);
    setExpandedEditIds({});
    toast.success('Sample JSON loaded! Preview, change marks or image URLs, and publish.');
  };

  const handleDownloadSampleJson = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_PSC_EXAM_JSON, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-psc-exam.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrentJson = () => {
    if (!paper) return;
    const exportObj: PscExamPaper = {
      ...paper,
      totalMarks: recalcTotalMarks(paper.questions),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paper.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'exam'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateQuestion = (qId: string, updater: (q: PscQuestion) => PscQuestion) => {
    setPaper((prev) => {
      if (!prev) return null;
      const nextQuestions = prev.questions.map((q) => (q.id === qId ? updater(q) : q));
      return {
        ...prev,
        questions: nextQuestions,
        totalMarks: recalcTotalMarks(nextQuestions),
      };
    });
  };

  const changeQuestionMarks = (qId: string, newMarks: number) => {
    if (!Number.isFinite(newMarks) || newMarks <= 0) return;
    updateQuestion(qId, (q) => ({
      ...q,
      marks: newMarks,
      negativeMarks: defaultNegativeForMarks(q.type, newMarks),
    }));
  };

  const changeQuestionNegativeMarks = (qId: string, newNeg: number) => {
    if (!Number.isFinite(newNeg) || newNeg < 0) return;
    updateQuestion(qId, (q) => ({
      ...q,
      negativeMarks: newNeg,
    }));
  };

  const bulkSetMarks = (targetMarks: number) => {
    setPaper((prev) => {
      if (!prev) return null;
      const nextQuestions = prev.questions.map((q) => ({
        ...q,
        marks: targetMarks,
        negativeMarks: defaultNegativeForMarks(q.type, targetMarks),
      }));
      return {
        ...prev,
        questions: nextQuestions,
        totalMarks: recalcTotalMarks(nextQuestions),
      };
    });
    toast.success(`All questions set to ${targetMarks} mark${targetMarks === 1 ? '' : 's'}.`);
  };

  const deleteQuestionFromDraft = async (qId: string, qNumber: number) => {
    if (!paper) return;
    if (paper.questions.length <= 1) {
      toast.error(
        'A question paper must have at least 1 question. Use "Delete Full Question Paper" to remove the entire paper.'
      );
      return;
    }

    // If editing an already-published paper, offer instant server sync or draft update
    const nextQuestions = paper.questions.filter((q) => q.id !== qId);
    setPaper({
      ...paper,
      questions: nextQuestions,
      totalMarks: recalcTotalMarks(nextQuestions),
    });

    if (editingPaperId) {
      try {
        const res = await fetch('/api/psc-exam/admin', {
          method: 'DELETE',
          headers: adminHeaders(),
          body: JSON.stringify({ id: editingPaperId, questionId: qId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not delete question from server.');
        toast.success(`Question #${qNumber} deleted from published paper.`);
        void loadPublishedExams();
      } catch (e: any) {
        toast.error(e.message);
      }
    } else {
      toast.success(`Question #${qNumber} removed from preview.`);
    }
  };

  const addNewQuestionToDraft = (type: PscQuestionType = 'MCQ') => {
    setPaper((prev) => {
      if (!prev) return null;
      const nextNum = prev.questions.length + 1;
      const newId = `q${nextNum}_${Date.now().toString().slice(-3)}`;
      const newQ: PscQuestion = {
        id: newId,
        type,
        topic: 'General',
        questionText: `New ${type} Question ${nextNum}`,
        questionImageUrl: '',
        options:
          type === 'NAT'
            ? []
            : [
                { id: 'A', text: 'Option A', imageUrl: '' },
                { id: 'B', text: 'Option B', imageUrl: '' },
                { id: 'C', text: 'Option C', imageUrl: '' },
                { id: 'D', text: 'Option D', imageUrl: '' },
              ],
        correctAnswer: type === 'NAT' ? '1' : 'A',
        marks: 1,
        negativeMarks: type === 'MCQ' ? 0.33 : 0,
        explanation: '',
        solutionImageUrl: '',
      };
      const nextQuestions = [...prev.questions, newQ];
      setExpandedEditIds((old) => ({ ...old, [newId]: true }));
      return {
        ...prev,
        questions: nextQuestions,
        totalMarks: recalcTotalMarks(nextQuestions),
      };
    });
  };

  const uploadImageForQuestion = async (
    file: File,
    onUrlReady: (url: string) => void
  ) => {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('prefix', 'psc-exam');
      const res = await fetch('/api/question-bank/admin/upload-image', {
        method: 'POST',
        headers: {
          'x-admin-email': process.env.NEXT_PUBLIC_ADMIN_EMAIL || '',
          'x-admin-password': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '',
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        onUrlReady(data.url);
        toast.success('Image uploaded and URL set!');
        return;
      }
      // Fallback to data URI if storage bucket is not configured
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUrlReady(reader.result);
          toast.success('Image attached as inline URL!');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUrlReady(reader.result);
          toast.success('Image attached!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveOrPublishPaper = async () => {
    if (!paper) return;
    if (!paper.title.trim()) {
      toast.error('Please enter an exam title.');
      return;
    }
    if (!paper.questions.length) {
      toast.error('The exam paper must have at least 1 question.');
      return;
    }

    setSaving(true);
    try {
      const method = editingPaperId ? 'PUT' : 'POST';
      const payload = {
        id: editingPaperId || undefined,
        title: paper.title.trim(),
        category: paper.category.trim() || 'Subject Wise',
        stream: paper.stream.trim().toUpperCase() || 'CS',
        durationMinutes: Number(paper.durationMinutes) || 45,
        totalMarks: recalcTotalMarks(paper.questions),
        questions: paper.questions,
      };

      const res = await fetch('/api/psc-exam/admin', {
        method,
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save exam paper.');

      toast.success(
        editingPaperId
          ? `Updated "${paper.title}" (${data.questionCount} questions, ${data.totalMarks} marks).`
          : `Published "${paper.title}" (${data.questionCount} questions, ${data.totalMarks} marks) to PSC Exam Test!`
      );

      setPaper(null);
      setEditingPaperId(null);
      setExpandedEditIds({});
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadPublishedExams();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const openPublishedPaperForEdit = async (id: string) => {
    setLoadingPaperId(id);
    try {
      const res = await fetch(`/api/psc-exam/admin?id=${encodeURIComponent(id)}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.exam) {
        throw new Error(data.error || 'Could not load exam paper.');
      }
      setEditingPaperId(data.exam.id);
      setPaper({
        title: data.exam.title,
        category: data.exam.category,
        stream: data.exam.stream,
        durationMinutes: data.exam.durationMinutes,
        totalMarks: recalcTotalMarks(data.exam.questions),
        questions: data.exam.questions,
      });
      setExpandedEditIds({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(`Opened "${data.exam.title}" for preview & editing.`);
    } catch (e: any) {
      toast.error(e.message || 'Unable to load exam.');
    } finally {
      setLoadingPaperId(null);
    }
  };

  const deleteFullPublishedPaper = async (id: string, title: string) => {
    if (
      !window.confirm(
        `Delete full question paper "${title}"?\n\nThis will permanently delete the entire question paper, all its questions, answer keys, and user attempts.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/psc-exam/admin', {
        method: 'DELETE',
        headers: adminHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      if (editingPaperId === id) {
        setPaper(null);
        setEditingPaperId(null);
      }
      toast.success(`Deleted full question paper "${title}".`);
      await loadPublishedExams();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete exam paper.');
    }
  };

  const calculatedTotalMarks = paper ? recalcTotalMarks(paper.questions) : 0;
  const mcqCount = paper?.questions.filter((q) => q.type === 'MCQ').length || 0;
  const natCount = paper?.questions.filter((q) => q.type === 'NAT').length || 0;
  const msqCount = paper?.questions.filter((q) => q.type === 'MSQ').length || 0;

  const filteredPublished = publishedExams.filter((ex) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [ex.title, ex.category, ex.stream].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
            <FileJson size={14} /> PSC / JSON Exam Control
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            JSON Upload Exam Section
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl">
            Upload your JSON question paper, preview and delete individual questions, add question
            image URLs, customize question marks, or delete full question papers. Explanations are
            optional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleLoadSampleJson}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 text-xs font-black transition"
          >
            <Sparkles size={15} /> Load Sample JSON
          </button>
          <button
            type="button"
            onClick={handleDownloadSampleJson}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold transition"
          >
            <Download size={15} /> Sample .JSON
          </button>
          <button
            type="button"
            onClick={() => setShowRawJsonModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold transition"
          >
            <FileJson size={15} /> Paste JSON Text
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-black transition shadow-lg shadow-emerald-500/10"
          >
            <Upload size={16} /> Upload JSON File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelect(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      {/* Drag & Drop Upload Box when no paper is open */}
      {!paper && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFileSelect(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 md:p-10 text-center transition-all ${
            dragging
              ? 'border-emerald-400 bg-emerald-500/10'
              : 'border-gray-800 bg-gray-900/60 hover:border-emerald-500/40 hover:bg-gray-900'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <FileJson size={30} />
          </div>
          <h2 className="text-lg font-black text-white">
            Drop your Exam JSON file here, or click to browse
          </h2>
          <p className="text-xs text-gray-400 mt-2 max-w-xl mx-auto">
            Supports <code className="text-emerald-300">title</code>,{' '}
            <code className="text-emerald-300">category</code>,{' '}
            <code className="text-emerald-300">stream</code>,{' '}
            <code className="text-emerald-300">durationMinutes</code>,{' '}
            <code className="text-emerald-300">totalMarks</code>, and{' '}
            <code className="text-emerald-300">questions</code> (MCQ / NAT / MSQ with optional{' '}
            <code className="text-emerald-300">explanation</code> &amp;{' '}
            <code className="text-emerald-300">questionImageUrl</code>).
          </p>
        </div>
      )}

      {/* Active Paper Preview & Question Editor */}
      {paper && (
        <section className="rounded-3xl border border-emerald-500/30 bg-gray-900/90 shadow-2xl overflow-hidden">
          {/* Paper Top Bar */}
          <div className="p-6 bg-gradient-to-r from-emerald-950/50 via-gray-900 to-gray-900 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
                  {editingPaperId ? 'Editing Published Paper' : 'JSON Exam Preview & Setup'}
                </span>
                <span className="text-xs text-gray-400 font-bold">
                  {paper.questions.length} Questions ({mcqCount} MCQ
                  {natCount ? ` • ${natCount} NAT` : ''}
                  {msqCount ? ` • ${msqCount} MSQ` : ''})
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white mt-2">{paper.title}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCurrentJson}
                className="px-3.5 py-2.5 rounded-xl border border-gray-700 bg-gray-800/80 text-gray-200 hover:text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download size={14} /> Export JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    editingPaperId &&
                    window.confirm(
                      `Delete this entire published question paper "${paper.title}" from the server?`
                    )
                  ) {
                    void deleteFullPublishedPaper(editingPaperId, paper.title);
                  } else if (!editingPaperId) {
                    setPaper(null);
                    setExpandedEditIds({});
                    toast('Cleared draft question paper.');
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-black flex items-center gap-1.5"
              >
                <Trash2 size={15} />
                {editingPaperId ? 'Delete Full Question Paper' : 'Discard / Delete Paper'}
              </button>
              {editingPaperId && (
                <button
                  type="button"
                  onClick={() => {
                    setPaper(null);
                    setEditingPaperId(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:text-white text-xs font-bold"
                >
                  Close Editor
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveOrPublishPaper()}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving
                  ? 'Saving...'
                  : editingPaperId
                    ? 'Save Changes to Exam'
                    : 'Upload & Publish Exam'}
              </button>
            </div>
          </div>

          {/* Paper Metadata Controls */}
          <div className="p-6 border-b border-gray-800 bg-black/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Exam Title
                </label>
                <input
                  value={paper.title}
                  onChange={(e) => setPaper({ ...paper, title: e.target.value })}
                  placeholder="e.g. GATE CS Mock Test 1 - Algorithms & Data Structures"
                  className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Category
                </label>
                <input
                  value={paper.category}
                  onChange={(e) => setPaper({ ...paper, category: e.target.value })}
                  placeholder="Subject Wise"
                  className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Stream
                </label>
                <input
                  value={paper.stream}
                  onChange={(e) => setPaper({ ...paper, stream: e.target.value.toUpperCase() })}
                  placeholder="CS / EC / EE / ALL"
                  className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={paper.durationMinutes}
                  onChange={(e) =>
                    setPaper({ ...paper, durationMinutes: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            {/* Quick Bulk Marks & Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <span className="text-gray-400 font-bold">Total Marks (Auto-Synced): </span>
                  <b className="text-emerald-400 text-sm font-black">{calculatedTotalMarks}</b>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 font-bold">Quick Bulk Marks:</span>
                  <button
                    type="button"
                    onClick={() => bulkSetMarks(1)}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold border border-gray-700 transition"
                  >
                    Set All 1 Mark
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetMarks(2)}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold border border-gray-700 transition"
                  >
                    Set All 2 Marks
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addNewQuestionToDraft('MCQ')}
                  className="px-3.5 py-2 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 text-xs font-black flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add MCQ
                </button>
                <button
                  type="button"
                  onClick={() => addNewQuestionToDraft('NAT')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 text-xs font-black flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add NAT
                </button>
              </div>
            </div>
          </div>

          {/* Questions Preview & Edit List */}
          <div className="p-6 space-y-5 max-h-[820px] overflow-y-auto">
            {paper.questions.map((q, index) => {
              const isExpanded = Boolean(expandedEditIds[q.id]);
              const hasExp = Boolean(
                (q.explanation && q.explanation.trim()) ||
                  (q.solutionImageUrl && q.solutionImageUrl.trim())
              );

              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-gray-800 bg-gray-950/80 overflow-hidden transition hover:border-gray-700"
                >
                  {/* Question Card Top Control Header */}
                  <div className="px-5 py-3.5 bg-gray-900/90 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-black text-xs">
                        Q{index + 1}
                      </span>
                      <span className="text-xs font-mono text-gray-500">({q.id})</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          q.type === 'MCQ'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                            : q.type === 'NAT'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                              : 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                        }`}
                      >
                        {q.type}
                      </span>
                      {q.topic && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-[11px] font-bold">
                          {q.topic}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          hasExp
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {hasExp ? 'Explanation Included' : 'No Explanation (Optional)'}
                      </span>
                    </div>

                    {/* Simple Marks Changer + Edit Toggle + Delete Question */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick 1M / 2M Buttons */}
                      <div className="flex items-center rounded-xl bg-black border border-gray-800 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => changeQuestionMarks(q.id, 1)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                            Number(q.marks) === 1
                              ? 'bg-emerald-500 text-black'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          1M
                        </button>
                        <button
                          type="button"
                          onClick={() => changeQuestionMarks(q.id, 2)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                            Number(q.marks) === 2
                              ? 'bg-emerald-500 text-black'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          2M
                        </button>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={q.marks}
                          onChange={(e) => changeQuestionMarks(q.id, Number(e.target.value))}
                          title="Custom Positive Marks"
                          className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-black text-emerald-400 text-center outline-none"
                        />
                      </div>

                      {/* Negative Marks Input */}
                      <div className="flex items-center gap-1.5 bg-black border border-gray-800 rounded-xl px-2.5 py-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Neg:</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={q.negativeMarks}
                          onChange={(e) => changeQuestionNegativeMarks(q.id, Number(e.target.value))}
                          className="w-14 bg-gray-900 border border-gray-700 rounded-lg px-1.5 py-0.5 text-xs font-bold text-red-400 text-center outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEditIds((old) => ({ ...old, [q.id]: !old[q.id] }))
                        }
                        className="px-3 py-1.5 rounded-xl border border-gray-700 bg-gray-800 text-gray-200 hover:text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Edit3 size={13} />
                        {isExpanded ? 'Hide Full Edit' : 'Edit Text / Explanation'}
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteQuestionFromDraft(q.id, index + 1)}
                        title="Delete this question"
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 text-xs font-black flex items-center gap-1"
                      >
                        <Trash2 size={14} /> Delete Question
                      </button>
                    </div>
                  </div>

                  {/* Question Body Preview */}
                  <div className="p-5 space-y-4">
                    {/* Question Text */}
                    <div className="text-sm md:text-base text-gray-100 leading-relaxed whitespace-pre-wrap font-medium">
                      {q.questionText}
                    </div>

                    {/* Direct Question Image URL Input & Preview (Always accessible!) */}
                    <div className="rounded-xl border border-gray-800/90 bg-black/40 p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ImageIcon size={16} className="text-cyan-400 shrink-0" />
                        <span className="text-xs font-black text-gray-300">
                          Question Image URL:
                        </span>
                        <input
                          value={q.questionImageUrl || ''}
                          onChange={(e) =>
                            updateQuestion(q.id, (item) => ({
                              ...item,
                              questionImageUrl: e.target.value,
                            }))
                          }
                          placeholder="Paste image URL (https://... or data:image/...) to display an image with this question"
                          className="flex-1 min-w-[220px] bg-gray-900 border border-gray-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                        />
                        <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-xs font-bold shrink-0">
                          Upload Image
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                void uploadImageForQuestion(f, (url) =>
                                  updateQuestion(q.id, (item) => ({
                                    ...item,
                                    questionImageUrl: url,
                                  }))
                                );
                              }
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                        {q.questionImageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(q.id, (item) => ({
                                ...item,
                                questionImageUrl: '',
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20"
                          >
                            Remove Image
                          </button>
                        )}
                      </div>

                      {q.questionImageUrl && (
                        <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 inline-block max-w-full">
                          <img
                            src={q.questionImageUrl}
                            alt={`Question ${index + 1}`}
                            className="max-h-64 max-w-full h-auto rounded-lg object-contain"
                          />
                        </div>
                      )}
                    </div>

                    {/* Options Preview for MCQ / MSQ or Answer for NAT */}
                    {q.type === 'NAT' ? (
                      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                          Numerical Correct Answer:
                        </span>
                        <input
                          value={q.correctAnswer}
                          onChange={(e) =>
                            updateQuestion(q.id, (item) => ({
                              ...item,
                              correctAnswer: e.target.value,
                            }))
                          }
                          placeholder="e.g. 2"
                          className="bg-gray-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-sm font-black text-white w-40 outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {q.options.map((opt) => {
                          const correctSet = new Set(
                            q.correctAnswer
                              .split(',')
                              .map((s) => s.trim().toUpperCase())
                              .filter(Boolean)
                          );
                          const isCorrect = correctSet.has(opt.id.toUpperCase());

                          return (
                            <div
                              key={opt.id}
                              onClick={() => {
                                if (q.type === 'MSQ') {
                                  const next = new Set(correctSet);
                                  if (next.has(opt.id)) {
                                    if (next.size > 1) next.delete(opt.id);
                                  } else {
                                    next.add(opt.id);
                                  }
                                  updateQuestion(q.id, (item) => ({
                                    ...item,
                                    correctAnswer: Array.from(next).sort().join(','),
                                  }));
                                } else {
                                  updateQuestion(q.id, (item) => ({
                                    ...item,
                                    correctAnswer: opt.id,
                                  }));
                                }
                              }}
                              title="Click to set as Correct Answer"
                              className={`cursor-pointer rounded-xl border p-3 flex items-start gap-3 transition ${
                                isCorrect
                                  ? 'border-emerald-500/50 bg-emerald-500/10'
                                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                              }`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                              >
                                {opt.id}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-200 break-words">{opt.text}</div>
                                {opt.imageUrl && (
                                  <img
                                    src={opt.imageUrl}
                                    alt={`Option ${opt.id}`}
                                    className="mt-2 max-h-32 rounded-lg border border-gray-700 object-contain"
                                  />
                                )}
                              </div>
                              {isCorrect && (
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 shrink-0">
                                  ✓ Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation Preview (if provided) */}
                    {hasExp && !isExpanded && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-gray-300 space-y-2">
                        <div className="font-black text-emerald-400 uppercase tracking-wider text-[10px]">
                          Explanation (Optional)
                        </div>
                        {q.explanation && <p className="leading-relaxed">{q.explanation}</p>}
                        {q.solutionImageUrl && (
                          <img
                            src={q.solutionImageUrl}
                            alt="Solution"
                            className="max-h-48 rounded-lg border border-gray-800 object-contain"
                          />
                        )}
                      </div>
                    )}

                    {/* Expandable Full Question / Option / Optional Explanation Editor */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-800 space-y-4 bg-black/30 p-4 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                              Question Type
                            </label>
                            <select
                              value={q.type}
                              onChange={(e) => {
                                const nextType = e.target.value as PscQuestionType;
                                updateQuestion(q.id, (item) => ({
                                  ...item,
                                  type: nextType,
                                  negativeMarks: defaultNegativeForMarks(nextType, item.marks),
                                  options:
                                    nextType === 'NAT'
                                      ? []
                                      : item.options.length
                                        ? item.options
                                        : [
                                            { id: 'A', text: 'Option A', imageUrl: '' },
                                            { id: 'B', text: 'Option B', imageUrl: '' },
                                            { id: 'C', text: 'Option C', imageUrl: '' },
                                            { id: 'D', text: 'Option D', imageUrl: '' },
                                          ],
                                }));
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            >
                              <option value="MCQ">MCQ</option>
                              <option value="NAT">NAT</option>
                              <option value="MSQ">MSQ</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                              Topic
                            </label>
                            <input
                              value={q.topic || ''}
                              onChange={(e) =>
                                updateQuestion(q.id, (item) => ({
                                  ...item,
                                  topic: e.target.value,
                                }))
                              }
                              placeholder="e.g. Algorithms"
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                              Correct Answer
                            </label>
                            <input
                              value={q.correctAnswer}
                              onChange={(e) =>
                                updateQuestion(q.id, (item) => ({
                                  ...item,
                                  correctAnswer: e.target.value,
                                }))
                              }
                              placeholder={q.type === 'NAT' ? '2' : 'B'}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                            Question Text
                          </label>
                          <textarea
                            rows={2}
                            value={q.questionText}
                            onChange={(e) =>
                              updateQuestion(q.id, (item) => ({
                                ...item,
                                questionText: e.target.value,
                              }))
                            }
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>

                        {q.type !== 'NAT' && (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400">
                              Options (Text &amp; Optional Option Image URL)
                            </label>
                            {q.options.map((opt, oIdx) => (
                              <div key={opt.id} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 text-xs font-black text-gray-400">
                                    {opt.id}:
                                  </span>
                                  <input
                                    value={opt.text}
                                    onChange={(e) =>
                                      updateQuestion(q.id, (item) => ({
                                        ...item,
                                        options: item.options.map((o, idx) =>
                                          idx === oIdx ? { ...o, text: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    placeholder={`Option ${opt.id} text`}
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                                <input
                                  value={opt.imageUrl || ''}
                                  onChange={(e) =>
                                    updateQuestion(q.id, (item) => ({
                                      ...item,
                                      options: item.options.map((o, idx) =>
                                        idx === oIdx ? { ...o, imageUrl: e.target.value } : o
                                      ),
                                    }))
                                  }
                                  placeholder={`Option ${opt.id} Image URL (optional)`}
                                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                              Explanation (Optional — leave blank if none)
                            </label>
                            <textarea
                              rows={2}
                              value={q.explanation || ''}
                              onChange={(e) =>
                                updateQuestion(q.id, (item) => ({
                                  ...item,
                                  explanation: e.target.value,
                                }))
                              }
                              placeholder="Optional explanation for solution review..."
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">
                              Solution Image URL (Optional)
                            </label>
                            <input
                              value={q.solutionImageUrl || ''}
                              onChange={(e) =>
                                updateQuestion(q.id, (item) => ({
                                  ...item,
                                  solutionImageUrl: e.target.value,
                                }))
                              }
                              placeholder="https://... (optional solution image)"
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Published Question Papers Library */}
      <section className="rounded-3xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 text-lg font-black text-white">
              <Layers3 size={20} className="text-emerald-400" />
              Uploaded PSC / JSON Question Papers
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Click <b>Preview / Edit Questions</b> on any paper to view questions, add image URLs,
              change marks, or delete individual questions, or click{' '}
              <b>Delete Full Question Paper</b> to remove the entire exam.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, category, stream..."
              className="bg-black border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => void loadPublishedExams()}
              className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:text-white"
              title="Refresh list"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {loadingList ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            <Loader2 size={20} className="animate-spin inline mr-2 text-emerald-400" />
            Loading uploaded question papers...
          </div>
        ) : !filteredPublished.length ? (
          <div className="p-12 text-center">
            <HelpCircle size={28} className="mx-auto text-gray-600 mb-2" />
            <p className="text-sm font-bold text-gray-300">No JSON Exam Papers uploaded yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Upload a JSON file above or click &ldquo;Load Sample JSON&rdquo; to publish your first
              PSC Exam Test paper.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredPublished.map((ex) => (
              <div
                key={ex.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.015] transition"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-white text-base">{ex.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                      {ex.category}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase">
                      {ex.stream}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-2">
                    <span>
                      <b className="text-white">{ex.questionCount}</b> Questions
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} /> <b className="text-white">{ex.durationMinutes}</b> mins
                    </span>
                    <span>•</span>
                    <span>
                      <b className="text-emerald-400">{ex.totalMarks}</b> Total Marks
                    </span>
                    <span>•</span>
                    <span>Uploaded {new Date(ex.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={loadingPaperId === ex.id}
                    onClick={() => void openPublishedPaperForEdit(ex.id)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-black flex items-center gap-1.5 transition"
                  >
                    {loadingPaperId === ex.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Eye size={14} />
                    )}
                    Preview / Edit Questions
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteFullPublishedPaper(ex.id, ex.title)}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 text-xs font-black flex items-center gap-1.5 transition"
                  >
                    <Trash2 size={14} /> Delete Full Question Paper
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Paste Raw JSON Modal */}
      {showRawJsonModal && (
        <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-gray-800 bg-gray-950 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-white">
                <FileJson size={18} className="text-emerald-400" />
                Paste Exam JSON
              </div>
              <button
                type="button"
                onClick={() => setShowRawJsonModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                rows={14}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={JSON.stringify(SAMPLE_PSC_EXAM_JSON, null, 2)}
                className="w-full bg-black border border-gray-800 rounded-2xl p-4 font-mono text-xs text-emerald-300 outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setJsonText(JSON.stringify(SAMPLE_PSC_EXAM_JSON, null, 2))}
                  className="text-xs font-bold text-violet-400 hover:text-violet-300"
                >
                  Fill with Sample JSON
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawJsonModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleParsePastedJson}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-black"
                  >
                    Load &amp; Preview Questions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
