'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Database,
  Users,
  LayoutDashboard,
  LogOut,
  ArrowLeftRight,
  ClipboardCheck,
  BookOpen,
  FileJson,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('gateTrackerTheme');
    const nextTheme = savedTheme === 'light' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('light-theme', nextTheme === 'light');
    document.documentElement.classList.toggle('dark-theme', nextTheme === 'dark');
    const savedSidebar = localStorage.getItem('gateTrackerAdminSidebarCollapsed');
    setSidebarCollapsed(savedSidebar === 'true');

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const adminNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/psc-exam', label: 'JSON Upload Exam', icon: FileJson, highlight: true },
    { href: '/admin/test-series', label: 'Test Series', icon: ClipboardCheck },
    { href: '/admin/question-bank', label: 'Question Bank', icon: BookOpen },
    { href: '/admin/resources', label: 'Manage Resources', icon: Database },
    { href: '/admin/users', label: 'Candidate Data', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col lg:flex-row text-white theme-transition">
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 h-15 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open admin sidebar"
            className="p-2 rounded-lg bg-gray-800 text-gray-200 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5 text-red-500 font-black text-base">
            <ShieldAlert size={20} />
            <span>OVERSEER</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/psc-exam"
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center gap-1"
          >
            <FileJson size={14} /> JSON Exam
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-amber-400"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
            <div className="flex items-center justify-between text-red-500 font-bold text-lg mb-6">
              <div className="flex items-center gap-2">
                <ShieldAlert size={24} />
                <span>OVERSEER</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-xl text-sm transition-colors ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push('/admin/stream');
                }}
                className="w-full flex items-center gap-3 text-gray-300 hover:text-white p-3 rounded-xl hover:bg-gray-800 text-sm text-left"
              >
                <ArrowLeftRight size={18} /> Switch Stream
              </button>
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 text-red-400 hover:text-red-300 p-3 mt-4 rounded-xl bg-red-500/10 w-full text-sm font-bold"
            >
              <LogOut size={18} /> Terminate Session
            </button>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex ${sidebarCollapsed ? 'w-[78px]' : 'w-64'} bg-gray-900 border-r border-gray-800 p-4 flex-col transition-[width] duration-300 shrink-0`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2 text-red-500 font-bold text-xl mb-8`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={28} />
            {!sidebarCollapsed && 'OVERSEER'}
          </div>
          <button onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        
        <nav className="flex-1 space-y-3">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} ${
                  active
                    ? item.highlight
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-bold'
                      : 'text-white bg-gray-800 font-bold'
                    : 'text-gray-400 hover:text-white'
                } transition-colors p-2.5 rounded-lg hover:bg-gray-800`}
              >
                <Icon size={20} className={active && item.highlight ? 'text-emerald-400' : ''} />
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
          <button
            onClick={() => router.push('/admin/stream')}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-gray-400 hover:text-white transition-colors p-2.5 rounded-lg hover:bg-gray-800 text-left`}
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
      <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
