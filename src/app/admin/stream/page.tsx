'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Code2, FileJson, Check } from 'lucide-react';

export default function AdminStreamSelector() {
  const router = useRouter();
  const [currentStream, setCurrentStream] = useState<'ece' | 'cse' | 'psc' | null>(null);
  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') {
      router.replace('/login');
      return;
    }
    setCurrentStream(sessionStorage.getItem('adminStream') as 'ece' | 'cse' | 'psc' | null);
  }, [router]);

  const select = (stream: 'ece' | 'cse' | 'psc') => {
    sessionStorage.setItem('adminStream', stream === 'psc' ? 'ece' : stream);
    setCurrentStream(stream);
    if (stream === 'psc') {
      router.replace('/admin/psc-exam');
    } else {
      router.replace('/admin/dashboard');
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="text-red-400 text-xs font-black tracking-[0.3em] uppercase mb-3">
            Admin Workspace
          </div>
          <h1 className="text-3xl md:text-4xl font-black">
            Which exam or stream do you want to manage?
          </h1>
          <p className="text-gray-500 mt-3">
            Choose PSC Exam PYQ (JSON Upload) or GATE (ECE / CSE).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. PSC Exam PYQ — Featured at the Top */}
          <button
            onClick={() => select('psc')}
            className="md:col-span-2 p-7 text-left rounded-3xl bg-gradient-to-br from-emerald-500/10 via-gray-900 to-gray-900 border border-emerald-500/35 hover:border-emerald-400 hover:bg-emerald-500/[0.08] transition-all"
          >
            <FileJson size={36} className="text-emerald-400 mb-4" />
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black">PSC Exam PYQ (JSON Upload)</div>
              {currentStream === 'psc' && <Check className="text-emerald-400" size={22} />}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Upload JSON question papers, preview &amp; delete questions, edit marks &amp; image
              URLs, and manage PSC exams.
            </p>
          </button>

          {/* 2. GATE ECE */}
          <button
            onClick={() => select('ece')}
            className="p-7 text-left rounded-3xl bg-gray-900 border border-gray-800 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] transition-all"
          >
            <Cpu size={36} className="text-emerald-400 mb-5" />
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black">ECE</div>
              {currentStream === 'ece' && <Check className="text-emerald-400" size={22} />}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Manage Electronics &amp; Communication lectures and question bank.
            </p>
          </button>

          {/* 3. GATE CSE */}
          <button
            onClick={() => select('cse')}
            className="p-7 text-left rounded-3xl bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-blue-500/[0.04] transition-all"
          >
            <Code2 size={36} className="text-blue-400 mb-5" />
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black">CSE</div>
              {currentStream === 'cse' && <Check className="text-blue-400" size={22} />}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Manage Computer Science lectures and question bank.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
