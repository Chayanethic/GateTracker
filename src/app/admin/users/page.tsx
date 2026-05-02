'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Flame } from 'lucide-react';

export default function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      // Fetch all user profiles from Supabase, ordered by highest XP
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('xp', { ascending: false });

      if (!error && data) {
        setUsers(data);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">Candidate Progression</h2>

      {loading ? (
        <div className="text-gray-400">Loading database records...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 text-gray-400 border-b border-gray-800 text-sm">
              <tr>
                <th className="p-4 font-medium">User ID / Email</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium text-yellow-400">Total XP</th>
                <th className="p-4 font-medium text-orange-400">Active Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/20 transition-colors">
                  <td className="p-4 text-gray-300 font-mono text-sm">
                    {user.email || user.id.substring(0, 12) + '...'}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-white font-bold flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> {user.xp}
                  </td>
                  <td className="p-4 text-white font-bold">
                    <div className="flex items-center gap-2">
                      <Flame size={16} className="text-orange-500" /> {user.streak} Days
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}