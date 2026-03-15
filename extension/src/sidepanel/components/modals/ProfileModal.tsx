import { X, User, Shield, ChevronRight, Key, LogOut, Trash2, Sparkles, HelpCircle } from 'lucide-react';
import type { AuthUser } from '../../auth/supabaseAuthClient';

type ProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser | null;
  profileName: string;
  profilePhotoUrl: string;
  onSetProfileName: (val: string) => void;
  onSetProfilePhotoUrl: (val: string) => void;
  onSaveProfile: () => void;
  onSignOut: () => void;
  themeMode: 'light' | 'dark' | 'system';
  onSetThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  saveHistory: boolean;
  onToggleSaveHistory: (val: boolean) => void;
  useAnalytics: boolean;
  onToggleAnalytics: (val: boolean) => void;
  autoCopy: boolean;
  onToggleAutoCopy: (val: boolean) => void;
  totalCredits: number;
  usedCredits: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  webAppBaseUrl: string;
  onClearHistory: () => void;
  onDeleteAccount: () => void;
  profileMessage: string | null;
  isBusy: boolean;
  tier: 'pro' | 'free';
  settingsPanel: 'menu' | 'profile' | 'appearance' | 'history' | 'usage' | 'password' | 'support';
  onSetSettingsPanel: (panel: 'menu' | 'profile' | 'appearance' | 'history' | 'usage' | 'password' | 'support') => void;
  newPassword: string;
  confirmNewPassword: string;
  onSetNewPassword: (val: string) => void;
  onSetConfirmNewPassword: (val: string) => void;
  onChangePassword: () => void;
};

export default function ProfileModal({
  isOpen,
  onClose,
  authUser,
  profileName,
  profilePhotoUrl,
  onSetProfileName,
  onSetProfilePhotoUrl,
  onSaveProfile,
  onSignOut,
  themeMode,
  onSetThemeMode,
  saveHistory,
  onToggleSaveHistory,
  useAnalytics,
  onToggleAnalytics,
  autoCopy,
  onToggleAutoCopy,
  totalCredits,
  usedCredits,
  monthlyImagesUsed,
  monthlyImagesLimit,
  webAppBaseUrl,
  onClearHistory,
  onDeleteAccount,
  profileMessage,
  isBusy,
  tier,
  settingsPanel,
  onSetSettingsPanel,
  newPassword,
  confirmNewPassword,
  onSetNewPassword,
  onSetConfirmNewPassword,
  onChangePassword
}: ProfileModalProps) {
  if (!isOpen) return null;
  const openWeb = (path: string) => {
    if (!webAppBaseUrl) return;
    try {
      const url = path.startsWith('http') ? path : new URL(path, webAppBaseUrl).toString();
      window.open(url, '_blank');
    } catch {
      // ignore malformed URL
    }
  };
  const hasWebApp = !!webAppBaseUrl;
  const creditUsagePercent = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;
  const imageUsagePercent = monthlyImagesLimit > 0 ? (monthlyImagesUsed / monthlyImagesLimit) * 100 : 0;

  const PANEL_TITLES: Record<string, string> = {
    menu: 'Account',
    profile: 'Edit Profile',
    appearance: 'Appearance',
    history: 'History & Data',
    usage: 'Usage & Limits',
    password: 'Security',
    support: 'Help & Support'
  };

  return (
    <div className="oryx-modal-overlay">
      <div className="oryx-modal-backdrop" onClick={onClose} />
      
      <div className="oryx-modal-panel flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetSettingsPanel('menu')}
              className={`transition-all ${settingsPanel === 'menu' ? 'hidden' : 'block hover:scale-110'}`}
            >
              <ChevronRight className="rotate-180 text-slate-400" size={20} />
            </button>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {PANEL_TITLES[settingsPanel] || 'Settings'}
            </h2>
          </div>
          <button onClick={onClose} className="oryx-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {profileMessage && (
            <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300 animate-in slide-in-from-top-2">
              {profileMessage}
            </div>
          )}

          {/* ─── Menu View ─── */}
          {settingsPanel === 'menu' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-16 w-16 rounded-[24px] border-2 border-white bg-slate-100 shadow-md dark:border-slate-800 dark:bg-slate-800">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Avatar" className="h-full w-full rounded-[24px] object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-black text-slate-400">
                      {authUser?.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{profileName || 'New User'}</p>
                  <p className="text-xs font-bold text-slate-400">{authUser?.email}</p>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${authUser?.emailVerified ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {authUser?.emailVerified ? 'Email Verified' : 'Email Not Verified'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => onSetSettingsPanel('profile')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-indigo-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Edit Profile</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('appearance')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-amber-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Appearance</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('usage')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-emerald-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Usage & Limits</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('history')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Trash2 size={18} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">History & Data</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('password')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Key size={18} className="text-violet-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Security</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('support')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <HelpCircle size={18} className="text-sky-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Support</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              </div>

              <button
                onClick={onSignOut}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-4 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <LogOut size={18} />
                Sign Out
              </button>

              <div className="mt-8 rounded-2xl bg-indigo-50 px-5 py-4 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20">
                <p className="oryx-caption text-indigo-500 mb-1">Current Plan</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{tier === 'pro' ? 'Oryx Pro' : 'Free Tier'}</p>
                  <button
                    type="button"
                    onClick={() => openWeb('/pricing')}
                    disabled={!hasWebApp}
                    className="text-[11px] font-black text-indigo-600 hover:underline disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Profile View ─── */}
          {settingsPanel === 'profile' && (
            <div className="space-y-6">
              <div>
                <label className="oryx-label">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => onSetProfileName(e.target.value)}
                  placeholder="Your name"
                  className="oryx-input"
                />
              </div>
              <div>
                <label className="oryx-label">Avatar URL</label>
                <input
                  type="text"
                  value={profilePhotoUrl}
                  onChange={(e) => onSetProfilePhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="oryx-input"
                />
              </div>
              <button onClick={onSaveProfile} disabled={isBusy} className="oryx-btn-primary">
                {isBusy ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}

          {/* ─── Appearance View ─── */}
          {settingsPanel === 'appearance' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-3">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Theme</p>
                  <p className="oryx-caption">Light, dark, or system</p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100/70 p-1 dark:bg-slate-800/60">
                  {(['system', 'light', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSetThemeMode(mode)}
                      className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest transition ${themeMode === mode
                          ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-3">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Preferences</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">Auto-copy Answer</p>
                    <p className="oryx-caption">Copy the final answer automatically</p>
                  </div>
                  <button
                    onClick={() => onToggleAutoCopy(!autoCopy)}
                    className={`oryx-toggle ${autoCopy ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                  >
                    <span className={`oryx-toggle__knob ${autoCopy ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-3">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Keyboard Shortcuts</p>
                </div>
                <div className="space-y-2 text-[12px] font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <span>Toggle history panel</span>
                    <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black text-white">Ctrl + Shift + H</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <span>Copy solution</span>
                    <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black text-white">Ctrl + C</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <span>New question</span>
                    <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-black text-white">Ctrl + N</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Usage View ─── */}
          {settingsPanel === 'usage' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-4">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Current Usage</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                      <span>Credits</span>
                      <span>{Math.max(totalCredits - usedCredits, 0)} left</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${Math.min(creditUsagePercent, 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                      <span>Images</span>
                      <span>{monthlyImagesUsed}/{monthlyImagesLimit}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.min(imageUsagePercent, 100)}%` }} />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openWeb('/account/usage')}
                  disabled={!hasWebApp}
                  className="mt-6 w-full rounded-xl border border-slate-200 bg-white/70 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 transition hover:bg-white disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  View full usage on web
                </button>
              </div>
            </div>
          )}

          {/* ─── History View ─── */}
          {settingsPanel === 'history' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-3">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Data Preferences</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">Save Question History</p>
                      <p className="oryx-caption">Keep a local record of past solves</p>
                    </div>
                    <button
                      onClick={() => onToggleSaveHistory(!saveHistory)}
                      className={`oryx-toggle ${saveHistory ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                    >
                      <span className={`oryx-toggle__knob ${saveHistory ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">Anonymous Usage Analytics</p>
                      <p className="oryx-caption">Help improve OryxSolver</p>
                    </div>
                    <button
                      onClick={() => onToggleAnalytics(!useAnalytics)}
                      className={`oryx-toggle ${useAnalytics ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                    >
                      <span className={`oryx-toggle__knob ${useAnalytics ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                <p className="text-sm font-black text-red-600 dark:text-red-400 mb-2">Danger Zone</p>
                <button onClick={onClearHistory} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-[11px] font-black uppercase tracking-widest text-red-500 shadow-sm transition hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-900/20">
                  <Trash2 size={16} />
                  Clear Question History
                </button>
              </div>
            </div>
          )}

          {/* ─── Password View ─── */}
          {settingsPanel === 'password' && (
            <div className="space-y-6">
              <div>
                <label className="oryx-label">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => onSetNewPassword(e.target.value)}
                  className="oryx-input"
                />
              </div>
              <div>
                <label className="oryx-label">Confirm Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => onSetConfirmNewPassword(e.target.value)}
                  className="oryx-input"
                />
              </div>
              <button onClick={onChangePassword} className="oryx-btn-secondary">
                Update Password
              </button>

              <button
                type="button"
                onClick={() => openWeb('/account/security')}
                disabled={!hasWebApp}
                className="oryx-btn-ghost disabled:pointer-events-none disabled:opacity-50"
              >
                Manage security on web
              </button>

              <div className="pt-8 opacity-50">
                <button
                  onClick={onDeleteAccount}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700"
                >
                  Delete Account Permanently
                </button>
              </div>
            </div>
          )}

          {/* ─── Support View ─── */}
          {settingsPanel === 'support' && (
            <div className="space-y-4">
              <button
                onClick={() => openWeb('/tutorials')}
                disabled={!hasWebApp}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">View Tutorials</p>
                <p className="text-[10px] text-slate-400">Learn how to use OryxSolver effectively</p>
              </button>
              <button
                onClick={() => openWeb('/support')}
                disabled={!hasWebApp}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Contact Support</p>
                <p className="text-[10px] text-slate-400">Get help with your account or solutions</p>
              </button>
              <button
                onClick={() => openWeb('/support/bug-report')}
                disabled={!hasWebApp}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Report a Bug</p>
                <p className="text-[10px] text-slate-400">Tell us if something isn't working</p>
              </button>
              <button
                onClick={() => openWeb('/support/feedback')}
                disabled={!hasWebApp}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Share Feedback</p>
                <p className="text-[10px] text-slate-400">Help us improve with your suggestions</p>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
