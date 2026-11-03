'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Cpu, Radio, Award, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChanging = searchParams.get('change') === '1';
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRole(localStorage.getItem('gateTrackerBranch'));
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });
  }, [router]);

  const chooseBranch = async (branch: 'ece' | 'cse' | 'psc') => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      await supabase.auth.updateUser({
        data: { branch },
      });
      localStorage.setItem('gateTrackerBranch', branch);

      const { error } = await supabase
        .from('user_profiles')
        .upsert({ user_id: session.user.id, branch }, { onConflict: 'user_id' });

      if (error) {
        if (branch === 'psc') {
          await supabase
            .from('user_profiles')
            .upsert({ user_id: session.user.id, branch: 'ece' }, { onConflict: 'user_id' });
        } else {
          console.error(error);
          toast.error(`Could not save role: ${error.message}`);
          setLoading(false);
          return;
        }
      }

      if (branch === 'psc') {
        toast.success('PSC Exam PYQ role selected.');
        router.replace('/psc-exam');
      } else {
        toast.success(`GATE ${branch.toUpperCase()} stream selected.`);
        router.replace('/dashboard');
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save selection.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-5 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4">
            <ArrowRight className="text-emerald-400" size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
            {isChanging ? 'Switch Your Exam Role' : 'Choose Your Exam Role'}
          </h1>
          <p className="text-zinc-500 text-sm sm:text-base mt-2.5 max-w-xl mx-auto">
            {isChanging
              ? 'Select your target exam stream and your sidebar workspace will update immediately.'
              : 'Select PSC Exam PYQ or GATE (ECE / CSE) to customize your workspace.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* 1. PSC Exam Role — Featured at the Top */}
          <button
            disabled={loading}
            onClick={() => void chooseBranch('psc')}
            className={`md:col-span-2 text-left p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/90 to-zinc-900/80 ring-1 transition-all group ${
              selectedRole === 'psc'
                ? 'ring-emerald-400 bg-emerald-500/[0.12] shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                : 'ring-emerald-500/35 hover:ring-emerald-400 hover:bg-emerald-500/[0.1]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center">
                <Award className="text-emerald-400" size={28} />
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                PSC Exam • PYQ &amp; Mock Tests
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-4">PSC Exam</div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Dedicated PSC Exam PYQ &amp; Mock Test Series environment with section-wise score
              breakdown, weak-area detection, and detailed explanations.
            </p>
            <div className="mt-5 text-xs font-black uppercase tracking-widest text-emerald-400 group-hover:translate-x-1 transition-transform">
              Continue to PSC Exam PYQ →
            </div>
          </button>

          {/* 2. GATE ECE Role */}
          <button
            disabled={loading}
            onClick={() => void chooseBranch('ece')}
            className={`text-left p-6 sm:p-7 rounded-3xl bg-zinc-900/70 ring-1 transition-all group ${
              selectedRole === 'ece'
                ? 'ring-emerald-500 bg-emerald-500/[0.06]'
                : 'ring-white/10 hover:ring-emerald-500/50 hover:bg-emerald-500/[0.05]'
            }`}
          >
            <Cpu className="text-emerald-400 mb-4 sm:mb-5" size={32} />
            <div className="flex items-center justify-between gap-2">
              <div className="text-xl sm:text-2xl font-black">ECE</div>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-400">
                GATE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Electronics &amp; Communication Engineering
            </p>
            <div className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-400 group-hover:translate-x-1 transition-transform">
              Continue →
            </div>
          </button>

          {/* 3. GATE CSE Role */}
          <button
            disabled={loading}
            onClick={() => void chooseBranch('cse')}
            className={`text-left p-6 sm:p-7 rounded-3xl bg-zinc-900/70 ring-1 transition-all group ${
              selectedRole === 'cse'
                ? 'ring-blue-500 bg-blue-500/[0.06]'
                : 'ring-white/10 hover:ring-blue-500/50 hover:bg-blue-500/[0.05]'
            }`}
          >
            <Radio className="text-blue-400 mb-4 sm:mb-5" size={32} />
            <div className="flex items-center justify-between gap-2">
              <div className="text-xl sm:text-2xl font-black">CSE</div>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-400">
                GATE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
              Computer Science &amp; Engineering
            </p>
            <div className="mt-5 text-xs font-bold uppercase tracking-widest text-blue-400 group-hover:translate-x-1 transition-transform">
              Continue →
            </div>
          </button>
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
            <Loader2 size={16} className="animate-spin text-emerald-400" /> Saving your role...
          </div>
        )}
      </div>
    </div>
  );
}
