'use client';
import { Database, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-2">
        System Overview
      </h1>
      <p className="text-gray-400 mb-10">Select a module to manage the platform.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/resources" className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-red-500 transition-all group">
          <Database size={40} className="text-red-400 mb-4 group-hover:scale-110 transition-transform" />
          <h2 className="text-2xl font-bold mb-2">Resource Deployment</h2>
          <p className="text-gray-400 text-sm">Upload new YouTube links, PDFs, and playlists to the user dashboard.</p>
        </Link>

        <Link href="/admin/users" className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-blue-500 transition-all group">
          <Users size={40} className="text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
          <h2 className="text-2xl font-bold mb-2">Candidate Tracking</h2>
          <p className="text-gray-400 text-sm">Monitor user progression, XP gains, and active streaks.</p>
        </Link>
      </div>
    </div>
  );
}