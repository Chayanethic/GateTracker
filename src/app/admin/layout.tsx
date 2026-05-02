'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Database, Users, LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if the secure admin override token exists
    const checkAdmin = localStorage.getItem('isAdmin');
    if (checkAdmin === 'true') {
      setIsAdmin(true);
    } else {
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    router.replace('/login');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-red-500">
        <ShieldAlert className="animate-pulse mb-4" size={48} />
        <h2 className="text-xl font-bold">Admin Clearance Required</h2>
      </div>
    );
  }

  // The Admin Sidebar Navigation
  return (
    <div className="min-h-screen bg-gray-950 flex text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col">
        <div className="flex items-center gap-2 text-red-500 font-bold text-xl mb-10">
          <ShieldAlert size={28} /> OVERSEER
        </div>
        
        <nav className="flex-1 space-y-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link href="/admin/resources" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800">
            <Database size={20} /> Manage Resources
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800">
            <Users size={20} /> Candidate Data
          </Link>
        </nav>

        <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors p-2 mt-auto">
          <LogOut size={20} /> Terminate Session
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}