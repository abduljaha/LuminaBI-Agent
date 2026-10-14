import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sparkles, Database, LayoutDashboard, Terminal, ArrowUpRight, LogOut, 
  UserCheck, Settings, User as UserIcon, CheckCircle2, AlertCircle, X, KeyRound,
  LayoutGrid, GitFork 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { user, logout, updateProfile, updatePassword } = useAuth();

  // Profile & Password Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'details' | 'security'>('details');

  const [fullNameInput, setFullNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('Data Analyst');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordToast, setPasswordToast] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const navItems = [
    { name: 'Analysis', path: '/', icon: LayoutDashboard },
    { name: 'Executive Board', path: '/board', icon: LayoutGrid },
    { name: 'Data Modeling', path: '/modeling', icon: GitFork },
    { name: 'Data Sources', path: '/datasets', icon: Database },
  ];

  const openProfileModal = () => {
    if (!user) return;
    setFullNameInput(user.full_name || '');
    setRoleInput(user.role || 'Data Analyst');
    setProfileToast(null);
    setProfileError(null);
    setPasswordToast(null);
    setPasswordError(null);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileToast(null);
    try {
      await updateProfile(fullNameInput.trim(), roleInput.trim());
      setProfileToast('Profile details updated successfully!');
      setTimeout(() => setProfileToast(null), 4000);
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordToast(null);

    if (!currentPasswordInput) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword(currentPasswordInput, newPasswordInput);
      setPasswordToast('Password renamed & updated successfully!');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => setPasswordToast(null), 4000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Dynamic Animated Glass Ambient Background */}
      <div className="bg-mesh" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* Floating Glassmorphic Top Navigation Bar */}
      <header className="sticky top-4 z-40 px-4 sm:px-8 max-w-7xl mx-auto w-full pt-2">
        <div className="glass-panel rounded-2xl px-5 py-3 flex items-center justify-between border border-white/10 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-6 sm:gap-10">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-[0_0_20px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-all">
                <div className="w-full h-full bg-[#0a0f1d]/90 rounded-[11px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-cyan-200 to-indigo-300 bg-clip-text text-transparent">
                    LuminaBI
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    AI
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">Autonomous Data Intelligence</span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="flex items-center gap-1.5 sm:gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/15 shadow-[0_4px_16px_rgba(99,102,241,0.25)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action & Status */}
          <div className="flex items-center gap-3">
            {/* Live Agent Status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LangGraph Active</span>
            </div>

            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all group"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
              <span>API Docs</span>
              <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            {/* User Session Profile & Auth Control */}
            {user ? (
              <div className="flex items-center gap-2">
                {/* Clickable Profile Pill to open settings */}
                <button
                  onClick={openProfileModal}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 hover:border-indigo-500/40 text-xs transition-all cursor-pointer group shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  title="Click to edit account details & rename password"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-[10px] font-bold text-indigo-300 group-hover:scale-105 transition-transform">
                    {(user.full_name?.trim() ? user.full_name.trim().charAt(0) : user.email.charAt(0)).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-white font-medium max-w-[140px] truncate leading-tight">
                      {user.full_name?.trim() || user.email}
                    </span>
                    {user.full_name?.trim() && (
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                        {user.email}
                      </span>
                    )}
                  </div>
                  <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-300 ml-1 transition-colors" />
                </button>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 rounded-xl glass-panel hover:bg-rose-500/15 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Glass Content Container */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col">
        {children}
      </main>

      {/* Account Profile & Password Settings Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel rounded-3xl border border-white/15 p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  {(user.full_name?.trim() ? user.full_name.trim().charAt(0) : user.email.charAt(0)).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Account Profile Settings</span>
                  </h3>
                  <p className="text-xs text-slate-400">Update display name, role, and rename password</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <button
                onClick={() => setProfileTab('details')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  profileTab === 'details'
                    ? 'bg-indigo-600/25 text-white border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Profile Details</span>
              </button>
              <button
                onClick={() => setProfileTab('security')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  profileTab === 'security'
                    ? 'bg-indigo-600/25 text-white border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rename Password</span>
              </button>
            </div>

            {/* Tab 1: Profile Details Form */}
            {profileTab === 'details' && (
              <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in">
                {profileToast && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{profileToast}</span>
                  </div>
                )}
                {profileError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Full Name</label>
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="E.g. Adil Khan"
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400"
                  />
                  <span className="text-[11px] text-slate-400">Displayed in navigation pill and export reports.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Account Email</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-400 font-mono outline-none cursor-not-allowed"
                  />
                  <span className="text-[11px] text-slate-500">Primary authentication identifier.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Professional Role</label>
                  <input
                    type="text"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    placeholder="E.g. Senior Data Analyst / BI Engineer"
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] disabled:opacity-40 cursor-pointer"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Security & Rename Password Form */}
            {profileTab === 'security' && (
              <form onSubmit={handleSavePassword} className="space-y-4 animate-fade-in">
                {passwordToast && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{passwordToast}</span>
                  </div>
                )}
                {passwordError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Current Password</label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">New Password</label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new secure password (min 6 chars)"
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-40 cursor-pointer"
                  >
                    {isSavingPassword ? 'Renaming...' : 'Rename Password'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>LuminaBI • Autonomous AI Agent powered by LangGraph & FastAPI</span>
          <span className="text-slate-600">Enterprise Intelligence Engine v2.0</span>
        </div>
      </footer>

    </div>
  );
};

export default Layout;
