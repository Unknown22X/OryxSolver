import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { User } from '@supabase/supabase-js';
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Loader2,
  Moon,
  ShieldCheck,
  Sun,
  Zap,
} from 'lucide-react';
import { MascotIcon } from '../components/MascotIcon';
import { supabase } from '../lib/supabase';
import { fetchEdge } from '../lib/edge';
import { trackEvent } from '../lib/analyticsClient';
import {
  getOnboardingPreferences,
  markOnboardingCompletedLocally,
  type OnboardingGoal,
  type OnboardingMode,
  type OnboardingTheme,
} from '../lib/onboarding';
import { toPublicErrorMessage } from '../lib/supabaseAuth';

const GOAL_OPTIONS: Array<{
  value: OnboardingGoal;
  icon: React.ReactNode;
}> = [
  {
    value: 'ace_exams',
    icon: <GraduationCap size={18} />,
  },
  {
    value: 'daily_homework',
    icon: <CheckCircle2 size={18} />,
  },
  {
    value: 'learn_faster',
    icon: <MascotIcon name="sparkle" size={18} />,
  },
  {
    value: 'bulk_revision',
    icon: <Layers3 size={18} />,
  },
];

const SUBJECT_OPTIONS = [
  'Math',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Programming',
  'Business',
  'History',
];

const MODE_OPTIONS: Array<{
  value: OnboardingMode;
}> = [
  { value: 'standard' },
  { value: 'exam' },
  { value: 'eli5' },
];

const THEME_OPTIONS: Array<{
  value: OnboardingTheme;
  icon: React.ReactNode;
}> = [
  { value: 'light', icon: <Sun size={16} /> },
  { value: 'dark', icon: <Moon size={16} /> },
  { value: 'system', icon: <Zap size={16} /> },
];

export default function OnboardingPage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoal>('daily_homework');
  const [subjects, setSubjects] = useState<string[]>(['Math', 'Physics']);
  const [mode, setMode] = useState<OnboardingMode>('standard');
  const [theme, setTheme] = useState<OnboardingTheme>('system');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = ((step + 1) / 4) * 100;
  const savedPreferences = useMemo(() => getOnboardingPreferences(user), [user]);
  const previewLine = useMemo(() => {
    const subjectText = subjects.slice(0, 2).map(s => t(`onboarding.subject_${s.toLowerCase()}`)).join(' + ') || t('onboarding.your_subjects');
    switch (mode) {
      case 'exam':
        return t('onboarding.preview_exam', { subject: subjectText });
      case 'eli5':
        return t('onboarding.preview_eli5', { subject: subjectText });
      default:
        return t('onboarding.preview_standard', { subject: subjectText });
    }
  }, [mode, subjects, t]);

  useEffect(() => {
    trackEvent('onboarding_started', { source: 'webapp' });
  }, []);

  useEffect(() => {
    setGoal(savedPreferences.goal);
    if (savedPreferences.subjects.length > 0) {
      setSubjects(savedPreferences.subjects.slice(0, 4));
    }
    setMode(savedPreferences.mode);
    setTheme(savedPreferences.theme);
  }, [savedPreferences]);

  const toggleSubject = (subject: string) => {
    setSubjects((current) => {
      if (current.includes(subject)) {
        return current.filter((item) => item !== subject);
      }
      if (current.length >= 4) return current;
      return [...current, subject];
    });
  };

  const handleTheme = (nextTheme: OnboardingTheme) => {
    setTheme(nextTheme);
    localStorage.setItem('oryx_theme', nextTheme);
    document.documentElement.classList.toggle(
      'dark',
      nextTheme === 'dark' ||
        (nextTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
  };

  const completeOnboarding = async () => {
    setSaving(true);
    setError(null);

    try {
      const metadata = {
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_goal: goal,
        onboarding_subjects: subjects,
        onboarding_mode: mode,
        onboarding_theme: theme,
      };

      const { error: authError } = await supabase.auth.updateUser({ data: metadata });
      if (authError) throw authError;

      markOnboardingCompletedLocally(user.id);
      localStorage.setItem('oryx_theme', theme);
      await fetchEdge<{ ok: true; profileSynced: boolean }>('/sync-profile', { method: 'POST' });

      trackEvent('onboarding_completed', {
        goal,
        subjects,
        mode,
        theme,
      });

      navigate('/chat?welcome=1', { replace: true });
    } catch (err) {
      setError(toPublicErrorMessage(err, t('onboarding.error_failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oryx-shell-bg min-h-screen overflow-auto px-4 py-6 text-slate-900 dark:text-white sm:px-6 lg:px-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white/90 p-6 shadow-2xl shadow-slate-200/60 dark:border-white/10 dark:bg-[#0d1017] dark:shadow-none sm:p-8 lg:p-10">
            <div className={`absolute -top-20 h-64 w-64 rounded-full bg-indigo-500/12 blur-[110px] ${isRtl ? '-left-20' : '-right-20'}`} />
            <div className={`absolute bottom-0 h-56 w-56 rounded-full bg-sky-400/10 blur-[100px] ${isRtl ? '-right-20' : '-left-20'}`} />

            <div className="relative">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.28em] text-indigo-500">{t('onboarding.title')}</p>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    {t('onboarding.heading')}
                  </h1>
                </div>
                <div className="flex h-16 w-16 items-center justify-center">
                  <img src="/app_icons/greeting.png" alt="Greeting" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <span>{t('onboarding.progress')}</span>
                  <span>{step + 1} / 4</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 text-xl font-black text-slate-950 dark:text-white">{t('onboarding.step_1_heading')}</h2>
                    <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {t('onboarding.step_1_sub')}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {GOAL_OPTIONS.map((item) => {
                      const active = goal === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setGoal(item.value)}
                          className={`rounded-[24px] border p-4 text-left transition-all ${
                            active
                              ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03]'
                          }`}
                        >
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                            {item.icon}
                          </div>
                          <p className="mb-1 text-base font-black text-slate-950 dark:text-white">{t(`onboarding.goal_${item.value}_title`)}</p>
                          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{t(`onboarding.goal_${item.value}_desc`)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 text-xl font-black text-slate-950 dark:text-white">{t('onboarding.step_2_heading')}</h2>
                    <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {t('onboarding.step_2_sub')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {SUBJECT_OPTIONS.map((subject) => {
                      const active = subjects.includes(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleSubject(subject)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                            active
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'
                          }`}
                        >
                          {t(`onboarding.subject_${subject.toLowerCase()}`)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {subjects.length} {t('onboarding.selected')}
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 text-xl font-black text-slate-950 dark:text-white">{t('onboarding.step_3_heading')}</h2>
                    <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {t('onboarding.step_3_sub')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {MODE_OPTIONS.map((item) => {
                      const active = mode === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setMode(item.value)}
                          className={`flex w-full items-start justify-between rounded-[24px] border p-4 text-left transition-all ${
                            active
                              ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10'
                              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03]'
                          }`}
                        >
                          <div>
                            <p className="mb-1 text-base font-black text-slate-950 dark:text-white">{t(`onboarding.mode_${item.value}_title`)}</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t(`onboarding.mode_${item.value}_desc`)}</p>
                          </div>
                          {active && <Check className="mt-1 text-indigo-500" size={18} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="mb-2 text-xl font-black text-slate-950 dark:text-white">{t('onboarding.step_4_heading')}</h2>
                    <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {t('onboarding.step_4_sub')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {THEME_OPTIONS.map((item) => {
                      const active = theme === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleTheme(item.value)}
                          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                            active
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'
                          }`}
                        >
                          {item.icon}
                          {t(`onboarding.theme_${item.value}`)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="mb-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck size={18} />
                      <p className="text-sm font-black">{t('onboarding.ready_to_start')}</p>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-emerald-800 dark:text-emerald-200">
                      {t('onboarding.ready_desc')}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(current - 1, 0))}
                  disabled={step === 0 || saving}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                >
                  {t('onboarding.back')}
                </button>
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.min(current + 1, 3))}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    {t('onboarding.continue')}
                    <ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={completeOnboarding}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {t('onboarding.finish')}
                  </button>
                )}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[36px] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#111521] sm:p-8">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.26em] text-indigo-300">{t('onboarding.live_preview')}</p>
              <h2 className="mb-3 text-2xl font-black leading-tight">{t('onboarding.preview_heading')}</h2>
              <p className="mb-6 text-sm font-medium leading-relaxed text-slate-300">{previewLine}</p>

              <div className="space-y-4">
                <div className="rounded-[24px] bg-white/8 p-4 backdrop-blur">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('onboarding.primary_goal')}</p>
                  <p className="text-base font-black">{t(`onboarding.goal_${goal}_title`)}</p>
                </div>
                <div className="rounded-[24px] bg-white/8 p-4 backdrop-blur">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('onboarding.subjects')}</p>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => (
                      <span key={subject} className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-100">
                        {t(`onboarding.subject_${subject.toLowerCase()}`)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[24px] bg-gradient-to-r from-indigo-500 to-sky-500 p-[1px]">
                  <div className="rounded-[23px] bg-slate-950 p-4 dark:bg-[#111521]">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('onboarding.default_mode')}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black">{t(`onboarding.mode_${mode}_title`)}</p>
                      <BookOpen size={18} className="text-indigo-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{t('onboarding.what_happens_next')}</p>
              <ul className="space-y-3 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                <li>{t('onboarding.next_1')}</li>
                <li>{t('onboarding.next_2')}</li>
                <li>{t('onboarding.next_3')}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
