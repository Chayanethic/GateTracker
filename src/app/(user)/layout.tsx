'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, User, LogOut, Hexagon, Target, Activity } from 'lucide-react';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const verifyUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setIsAuthorized(true);
      }
    };
    verifyUser();
  }, [router]);

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
    { name: 'Daily HUD', href: '/daily-goal', icon: Target },
    { name: 'Curriculum', href: '/resources', icon: BookOpen },
  ];

  return (
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
        <div className="p-5 border-t border-white/5 bg-white/[0.01]">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-red-400 hover:bg-red-500/10 ring-1 ring-transparent hover:ring-red-500/20"
          >
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </aside>

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
        <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-400 bg-white/5 rounded-lg ring-1 ring-white/5 transition-colors">
          <LogOut size={16} />
        </button>
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
  );
}