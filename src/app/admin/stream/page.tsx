'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Code2 } from 'lucide-react';

export default function AdminStreamSelector() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') router.replace('/login');
  }, [router]);

  const select = (stream: 'ece' | 'cse') => {
    sessionStorage.setItem('adminStream', stream);
    router.replace('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="text-red-400 text-xs font-black tracking-[0.3em] uppercase mb-3">Admin Workspace</div>
          <h1 className="text-3xl md:text-4xl font-black">Which stream do you want to manage?</h1>
          <p className="text-gray-500 mt-3">Only the selected stream will be visible in Resource Management.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <button onClick={() => select('ece')} className="p-8 text-left rounded-3xl bg-gray-900 border border-gray-800 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] transition-all">
            <Cpu size={38} className="text-emerald-400 mb-5"/>
            <div className="text-2xl font-black">ECE</div>
            <p className="text-sm text-gray-500 mt-2">Manage Electronics & Communication lectures.</p>
          </button>
          <button onClick={() => select('cse')} className="p-8 text-left rounded-3xl bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-blue-500/[0.04] transition-all">
            <Code2 size={38} className="text-blue-400 mb-5"/>
            <div className="text-2xl font-black">CSE</div>
            <p className="text-sm text-gray-500 mt-2">Manage Computer Science lectures.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
