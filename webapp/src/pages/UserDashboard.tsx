import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Flame,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  Target,
  Zap,
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Download,
  Trophy,
  History as HistoryIcon,
  Shapes,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import AppLayout from '../components/AppLayout';
import { submitAnswerFeedback } from '../lib/feedbackApi';
import { fetchHistoryList, type HistoryEntry } from '../lib/historyApi';
import { useProfile } from '../hooks/useProfile';
import { useUsage } from '../hooks/useUsage';
import { useTranslation } from 'react-i18next';

type AnswerFeedbackDraft = {
  status?: 'correct' | 'incorrect';
  comment: string;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
};

function formatDate(dateValue: string, t: any, language: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return t('common.unknown_date');
  return date.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { usage, loading: usageLoading } = useUsage(user);
  const { profile, loading: profileLoading } = useProfile(user);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(() => {
    return localStorage.getItem('oryx_hide_upgrade_banner') !== 'true';
  });

  const hideBanner = () => {
    setShowUpgradeBanner(false);
    localStorage.setItem('oryx_hide_upgrade_banner', 'true');
  };
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, AnswerFeedbackDraft>>({});
  const [isPlanExplainerOpen, setIsPlanExplainerOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const data = await fetchHistoryList({ limit: 40 });
        if (!active) return;
        setHistory(data.entries);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load history:', error);
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);


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

  
  const usageByMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((entry) => {
      const monthKey = new Date(entry.created_at).toISOString().slice(0, 7);
      counts[monthKey] = (counts[monthKey] || 0) + 1;
    });
    
    const result = [];
    const now = new Date();
    for (let i = 4; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const isCurrentMonth = i === 0;
      
      const label = d.toLocaleDateString(i18n.language, { month: 'short' });
      
      result.push({
        label,
        count: isCurrentMonth ? (usage?.monthlyQuestionsUsed ?? counts[key] ?? 0) : (counts[key] ?? 0),
      });
    }
    return result;
  }, [history, usage]);

  const isAdmin = profile?.role === 'admin';
  const isPro = usage?.subscriptionTier !== 'free';
  const totalSolves = history.length;
  
  // Subject Detection Logic
  const getSubjectFromQuestion = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('derive') || q.includes('integral') || q.includes('calculus') || q.includes('math') || q.includes('equation') || q.includes('solve for x')) return t('dashboard.subject_math');
    if (q.includes('physics') || q.includes('force') || q.includes('energy') || q.includes('motion') || q.includes('velocity')) return t('dashboard.subject_physics');
    if (q.includes('history') || q.includes('war') || q.includes('revolution') || q.includes('century') || q.includes('king') || q.includes('president')) return t('dashboard.subject_history');
    if (q.includes('biology') || q.includes('cell') || q.includes('dna') || q.includes('species') || q.includes('science')) return t('dashboard.subject_biology');
    if (q.includes('code') || q.includes('python') || q.includes('javascript') || q.includes('function') || q.includes('programming')) return t('dashboard.subject_programming');
    return t('dashboard.subject_general');
  };

  const subjectStats = useMemo(() => {
    const subjects = history.map(h => getSubjectFromQuestion(h.question));
    const uniqueSubjects = new Set(subjects.filter(s => s !== 'General'));
    return {
      all: subjects,
      uniqueCount: uniqueSubjects.size,
    };
  }, [history]);

  // Achievement Logic
  const achievements = useMemo(() => {
    const nightOwl = history.some(h => {
      const hour = new Date(h.created_at).getHours();
      return hour >= 0 && hour <= 4;
    });

    return [
      { id: 'first_solve', name: t('dashboard.achv_first_solve_name'), description: t('dashboard.achv_first_solve_desc'), icon: Sparkles, unlocked: totalSolves >= 1 },
      { id: 'hot_streak', name: t('dashboard.achv_hot_streak_name'), description: t('dashboard.achv_hot_streak_desc'), icon: Flame, unlocked: currentStreak >= 3 },
      { id: 'learner', name: t('dashboard.achv_learner_name'), description: t('dashboard.achv_learner_desc'), icon: BookOpen, unlocked: totalSolves >= 10 },
      { id: 'night_owl', name: t('dashboard.achv_night_owl_name'), description: t('dashboard.achv_night_owl_desc'), icon: Zap, unlocked: nightOwl },
    ];
  }, [totalSolves, currentStreak, history, t]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  // Dynamic coaching copy
  const coachingSubtitle = useMemo(() => {
    if (totalSolves === 0) return t('dashboard.coaching_start');
    
    const todaySolved = history.filter(h => {
      const today = new Date().toDateString();
      return new Date(h.created_at).toDateString() === today;
    }).length;

    if (todaySolved >= 1) return t('dashboard.coaching_done_today', { count: todaySolved });
    if (currentStreak > 0) return t('dashboard.coaching_streak_alive', { count: currentStreak });
    return t('dashboard.coaching_momentum', { count: totalSolves });
  }, [totalSolves, history, currentStreak, t]);

  if (usageLoading || profileLoading) {
    return (
      <AppLayout currentPage="dashboard" user={user}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  const isOverLimit = usage && usage.monthlyQuestionsUsed > usage.monthlyQuestionsLimit;
  const usagePercent =
    usage && usage.monthlyQuestionsLimit > 0 && usage.monthlyQuestionsLimit !== -1
      ? Math.min((usage.monthlyQuestionsUsed / usage.monthlyQuestionsLimit) * 100, 100)
      : 0;


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
        error: t('dashboard.error_feedback_short'),
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

  const isRtl = i18n.language === 'ar';

  return (
    <AppLayout currentPage="dashboard" user={user}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 bg-slate-50 px-4 pt-4 pb-16 sm:px-6 lg:gap-10 lg:px-8 lg:pt-6 dark:bg-transparent" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Dominant Hero Section */}
        <header className="relative py-4 animate-in fade-in slide-in-from-top-4 duration-700 lg:py-6">
           <div className="absolute -left-24 -top-24 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
           <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-violet-500 mb-4 px-1">{t('dashboard.overview')}</p>
              <h1 className="mb-3 text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl xl:text-[3.25rem]">
                {t('dashboard.welcome_back')}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-500">
                  {profile?.displayName?.split(' ')[0] ?? t('nav.user')}
                </span>
              </h1>
              <p className="mb-6 max-w-2xl text-[15px] font-medium leading-relaxed text-slate-600 dark:text-slate-400 lg:text-base">
                {coachingSubtitle}
              </p>

              <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/chat')}
                  className="group relative w-full overflow-hidden rounded-[28px] bg-violet-600 p-[1px] shadow-2xl shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-95 sm:w-auto"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-400 via-indigo-500 to-violet-600 animate-gradient-x" />
                  <div className="relative flex items-center justify-center gap-3 rounded-[27px] bg-violet-600 px-8 py-4 text-white transition-colors group-hover:bg-transparent">
                    <Sparkles size={22} className="text-violet-200 group-hover:text-white" />
                    <span className="px-2 text-base font-black uppercase tracking-widest lg:text-lg">{t('dashboard.open_solver')}</span>
                    <ArrowRight size={22} className={`${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'} transition-transform`} />
                  </div>
                </button>
                
                 <div className="flex flex-wrap items-center gap-3 lg:max-w-[50%] lg:justify-end">
                   <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-2.5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">{t('dashboard.system_online')}</p>
                   </div>

                   {(usage?.subscriptionTier !== 'free' || usage?.monthlyQuestionsLimit !== 15) && (
                     <button
                       onClick={() => navigate('/subscription')}
                       className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:border-violet-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                     >
                       <CreditCard size={12} />
                       {t('dashboard.billing')}
                     </button>
                   )}

                   {isAdmin && (
                     <button
                       onClick={() => navigate('/admin')}
                       className="flex items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 transition-all hover:bg-indigo-500/20 dark:text-indigo-400"
                     >
                        <LayoutDashboard size={12} />
                        {t('dashboard.admin_console')}
                      </button>
                   )}
                 </div>
              </div>
           </div>
        </header>

        {/* Restore Usage Chart Section */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
           <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 dark:border-white/5 dark:bg-white/[0.03] sm:rounded-[36px] sm:p-6 lg:p-7">
              <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                       <TrendingUp size={22} className="text-violet-500" />
                    </div>
                    <div>
                       <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">{t('dashboard.solving_trends')}</h2>
                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">{t('dashboard.last_5_months')}</p>
                    </div>
                 </div>
                 <div className="text-left sm:text-right">
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                       {usageByMonth.reduce((acc, curr) => acc + curr.count, 0)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.total_lifetime_solves')}</p>
                 </div>
              </div>

              <div className="mt-4 h-[180px] w-full sm:h-[200px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <defs>
                          <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                             <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.18} />
                       <XAxis 
                          dataKey="label" 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                       />
                       <YAxis 
                          stroke="#64748b" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                       />
                       <Tooltip 
                          contentStyle={{ 
                             backgroundColor: '#ffffff', 
                             border: '1px solid rgba(148,163,184,0.25)', 
                             borderRadius: '16px', 
                             color: '#0f172a', 
                             fontSize: '12px',
                             fontWeight: 'bold',
                             boxShadow: '0 10px 30px rgba(15,23,42,0.12)'
                          }}
                          itemStyle={{ color: '#7c3aed' }}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#7c3aed" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#usageGradient)" 
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </section>

        {/* Harmonized Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            {/* Plan Allowance Card */}
            <div className={`p-6 rounded-[32px] border shadow-sm flex flex-col justify-between transition-all duration-500 ${
               isOverLimit 
                 ? 'bg-amber-500/10 border-amber-500/30' 
                 : 'dark:bg-[#111118] dark:border-white/5 bg-white border-slate-200 shadow-slate-200/50'
            }`}>
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">{t('dashboard.plan_allowance')}</p>
                 <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {usage?.monthlyQuestionsUsed ?? 0} <span className="text-xs font-bold text-slate-500 italic">/ {usage?.monthlyQuestionsLimit ?? 15}</span>
                    </p>
                    <Zap className={isOverLimit ? "text-amber-500" : "text-violet-500"} size={18} />
                 </div>
                 <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden mb-2">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ${isOverLimit ? 'bg-amber-500' : 'bg-violet-500'}`} 
                     style={{ width: `${usagePercent}%` }}
                   />
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                       <p className="text-[10px] font-bold text-slate-500 italic">{t('dashboard.used_this_month')}</p>
                       <p className={`text-[10px] font-black uppercase tracking-widest ${isOverLimit ? 'text-amber-600 dark:text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                         {isOverLimit ? t('dashboard.extra_credit_active') : t('dashboard.left', { count: usage?.monthlyQuestionsRemaining ?? 0 })}
                       </p>
                    </div>
                    <p className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tighter">
                       {t('dashboard.follow_ups_free')}
                    </p>
                    <div className="pb-6" />
                 </div>

                 {/* Plan Explainer Toggle */}
                 <button 
                   onClick={() => setIsPlanExplainerOpen(!isPlanExplainerOpen)}
                   className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
                 >
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{t('dashboard.how_does_this_work')}</span>
                    {isPlanExplainerOpen ? (
                      <ChevronUp size={12} className="text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-400 dark:text-slate-500" />
                    )}
                 </button>

                 {/* Collapsible Explainer Content */}
                 {isPlanExplainerOpen && (
                   <div className="mt-3 p-5 rounded-2xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 animate-in slide-in-from-top-2 duration-300 max-w-[480px]">
                      <div className="flex flex-col gap-4">
                         <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400 mt-1.5" />
                            <div>
                               <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('dashboard.allowance')}</p>
                               <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">{t('dashboard.allowance_desc')}</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5" />
                            <div>
                               <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('dashboard.follow_ups')}</p>
                               <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">{t('dashboard.follow_ups_desc')}</p>
                            </div>
                         </div>
                         <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5" />
                            <div>
                               <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('dashboard.extra_credits')}</p>
                               <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">{t('dashboard.extra_credits_desc')}</p>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}
               </div>
            </div>

            {/* Streak Card - Dynamic Styling */}
            <div className={`p-6 rounded-[32px] border shadow-sm flex flex-col justify-between transition-all duration-500 ${
              currentStreak >= 7 
                ? 'bg-violet-600/10 border-violet-500/30 dark:bg-violet-600/10 dark:border-violet-500/30' 
                : 'dark:bg-[#111118] dark:border-white/5 bg-white border-slate-200 shadow-slate-200/50'
            }`}>
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">{t('dashboard.study_streak')}</p>
                 <div className="flex items-center justify-between">
                    <div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{t('dashboard.days', { count: currentStreak })}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                          {currentStreak === 0 ? t('dashboard.start_your_streak') : t('dashboard.goal_days', { count: currentStreak + 1 })}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500/80 italic mt-1">
                           {currentStreak >= 7 ? t('dashboard.champion_status') : t('dashboard.more_days_to_streak', { count: 7 - currentStreak })}
                        </p>
                    </div>
                    <Flame className={currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-slate-700"} size={22} />
                 </div>
               </div>
            </div>

            {/* Daily Goal Card */}
            <div className="p-6 rounded-[32px] dark:bg-[#111118] dark:border-white/5 bg-white border-slate-200 shadow-slate-200/50 shadow-sm flex flex-col justify-between">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">{t('dashboard.daily_goal')}</p>
                 <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {Math.min(usageByMonth[4]?.count ?? 0, 1)} <span className="text-xs font-bold text-slate-500 italic">/ 1</span>
                    </p>
                    <Target className="text-indigo-500 border border-indigo-500/10 p-0.5 rounded-md" size={18} />
                 </div>
                 <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden mb-3">
                   <div 
                     className="h-full rounded-full bg-indigo-500 transition-all duration-1000" 
                     style={{ width: usageByMonth[4]?.count > 0 ? '100%' : '0%' }}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 italic">{usageByMonth[4]?.count > 0 ? t('dashboard.goal_met') : t('dashboard.goal_remaining')}</p>
                    <button 
                      onClick={() => navigate('/chat')}
                      className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                        usageByMonth[4]?.count > 0 ? 'text-slate-600 pointer-events-none' : 'text-indigo-400 hover:text-indigo-300'
                      }`}
                    >
                      {usageByMonth[4]?.count > 0 ? t('dashboard.complete') : t('dashboard.solve_now')}
                    </button>
                 </div>
               </div>
            </div>

            {/* Top-Up Credits Card */}
            <div className="p-6 rounded-[32px] dark:bg-[#111118] dark:border-white/5 bg-white border-slate-200 shadow-slate-200/50 shadow-sm flex flex-col justify-between">
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">{t('dashboard.top_up_credits')}</p>
                 <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {usage?.paygoCreditsRemaining ?? 0} <span className="text-xs font-bold text-slate-500 italic">{t('dashboard.credits')}</span>
                    </p>
                    <Sparkles className="text-emerald-500 border border-emerald-500/10 p-0.5 rounded-md" size={18} />
                 </div>
                 <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 italic">{t('dashboard.extra_backup')}</p>
                    <Link to="/subscription" className="text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:underline">
                      {t('dashboard.buy_more')}
                    </Link>
                 </div>
               </div>
            </div>
         </section>

        {/* Upsell Banner (Free Users Only) */}
        {!isPro && showUpgradeBanner && (
           <div className="relative mx-auto mb-8 w-full max-w-5xl group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 blur-xl opacity-50 transition-opacity group-hover:opacity-100" />
            <div className="relative p-6 rounded-[32px] bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-600 dark:to-indigo-600 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl shadow-violet-500/20">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">{t('dashboard.unlock_unlimited')}</h3>
                  <p className="text-sm font-bold text-white/80">{t('dashboard.upgrade_subtitle')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => navigate('/subscription')}
                  className="flex-1 sm:flex-none px-8 py-3 rounded-2xl bg-white text-violet-600 font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  {t('dashboard.upgrade_now')}
                </button>
                <button 
                  onClick={hideBanner}
                  className="p-3 rounded-2xl bg-black/20 text-white/60 hover:text-white hover:bg-black/30 transition-all font-bold text-xs"
                >
                  {t('dashboard.hide')}
                </button>
              </div>
            </div>
          </div>
        )}

         <div className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
           {[
             { label: t('dashboard.total_solves'), value: totalSolves, icon: HistoryIcon, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10 dark:bg-violet-400/10' },
             { label: t('dashboard.day_streak'), value: t('dashboard.days', { count: currentStreak }), icon: Flame, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-500/10 dark:bg-orange-400/10' },
             { label: t('dashboard.avg_per_day'), value: (totalSolves / 30).toFixed(1), icon: TrendingUp, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-400/10' },
             { label: t('dashboard.subjects'), value: subjectStats.uniqueCount, icon: Shapes, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-400/10' },
           ].map((stat, i) => (
             <div key={i} className="flex items-center gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 transition-all group hover:border-indigo-500/30 dark:border-white/5 dark:bg-[#111118] dark:hover:border-white/10">
                <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                   <stat.icon size={20} className={stat.color} />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
                   <p className="text-lg font-black text-slate-900 dark:text-white sm:text-xl">{stat.value}</p>
                </div>
             </div>
           ))}
        </div>

        {/* Recent Solves & Feedback Stack */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 mb-12">
           <div className="flex flex-col gap-4 px-2 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                 <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('dashboard.recent_solves')}</h2>
                 <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    {t('dashboard.problems', { count: totalSolves })}
                 </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                 <button
                    onClick={() => {
                      const csv = "Date,Question,Subject,Status\n" + history.map(h => `${new Date(h.created_at).toLocaleDateString()},"${h.question.replace(/"/g, '""')}",${getSubjectFromQuestion(h.question)},Solved`).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.setAttribute('hidden', '');
                      a.setAttribute('href', url);
                      a.setAttribute('download', 'oryx_solves.csv');
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-bold"
                 >
                    <Download size={14} /> {t('dashboard.export_csv')}
                 </button>
                 <Link to="/history" className="text-xs font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors">{t('dashboard.view_all')}</Link>
              </div>
           </div>

           {historyLoading ? (
             <div className="space-y-4">
                {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-[32px] bg-slate-200/70 animate-pulse dark:bg-white/5" />)}
             </div>
           ) : history.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 px-6 rounded-[40px] border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6">
                   <BookOpen size={24} className="text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.no_solves_yet')}</h3>
                <p className="text-slate-500 text-center max-w-sm font-medium mb-8">
                   {t('dashboard.no_solves_desc')}
                </p>
                <button
                  onClick={() => navigate('/chat')}
                  className="px-8 py-3 rounded-2xl bg-white text-black font-black text-sm hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {t('dashboard.start_first_solve')}
                </button>
             </div>
           ) : (
             <div className="space-y-4">
               {history.slice(0, 10).map((entry) => {
                 const draft = feedbackDrafts[entry.id] ?? getInitialDraft();
                 // Filter out obvious test data
                 const testBlacklist = ['fortnite', 'sick at school', 'what do i do', 'who r you', 'test question', 'asdf'];
                 const isTestData = testBlacklist.some(word => entry.question.toLowerCase().includes(word));
                 if (isTestData) return null;

                 return (
                    <div 
                      key={entry.id} 
                      className="group rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition-all hover:border-violet-500/20 dark:border-white/5 dark:bg-[#111118] sm:rounded-[30px] sm:p-5"
                    >
                     <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                           <div className="mb-2 flex flex-wrap items-center gap-3">
                               <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">{t('dashboard.solved_date', { date: formatDate(entry.created_at, t, i18n.language) })}</span>
                               <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/10" />
                               <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-slate-400">
                                  {getSubjectFromQuestion(entry.question)}
                               </span>
                            </div>
                           <h3 className="mb-2 line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-400 sm:text-lg">{entry.question}</h3>
                            <button 
                              onClick={() => navigate(`/chat?conversationId=${entry.conversation_id || entry.id}`)}
                              className="flex items-center gap-1 text-xs font-bold text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white"
                            >
                               {t('dashboard.view_full_answer')} <ArrowRight size={12} className={isRtl ? 'rotate-180' : ''} />
                            </button>
                         </div>

                        <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                           {draft.submitted ? (
                             <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full">
                                <CheckCircle2 size={14} /> {t('dashboard.feedback_saved')}
                             </div>
                           ) : (
                             <>
                               <button
                                 onClick={() => handleCorrectAnswerFeedback(entry)}
                                 className="flex items-center justify-center p-3 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all border border-slate-200 dark:border-white/5"
                               >
                                 <CheckCircle2 size={20} />
                               </button>
                               <button
                                 onClick={() => updateFeedbackDraft(entry.id, d => ({ ...d, status: 'incorrect', error: null }))}
                                 className="flex items-center justify-center p-3 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all border border-slate-200 dark:border-white/5"
                               >
                                 <MessageSquareWarning size={20} />
                               </button>
                             </>
                           )}
                        </div>
                     </div>

                     {draft.status === 'incorrect' && !draft.submitted && (
                       <div className="mt-6 animate-in rounded-2xl border border-slate-200 bg-slate-50 p-6 slide-in-from-top-2 duration-300 dark:border-white/5 dark:bg-black/40">
                          <textarea
                             value={draft.comment}
                             onChange={(e) => updateFeedbackDraft(entry.id, d => ({ ...d, comment: e.target.value }))}
                             placeholder={t('dashboard.feedback_placeholder')}
                             className="mb-4 h-24 w-full resize-none border-none bg-transparent p-0 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0 dark:text-slate-300 dark:placeholder:text-slate-600"
                          />
                           <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                             <p className="text-[10px] font-bold text-rose-400">{draft.error}</p>
                             <button
                               onClick={() => handleIncorrectAnswerFeedback(entry)}
                               disabled={draft.submitting}
                               className="px-6 py-2 rounded-xl bg-violet-600 text-white font-black text-xs hover:bg-violet-500 disabled:opacity-50"
                             >
                                {draft.submitting ? t('dashboard.sending') : t('dashboard.send_feedback')}
                             </button>
                          </div>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           )}
        </section>

        <section className="pb-24 mt-12">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Trophy className="text-amber-500" size={24} />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('dashboard.achievements')}</h2>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                 {t('dashboard.unlocked', { count: unlockedCount, total: achievements.length })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
             {achievements.map((achievement) => {
               const Icon = achievement.icon;
               return (
                  <div 
                    key={achievement.id}
                    className={`relative overflow-hidden rounded-[28px] border p-5 transition-all duration-500 group ${
                      achievement.unlocked 
                        ? 'border-amber-200 bg-white shadow-lg shadow-amber-500/5 dark:border-amber-500/20 dark:bg-[#111118]' 
                        : 'border-slate-200 bg-slate-100 grayscale opacity-60 hover:opacity-80 hover:grayscale-[0.5] dark:border-white/5 dark:bg-black/20'
                    }`}
                  >
                   {achievement.unlocked && (
                     <div className="absolute top-0 right-0 p-3">
                        <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                           <CheckCircle2 size={10} className="text-black" />
                        </div>
                     </div>
                   )}
                    <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-700 ${
                      achievement.unlocked ? 'rotate-0 bg-gradient-to-br from-amber-400 to-orange-500 text-black' : '-rotate-6 bg-white/70 text-slate-600 dark:bg-white/5'
                    } group-hover:scale-110 group-hover:rotate-0`}>
                       <Icon size={24} />
                    </div>
                    <h3 className={`mb-1 text-lg font-black ${achievement.unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-500'}`}>{achievement.name}</h3>
                   <p className="text-xs font-bold text-slate-500 leading-relaxed">{achievement.description}</p>
                   
                   {!achievement.unlocked && (
                     <div className="mt-4 flex items-center gap-2">
                         <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70 dark:bg-white/5">
                            <div className="h-full w-[15%] bg-slate-400 dark:bg-slate-700" />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase">{t('dashboard.locked')}</span>
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        </section>

      </div>
    </AppLayout>
  );
}
