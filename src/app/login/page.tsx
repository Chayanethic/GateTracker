'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Shield, User, Zap, Mail, Key, Loader2, ArrowRight, Fingerprint } from 'lucide-react';

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

  // --- GOOGLE OAUTH LOGIC ---
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (error) {
      toast.error(`Google Login Error: ${error.message}`);
      setIsLoading(false);
    }
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
    <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* --- ANIMATED BACKGROUND LAYER --- */}
      {/* Blueprint Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      {/* Slow Pulsing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-600/10 rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px] animate-[pulse_10s_ease-in-out_infinite_reverse] pointer-events-none"></div>

      {/* --- MAIN GLASS CARD --- */}
      <div className="w-full max-w-md bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.5)] p-8 z-10 relative overflow-hidden group">
        
        {/* Subtle hover sweep effect inside the card */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="inline-flex items-center justify-center p-4 bg-black/40 rounded-2xl mb-5 border border-white/10 shadow-inner group-hover:border-purple-500/30 transition-colors duration-500">
            <Zap className="text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse" size={32} />
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-gray-500 tracking-tight">
            GATE Command
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-medium tracking-wide">Secure Access Protocol</p>
        </div>

        {/* High-Tech Toggle Switch */}
        <div className="flex p-1 bg-black/40 rounded-xl mb-8 border border-white/5 shadow-inner relative z-10">
          <button
            onClick={() => { setLoginType('user'); setOtpSent(false); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
              loginType === 'user' 
                ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <User size={16} /> Candidate
          </button>
          <button
            onClick={() => setLoginType('admin')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${
              loginType === 'admin' 
                ? 'bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)] border border-red-500/20' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Shield size={16} /> Admin
          </button>
        </div>

        {/* --- CUSTOM USER LOGIN VIEW --- */}
        {loginType === 'user' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-500 relative z-10">
            {!otpSent ? (
              <>
                {/* GOOGLE LOGIN BUTTON */}
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-950 font-bold py-3.5 rounded-xl hover:bg-gray-100 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all active:scale-[0.98] mb-6"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>

                <div className="relative flex items-center py-2 mb-6">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-semibold uppercase tracking-widest">System Override</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Communication Channel</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-4 text-gray-500 group-focus-within:text-blue-400 transition-colors duration-300" size={20} />
                      <input 
                        type="email" 
                        required
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-600 outline-none focus:border-blue-500/50 focus:bg-black/60 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-inner backdrop-blur-sm"
                        placeholder="candidate@system.com"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={isLoading || !userEmail}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] group overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500"></div>
                    {isLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>Initiate Uplink <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
                
                {/* Advanced UX Instructions */}
                <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-5 text-center backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                  <Fingerprint className="mx-auto text-blue-400 mb-2 opacity-80" size={28} />
                  <p className="text-blue-300 text-sm font-bold mb-1">Identity Verification Required</p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Intel routed to <span className="text-white font-medium">{userEmail}</span>.<br/> 
                    Engage the Magic Link <strong>OR</strong> input the 6-digit cipher.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Access Cipher</label>
                  <div className="relative group">
                    <Key className="absolute left-4 top-4 text-gray-500 group-focus-within:text-green-400 transition-colors duration-300" size={20} />
                    <input 
                      type="text" 
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-green-500/50 focus:bg-black/60 focus:ring-1 focus:ring-green-500/50 transition-all tracking-[0.75em] text-center text-2xl font-black shadow-inner backdrop-blur-sm"
                      placeholder="••••••"
                      maxLength={6}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
                  className="w-full text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors py-2 uppercase tracking-wide"
                >
                  Abort & Change Target
                </button>
              </form>
            )}
          </div>
        )}

        {/* --- ADMIN LOGIN VIEW --- */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin} className="animate-in slide-in-from-left-4 fade-in duration-500 space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-red-400/80 mb-2 ml-1 uppercase tracking-wider">Commander ID</label>
              <input 
                type="email" 
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-red-950/10 border border-red-500/20 rounded-xl py-4 px-4 text-white outline-none focus:border-red-500 focus:bg-red-950/20 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner backdrop-blur-sm"
                placeholder="commander@system.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-red-400/80 mb-2 ml-1 uppercase tracking-wider">Clearance Code</label>
              <input 
                type="password" 
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-red-950/10 border border-red-500/20 rounded-xl py-4 px-4 text-white outline-none focus:border-red-500 focus:bg-red-950/20 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner backdrop-blur-sm"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-900 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all duration-300 active:scale-[0.98] mt-4 border border-red-500/50"
            >
              Authorize Override
            </button>
          </form>
        )}

      </div>
    </div>
  );
}