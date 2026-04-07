import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap, History, Settings, LogOut, Menu, ChevronRight, BookOpen, Layers2,
  Loader2, CreditCard, Plus, Bug
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import AnnouncementBanner from './AnnouncementBanner';
import { useUsage } from '../hooks/useUsage';
import { useProfile } from '../hooks/useProfile';
import { getUsageSummary } from '../lib/usagePresentation';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import type { User } from '@supabase/supabase-js';
import { submitFeatureRequest } from '../lib/feedbackApi';
import { MascotIcon } from './MascotIcon';

type SubscriptionTier = 'free' | 'pro' | 'premium';

interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  subscription_tier: SubscriptionTier;
  credits_used: number;
  credits_total: number;
  day_streak: number;
  total_questions: number;
  created_at: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: 'dashboard' | 'chat' | 'history' | 'subscription' | 'settings' | 'profile' | 'admin';
  user?: User | null;
}

type NavItem = {
  id: string;
  label: string;
  icon: any;
  href?: string;
  soon?: boolean;
  soonTone?: 'quiz' | 'flash';
};

function UserAvatar({ photoUrl, email, size = 'md' }: { photoUrl?: string | null; email?: string; size?: 'sm' | 'md' }) {
  const initial = (email?.charAt(0) || 'U').toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Profile"
        className={`${sizeClass} rounded-full object-cover border-2 border-indigo-500/20`}
        onError={(e) => {
          // Fallback to initial if image fails to load
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black shadow-sm`}>
      {initial}
    </div>
  );
}

export default function AppLayout({ children, currentPage, user }: AppLayoutProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(user === undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestedFeatures, setRequestedFeatures] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('oryx_requested_features');
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [requestingFeatureId, setRequestingFeatureId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<User | null>(user ?? null);
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  
  const { usage, loading: usageLoading } = useUsage(authUser);
  const { profile: loadedProfile, loading: profileLoading } = useProfile(authUser);

  useEffect(() => {
    if (user !== undefined) {
      setAuthUser(user ?? null);
      setLoading(false);
      return;
    }

    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setAuthUser(authUser ?? null);
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, [user]);

  useEffect(() => {
    if (loadedProfile) {
      setProfile({
        id: loadedProfile.id,
        email: loadedProfile.email,
        display_name: loadedProfile.displayName ?? undefined,
        avatar_url: loadedProfile.photoUrl ?? undefined,
        subscription_tier: usage?.subscriptionTier ?? 'free',
        credits_used: usage?.monthlyQuestionsUsed ?? 0,
        credits_total: usage?.monthlyQuestionsLimit ?? 0,
        day_streak: 0,
        total_questions: 0,
        created_at: loadedProfile.createdAt,
      });
    }
  }, [loadedProfile, usage]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleFeatureRequest = async (item: NavItem) => {
    if (!authUser) {
      navigate('/login');
      return;
    }
    if (requestedFeatures[item.id] || requestingFeatureId === item.id) {
      return;
    }

    setRequestingFeatureId(item.id);
    try {
      await submitFeatureRequest({
        userId: authUser.id,
        featureId: item.id,
        featureLabel: item.label,
      });
      setRequestedFeatures((prev) => {
        const next = { ...prev, [item.id]: true };
        try {
          localStorage.setItem('oryx_requested_features', JSON.stringify(next));
        } catch {
          // Ignore storage write errors.
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to submit feature request:', error);
    } finally {
      setRequestingFeatureId(null);
    }
  };

  const navItems: NavItem[] = [
    { id: 'chat', label: t('nav.chat'), icon: Zap, href: '/chat' },
    { id: 'history', label: t('nav.history'), icon: History, href: '/history' },
    { id: 'dashboard', label: t('nav.dashboard'), icon: Zap, href: '/dashboard' },
    { id: 'subscription', label: t('nav.subscription'), icon: CreditCard, href: '/subscription' },
    { id: 'quiz_me', label: t('nav.quiz_me'), icon: BookOpen, soon: true, soonTone: 'quiz' },
    { id: 'flash_cards', label: t('nav.flash_cards'), icon: Layers2, soon: true, soonTone: 'flash' },
    { id: 'settings', label: t('nav.settings'), icon: Settings, href: '/settings' },
  ];

  const isAdmin = loadedProfile?.role === 'admin';
  if (isAdmin) {
    navItems.push({ id: 'admin', label: t('nav.admin'), icon: Zap, href: '/admin' });
  }

  if (loading) {
    return (
      <div className="oryx-shell-bg h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const extraCreditsRemaining = usage?.paygoCreditsRemaining ?? 0;
  const planMetric = getUsageSummary(
    usage,
    (percent) => t('common.percent_used', { percent, defaultValue: `${percent}% used` }),
  );
  const planReached = !usageLoading && usage && planMetric.isExhausted;
  const isChatLayout = currentPage === 'chat';
  const useCompactDesktopSidebar = currentPage !== 'admin';

  const getSoonToneClasses = (tone: NavItem['soonTone']) => {
    switch (tone) {
      case 'quiz':
        return {
          row: 'border-amber-200/70 bg-amber-50/90 text-amber-800 dark:border-amber-500/15 dark:bg-amber-500/[0.08] dark:text-amber-200',
          iconWrap: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
          badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
        };
      case 'flash':
        return {
          row: 'border-cyan-200/70 bg-cyan-50/90 text-cyan-800 dark:border-cyan-500/15 dark:bg-cyan-500/[0.08] dark:text-cyan-200',
          iconWrap: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200',
          badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200',
        };
      default:
        return {
          row: 'border-slate-200/70 bg-slate-50/70 text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400',
          iconWrap: 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300',
          badge: 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300',
        };
    }
  };

  return (
    <div className="oryx-shell-bg h-screen flex flex-col overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <AnnouncementBanner />
      <div className="flex min-w-0 flex-1 overflow-hidden">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 w-[min(18rem,calc(100vw-0.75rem))] transform border-r transition-transform duration-300 sm:w-72 lg:relative ${useCompactDesktopSidebar ? 'lg:w-60 xl:w-64' : 'lg:w-64 xl:w-72'} ${sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-[105%]' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: 'var(--surface-sidebar)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="h-full flex flex-col">
          <div className={`${isChatLayout ? 'p-4' : 'p-4 xl:p-5'} border-b`} style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <Link to="/dashboard" className="flex items-center gap-3">
                <MascotIcon 
                  name="logo" 
                  size={44} 
                  className="hover:scale-110 transition-transform duration-300" 
                />

                <span className="text-lg font-black sm:text-xl">Oryx<span className="text-indigo-500">.</span></span>
              </Link>
              <NotificationCenter align={isRtl ? 'right' : 'left'} />
            </div>
          </div>

          <div className={`border-b ${isChatLayout ? 'p-3' : 'p-3'}`} style={{ borderColor: 'var(--border-color)' }}>
            <button 
              onClick={() => {
                navigate('/chat');
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 ${isChatLayout ? 'py-2.5 text-sm' : 'py-2 text-sm'} font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98]`}
            >
              <Plus size={18} />
              {t('nav.new_solve')}
            </button>
          </div>

          <div className={`border-b ${isChatLayout ? 'p-3' : 'p-2.5'}`} style={{ borderColor: 'var(--border-color)' }}>
            <button 
              onClick={() => navigate('/settings')}
              className={`flex w-full items-center gap-3 rounded-xl ${isChatLayout ? 'p-2.5' : 'p-2'} text-left transition-colors hover:bg-white/70 dark:hover:bg-white/5 font-arabic-support`}
            >
              <UserAvatar photoUrl={profile?.avatar_url} email={profile?.email} />
              <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{profile?.display_name || (profileLoading ? t('common.loading') : t('nav.user'))}</p>
              <p className="text-[11px] text-slate-500 truncate">{profile?.email || (profileLoading ? t('nav.fetching_profile') : '')}</p>
            </div>
            <ChevronRight size={16} className={`text-slate-500 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <nav className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto ${isChatLayout ? 'p-3' : 'p-2.5'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              if (item.soon) {
                const toneClasses = getSoonToneClasses(item.soonTone);
                const requested = requestedFeatures[item.id];
                const requesting = requestingFeatureId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleFeatureRequest(item)}
                    className={`flex w-full items-center gap-3 rounded-2xl border ${isChatLayout ? 'px-3 py-2.5 text-sm' : 'px-3 py-2 text-sm'} text-left transition-colors ${toneClasses.row}`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.iconWrap}`}>
                      <Icon size={16} />
                    </div>
                    <span className="font-bold">{item.label}</span>
                    <span className={`mr-auto rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${toneClasses.badge}`}>
                      {requesting
                        ? t('common.loading', { defaultValue: 'Loading' })
                        : requested
                          ? t('nav.requested', { defaultValue: 'Requested' })
                          : t('nav.request', { defaultValue: 'Request' })}
                    </span>
                  </button>
                );
              }
              return (
                <Link
                  key={item.id}
                  to={item.href!}
                  onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl ${isChatLayout ? 'px-3 py-2.5 text-sm' : 'px-3 py-2 text-sm'} font-bold transition-colors ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-500' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {isChatLayout ? (
            <div className="border-t p-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="mb-3 rounded-[22px] border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>{t('nav.plan')}</span>
                  <span>{usageLoading ? '...' : planMetric.isUnlimited ? t('nav.unlimited') : planMetric.percentLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>{t('nav.credits')}</span>
                  <span>{usageLoading ? '...' : extraCreditsRemaining}</span>
                </div>
              </div>

              {usage?.subscriptionTier === 'free' && !usageLoading && (
                <Link 
                  to="/subscription"
                  className="mb-3 flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  {t('nav.upgrade')}
                </Link>
              )}

              <button 
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-red-500 transition-colors hover:bg-red-500/10 text-sm font-bold"
              >
                <LogOut size={18} className={isRtl ? 'rotate-180' : ''} />
                {t('nav.sign_out')}
              </button>
            </div>
          ) : (
            <div className="border-t p-2.5 sm:p-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="mb-2 flex flex-wrap gap-2">
                <div className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-slate-200/70 bg-white/55 px-3 py-2 shadow-sm dark:border-white/5 dark:bg-white/[0.03]">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('nav.plan')}</span>
                  <span className={`text-[10px] font-black ${planReached ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {usageLoading ? '...' : planMetric.isUnlimited ? t('nav.unlimited') : planMetric.percentLabel}
                  </span>
                </div>

                <div className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-slate-200/70 bg-white/55 px-3 py-2 shadow-sm dark:border-white/5 dark:bg-white/[0.03]">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{t('nav.credits')}</span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {usageLoading ? '...' : extraCreditsRemaining}
                  </span>
                </div>
              </div>

              {usage?.subscriptionTier === 'free' && !usageLoading && (
                <Link 
                  to="/subscription"
                  className="group relative mb-2 block w-full overflow-hidden rounded-2xl bg-indigo-600 p-[1px] shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-blue-500 to-indigo-600 animate-gradient-x" />
                  <div className="relative flex items-center justify-center gap-2 rounded-[15px] bg-slate-900 px-3 py-2 text-white transition-colors group-hover:bg-transparent">
                    <MascotIcon name="sparkle" size={15} />
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]">{t('nav.upgrade_pro')}</span>
                  </div>
                </Link>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => navigate('/settings#bug-report')}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-400 transition-all hover:bg-amber-500/10 hover:text-amber-500"
                >
                  <Bug size={14} />
                  {t('nav.support')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <LogOut size={14} className={isRtl ? 'rotate-180' : ''} />
                  {t('nav.sign_out')}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="lg:hidden h-16 border-b flex items-center justify-between px-4 flex-shrink-0" style={{ backgroundColor: 'var(--surface-header)', borderColor: 'var(--border-color)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-white/5">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <MascotIcon 
              name="logo" 
              size={40} 
              className="hover:scale-110 transition-transform duration-300" 
            />

            <span className="font-black">Oryx</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <NotificationCenter />
            <button onClick={() => navigate('/settings')}>
              <UserAvatar photoUrl={profile?.avatar_url} email={profile?.email} size="sm" />
            </button>
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
    </div>
  );
}
