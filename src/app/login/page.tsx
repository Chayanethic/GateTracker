'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Shield, User, Zap, Mail, Key } from 'lucide-react';

export default function Gateway() {
  const router = useRouter();
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  
  // Admin State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // User OTP State
  const [userEmail, setUserEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.push('/dashboard');
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // 2. Redirect URL generator
  const getRedirectUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/dashboard`;
    }
    return '';
  };

  // --- NEW: CUSTOM OTP LOGIC ---
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // This talks directly to Supabase and catches any errors
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    });

    setIsLoading(false);

    if (error) {
      toast.error(`Error: ${error.message}`); // WE WILL FINALLY SEE THE ERROR!
      console.error("Supabase Error:", error);
    } else {
      toast.success('OTP Sent! Check your Gmail.');
      setOtpSent(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpCode,
      type: 'email',
    });

    setIsLoading(false);

    if (error) {
      toast.error(`Invalid OTP: ${error.message}`);
    } else {
      toast.success('Access Granted!');
      router.push('/dashboard');
    }
  };

  // 3. Admin Logic
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const envPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    if (adminEmail === envEmail && adminPassword === envPassword) {
      toast.success('Admin Override Accepted.');
      localStorage.setItem('isAdmin', 'true'); 
      router.push('/admin/dashboard');
    } else {
      toast.error('Access Denied. Incorrect Admin Credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Aesthetic */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-8 z-10 relative">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gray-800 rounded-xl mb-4 border border-gray-700">
            <Zap className="text-yellow-400" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
            GATE Command Center
          </h1>
          <p className="text-gray-400 text-sm mt-2">Identify yourself to proceed.</p>
        </div>

        {/* Toggle Switch */}
        <div className="flex p-1 bg-gray-950 rounded-lg mb-8 border border-gray-800">
          <button
            onClick={() => setLoginType('user')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${
              loginType === 'user' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User size={16} /> Candidate
          </button>
          <button
            onClick={() => setLoginType('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${
              loginType === 'admin' ? 'bg-red-900/30 text-red-400 border border-red-500/50 shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Shield size={16} /> Admin
          </button>
        </div>

        {/* --- CUSTOM USER LOGIN VIEW --- */}
        {loginType === 'user' && (
          <div className="animate-in fade-in zoom-in duration-300">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-gray-500" size={18} />
                    <input 
                      type="email" 
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg py-3 pl-10 pr-3 text-white outline-none focus:border-purple-500 transition-colors"
                      placeholder="student@example.com"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Requesting Access...' : 'Send Magic Link / OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Enter 6-Digit OTP</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3.5 text-gray-500" size={18} />
                    <input 
                      type="text" 
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg py-3 pl-10 pr-3 text-white outline-none focus:border-purple-500 transition-colors tracking-widest text-center text-lg"
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3 rounded-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enter'}
                </button>
                <button 
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-sm text-gray-500 hover:text-white transition-colors mt-2"
                >
                  Used wrong email? Go back.
                </button>
              </form>
            )}
          </div>
        )}

        {/* --- ADMIN LOGIN VIEW --- */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin} className="animate-in fade-in zoom-in duration-300 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Admin ID (Email)</label>
              <input 
                type="email" 
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white outline-none focus:border-red-500 transition-colors"
                placeholder="commander@system.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Master Password</label>
              <input 
                type="password" 
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white outline-none focus:border-red-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-3 rounded-lg hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all mt-4"
            >
              Initiate Override
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

