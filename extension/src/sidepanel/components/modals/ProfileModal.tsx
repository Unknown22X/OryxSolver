import { X, User, Shield, ChevronRight, Key, LogOut, Trash2 } from 'lucide-react';
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
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  saveHistory: boolean;
  onToggleSaveHistory: (val: boolean) => void;
  useAnalytics: boolean;
  onToggleAnalytics: (val: boolean) => void;
  autoCopy: boolean;
  onToggleAutoCopy: (val: boolean) => void;
  onClearHistory: () => void;
  onDeleteAccount: () => void;
  profileMessage: string | null;
  isBusy: boolean;
  tier: 'pro' | 'free';
  settingsPanel: 'menu' | 'profile' | 'settings' | 'password';
  onSetSettingsPanel: (panel: 'menu' | 'profile' | 'settings' | 'password') => void;
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
  isDarkMode,
  onToggleDarkMode,
  saveHistory,
  onToggleSaveHistory,
  useAnalytics,
  onToggleAnalytics,
  autoCopy,
  onToggleAutoCopy,
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
              {settingsPanel === 'menu' ? 'Account' : settingsPanel === 'profile' ? 'Edit Profile' : settingsPanel === 'password' ? 'Security' : 'Preferences'}
            </h2>
          </div>
          <button onClick={onClose} className="oryx-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {profileMessage && (
            <div className="mb-6 rounded-2xl bg-indigo-50 p-4 text-xs font-bold text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300 animate-in slide-in-from-top-2">
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
                <button onClick={() => onSetSettingsPanel('settings')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-emerald-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Preferences</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button onClick={() => onSetSettingsPanel('password')} className="oryx-menu-item">
                  <div className="flex items-center gap-3">
                    <Key size={18} className="text-amber-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Security</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              </div>

              <button
                onClick={onSignOut}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-sm font-bold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/20"
              >
                <LogOut size={18} />
                Sign Out
              </button>

              <div className="mt-8 rounded-2xl bg-indigo-50 px-5 py-4 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20">
                <p className="oryx-caption text-indigo-500 mb-1">Current Plan</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{tier === 'pro' ? 'Oryx Pro' : 'Free Tier'}</p>
                  <a href="https://oryxsolver.shop/pricing" target="_blank" className="text-[11px] font-black text-indigo-600 hover:underline">Manage</a>
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

          {/* ─── Settings View ─── */}
          {settingsPanel === 'settings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Dark Mode</p>
                  <p className="oryx-caption">Toggle dark/light theme</p>
                </div>
                <button
                  onClick={onToggleDarkMode}
                  className={`oryx-toggle ${isDarkMode ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                >
                  <span className={`oryx-toggle__knob ${isDarkMode ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Save History</p>
                  <p className="oryx-caption">Keep past solves on this device</p>
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
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Auto-copy Answer</p>
                  <p className="oryx-caption">Copy main answer to clipboard</p>
                </div>
                <button
                  onClick={() => onToggleAutoCopy(!autoCopy)}
                  className={`oryx-toggle ${autoCopy ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                >
                  <span className={`oryx-toggle__knob ${autoCopy ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">Anonymous Usage</p>
                  <p className="oryx-caption">Help improve AI with usage data</p>
                </div>
                <button
                  onClick={() => onToggleAnalytics(!useAnalytics)}
                  className={`oryx-toggle ${useAnalytics ? 'oryx-toggle--on' : 'oryx-toggle--off'}`}
                >
                  <span className={`oryx-toggle__knob ${useAnalytics ? 'oryx-toggle__knob--on' : 'oryx-toggle__knob--off'}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={onClearHistory} className="oryx-btn-danger">
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
        </div>
      </div>
    </div>
  );
}
