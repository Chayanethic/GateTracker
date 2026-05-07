'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Shield, User, Zap, Mail, Key, Loader2, ArrowRight } from 'lucide-react';

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

  // --- CUSTOM OTP LOGIC ---
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: getRedirectUrl(),
      },
    });

    setIsLoading(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
      console.error("Supabase Error:", error);
    } else {
      toast.success('Secure Intel Sent! Check your Gmail.');
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
      toast.error(`Invalid Code: ${error.message}`);
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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Premium Background Aesthetic */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl p-8 z-10 relative">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gray-800/50 rounded-2xl mb-4 border border-gray-700/50 shadow-inner">
            <Zap className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-blue-600 tracking-tight">
            GATE Command Center
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-medium">Identify yourself to proceed.</p>
        </div>

        {/* Toggle Switch */}
        <div className="flex p-1 bg-gray-950/50 rounded-xl mb-8 border border-gray-800/80 shadow-inner">
          <button
            onClick={() => setLoginType('user')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
              loginType === 'user' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <User size={16} /> Candidate
          </button>
          <button
            onClick={() => setLoginType('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
              loginType === 'admin' ? 'bg-red-950/40 text-red-400 border border-red-500/30 shadow-md' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Shield size={16} /> Admin
          </button>
        </div>

        {/* --- CUSTOM USER LOGIN VIEW --- */}
        {loginType === 'user' && (
          <div className="animate-in fade-in zoom-in duration-300">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-purple-400 transition-colors" size={20} />
                    <input 
                      type="email" 
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
                      placeholder="candidate@example.com"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading || !userEmail}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>Request Access <ArrowRight size={18} /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                
                {/* Clear UX Instructions */}
                <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 text-center backdrop-blur-sm">
                  <p className="text-purple-300 text-sm font-bold mb-1">Check Your Inbox</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    We sent a link to <span className="text-white font-medium">{userEmail}</span>.<br/> 
                    Click the Magic Link inside, <strong>OR</strong> type the code below.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5 ml-1">Enter 6-Digit OTP</label>
                  <div className="relative group">
                    <Key className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-green-400 transition-colors" size={20} />
                    <input 
                      type="text" 
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all tracking-[0.5em] text-center text-xl font-bold shadow-inner"
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Verify & Enter'
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-xs font-medium text-gray-500 hover:text-white transition-colors py-2"
                >
                  Used the wrong email? Go back
                </button>
              </form>
            )}
          </div>
        )}

        {/* --- ADMIN LOGIN VIEW --- */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin} className="animate-in fade-in zoom-in duration-300 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5 ml-1">Admin ID</label>
              <input 
                type="email" 
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-3.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner"
                placeholder="commander@system.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1.5 ml-1">Master Password</label>
              <input 
                type="password" 
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-gray-950/50 border border-gray-700/50 rounded-xl p-3.5 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-[0.98] mt-2"
            >
              Initiate Override
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
