'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Cpu, Radio, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });
  }, [router]);

  const chooseBranch = async (branch: 'ece' | 'cse') => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: session.user.id, branch }, { onConflict: 'user_id' });

    if (error) {
      console.error(error);
      toast.error(`Could not save branch: ${error.message}`);
      setLoading(false);
      return;
    }

    localStorage.setItem('gateTrackerBranch', branch);
    toast.success(`${branch.toUpperCase()} stream selected.`);
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-5">
            <ArrowRight className="text-emerald-400" size={30} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Choose Your Branch</h1>
          <p className="text-zinc-500 mt-3">Your subjects, topics and lectures will be filtered to this stream.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <button disabled={loading} onClick={() => chooseBranch('ece')} className="text-left p-7 rounded-3xl bg-zinc-900/70 ring-1 ring-white/10 hover:ring-emerald-500/50 hover:bg-emerald-500/[0.05] transition-all group">
            <Cpu className="text-emerald-400 mb-5" size={34} />
            <div className="text-2xl font-black">ECE</div>
            <p className="text-sm text-zinc-500 mt-2">Electronics & Communication Engineering</p>
            <div className="mt-6 text-xs font-bold uppercase tracking-widest text-emerald-400 group-hover:translate-x-1 transition-transform">Continue →</div>
          </button>
          <button disabled={loading} onClick={() => chooseBranch('cse')} className="text-left p-7 rounded-3xl bg-zinc-900/70 ring-1 ring-white/10 hover:ring-blue-500/50 hover:bg-blue-500/[0.05] transition-all group">
            <Radio className="text-blue-400 mb-5" size={34} />
            <div className="text-2xl font-black">CSE</div>
            <p className="text-sm text-zinc-500 mt-2">Computer Science & Engineering</p>
            <div className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-400 group-hover:translate-x-1 transition-transform">Continue →</div>
          </button>
        </div>
        {loading && <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500"><Loader2 size={16} className="animate-spin"/> Saving your branch...</div>}
      </div>
    </div>
  );
}
