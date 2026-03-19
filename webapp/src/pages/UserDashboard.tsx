import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  Flame,
  HelpCircle,
  Loader2,
  Mail,
  MessageSquareWarning,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { submitAnswerFeedback } from '../lib/feedbackApi';
import { fetchHistoryList, type HistoryEntry } from '../lib/historyApi';
import { usePublicAppConfig } from '../hooks/usePublicAppConfig';
import { useProfile } from '../hooks/useProfile';
import { useUsage } from '../hooks/useUsage';

type AnswerFeedbackDraft = {
  status?: 'correct' | 'incorrect';
  comment: string;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
};

function monthLabel(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return date.toLocaleString('en-US', { month: 'short' });
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitialDraft(): AnswerFeedbackDraft {
  return {
    comment: '',
    submitting: false,
    submitted: false,
    error: null,
  };
}

export default function UserDashboard({ user }: { user: User }) {
  const navigate = useNavigate();
  const { usage, loading: usageLoading, error: usageError } = useUsage(user);
  const { profile, loading: profileLoading } = useProfile(user);
  const { config } = usePublicAppConfig();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, AnswerFeedbackDraft>>({});

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const data = await fetchHistoryList({ limit: 40 });
        if (!active) return;
        setHistory(data.entries);
        setHistoryError(null);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load history:', error);
        setHistoryError('Unable to load recent activity.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const dailyGoal = useMemo(() => {
    if (!usage) return 5;
    if (usage.monthlyQuestionsLimit === -1) return 5;
    return Math.max(1, Math.ceil(usage.monthlyQuestionsLimit / 30));
  }, [usage]);

  const historyByDay = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach((entry) => {
      const dayKey = new Date(entry.created_at).toISOString().split('T')[0];
      map[dayKey] = (map[dayKey] || 0) + 1;
    });
    return map;
  }, [history]);

  const currentStreak = useMemo(() => {
    const today = new Date();
    let streak = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const key = date.toISOString().split('T')[0];
      if (historyByDay[key]) {
        streak += 1;
      } else {
        if (offset === 0) continue;
        break;
      }
    }
    return streak;
  }, [historyByDay]);

  const todayQuestions = useMemo(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    return historyByDay[todayKey] ?? 0;
  }, [historyByDay]);

  const usageByMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((entry) => {
      const monthKey = new Date(entry.created_at).toISOString().slice(0, 7);
      counts[monthKey] = (counts[monthKey] || 0) + 1;
    });
    const result = [];
    for (let i = 4; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toISOString().slice(0, 7);
      const isCurrentMonth = i === 0;
      result.push({
        label: monthLabel(i),
        value: isCurrentMonth ? usage?.monthlyQuestionsUsed ?? counts[key] ?? 0 : counts[key] ?? 0,
      });
    }
    return result;
  }, [history, usage?.monthlyQuestionsUsed]);

  const answerFeedbackCandidates = useMemo(
    () => history.filter((entry) => Boolean(entry.answer?.trim())).slice(0, 3),
    [history],
  );

  if (usageLoading || profileLoading) {
    return (
      <AppLayout currentPage="dashboard" user={user}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  const usagePercent =
    usage && usage.monthlyQuestionsLimit > 0 && usage.monthlyQuestionsLimit !== -1
      ? Math.min((usage.monthlyQuestionsUsed / usage.monthlyQuestionsLimit) * 100, 100)
      : 0;

  const questionsRemaining =
    usage?.monthlyQuestionsLimit === -1
      ? 'Unlimited'
      : String(Math.max(usage?.monthlyQuestionsRemaining ?? 0, 0));
  const supportEmail = config.support.email;

  const updateFeedbackDraft = (entryId: string, updater: (draft: AnswerFeedbackDraft) => AnswerFeedbackDraft) => {
    setFeedbackDrafts((prev) => ({
      ...prev,
      [entryId]: updater(prev[entryId] ?? getInitialDraft()),
    }));
  };

  const handleCorrectAnswerFeedback = async (entry: HistoryEntry) => {
    const entryId = entry.id;
    updateFeedbackDraft(entryId, (draft) => ({
      ...draft,
      status: 'correct',
      submitting: true,
      submitted: false,
      error: null,
    }));

    try {
      await submitAnswerFeedback({
        userId: user.id,
        conversationId: entry.conversation_id ?? entry.id,
        wasCorrect: true,
        metadata: {
          app: 'webapp',
          source: 'dashboard',
          question: entry.question,
          route: '/dashboard',
        },
      });
      updateFeedbackDraft(entryId, (draft) => ({
        ...draft,
        submitting: false,
        submitted: true,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to submit answer feedback:', error);
      updateFeedbackDraft(entryId, (draft) => ({
        ...draft,
        submitting: false,
        submitted: false,
        error: error instanceof Error ? error.message : 'Failed to save feedback.',
      }));
    }
  };

  const handleIncorrectAnswerFeedback = async (entry: HistoryEntry) => {
    const entryId = entry.id;
    const draft = feedbackDrafts[entryId] ?? getInitialDraft();
    const details = draft.comment.trim();

    if (details.length < 8) {
      updateFeedbackDraft(entryId, (current) => ({
        ...current,
        status: 'incorrect',
        error: 'Add a short note so we know what was wrong.',
      }));
      return;
    }

    updateFeedbackDraft(entryId, (current) => ({
      ...current,
      status: 'incorrect',
      submitting: true,
      submitted: false,
      error: null,
    }));

    try {
      await submitAnswerFeedback({
        userId: user.id,
        conversationId: entry.conversation_id ?? entry.id,
        wasCorrect: false,
        comment: details,
        metadata: {
          app: 'webapp',
          source: 'dashboard',
          question: entry.question,
          route: '/dashboard',
        },
      });
      updateFeedbackDraft(entryId, () => ({
        comment: '',
        status: 'incorrect',
        submitting: false,
        submitted: true,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to submit answer feedback:', error);
      updateFeedbackDraft(entryId, (current) => ({
        ...current,
        submitting: false,
        submitted: false,
        error: error instanceof Error ? error.message : 'Failed to save feedback.',
      }));
    }
  };

  const contactSupport = () => {
    window.location.href = `mailto:${supportEmail}?subject=OryxSolver%20Support%20Request`;
  };

  return (
    <AppLayout currentPage="dashboard" user={user}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 lg:p-10">
        <section className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#09111d]/82 lg:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: 'var(--marketing-glow)' }} />
          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Account overview</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white lg:text-5xl">
                  Welcome back, {profile?.displayName ?? user.email}
                </h1>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Check your plan, keep your study streak moving, and jump back into the solver without digging through settings.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/chat')}
                    className="gradient-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm shadow-lg shadow-sky-500/15 transition hover:scale-[1.01]"
                  >
                    Open solver
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link
                    to="/history"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    View history
                    <BookOpen className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/payments-coming-soon"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    Billing status
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[26rem] lg:grid-cols-1">
                <div className="rounded-[26px] border border-slate-200/80 bg-white/88 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Current plan</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-black text-slate-950 dark:text-white">
                        {usage?.subscriptionTier === 'premium' ? 'Premium' : usage?.subscriptionTier ?? 'Free'}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{usage?.subscriptionStatus}</p>
                    </div>
                    <Sparkles className="h-7 w-7 text-sky-600 dark:text-teal-300" />
                  </div>
                </div>

                <div className="rounded-[26px] border border-slate-200/80 bg-white/88 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">This month</p>
                  <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{usage?.monthlyQuestionsUsed ?? 0}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Top-level questions used</p>
                </div>

                <div className="rounded-[26px] border border-slate-200/80 bg-white/88 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Extra credits</p>
                  <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{usage?.paygoCreditsRemaining ?? 0}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Separate from plan questions</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
              <div className="rounded-[30px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Usage model</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Plan questions stay predictable</h2>
                  </div>
                  <TrendingUp className="h-7 w-7 text-sky-600 dark:text-teal-300" />
                </div>

                <div className="mt-5 h-3 rounded-full bg-slate-200 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${usagePercent}%`, backgroundImage: 'var(--brand-gradient)' }} />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {usage?.monthlyQuestionsUsed ?? 0} top-level questions used this month. {questionsRemaining} remaining in your plan allowance.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    ['Questions', 'Top-level solves count against your monthly plan.'],
                    ['Follow-ups', 'Follow-ups stay in the same thread instead of creating a new chat.'],
                    ['Credits', `Extra credits available: ${usage?.paygoCreditsRemaining ?? 0}`],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="text-sm font-black text-slate-950 dark:text-white">{title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[30px] border border-amber-200/80 bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50 p-5 text-amber-950 shadow-[0_24px_60px_-40px_rgba(245,158,11,0.65)] dark:border-white/10 dark:from-amber-600/70 dark:to-orange-500/70 dark:text-white dark:shadow-xl">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700 dark:text-white/80">Current streak</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Flame className="h-7 w-7 text-amber-500 dark:text-white" />
                    <div className="text-3xl font-black">{currentStreak} days</div>
                  </div>
                  <p className="mt-2 text-sm text-amber-800 dark:text-white/80">Solve something today to keep the streak alive.</p>
                </div>

                <div className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Daily goal</p>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-4xl font-black text-slate-950 dark:text-white">{todayQuestions}</span>
                        <span className="pb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">/ {dailyGoal}</span>
                      </div>
                    </div>
                    <Target className="h-7 w-7 text-sky-600 dark:text-teal-300" />
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-slate-950 dark:bg-white"
                      style={{ width: `${Math.min((todayQuestions / dailyGoal) * 100, 100)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/chat')}
                    className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    {todayQuestions >= dailyGoal ? 'Open solver' : `Solve ${Math.max(0, dailyGoal - todayQuestions)} more`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Usage statistics</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Questions per month</h2>
                </div>
                <Link to="/history" className="text-sm font-bold text-sky-700 hover:text-teal-700 dark:text-teal-300 dark:hover:text-teal-200">
                  View all
                </Link>
              </div>
              <div className="mt-6 flex items-end gap-3">
                {usageByMonth.map((item) => (
                  <div key={item.label} className="flex-1">
                    <div className="flex h-36 items-end rounded-[22px] bg-slate-100 p-2 dark:bg-white/5">
                      <div
                        className="w-full rounded-[18px]"
                        style={{
                          height: `${Math.max(14, item.value * 10)}px`,
                          backgroundImage: 'var(--brand-gradient)',
                        }}
                      />
                    </div>
                    <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between text-sm font-semibold text-slate-500 dark:text-slate-400">
                <span>{history.length} recent solves</span>
                <span>{usage?.monthlyQuestionsUsed ?? 0} this month</span>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recent activity</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Latest solves</h2>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Latest
                </span>
              </div>
              {historyLoading ? (
                <div className="mt-4 space-y-3">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-900/80 animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No recent solves yet. Start a solve to populate activity.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => navigate(`/chat?conversationId=${entry.conversation_id ?? entry.id}`)}
                      className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-white/88 px-4 py-4 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                    >
                      <div className="text-left">
                        <p className="font-semibold text-slate-900 dark:text-white">{entry.question}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.created_at)}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Answer quality</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Did the answer hold up?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Optional feedback on the latest solved answers so you can mark when the solver got it right.
                  </p>
                </div>
                <MessageSquareWarning className="h-5 w-5 text-sky-600 dark:text-teal-300" />
              </div>

              {historyLoading ? (
                <div className="mt-4 space-y-3">
                  {[0, 1].map((item) => (
                    <div key={item} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-900/80 animate-pulse" />
                  ))}
                </div>
              ) : answerFeedbackCandidates.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No solved answers yet. Once you use the solver, the latest answers will show up here for optional review.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {answerFeedbackCandidates.map((entry) => {
                    const draft = feedbackDrafts[entry.id] ?? getInitialDraft();
                    return (
                      <div key={entry.id} className="rounded-[24px] border border-slate-200/80 bg-white/88 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <button
                          type="button"
                          onClick={() => navigate(`/chat?conversationId=${entry.conversation_id ?? entry.id}`)}
                          className="text-left"
                        >
                          <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{entry.question}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Open the conversation for the full answer</p>
                        </button>

                        {draft.submitted ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            Feedback saved
                          </div>
                        ) : (
                          <>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCorrectAnswerFeedback(entry)}
                                disabled={draft.submitting}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                              >
                                Correct answer
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateFeedbackDraft(entry.id, (current) => ({
                                    ...current,
                                    status: 'incorrect',
                                    error: null,
                                  }))
                                }
                                disabled={draft.submitting}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                              >
                                Needs work
                              </button>
                            </div>

                            {draft.status === 'incorrect' && (
                              <div className="mt-3 space-y-3">
                                <textarea
                                  value={draft.comment}
                                  onChange={(event) =>
                                    updateFeedbackDraft(entry.id, (current) => ({
                                      ...current,
                                      comment: event.target.value,
                                      error: null,
                                    }))
                                  }
                                  placeholder="What was wrong or missing?"
                                  className="min-h-24 w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm font-medium outline-none transition focus:border-sky-400 dark:border-white/10"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleIncorrectAnswerFeedback(entry)}
                                  disabled={draft.submitting}
                                  className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                                >
                                  {draft.submitting ? 'Sending...' : 'Send answer feedback'}
                                </button>
                              </div>
                            )}

                            {draft.error && (
                              <p className="mt-3 text-xs font-bold text-rose-500">{draft.error}</p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04] text-slate-950 dark:text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Help & support
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Need help?</h2>
                </div>
                <HelpCircle className="h-6 w-6 text-sky-600 dark:text-teal-300" />
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Reach support directly, open the FAQ, or file a bug report that lands in the admin feedback inbox.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={contactSupport}
                  className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {supportEmail}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/settings#bug-report')}
                  className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Report a bug
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/faq')}
                  className="flex w-full items-center justify-between rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Open FAQ
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {(usageError || historyError) && (
          <div className="rounded-[28px] border border-amber-200/70 bg-amber-50/60 p-4 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <AlertCircle className="inline h-4 w-4" />
            <span className="ml-2">{usageError || historyError}</span>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
