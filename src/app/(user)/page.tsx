'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText,
  Flame, GraduationCap, Plus, Save, Trash2, Trophy, Video, X, Target
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getISTDateString } from '../../../lib/dataService';

type LectureLog = {
  id: string;
  material_id: string;
  date_str: string;
  title: string;
  subject_name: string;
  topic_name: string;
  duration_mins: number;
};

type Exam = {
  id: string;
  exam_name: string;
  exam_date: string;
  score: number | null;
  total_marks: number | null;
  notes: string | null;
};

const formatMinutes = (mins: number) => {
  const total = Math.round(mins || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const getDateLabel = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export default function DailyTrackerPage() {
  const router = useRouter();
  const today = getISTDateString();

  const [selectedDate, setSelectedDate] = useState(today);
  const [logs, setLogs] = useState<LectureLog[]>([]);
  const [allLogs, setAllLogs] = useState<LectureLog[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [examForm, setExamForm] = useState({
    exam_name: '',
    exam_date: today,
    score: '',
    total_marks: '',
    notes: '',
  });

  const dateStrip = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - 3 + i);
      return getISTDateString(d);
    });
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }

    const [{ data: lectureData, error: lectureError }, { data: examData }, { data: tracking }] =
      await Promise.all([
        supabase.from('daily_lecture_activity').select('*').eq('user_id', session.user.id).order('date_str', { ascending: false }).order('created_at', { ascending: true }),
        supabase.from('user_exam_scores').select('*').eq('user_id', session.user.id).order('exam_date', { ascending: true }),
        supabase.from('daily_tracking').select('date_str, notes').eq('user_id', session.user.id).eq('date_str', selectedDate).maybeSingle(),
      ]);

    if (lectureError) {
      console.error(lectureError);
      toast.error('Daily tracker database is not ready. Run the SQL migration.');
    }

    const fetchedLogs = (lectureData || []) as LectureLog[];
    setAllLogs(fetchedLogs);
    setLogs(fetchedLogs.filter(log => log.date_str === selectedDate));
    setExams((examData || []) as Exam[]);
    setNote(tracking?.notes || '');
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const dailyMinutes = useMemo(
    () => logs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0),
    [logs]
  );

  const activeDays = useMemo(
    () => new Set(allLogs.map(log => log.date_str)).size,
    [allLogs]
  );

  const monthlyMinutes = useMemo(() => {
    const monthPrefix = selectedDate.slice(0, 7);
    return allLogs
      .filter(log => log.date_str.startsWith(monthPrefix))
      .reduce((sum, log) => sum + Number(log.duration_mins || 0), 0);
  }, [allLogs, selectedDate]);

  const dailyPercent = Math.min(100, Math.round((dailyMinutes / 360) * 100));

  const saveNote = async () => {
    setSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('daily_tracking').upsert({
      user_id: session.user.id,
      date_str: selectedDate,
      notes: note,
    }, { onConflict: 'user_id,date_str' });

    if (error) toast.error(error.message);
    else toast.success('Daily report saved.');
    setSavingNote(false);
  };

  const addExam = async () => {
    if (!examForm.exam_name.trim() || !examForm.exam_date) {
      toast.error('Enter the exam name and date.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('user_exam_scores').insert({
      user_id: session.user.id,
      exam_name: examForm.exam_name.trim(),
      exam_date: examForm.exam_date,
      score: examForm.score === '' ? null : Number(examForm.score),
      total_marks: examForm.total_marks === '' ? null : Number(examForm.total_marks),
      notes: examForm.notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setExamForm({ exam_name: '', exam_date: today, score: '', total_marks: '', notes: '' });
    setShowExamForm(false);
    await loadData();
    toast.success('Exam result added.');
  };

  const deleteExam = async (id: string) => {
    const { error } = await supabase.from('user_exam_scores').delete().eq('id', id);
    if (error) toast.error(error.message);
    else setExams(prev => prev.filter(exam => exam.id !== id));
  };

  const getScorePercent = (exam: Exam) => {
    if (exam.score === null || exam.total_marks === null || !exam.total_marks) return null;
    return Math.round((Number(exam.score) / Number(exam.total_marks)) * 100);
  };

  const recentDays = useMemo(() => {
    const base = new Date(`${today}T12:00:00`);
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (27 - i));
      const date = getISTDateString(d);
      const minutes = allLogs
        .filter(log => log.date_str === date)
        .reduce((sum, log) => sum + Number(log.duration_mins || 0), 0);
      return { date, minutes };
    });
  }, [allLogs, today]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans pb-20">
      <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 bg-black/40 hover:bg-white/10 ring-1 ring-white/10 rounded-lg text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">
                <Activity size={11} /> Personal Study Ledger
              </div>
              <h1 className="text-lg sm:text-xl font-black text-zinc-100 tracking-tight">Daily Tracker</h1>
            </div>
          </div>
          <Link
            href="/resources"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 ring-1 ring-zinc-800 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            <Video size={13} /> Continue Lectures
          </Link>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Snapshot */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Selected Day', value: formatMinutes(dailyMinutes), icon: Clock3, box: 'bg-emerald-500/10 ring-emerald-500/20', iconText: 'text-emerald-400' },
            { label: 'Lectures Done', value: logs.length, icon: CheckCircle2, box: 'bg-indigo-500/10 ring-indigo-500/20', iconText: 'text-indigo-400' },
            { label: 'Active Days', value: activeDays, icon: Flame, box: 'bg-orange-500/10 ring-orange-500/20', iconText: 'text-orange-400' },
            { label: 'This Month', value: formatMinutes(monthlyMinutes), icon: Target, box: 'bg-violet-500/10 ring-violet-500/20', iconText: 'text-violet-400' },
          ].map(({ label, value, icon: Icon, box, iconText }) => (
            <div key={label} className="bg-zinc-900/50 ring-1 ring-zinc-800 rounded-2xl p-4">
              <div className={`w-9 h-9 rounded-xl ${box} ring-1 flex items-center justify-center mb-3`}>
                <Icon size={16} className={iconText} />
              </div>
              <div className="text-xl font-black text-zinc-100">{value}</div>
              <div className="text-[8px] uppercase tracking-widest font-bold text-zinc-600 mt-1">{label}</div>
            </div>
          ))}
        </section>

        {/* Date navigator */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-zinc-100 text-sm">Daily Report</h2>
              <p className="text-[10px] text-zinc-600 mt-1">{getDateLabel(selectedDate)}</p>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-zinc-950 ring-1 ring-zinc-800 rounded-lg px-2 py-2 text-[10px] text-zinc-300 outline-none"
            />
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {dateStrip.map(date => {
              const dayLogs = allLogs.filter(log => log.date_str === date);
              const mins = dayLogs.reduce((sum, log) => sum + Number(log.duration_mins || 0), 0);
              const active = date === selectedDate;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`min-w-0 rounded-xl p-2.5 text-center ring-1 transition-all ${
                    active ? 'bg-emerald-500/10 ring-emerald-500/40' : 'bg-zinc-950/70 ring-zinc-800 hover:ring-zinc-600'
                  }`}
                >
                  <div className={`text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-black mt-1 ${active ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {new Date(`${date}T12:00:00`).getDate()}
                  </div>
                  <div className={`text-[8px] font-bold mt-1 ${mins ? 'text-emerald-500' : 'text-zinc-700'}`}>
                    {mins ? formatMinutes(mins) : isToday ? 'Today' : '—'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-2">
              <span className="text-zinc-500">6-hour study target</span>
              <span className="text-emerald-400">{dailyPercent}%</span>
            </div>
            <div className="h-2 bg-zinc-950 rounded-full ring-1 ring-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dailyPercent}%` }} />
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6">
          {/* Lecture ledger */}
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-black text-zinc-100 text-sm">What I Completed</h2>
                <p className="text-[9px] text-zinc-600 mt-1">Every completed lecture is stamped with its date.</p>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-400 text-[9px] font-black">
                {formatMinutes(dailyMinutes)}
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {loading ? (
                <div className="py-16 text-center text-[10px] uppercase tracking-widest text-zinc-600 animate-pulse">Loading ledger...</div>
              ) : logs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 ring-1 ring-zinc-800 flex items-center justify-center mx-auto mb-3">
                    <CalendarDays size={20} className="text-zinc-700" />
                  </div>
                  <p className="text-sm font-bold text-zinc-500">Nothing logged for this day.</p>
                  <p className="text-[9px] text-zinc-700 mt-1">Tick a lecture as completed from Curriculum to create the entry.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950/70 ring-1 ring-zinc-800/80">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-200 truncate">{log.title}</div>
                        <div className="text-[8px] uppercase tracking-widest text-zinc-600 mt-1 truncate">
                          {log.subject_name} {log.topic_name ? `• ${log.topic_name}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                        <Clock3 size={11} /> {formatMinutes(Number(log.duration_mins))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center">
                <FileText size={15} className="text-rose-400" />
              </div>
              <div>
                <h2 className="font-black text-zinc-100 text-sm">Daily Reflection</h2>
                <p className="text-[9px] text-zinc-600">Write what actually happened.</p>
              </div>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What did you study? What went well? What should you fix tomorrow?"
              className="flex-1 min-h-[170px] bg-zinc-950/70 ring-1 ring-zinc-800 rounded-xl p-4 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:ring-emerald-500/40 resize-none"
            />
            <button
              onClick={saveNote}
              disabled={savingNote}
              className="mt-3 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Save size={13} /> {savingNote ? 'Saving...' : 'Save Daily Report'}
            </button>
          </section>
        </div>

        {/* 28 day activity */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 flex items-center justify-center">
              <Activity size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-zinc-100 text-sm">28-Day Consistency</h2>
              <p className="text-[9px] text-zinc-600">A visual record of the days you actually studied.</p>
            </div>
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
            {recentDays.map(day => {
              const level = day.minutes === 0 ? 0 : day.minutes < 60 ? 1 : day.minutes < 180 ? 2 : day.minutes < 360 ? 3 : 4;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  title={`${day.date}: ${formatMinutes(day.minutes)}`}
                  className={`aspect-square rounded-lg ring-1 transition-all hover:scale-105 ${
                    level === 0 ? 'bg-zinc-950 ring-zinc-800' :
                    level === 1 ? 'bg-emerald-950 ring-emerald-900' :
                    level === 2 ? 'bg-emerald-900 ring-emerald-800' :
                    level === 3 ? 'bg-emerald-700 ring-emerald-600' :
                    'bg-emerald-500 ring-emerald-400'
                  } ${selectedDate === day.date ? 'outline outline-2 outline-white/50 outline-offset-2' : ''}`}
                />
              );
            })}
          </div>
        </section>

        {/* Exams */}
        <section className="bg-zinc-900/40 ring-1 ring-zinc-800 rounded-[1.5rem] overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center">
                <GraduationCap size={16} className="text-amber-400" />
              </div>
              <div>
                <h2 className="font-black text-zinc-100 text-sm">Exam Scoreboard</h2>
                <p className="text-[9px] text-zinc-600">Record every mock, GATE test, or other exam.</p>
              </div>
            </div>
            <button
              onClick={() => setShowExamForm(v => !v)}
              className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5"
            >
              {showExamForm ? <X size={12} /> : <Plus size={12} />} {showExamForm ? 'Close' : 'Add Exam'}
            </button>
          </div>

          {showExamForm && (
            <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input value={examForm.exam_name} onChange={e => setExamForm({ ...examForm, exam_name: e.target.value })} placeholder="Exam name" className="lg:col-span-2 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none focus:ring-amber-500/40" />
              <input type="date" value={examForm.exam_date} onChange={e => setExamForm({ ...examForm, exam_date: e.target.value })} className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <input type="number" value={examForm.score} onChange={e => setExamForm({ ...examForm, score: e.target.value })} placeholder="Score" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <input type="number" value={examForm.total_marks} onChange={e => setExamForm({ ...examForm, total_marks: e.target.value })} placeholder="Total marks" className="bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none" />
              <textarea value={examForm.notes} onChange={e => setExamForm({ ...examForm, notes: e.target.value })} placeholder="Short note (optional)" className="sm:col-span-2 lg:col-span-4 bg-zinc-900 ring-1 ring-zinc-800 rounded-xl px-3 py-3 text-xs outline-none resize-none h-12" />
              <button onClick={addExam} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-widest">Save Result</button>
            </div>
          )}

          <div className="p-4 space-y-2">
            {exams.length === 0 ? (
              <div className="py-10 text-center text-[10px] uppercase tracking-widest text-zinc-700">No exams recorded yet.</div>
            ) : (
              exams.map(exam => {
                const pct = getScorePercent(exam);
                return (
                  <div key={exam.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-950/60 ring-1 ring-zinc-800">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Trophy size={15} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <div className="text-xs font-bold text-zinc-200">{exam.exam_name}</div>
                      <div className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">{getDateLabel(exam.exam_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-zinc-100">
                        {exam.score === null ? '—' : `${exam.score}${exam.total_marks !== null ? ` / ${exam.total_marks}` : ''}`}
                      </div>
                      {pct !== null && <div className="text-[8px] font-bold text-emerald-400">{pct}%</div>}
                    </div>
                    <button onClick={() => deleteExam(exam.id)} className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-500/10">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
