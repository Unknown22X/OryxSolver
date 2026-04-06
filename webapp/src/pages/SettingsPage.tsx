import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Bug,
  ChevronRight,
  Eye,
  EyeOff,
  
  Keyboard,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  Star,
  Sun,
  User as UserIcon,
  Globe,
} from 'lucide-react';
import { MascotIcon } from '../components/MascotIcon';

import AppLayout from '../components/AppLayout';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import { usePublicAppConfig } from '../hooks/usePublicAppConfig';
import { useUsage } from '../hooks/useUsage';
import { fetchEdge } from '../lib/edge';
import { deleteHistory } from '../lib/historyApi';
import { submitBugReport, submitFeedback } from '../lib/feedbackApi';
import { supabase } from '../lib/supabase';
import { toPublicErrorMessage } from '../lib/supabaseAuth';

export default function SettingsPage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = usePublicAppConfig();
  const { usage } = useUsage(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    marketing: false,
  });
  const [privacy, setPrivacy] = useState({
    saveHistory: true,
    analyticsEnabled: false,
  });
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [bugSubject, setBugSubject] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [submittingBugReport, setSubmittingBugReport] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = localStorage.getItem('oryx_theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setTheme(stored);
        }
        const storedNotificationEmail = localStorage.getItem('oryx_notification_email');
        const storedNotificationMarketing = localStorage.getItem('oryx_notification_marketing');
        setPrivacy({
          saveHistory: localStorage.getItem('oryx_save_history') !== 'false',
          analyticsEnabled: localStorage.getItem('oryx_analytics') !== 'false',
        });
        setNotifications({
          email: storedNotificationEmail !== 'false',
          marketing: storedNotificationMarketing === 'true',
        });

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (profile) {
          setDisplayName(profile.display_name || '');
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, [user]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('oryx_theme', newTheme);
    document.documentElement.classList.toggle(
      'dark',
      newTheme === 'dark' ||
        (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
        })
        .eq('auth_user_id', user.id);
      if (profileError) throw profileError;

      localStorage.setItem('oryx_save_history', String(privacy.saveHistory));
      localStorage.setItem('oryx_analytics', String(privacy.analyticsEnabled));
      localStorage.setItem('oryx_notification_email', String(notifications.email));
      localStorage.setItem('oryx_notification_marketing', String(notifications.marketing));
      
      // Update preferred language in metadata and profile table
      const currentLang = localStorage.getItem('oryx_language') || 'en';
      await supabase.auth.updateUser({
        data: { preferred_language: currentLang }
      });
      await supabase.from('profiles').update({ preferred_language: currentLang }).eq('auth_user_id', user.id);

      window.dispatchEvent(new Event('oryx-profile-updated'));

      setMessage({ type: 'success', text: t('settings.settings_saved') });
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: toPublicErrorMessage(err, t('settings.error_save')) });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleDeleteAccount = async () => {
    setMessage(null);

    const confirmed = confirm(
      t('settings.confirm_delete_account'),
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      await fetchEdge<{ ok: true; deleted: true }>('/delete-account', { method: 'POST' });
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setMessage({
        type: 'error',
        text: toPublicErrorMessage(
          err,
          `Failed to delete account. If this keeps happening, contact ${config.support.email}.`,
        ),
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handlePasswordChange = async () => {
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: t('settings.password_min_length') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('settings.passwords_no_match') });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: t('settings.password_updated') });
    } catch (err) {
      console.error('Error updating password:', err);
      setMessage({ type: 'error', text: toPublicErrorMessage(err, t('settings.error_update_password')) });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm(t('settings.confirm_clear_history'))) return;

    try {
      await deleteHistory({ all: true });
      setMessage({ type: 'success', text: t('settings.history_cleared') });
    } catch (err) {
      console.error('Error clearing history:', err);
      setMessage({ type: 'error', text: t('settings.error_clear_history') });
    }
  };

  const openSupport = (target: 'tutorials' | 'support' | 'bug' | 'faq') => {
    if (target === 'tutorials') {
      navigate('/how-it-works');
      return;
    }
    if (target === 'faq') {
      navigate('/faq');
      return;
    }
    if (target === 'support') {
      window.location.href = `mailto:${config.support.email}?subject=OryxSolver%20Support`;
      return;
    }
    navigate('/settings#bug-report-form');
  };

  const handleSubmitFeedback = async () => {
    setSubmittingFeedback(true);
    setMessage(null);

    try {
      await submitFeedback({
        userId: user.id,
        rating: feedbackRating,
        comment: feedbackComment,
        metadata: {
          source: 'settings_page',
          app: 'webapp',
          kind: 'general',
        },
      });
      setFeedbackComment('');
      setFeedbackRating(5);
      setMessage({ type: 'success', text: t('settings.feedback_sent') });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setMessage({ type: 'error', text: toPublicErrorMessage(err, t('settings.feedback_error')) });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSubmitBugReport = async () => {
    setSubmittingBugReport(true);
    setMessage(null);

    try {
      await submitBugReport({
        userId: user.id,
        subject: bugSubject,
        description: bugDescription,
        metadata: {
          source: 'settings_page',
          app: 'webapp',
          path: `${window.location.pathname}${window.location.hash}`,
          userAgent: navigator.userAgent,
        },
      });
      setBugSubject('');
      setBugDescription('');
      setMessage({ type: 'success', text: t('settings.bug_sent') });
    } catch (err) {
      console.error('Error submitting bug report:', err);
      setMessage({ type: 'error', text: toPublicErrorMessage(err, t('settings.bug_report_error')) });
    } finally {
      setSubmittingBugReport(false);
    }
  };

  if (loading) {
    return (
      <AppLayout currentPage="settings" user={user}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="settings" user={user}>
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-5 lg:px-6 lg:py-5" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-8">
          <h1 className="mb-2 text-[28px] font-black">{t('settings.title')}</h1>
          <p className="text-sm font-bold text-slate-500">{t('settings.subtitle')}</p>
        </div>

        {message && (
          <div
            aria-live="polite"
            className={`mb-6 rounded-xl p-4 ${
              message.type === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 space-y-6">
          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <UserIcon size={20} className="text-indigo-500" />
              </div>
              <h2 className="text-xl font-black">{t('settings.profile')}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="display-name" className="mb-2 block text-sm font-bold">{t('settings.display_name')}</label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 font-bold"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder={t('settings.display_name')}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">{t('settings.email')}</label>
                <div className="flex items-center gap-2 rounded-xl border px-4 py-3 opacity-60" style={{ borderColor: 'var(--border-color)' }}>
                  <Mail size={18} className="text-slate-500" />
                  <span className="font-bold">{user.email}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t('settings.email_locked')}</p>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
                <p className="mb-3 text-sm font-bold">{t('settings.change_password')}</p>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border bg-transparent px-4 py-3 pr-12 font-bold"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder={t('settings.new_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border bg-transparent px-4 py-3 pr-12 font-bold"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder={t('settings.confirm_password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    disabled={passwordSaving || !newPassword || !confirmPassword}
                    className="w-full rounded-xl py-3 font-black gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {passwordSaving ? t('settings.updating_password') : t('settings.update_password')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <Shield size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.subscription')}</h2>
                <p className="text-sm text-slate-500">{t('settings.subscription_desc')}</p>
              </div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-sm font-black">
                {t('settings.current_plan', { tier: usage?.subscriptionTier === 'premium' ? t('pricing.premium') : usage?.subscriptionTier === 'pro' ? t('pricing.pro') : t('pricing.free') })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('settings.monthly_questions', { 
                  used: usage?.monthlyQuestionsUsed ?? 0, 
                  limit: usage?.monthlyQuestionsLimit === -1 ? t('settings.unlimited') : (usage?.monthlyQuestionsLimit ?? 15) 
                })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('settings.paygo_credits', { count: usage?.paygoCreditsRemaining ?? 0 })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t('settings.paygo_notice')}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/subscription')}
                  className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                >
                  {t('settings.manage_subscription')}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.href = `mailto:${config.support.email}?subject=Subscription%20Help`}
                  className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {t('settings.contact_support')}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t('settings.billing_entry_desc')}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <Palette size={20} className="text-purple-500" />
              </div>
              <h2 className="text-xl font-black">{t('settings.appearance')}</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: t('settings.theme_light'), icon: Sun },
                { value: 'dark', label: t('settings.theme_dark'), icon: Moon },
                { value: 'system', label: t('settings.theme_system'), icon: Monitor },
              ].map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleThemeChange(option.value as 'light' | 'dark' | 'system')}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                      isActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={24} className={isActive ? 'text-indigo-500' : 'text-slate-500'} />
                    <span className="text-sm font-bold">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <Globe size={20} className="text-sky-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.language')}</h2>
                <p className="text-sm text-slate-500">{t('settings.language_desc')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <p className="font-bold">{t('settings.language_label')}</p>
                <p className="text-xs text-slate-500">{t('settings.language_desc')}</p>
              </div>
              <LanguageSwitcher />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <Bell size={20} className="text-orange-500" />
              </div>
              <h2 className="text-xl font-black">{t('settings.notifications')}</h2>
            </div>

            <div className="space-y-4">
              <ToggleRow
                title={t('settings.email_notifications')}
                description={t('settings.email_notifications_desc')}
                checked={notifications.email}
                onToggle={() => setNotifications((prev) => ({ ...prev, email: !prev.email }))}
                isRtl={isRtl}
              />
              <ToggleRow
                title={t('settings.marketing_emails')}
                description={t('settings.marketing_emails_desc')}
                checked={notifications.marketing}
                onToggle={() => setNotifications((prev) => ({ ...prev, marketing: !prev.marketing }))}
                isRtl={isRtl}
              />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Keyboard size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.keyboard_shortcuts')}</h2>
                <p className="text-sm text-slate-500">{t('settings.shortcuts_desc')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <ShortcutGroup
                title={t('settings.shortcuts_webapp')}
                items={[
                  { label: t('settings.shortcut_send_message'), keys: ['Enter'] },
                  { label: t('settings.shortcut_new_line'), keys: ['Shift', 'Enter'] },
                ]}
              />
              <ShortcutGroup
                title={t('settings.shortcuts_extension')}
                items={[
                  { label: t('settings.shortcut_toggle_history'), keys: ['Ctrl', 'Shift', 'H'] },
                  { label: t('settings.shortcut_copy_solution'), keys: ['Ctrl', 'C'] },
                  { label: t('settings.shortcut_new_question'), keys: ['Ctrl', 'N'] },
                ]}
              />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield size={20} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.privacy')}</h2>
                <p className="text-sm text-slate-500">{t('settings.privacy_desc')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <ToggleRow
                title={t('settings.save_history')}
                description={t('settings.save_history_desc')}
                checked={privacy.saveHistory}
                onToggle={() => setPrivacy((prev) => ({ ...prev, saveHistory: !prev.saveHistory }))}
                isRtl={isRtl}
              />
              <ToggleRow
                title={t('settings.anonymous_analytics')}
                description={t('settings.anonymous_analytics_desc')}
                checked={privacy.analyticsEnabled}
                onToggle={() => setPrivacy((prev) => ({ ...prev, analyticsEnabled: !prev.analyticsEnabled }))}
                isRtl={isRtl}
              />

              <button
                type="button"
                onClick={handleClearHistory}
                className="mt-2 w-full rounded-xl border border-red-500/20 bg-red-500/5 py-3 font-bold text-red-500 transition-colors hover:bg-red-500/10"
              >
                {t('settings.clear_history')}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <MascotIcon name="engineer" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.help_support')}</h2>
                <p className="text-sm text-slate-500">{t('settings.help_support_desc')}</p>
              </div>
            </div>


            <div className="space-y-3" id="help-support">
              <SupportButton label={t('settings.view_tutorials')} onClick={() => openSupport('tutorials')} />
              <SupportButton label={t('settings.open_faq')} onClick={() => openSupport('faq')} />
              <SupportButton label={t('settings.email_us', { email: config.support.email })} onClick={() => openSupport('support')} />
              <SupportButton label={t('settings.jump_to_bug')} onClick={() => openSupport('bug')} />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <MessageSquare size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.share_feedback')}</h2>
                <p className="text-sm text-slate-500">{t('settings.feedback_desc')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-3 block text-sm font-bold">{t('settings.rating')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFeedbackRating(value)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-bold transition-colors ${
                        feedbackRating === value
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                      style={feedbackRating === value ? undefined : { borderColor: 'var(--border-color)' }}
                    >
                      <Star size={16} className={feedbackRating >= value ? 'fill-current' : ''} />
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="feedback-comment" className="mb-2 block text-sm font-bold">{t('settings.comment')}</label>
                <textarea
                  id="feedback-comment"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder={t('settings.feedback_placeholder')}
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={submittingFeedback || feedbackComment.trim().length < 8}
                className="w-full rounded-xl py-3 font-black gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingFeedback ? t('settings.sending_feedback') : t('settings.send_feedback')}
              </button>
            </div>
          </section>

          <section
            id="bug-report-form"
            className="rounded-2xl border p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <Bug size={20} className="text-rose-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">{t('settings.report_bug')}</h2>
                <p className="text-sm text-slate-500">{t('settings.bug_desc')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="bug-subject" className="mb-2 block text-sm font-bold">{t('settings.bug_title')}</label>
                <input
                  id="bug-subject"
                  value={bugSubject}
                  onChange={(e) => setBugSubject(e.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder={t('settings.bug_summary_placeholder')}
                />
              </div>

              <div>
                <label htmlFor="bug-description" className="mb-2 block text-sm font-bold">{t('settings.bug_what_happened')}</label>
                <textarea
                  id="bug-description"
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  className="min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder={t('settings.bug_reproduce_placeholder')}
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitBugReport}
                disabled={submittingBugReport || bugSubject.trim().length < 4 || bugDescription.trim().length < 12}
                className="w-full rounded-xl py-3 font-black gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingBugReport ? t('settings.sending_bug') : t('settings.send_bug')}
              </button>
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl py-4 font-black gradient-btn"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={20} />}
          {t('settings.save')}
        </button>

        <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
              <LogOut size={20} className="text-slate-400" />
            </div>
            <h2 className="text-xl font-black">{t('settings.account_actions')}</h2>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            {t('settings.account_actions_desc')}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 rounded-xl border border-slate-700 px-6 py-3 font-bold text-slate-300 transition-colors hover:bg-white/5"
            >
              {t('settings.sign_out')}
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="flex-1 rounded-xl border border-red-500/40 px-6 py-3 font-bold text-red-400 transition-colors hover:bg-red-500/10"
            >
              {deletingAccount ? t('settings.deleting_account') : t('settings.delete_account')}
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onToggle,
  isRtl,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  isRtl: boolean;
}) {
  return (
    <div
      className="group flex items-center justify-between rounded-2xl border bg-white/50 p-5 transition-all hover:border-indigo-500/30 dark:bg-white/[0.02]"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div>
        <p className="font-black text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-sm font-medium text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative h-6 w-12 rounded-full transition-all ${checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
      >
        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`} />
      </button>
    </div>
  );
}

function ShortcutGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; keys: string[] }>;
}) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
      <p className="mb-3 text-sm font-black text-slate-800 dark:text-slate-200">{title}</p>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center justify-between border-b py-3 last:border-0"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
            <div className="flex items-center gap-1">
              {item.keys.map((key, keyIndex) => (
                <div key={`${item.label}-${key}`} className="flex items-center gap-1">
                  {keyIndex > 0 && <span className="text-xs text-slate-400 dark:text-slate-500">+</span>}
                  <kbd className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <span className="font-bold">{label}</span>
      <ChevronRight size={18} className="text-slate-500" />
    </button>
  );
}
