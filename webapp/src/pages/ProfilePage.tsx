import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { 
  Mail, Calendar, Zap, Target,
  Loader2, CreditCard, Sparkles, Crown
} from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { useProfile } from '../hooks/useProfile';
import type { User } from '@supabase/supabase-js';

export default function ProfilePage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { usage, loading: usageLoading } = useUsage(user);
  const { profile, loading: profileLoading } = useProfile(user);

  const getTierBadge = () => {
    const tier = usage?.subscriptionTier || 'free';
    if (tier === 'premium') {
      return { label: t('profile.tier_premium'), icon: <Crown size={14} />, class: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20' };
    }
    if (tier === 'pro') {
      return { label: t('profile.tier_pro'), icon: <Sparkles size={14} />, class: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    }
    return { label: t('profile.tier_free'), icon: <Zap size={14} />, class: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilReset = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffMs = nextMonth.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };

  if (usageLoading || profileLoading) {
    return (
      <AppLayout currentPage="profile" user={user}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  const tier = getTierBadge();
  const questionsRemaining =
    usage?.monthlyQuestionsLimit === -1
      ? -1
      : Math.max((usage?.monthlyQuestionsLimit || 0) - (usage?.monthlyQuestionsUsed || 0), 0);

  return (
    <AppLayout currentPage="profile" user={user}>
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-black tracking-tight">{t('profile.title')}</h1>
          <p className="text-sm font-bold text-slate-500">{t('profile.subtitle')}</p>
        </div>

        {/* Profile Card */}
        <div className="relative mb-6 overflow-hidden rounded-[28px] border bg-white/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8 dark:bg-white/[0.02]" style={{ borderColor: 'var(--border-color)' }}>
          <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32" />
          
          <div className="relative z-10 flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
              {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                <img 
                  src={user.user_metadata.avatar_url || user.user_metadata.picture} 
                  alt="Avatar" 
                  className="relative h-24 w-24 rounded-full border-4 border-white object-cover shadow-xl dark:border-slate-800 md:h-28 md:w-28"
                />
              ) : (
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-600 to-blue-600 text-4xl font-black text-white shadow-xl dark:border-slate-800 md:h-28 md:w-28">
                  {profile?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div className="flex-1 pt-1 text-center md:text-left">
              <div className="mb-4 flex flex-col items-center gap-3 md:flex-row">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {profile?.displayName || t('profile.scholar')}
                </h2>
                <div className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-sm ${tier.class}`}>
                  {tier.icon}
                  {tier.label}
                </div>
              </div>
              
              <div className="space-y-3 inline-block">
                <div className="flex items-center justify-center md:justify-start gap-3 text-slate-500 dark:text-slate-400 font-bold">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <span>{profile?.email}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-3 text-slate-500 dark:text-slate-400 font-bold opacity-70">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <span>{t('profile.researching_since', { date: formatDate(profile?.createdAt || new Date().toISOString()) })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-5 md:grid-cols-2">
          {/* Subscription Box */}
          <section className="rounded-[24px] border bg-white/50 p-6 backdrop-blur-sm dark:bg-white/[0.02]" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <CreditCard size={24} className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-black tracking-tight">{t('profile.plan_details')}</h3>
            </div>
            
            <div className="mb-6">
              <p className="mb-1 text-2xl font-black">
                {usage?.subscriptionTier === 'free' ? t('profile.free_access') : 
                 usage?.subscriptionTier === 'pro' ? t('profile.oryx_pro') : t('profile.oryx_premium')}
              </p>
              <p className="text-sm text-slate-500 font-bold">
                {usage?.subscriptionTier === 'free' ? t('profile.solves_per_month', { count: 15 }) : usage?.subscriptionTier === 'pro' ? t('profile.solves_per_month', { count: 100 }) : t('profile.solves_per_month', { count: 500 })}
              </p>
            </div>
            
            {usage?.subscriptionTier === 'free' && (
              <button
                type="button"
                onClick={() => navigate('/subscription')}
                className="w-full text-center px-6 py-4 rounded-2xl gradient-btn text-sm font-black shadow-lg shadow-indigo-500/20 block"
              >
                {t('profile.upgrade_account')}
              </button>
            )}
            {usage?.subscriptionTier !== 'free' && (
              <button
                onClick={() => {
                  navigate('/subscription');
                }}
                className="w-full text-center px-6 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-black hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                {t('profile.manage_billing')}
              </button>
            )}
          </section>

          {/* Usage Box */}
          <section className="rounded-[24px] border bg-white/50 p-6 backdrop-blur-sm dark:bg-white/[0.02]" style={{ borderColor: 'var(--border-color)' }}>
            <div className="mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Zap size={24} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black tracking-tight">{t('profile.active_usage')}</h3>
            </div>
            
            <div className="mb-5">
              <p className="mb-1 text-2xl font-black">
                {questionsRemaining === -1 ? (
                  <span>{t('profile.unlimited')}</span>
                ) : (
                  <>
                    {questionsRemaining}{' '}
                    <span className="text-slate-400 font-bold text-xl">{t('profile.remaining')}</span>
                  </>
                )}
              </p>
              <p className="text-sm text-slate-500 font-bold">{t('profile.resets_in', { count: getDaysUntilReset() })}</p>
            </div>
            
            <div className="space-y-3">
              <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800/50 overflow-hidden border border-slate-200/20 dark:border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${usage?.monthlyQuestionsLimit && usage.monthlyQuestionsLimit > 0 ? ((usage.monthlyQuestionsLimit - (usage.monthlyQuestionsUsed || 0)) / usage.monthlyQuestionsLimit) * 100 : 0}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                 <span>{t('profile.current_usage')}</span>
                 <span>{usage?.monthlyQuestionsUsed || 0} / {usage?.monthlyQuestionsLimit === -1 ? '∞' : usage?.monthlyQuestionsLimit}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Extended Stats */}
        <div className="rounded-[24px] border bg-white/50 p-6 backdrop-blur-sm dark:bg-white/[0.02]" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="mb-6 text-xl font-black tracking-tight">{t('profile.growth_insights')}</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="group rounded-[20px] border border-transparent bg-slate-50 p-5 text-center transition-all hover:border-slate-200 hover:bg-white hover:shadow-xl hover:shadow-black/5 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Target size={24} className="text-indigo-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{usage?.monthlyQuestionsUsed || 0}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('profile.total_answers')}</p>
            </div>
            
            <div className="group rounded-[20px] border border-transparent bg-slate-50 p-5 text-center transition-all hover:border-slate-200 hover:bg-white hover:shadow-xl hover:shadow-black/5 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/10">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Sparkles size={24} className="text-orange-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{usage?.paygoCreditsRemaining ?? 0}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('profile.extra_credits')}</p>
            </div>

            <div className="group rounded-[20px] border border-transparent bg-slate-50 p-5 text-center transition-all hover:border-slate-200 hover:bg-white hover:shadow-xl hover:shadow-black/5 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/10">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Zap size={24} className="text-green-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{questionsRemaining === -1 ? '∞' : questionsRemaining}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('profile.remaining')}</p>
            </div>

            <div className="group rounded-[20px] border border-transparent bg-slate-50 p-5 text-center transition-all hover:border-slate-200 hover:bg-white hover:shadow-xl hover:shadow-black/5 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/10">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Crown size={24} className="text-purple-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{t('profile.top')}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('profile.scholar_rank')}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
