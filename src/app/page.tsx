import Link from 'next/link';
import { Activity, Zap, Shield, ChevronRight, Target, BrainCircuit } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden relative flex flex-col items-center justify-center">
      
      {/* --- AMBIENT GLOWS --- */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* --- BACKGROUND GRID --- */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center animate-in fade-in zoom-in-[0.98] duration-1000 ease-out">
        
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 ring-1 ring-white/10 backdrop-blur-md mb-8 shadow-2xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">GATE ECE Protocol Active</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-tight">
          <span className="text-zinc-100 drop-shadow-lg">Neural</span>{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500 bg-clip-text text-transparent">
            Command
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed mb-10">
          The ultimate dopamine-optimized learning matrix. Track your syllabus, manage focus payloads, and predict your progression speed in real-time.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link 
            href="/login" 
            className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
          >
            <Activity size={18} /> Initialize System
          </Link>
          
          <div className="w-full sm:w-auto px-8 py-4 bg-zinc-900/50 hover:bg-zinc-800/50 text-zinc-300 ring-1 ring-white/10 rounded-2xl font-bold text-sm uppercase tracking-widest backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
            <Shield size={18} /> Secure Server
          </div>
        </div>

        {/* Features Micro-Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 md:mt-32 w-full max-w-4xl text-left">
          
          <div className="bg-zinc-900/30 backdrop-blur-xl ring-1 ring-white/5 rounded-3xl p-6 hover:ring-white/10 transition-colors">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-indigo-500/20 text-indigo-400">
              <BrainCircuit size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Chrono-Predictor</h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">AI-driven math calculates exactly how many days remain based on your custom brain speed and daily focus hours.</p>
          </div>

          <div className="bg-zinc-900/30 backdrop-blur-xl ring-1 ring-white/5 rounded-3xl p-6 hover:ring-white/10 transition-colors">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-emerald-500/20 text-emerald-400">
              <Zap size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Dopamine Engine</h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">Lock in progress to instantly update your global syllabus matrix, earn Focus XP, and secure your daily streak.</p>
          </div>

          <div className="bg-zinc-900/30 backdrop-blur-xl ring-1 ring-white/5 rounded-3xl p-6 hover:ring-white/10 transition-colors">
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-rose-500/20 text-rose-400">
              <Target size={20} />
            </div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Matrix Vault</h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">100% synchronized database. Your exact timeline, completed modules, and study assets are secured in the cloud.</p>
          </div>

        </div>
      </div>
      
    </div>
  );
}