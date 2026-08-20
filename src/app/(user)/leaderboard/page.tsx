'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Trophy, Medal, Crown, ArrowLeft, Flame, Clock3, CalendarDays, Users } from 'lucide-react';
import Link from 'next/link';

type LeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  branch: string | null;
  daily_minutes: number;
  week_minutes: number;
  month_minutes: number;
};

type SortMode = 'daily' | 'week' | 'month';

const formatHours = (minutes: number) => {
  const mins = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('daily');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setMyUserId(session.user.id);

      const { data, error } = await supabase.rpc('get_study_leaderboard');
      if (error) {
        console.error('Leaderboard error:', error);
        setError('Leaderboard data could not be loaded. Run the supplied leaderboard SQL in Supabase first.');
      } else {
        setRows((data || []) as LeaderboardRow[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const sortedRows = useMemo(() => {
    const key = sortMode === 'daily' ? 'daily_minutes' : sortMode === 'week' ? 'week_minutes' : 'month_minutes';
    return [...rows]
      .sort((a, b) => Number(b[key]) - Number(a[key]))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [rows, sortMode]);

  const myRow = sortedRows.find(r => r.user_id === myUserId);

  return (
    <div className="min-h-full bg-[#050505] text-zinc-200 px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-400 mb-4">
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center">
                <Trophy className="text-amber-400" size={22} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Study Leaderboard</h1>
                <p className="text-xs text-zinc-500 mt-1">All ECE + CSE students • ranked by study time</p>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-500">
            <Users size={15} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{rows.length} Students</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => setSortMode('daily')} className={`p-4 rounded-2xl text-left border transition-all ${sortMode === 'daily' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500"><Clock3 size={14} /> Today</div>
            <div className="text-lg font-black mt-2">Daily Study</div>
            <div className="text-[10px] text-zinc-600 mt-1">Default ranking</div>
          </button>
          <button onClick={() => setSortMode('week')} className={`p-4 rounded-2xl text-left border transition-all ${sortMode === 'week' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500"><CalendarDays size={14} /> This Week</div>
            <div className="text-lg font-black mt-2">Weekly Study</div>
            <div className="text-[10px] text-zinc-600 mt-1">Monday → today</div>
          </button>
          <button onClick={() => setSortMode('month')} className={`p-4 rounded-2xl text-left border transition-all ${sortMode === 'month' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500"><Flame size={14} /> This Month</div>
            <div className="text-lg font-black mt-2">Monthly Study</div>
            <div className="text-[10px] text-zinc-600 mt-1">Calendar month total</div>
          </button>
        </div>

        {myRow && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Your Position</p>
              <p className="font-black mt-1">#{myRow.rank} • {myRow.display_name}</p>
            </div>
            <div className="flex gap-5 text-xs">
              <span><b>{formatHours(myRow.daily_minutes)}</b><span className="text-zinc-600 ml-1">today</span></span>
              <span><b>{formatHours(myRow.week_minutes)}</b><span className="text-zinc-600 ml-1">week</span></span>
              <span><b>{formatHours(myRow.month_minutes)}</b><span className="text-zinc-600 ml-1">month</span></span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-zinc-950/70 overflow-hidden shadow-2xl">
          <div className="hidden sm:grid grid-cols-[70px_minmax(180px,1fr)_100px_130px_130px] gap-3 px-5 py-4 border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-600">
            <span>Rank</span><span>Student</span><span>Branch</span><span>Today</span><span>Week / Month</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-600 animate-pulse">Loading study rankings...</div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-red-400">{error}</div>
          ) : sortedRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-600">No study activity has been recorded yet.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {sortedRows.map((row) => {
                const isMe = row.user_id === myUserId;
                const rankIcon = row.rank === 1 ? <Crown size={17} className="text-amber-400" /> : row.rank === 2 ? <Medal size={17} className="text-zinc-300" /> : row.rank === 3 ? <Medal size={17} className="text-orange-400" /> : <span className="text-xs font-black text-zinc-600">#{row.rank}</span>;
                return (
                  <div key={row.user_id} className={`grid grid-cols-1 sm:grid-cols-[70px_minmax(180px,1fr)_100px_130px_130px] gap-2 sm:gap-3 px-5 py-4 items-center ${isMe ? 'bg-emerald-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-2">{rankIcon}<span className="sm:hidden text-[9px] text-zinc-600 uppercase tracking-widest">Rank {row.rank}</span></div>
                    <div className="min-w-0"><p className={`text-sm font-black truncate ${isMe ? 'text-emerald-400' : 'text-zinc-200'}`}>{row.display_name}{isMe ? ' (You)' : ''}</p><p className="text-[9px] text-zinc-600 mt-0.5">All-stream ranking</p></div>
                    <div><span className={`inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${row.branch === 'cse' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{(row.branch || '—').toUpperCase()}</span></div>
                    <div><p className="text-sm font-black">{formatHours(row.daily_minutes)}</p><p className="text-[9px] text-zinc-600">daily</p></div>
                    <div><p className="text-xs font-bold">{formatHours(row.week_minutes)}</p><p className="text-[9px] text-zinc-600">week • {formatHours(row.month_minutes)} month</p></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
