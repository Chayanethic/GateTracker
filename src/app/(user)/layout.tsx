'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, User, LogOut, Hexagon, Target, Activity, ClipboardCheck, ArrowLeftRight, Trophy } from 'lucide-react';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showGateDayAnimation, setShowGateDayAnimation] = useState(false);
  const [gateAnimationStage, setGateAnimationStage] = useState<'cut' | 'reveal'>('cut');
  const [gateDaysRemaining, setGateDaysRemaining] = useState(0);
  const [previousGateDays, setPreviousGateDays] = useState(0);

  useEffect(() => {
    const verifyUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      if (pathname !== '/branch-selection') {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('branch')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!profile?.branch) {
          router.replace('/branch-selection');
          return;
        }
        localStorage.setItem('gateTrackerBranch', profile.branch);
      }

      setIsAuthorized(true);

      // Show the full-screen GATE countdown animation only once per IST calendar day.
      const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istDateKey = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${String(istNow.getDate()).padStart(2, '0')}`;
      const examDate = new Date('2027-02-07T00:00:00');
      const todayStart = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
      const remaining = Math.max(0, Math.ceil((examDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)));
      const seenKey = 'gateTrackerGate2027DailyAnimation';
      const alreadyShown = localStorage.getItem(seenKey) === istDateKey;

      if (!alreadyShown) {
        localStorage.setItem(seenKey, istDateKey);
        setPreviousGateDays(remaining + 1);
        setGateDaysRemaining(remaining);
        setGateAnimationStage('cut');
        setShowGateDayAnimation(true);
        window.setTimeout(() => setGateAnimationStage('reveal'), 1250);
        window.setTimeout(() => setShowGateDayAnimation(false), 3550);
      }
    };
    verifyUser();
  }, [router, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col gap-4 items-center justify-center text-emerald-500 font-bold tracking-widest text-xs">
        <Activity size={32} className="animate-spin text-emerald-500"/>
        <span className="animate-pulse">Authenticating Secure Channel...</span>
      </div>
    );
  }

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Daily HUD', href: '/daily-goal', icon: Target },
    { name: 'Daily Tracker', href: '/daily-tracker', icon: ClipboardCheck },
    { name: 'Curriculum', href: '/resources', icon: BookOpen },
  ];

  return (
    <>
      <style jsx global>{`
        @keyframes gateCurtainIn { from { opacity: 0; transform: scale(1.06); } to { opacity: 1; transform: scale(1); } }
        @keyframes gateNumberCut { 0% { opacity: 0; transform: translateY(28px) scale(.8); } 35% { opacity: 1; transform: translateY(0) scale(1); } 70% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-30px) scale(1.12); } }
        @keyframes gateSlash { 0% { width: 0; opacity: 0; } 35% { width: 115%; opacity: 1; } 70% { width: 115%; opacity: 1; } 100% { width: 0; opacity: 0; } }
        @keyframes gateReveal { 0% { opacity: 0; transform: translateY(24px) scale(.92); } 45% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes gatePulse { 0%,100% { opacity: .35; transform: scale(.96); } 50% { opacity: .75; transform: scale(1.04); } }
      `}</style>

      {showGateDayAnimation && (
        <div className="fixed inset-0 z-[9999] bg-[#020202] flex items-center justify-center overflow-hidden" style={{ animation: 'gateCurtainIn .45s ease-out both' }} role="dialog" aria-label="GATE 2027 daily countdown">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_38%)]" />
          <div className="absolute w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full border border-emerald-500/10" style={{ animation: 'gatePulse 2.2s ease-in-out infinite' }} />
          <div className="relative z-10 text-center px-6">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.45em] text-emerald-400 mb-5">TARGET GATE • DAILY COUNTDOWN</p>
            {gateAnimationStage === 'cut' ? (
              <div className="relative inline-block" style={{ animation: 'gateNumberCut 1.2s ease-in-out both' }}>
                <div className="text-[92px] sm:text-[150px] md:text-[190px] leading-none font-black tracking-[-0.08em] text-zinc-200">{previousGateDays}</div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 bg-red-500 rounded-full rotate-[-9deg] shadow-[0_0_30px_rgba(239,68,68,.7)]" style={{ animation: 'gateSlash 1.2s ease-in-out both' }} />
                <div className="text-[9px] font-black uppercase tracking-[0.5em] text-red-400 mt-4">ONE DAY CUT</div>
              </div>
            ) : (
              <div style={{ animation: 'gateReveal .7s cubic-bezier(.2,.8,.2,1) both' }}>
                <div className="text-[92px] sm:text-[150px] md:text-[190px] leading-none font-black tracking-[-0.08em] text-emerald-400">{gateDaysRemaining}</div>
                <div className="text-xl sm:text-2xl font-black uppercase tracking-[0.25em] text-zinc-100 mt-3">Days Remaining</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-600 mt-5">GATE 2027 • 07 FEB 2027</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 overflow-hidden relative">
      
      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (lg and up) */}
      {/* ========================================================= */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-zinc-950/80 backdrop-blur-2xl border-r border-white/5 relative z-50 shadow-[5px_0_30px_rgba(0,0,0,0.5)]">
        
        {/* Brand Header */}
        <div className="p-7 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-[10px] bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300"></div>
            <Hexagon size={20} className="text-emerald-400 relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-zinc-100 tracking-tight leading-tight">Target Gate Platform</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Neural Engine</span>
          </div>
        </div>
        
        {/* Nav Links */}
        <nav className="flex-1 px-4 py-8 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-2">Main Menu</span>
          
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href));
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.name}
                href={link.href} 
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-300 text-xs group relative overflow-hidden ${
                  isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>}
                <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'} />
                {link.name}
              </Link>
            );
          })}

          <div className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-xs text-zinc-600 cursor-not-allowed bg-black/20 ring-1 ring-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-zinc-800/10 rounded-full blur-xl"></div>
            <User size={18} className="opacity-50" /> Analytics (Locked)
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/5 bg-white/[0.01] space-y-2">
          <button
            onClick={() => router.push('/branch-selection?change=1')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 ring-1 ring-transparent hover:ring-emerald-500/20"
          >
            <ArrowLeftRight size={16} /> Switch Branch
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-red-400 hover:bg-red-500/10 ring-1 ring-transparent hover:ring-red-500/20"
          >
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* GLOBAL LEADERBOARD SHORTCUT */}
      {/* ========================================================= */}
      <Link
        href="/leaderboard"
        className="hidden lg:flex fixed top-5 right-6 z-40 items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950/90 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.45)] transition-all"
      >
        <Trophy size={16} className="text-amber-400" />
        <span className="text-[10px] font-black uppercase tracking-widest">Leaderboard</span>
      </Link>

      {/* ========================================================= */}
      {/* MOBILE TOP HEADER (< lg) */}
      {/* ========================================================= */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center shadow-inner">
            <Hexagon size={16} className="text-emerald-400" />
          </div>
          <span className="text-sm font-black text-zinc-100 tracking-tight">Target Gate</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/leaderboard')} title="Leaderboard" className="p-2 text-zinc-500 hover:text-amber-400 bg-white/5 rounded-lg ring-1 ring-white/5 transition-colors">
            <Trophy size={16} />
          </button>
          <button onClick={() => router.push('/branch-selection?change=1')} title="Switch Branch" className="p-2 text-zinc-500 hover:text-emerald-400 bg-white/5 rounded-lg ring-1 ring-white/5 transition-colors">
            <ArrowLeftRight size={16} />
          </button>
          <button onClick={handleLogout} title="Disconnect" className="p-2 text-zinc-500 hover:text-red-400 bg-white/5 rounded-lg ring-1 ring-white/5 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================================= */}
      <main className="flex-1 overflow-y-auto relative w-full h-full pt-16 lg:pt-0 pb-24 lg:pb-0 custom-scrollbar scroll-smooth">
        {children}
      </main>

      {/* ========================================================= */}
      {/* FLOATING MOBILE BOTTOM NAVIGATION (< lg) */}
      {/* ========================================================= */}
      <div className="lg:hidden fixed bottom-5 left-4 right-4 z-50 pointer-events-none">
        <nav className="pointer-events-auto max-w-sm mx-auto bg-zinc-950/90 backdrop-blur-2xl ring-1 ring-white/10 p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-between gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href));
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.name}
                href={link.href} 
                className={`flex flex-col items-center justify-center gap-1 w-full py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-inner' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
              >
                {isActive && <div className="absolute top-0 w-8 h-1 bg-emerald-500 rounded-b-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                <Icon size={20} className={isActive ? 'text-emerald-400' : 'text-zinc-400'} />
                <span className={`text-[9px] font-bold tracking-widest uppercase ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      
      </div>
    </>
  );
}
