'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, User, LogOut, Hexagon } from 'lucide-react';

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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-sm font-medium tracking-widest uppercase">
        Authenticating Secure Channel...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col md:flex-row text-zinc-300 font-sans selection:bg-zinc-800">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-[#09090b] md:border-r border-zinc-800/80 flex flex-col z-50">
        
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800/80">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Hexagon size={18} className="text-indigo-400" />
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">Ozone Platform</span>
        </div>
        
        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all text-sm shrink-0 md:shrink ${
              pathname === '/dashboard' ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          
          <Link 
            href="/resources" 
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all text-sm shrink-0 md:shrink ${
              pathname?.startsWith('/resources') ? 'bg-zinc-800/80 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <BookOpen size={18} /> Curriculum Hub
          </Link>

          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm text-zinc-600 cursor-not-allowed shrink-0 md:shrink">
            <User size={18} /> Analytics (Locked)
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 hidden md:block">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={18} /> Disconnect
          </button>
        </div>
      </aside>

      {/* DYNAMIC PAGE CONTENT */}
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>
      
    </div>
  );
}