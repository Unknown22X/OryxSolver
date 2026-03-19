import AppLayout from '../components/AppLayout';
import { 
  Mail, Calendar, Zap, Target,
  Loader2, CreditCard, Sparkles, Crown
} from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { useProfile } from '../hooks/useProfile';
import type { User } from '@supabase/supabase-js';

export default function ProfilePage({ user }: { user: User }) {
  const { usage, loading: usageLoading } = useUsage(user);
  const { profile, loading: profileLoading } = useProfile(user);

  const getTierBadge = () => {
    const tier = usage?.subscriptionTier || 'free';
    if (tier === 'premium') {
      return { label: 'Premium', icon: <Crown size={14} />, class: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20' };
    }
    if (tier === 'pro') {
      return { label: 'Pro', icon: <Sparkles size={14} />, class: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    }
    return { label: 'Free', icon: <Zap size={14} />, class: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-black mb-2 tracking-tight">Your Profile</h1>
          <p className="text-slate-500 font-bold">Manage your academic identity and subscription</p>
        </div>

        {/* Profile Card */}
        <div className="rounded-[40px] p-8 md:p-12 border bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl shadow-2xl shadow-black/5 mb-8 overflow-hidden relative" style={{ borderColor: 'var(--border-color)' }}>
          <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32" />
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10 relative z-10">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
              {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                <img 
                  src={user.user_metadata.avatar_url || user.user_metadata.picture} 
                  alt="Avatar" 
                  className="relative w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 object-cover shadow-2xl"
                />
              ) : (
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white text-5xl font-black border-4 border-white dark:border-slate-800 shadow-2xl">
                  {profile?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center md:text-left pt-2">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  {profile?.displayName || 'Scholar'}
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
                  <span>Researching since {formatDate(profile?.createdAt || new Date().toISOString())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Subscription Box */}
          <section className="rounded-[32px] p-8 border bg-white/50 dark:bg-white/[0.02] backdrop-blur-sm" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <CreditCard size={24} className="text-indigo-500" />
              </div>
              <h3 className="text-xl font-black tracking-tight">Plan Details</h3>
            </div>
            
            <div className="mb-8">
              <p className="text-3xl font-black mb-1">
                {usage?.subscriptionTier === 'free' ? 'Free Access' : 
                 usage?.subscriptionTier === 'pro' ? 'Oryx Pro' : 'Oryx Premium'}
              </p>
              <p className="text-sm text-slate-500 font-bold">
                {usage?.subscriptionTier === 'free' ? '15 solves per month' : usage?.subscriptionTier === 'pro' ? '100 solves per month' : '500 solves per month'}
              </p>
            </div>
            
            {usage?.subscriptionTier === 'free' && (
              <a href="/payments-coming-soon" className="w-full text-center px-6 py-4 rounded-2xl gradient-btn text-sm font-black shadow-lg shadow-indigo-500/20 block">
                Upgrade Account
              </a>
            )}
            {usage?.subscriptionTier !== 'free' && (
              <button
                onClick={() => {
                  window.location.href = '/payments-coming-soon';
                }}
                className="w-full text-center px-6 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-black hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Manage Billing
              </button>
            )}
          </section>

          {/* Usage Box */}
          <section className="rounded-[32px] p-8 border bg-white/50 dark:bg-white/[0.02] backdrop-blur-sm" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Zap size={24} className="text-emerald-500" />
              </div>
              <h3 className="text-xl font-black tracking-tight">Active Usage</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-3xl font-black mb-1">
                {questionsRemaining === -1 ? (
                  <span>Unlimited</span>
                ) : (
                  <>
                    {questionsRemaining}{' '}
                    <span className="text-slate-400 font-bold text-xl">Remaining</span>
                  </>
                )}
              </p>
              <p className="text-sm text-slate-500 font-bold">Resets in {getDaysUntilReset()} days</p>
            </div>
            
            <div className="space-y-3">
              <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800/50 overflow-hidden border border-slate-200/20 dark:border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${usage?.monthlyQuestionsLimit && usage.monthlyQuestionsLimit > 0 ? ((usage.monthlyQuestionsLimit - (usage.monthlyQuestionsUsed || 0)) / usage.monthlyQuestionsLimit) * 100 : 0}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                 <span>Current Usage</span>
                 <span>{usage?.monthlyQuestionsUsed || 0} / {usage?.monthlyQuestionsLimit === -1 ? '∞' : usage?.monthlyQuestionsLimit}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Extended Stats */}
        <div className="rounded-[32px] p-8 border bg-white/50 dark:bg-white/[0.02] backdrop-blur-sm" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-xl font-black mb-8 tracking-tight">Growth Insights</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] text-center group hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-xl hover:shadow-black/5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Target size={24} className="text-indigo-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{usage?.monthlyQuestionsUsed || 0}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Answers</p>
            </div>
            
            <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] text-center group hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-xl hover:shadow-black/5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Sparkles size={24} className="text-orange-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{usage?.paygoCreditsRemaining ?? 0}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Extra Credits</p>
            </div>

            <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] text-center group hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-xl hover:shadow-black/5">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Zap size={24} className="text-green-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{questionsRemaining === -1 ? '∞' : questionsRemaining}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Remaining</p>
            </div>

            <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] text-center group hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-xl hover:shadow-black/5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Crown size={24} className="text-purple-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">Top</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scholar rank</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
