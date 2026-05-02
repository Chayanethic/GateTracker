'use client';

import Link from 'next/link';
import { Shield, Zap, Target, Flame, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white selection:bg-purple-500/30 overflow-hidden relative">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Navigation Bar */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2">
          <Zap className="text-yellow-400" size={28} />
          <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
            GATE COMMAND
          </span>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/login" 
            className="px-6 py-2 rounded-lg font-semibold text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/login" 
            className="px-6 py-2 rounded-lg font-bold bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Start Farming XP
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-sm font-medium text-purple-400 mb-8">
          <Flame size={16} /> GATE ECE Gamified Tracker Live
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Don't just study for GATE. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-500 to-purple-600">
            Conquer it like a game.
          </span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Transform your 15-hour engineering mathematics lectures into bite-sized, gamified missions. 
          Build streaks, earn XP, and obliterate your target syllabus.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/login" 
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all flex items-center justify-center gap-2 group"
          >
            Initiate Basecamp 
            <ChevronRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </Link>
        </div>
      </main>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-800/50 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl">
            <Target className="text-blue-400 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-3">4-Day Timelines</h3>
            <p className="text-gray-400">Lock in your targets. Break massive subjects down into manageable daily blocks with automated routing.</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl">
            <Flame className="text-orange-400 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-3">Streak Multipliers</h3>
            <p className="text-gray-400">Consistency is everything. Maintain your daily study streak to multiply your XP gains and rank up faster.</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl">
            <Shield className="text-purple-400 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-3">Admin Overrides</h3>
            <p className="text-gray-400">A dedicated control room to dynamically push new YouTube playlists, PDFs, and resources directly to your dashboard.</p>
          </div>
        </div>
      </section>

    </div>
  );
}