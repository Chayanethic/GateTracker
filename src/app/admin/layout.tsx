'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert, Database, Users, LayoutDashboard, LogOut, ArrowLeftRight, ClipboardCheck, BookOpen, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('gateTrackerTheme');
    const nextTheme = savedTheme === 'light' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('light-theme', nextTheme === 'light');
    document.documentElement.classList.toggle('dark-theme', nextTheme === 'dark');
    const savedSidebar = localStorage.getItem('gateTrackerAdminSidebarCollapsed');
    setSidebarCollapsed(savedSidebar === 'true');

    // Check if the secure admin override token exists
    const checkAdmin = localStorage.getItem('isAdmin');
    if (checkAdmin !== 'true') {
      router.replace('/login');
      return;
    }
    setIsAdmin(true);
    if (pathname === '/admin/stream') {
      setStreamReady(true);
      return;
    }
    if (!sessionStorage.getItem('adminStream')) {
      router.replace('/admin/stream');
      return;
    }
    setStreamReady(true);
  }, [router, pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('gateTrackerTheme', nextTheme);
    document.documentElement.classList.toggle('light-theme', nextTheme === 'light');
    document.documentElement.classList.toggle('dark-theme', nextTheme === 'dark');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      localStorage.setItem('gateTrackerAdminSidebarCollapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminStream');
    router.replace('/login');
  };

  if (!isAdmin || !streamReady) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500">
        <ShieldAlert className="animate-pulse mb-4" size={48} />
        <h2 className="text-xl font-bold">Admin Clearance Required</h2>
      </div>
    );
  }

  if (pathname === '/admin/stream') return <>{children}</>;

  // The Admin Sidebar Navigation
  return (
    <div className="min-h-screen bg-gray-950 flex text-white theme-transition">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-[78px]' : 'w-64'} bg-gray-900 border-r border-gray-800 p-4 flex flex-col transition-[width] duration-300 shrink-0`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2 text-red-500 font-bold text-xl mb-8`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={28} />
            {!sidebarCollapsed && 'OVERSEER'}
          </div>
          <button onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        
        <nav className="flex-1 space-y-4">
          <Link href="/admin/dashboard" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800`}>
            <LayoutDashboard size={20} /> {!sidebarCollapsed && 'Dashboard'}
          </Link>
          <Link href="/admin/resources" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800`}>
            <Database size={20} /> {!sidebarCollapsed && 'Manage Resources'}
          </Link>
          <Link href="/admin/test-series" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800`}>
            <ClipboardCheck size={20} /> {!sidebarCollapsed && 'Test Series'}
          </Link>
          <Link href="/admin/question-bank" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800`}>
            <BookOpen size={20} /> {!sidebarCollapsed && 'Question Bank'}
          </Link>
          <Link href="/admin/users" className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800`}>
            <Users size={20} /> {!sidebarCollapsed && 'Candidate Data'}
          </Link>
          <button
            onClick={() => router.push('/admin/stream')}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800 text-left`}
          >
            <ArrowLeftRight size={20} /> {!sidebarCollapsed && 'Switch Stream'}
          </button>
        </nav>

        <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-500 hover:text-amber-400 transition-colors p-2 mb-2 w-full`}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {!sidebarCollapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
        </button>

        <button onClick={handleLogout} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-500 hover:text-red-500 transition-colors p-2 mt-auto w-full`}>
          <LogOut size={20} /> {!sidebarCollapsed && 'Terminate Session'}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
