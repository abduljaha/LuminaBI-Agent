import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!isLoginMode && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        await login(email.trim(), password);
        navigate('/');
      } else {
        await register(email.trim(), password);
        setSuccessMessage('Account created successfully! Redirecting...');
        setTimeout(() => navigate('/'), 1000);
      }
    } catch (err: any) {
      console.error('Auth error', err);
      const detail = err.response?.data?.detail;
      setErrorMessage(detail || (isLoginMode ? 'Invalid credentials.' : 'Registration failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('analyst@company.com');
    setPassword('password123');
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login('analyst@company.com', 'password123');
      navigate('/');
    } catch (err: any) {
      // If demo user wasn't registered yet, register automatically
      try {
        await register('analyst@company.com', 'password123');
        navigate('/');
      } catch (regErr: any) {
        setErrorMessage(regErr.response?.data?.detail || 'Demo login failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8 animate-fade-in">
      <div className="w-full max-w-md">
        
        {/* Glow Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-[0_0_30px_rgba(99,102,241,0.4)] mx-auto flex items-center justify-center">
            <div className="w-full h-full bg-[#0a0f1d]/90 rounded-[15px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {isLoginMode ? 'Welcome Back' : 'Create an Account'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {isLoginMode 
                ? 'Sign in to access your data analysis workspaces & agents' 
                : 'Get started with autonomous multi-agent data intelligence'}
            </p>
          </div>
        </div>

        {/* Glass Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-6">
          
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setIsLoginMode(true); setErrorMessage(null); }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                isLoginMode
                  ? 'bg-indigo-600 text-white shadow-[0_4px_16px_rgba(99,102,241,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginMode(false); setErrorMessage(null); }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                !isLoginMode
                  ? 'bg-indigo-600 text-white shadow-[0_4px_16px_rgba(99,102,241,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@company.com"
                  required
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>{isSubmitting ? 'Authenticating...' : isLoginMode ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Button */}
          <div className="pt-2 border-t border-white/10 space-y-3">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Use Quick Demo Credentials (analyst@company.com)</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Auth;
