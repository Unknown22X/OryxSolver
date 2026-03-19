import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import {
  Bell,
  Bug,
  ChevronRight,
  HelpCircle,
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
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { usePublicAppConfig } from '../hooks/usePublicAppConfig';
import { useUsage } from '../hooks/useUsage';
import { deleteHistory } from '../lib/historyApi';
import { submitBugReport, submitFeedback } from '../lib/feedbackApi';
import { supabase } from '../lib/supabase';

export default function SettingsPage({ user }: { user: User }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = usePublicAppConfig();
  const { usage } = useUsage(user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [displayName, setDisplayName] = useState('');
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
        setPrivacy({
          saveHistory: localStorage.getItem('oryx_save_history') !== 'false',
          analyticsEnabled: localStorage.getItem('oryx_analytics') !== 'false',
        });

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, notification_email, notification_marketing')
          .eq('auth_user_id', user.id)
          .single();

        if (profile) {
          setDisplayName(profile.display_name || '');
          setNotifications({
            email: profile.notification_email !== false,
            marketing: profile.notification_marketing === true,
          });
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
      await supabase.auth.updateUser({
        data: { display_name: displayName },
      });

      await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          notification_email: notifications.email,
          notification_marketing: notifications.marketing,
        })
        .eq('auth_user_id', user.id);

      localStorage.setItem('oryx_save_history', String(privacy.saveHistory));
      localStorage.setItem('oryx_analytics', String(privacy.analyticsEnabled));

      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings.' });
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
    setMessage({
      type: 'error',
      text: `Account deletion is not self-serve yet. Email ${config.support.email} if you need your data removed.`,
    });
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all saved question history? This cannot be undone.')) return;

    try {
      await deleteHistory({ all: true });
      setMessage({ type: 'success', text: 'Question history cleared.' });
    } catch (err) {
      console.error('Error clearing history:', err);
      setMessage({ type: 'error', text: 'Failed to clear question history.' });
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
      setMessage({ type: 'success', text: 'Feedback sent. Thank you.' });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send feedback.' });
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
      setMessage({ type: 'success', text: 'Bug report sent. We will review it.' });
    } catch (err) {
      console.error('Error submitting bug report:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send bug report.' });
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
      <div className="mx-auto max-w-2xl p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-black">Settings</h1>
          <p className="font-bold text-slate-500">Manage your account, support access, and feedback flow</p>
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
              <h2 className="text-xl font-black">Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="display-name" className="mb-2 block text-sm font-bold">Display Name</label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 font-bold"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">Email</label>
                <div className="flex items-center gap-2 rounded-xl border px-4 py-3 opacity-60" style={{ borderColor: 'var(--border-color)' }}>
                  <Mail size={18} className="text-slate-500" />
                  <span className="font-bold">{user.email}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Email cannot be changed here</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <Shield size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">Subscription</h2>
                <p className="text-sm text-slate-500">Plan details and billing entry point</p>
              </div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
              <p className="text-sm font-black">
                Current plan: {usage?.subscriptionTier === 'premium' ? 'Premium' : usage?.subscriptionTier === 'pro' ? 'Pro' : 'Free'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Monthly questions: {usage?.monthlyQuestionsUsed ?? 0} used of {usage?.monthlyQuestionsLimit === -1 ? 'unlimited' : usage?.monthlyQuestionsLimit ?? 15}.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Extra pay-as-you-go credits: {usage?.paygoCreditsRemaining ?? 0}.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/payments-coming-soon')}
                  className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                >
                  Manage subscription
                </button>
                <button
                  type="button"
                  onClick={() => window.location.href = `mailto:${config.support.email}?subject=Subscription%20Help`}
                  className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  Contact support
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Payments are not live yet in-app. This section is the future billing home and currently points to a holding page instead of a live checkout.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <Palette size={20} className="text-purple-500" />
              </div>
              <h2 className="text-xl font-black">Appearance</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <Bell size={20} className="text-orange-500" />
              </div>
              <h2 className="text-xl font-black">Notifications</h2>
            </div>

            <div className="space-y-4">
              <ToggleRow
                title="Email Notifications"
                description="Receive updates about your account"
                checked={notifications.email}
                onToggle={() => setNotifications((prev) => ({ ...prev, email: !prev.email }))}
              />
              <ToggleRow
                title="Marketing Emails"
                description="News, updates, and promotions"
                checked={notifications.marketing}
                onToggle={() => setNotifications((prev) => ({ ...prev, marketing: !prev.marketing }))}
              />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Keyboard size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">Keyboard Shortcuts</h2>
                <p className="text-sm text-slate-500">Only shortcuts that actually exist right now</p>
              </div>
            </div>

            <div className="space-y-4">
              <ShortcutGroup
                title="Web app chat"
                items={[
                  { label: 'Send message', keys: ['Enter'] },
                  { label: 'New line', keys: ['Shift', 'Enter'] },
                ]}
              />
              <ShortcutGroup
                title="Browser extension side panel"
                items={[
                  { label: 'Toggle history panel', keys: ['Ctrl', 'Shift', 'H'] },
                  { label: 'Copy latest solution', keys: ['Ctrl', 'C'] },
                  { label: 'Start a new question', keys: ['Ctrl', 'N'] },
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
                <h2 className="text-xl font-black">Privacy & Security</h2>
                <p className="text-sm text-slate-500">Manage your data and privacy settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <ToggleRow
                title="Save Question History"
                description="Keep a record of your past questions"
                checked={privacy.saveHistory}
                onToggle={() => setPrivacy((prev) => ({ ...prev, saveHistory: !prev.saveHistory }))}
              />
              <ToggleRow
                title="Anonymous Usage Analytics"
                description="Help improve OryxSolver with anonymous product data"
                checked={privacy.analyticsEnabled}
                onToggle={() => setPrivacy((prev) => ({ ...prev, analyticsEnabled: !prev.analyticsEnabled }))}
              />

              <button
                type="button"
                onClick={handleClearHistory}
                className="mt-2 w-full rounded-xl border border-red-500/20 bg-red-500/5 py-3 font-bold text-red-500 transition-colors hover:bg-red-500/10"
              >
                Clear All Question History
              </button>
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <HelpCircle size={20} className="text-sky-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">Help & Support</h2>
                <p className="text-sm text-slate-500">Support email, docs, and a real in-app bug report flow</p>
              </div>
            </div>

            <div className="space-y-3" id="help-support">
              <SupportButton label="View Tutorials" onClick={() => openSupport('tutorials')} />
              <SupportButton label="Open FAQ" onClick={() => openSupport('faq')} />
              <SupportButton label={`Email ${config.support.email}`} onClick={() => openSupport('support')} />
              <SupportButton label="Jump to Bug Report Form" onClick={() => openSupport('bug')} />
            </div>
          </section>

          <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <MessageSquare size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-black">Share Feedback</h2>
                <p className="text-sm text-slate-500">General product feedback. Wrong-answer feedback lives on the dashboard card.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-3 block text-sm font-bold">Rating</p>
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
                <label htmlFor="feedback-comment" className="mb-2 block text-sm font-bold">Comment</label>
                <textarea
                  id="feedback-comment"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder="Tell us what feels confusing, what you want next, or what should be improved."
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={submittingFeedback || feedbackComment.trim().length < 8}
                className="w-full rounded-xl py-3 font-black gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingFeedback ? 'Sending Feedback...' : 'Send Feedback'}
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
                <h2 className="text-xl font-black">Report a Bug</h2>
                <p className="text-sm text-slate-500">This submits to the internal feedback inbox instead of a placeholder mail link.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="bug-subject" className="mb-2 block text-sm font-bold">Bug title</label>
                <input
                  id="bug-subject"
                  value={bugSubject}
                  onChange={(e) => setBugSubject(e.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder="Short summary of the bug"
                />
              </div>

              <div>
                <label htmlFor="bug-description" className="mb-2 block text-sm font-bold">What happened?</label>
                <textarea
                  id="bug-description"
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  className="min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 font-medium"
                  style={{ borderColor: 'var(--border-color)' }}
                  placeholder="What did you expect, what actually happened, and how can we reproduce it?"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitBugReport}
                disabled={submittingBugReport || bugSubject.trim().length < 4 || bugDescription.trim().length < 12}
                className="w-full rounded-xl py-3 font-black gradient-btn disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingBugReport ? 'Sending Bug Report...' : 'Send Bug Report'}
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
          Save Settings
        </button>

        <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
              <LogOut size={20} className="text-slate-400" />
            </div>
            <h2 className="text-xl font-black">Account Actions</h2>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Manage your session. Account deletion is not yet self-serve.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 rounded-xl border border-slate-700 px-6 py-3 font-bold text-slate-300 transition-colors hover:bg-white/5"
            >
              Sign Out
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex-1 rounded-xl border border-red-500/40 px-6 py-3 font-bold text-red-400 transition-colors hover:bg-red-500/10"
            >
              Request Account Deletion
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
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
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
        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-7' : 'left-1'}`} />
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
