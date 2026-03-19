import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, Zap, History, Settings, LogOut, Menu, ChevronRight, BookOpen, Layers2,
  Loader2, Wallet
} from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { useProfile } from '../hooks/useProfile';
import type { User } from '@supabase/supabase-js';

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
  currentPage: 'dashboard' | 'chat' | 'history' | 'settings' | 'profile' | 'admin';
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
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<User | null>(user ?? null);
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

  const navItems: NavItem[] = [
    { id: 'chat', label: 'Solve', icon: Sparkles, href: '/chat' },
    { id: 'history', label: 'History', icon: History, href: '/history' },
    { id: 'dashboard', label: 'Dashboard', icon: Zap, href: '/dashboard' },
    { id: 'quiz_me', label: 'Quiz Me', icon: BookOpen, soon: true, soonTone: 'quiz' },
    { id: 'flash_cards', label: 'Flash Cards', icon: Layers2, soon: true, soonTone: 'flash' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  const isAdmin = loadedProfile?.role === 'admin';
  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Zap, href: '/admin' });
  }

  if (loading) {
    return (
      <div className="oryx-shell-bg h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const planQuestionsRemaining = usage?.monthlyQuestionsRemaining ?? 0;
  const planQuestionsLimit = usage?.monthlyQuestionsLimit ?? 0;
  const extraCreditsRemaining = usage?.paygoCreditsRemaining ?? 0;
  const planReached = planQuestionsLimit !== -1 && planQuestionsRemaining <= 0;
  const usesExtraCredits = usage?.subscriptionTier === 'free' && extraCreditsRemaining > 0;

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
    <div className="oryx-shell-bg h-screen flex overflow-hidden">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed lg:relative inset-y-0 left-0 z-50 w-72 transform border-r transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ backgroundColor: 'var(--surface-sidebar)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-soft)' }}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Sparkles size={22} className="text-white" />
              </div>
              <span className="text-xl font-black">Oryx<span className="text-indigo-500">.</span></span>
            </Link>
          </div>

          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <button 
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-white/70 dark:hover:bg-white/5"
            >
              <UserAvatar photoUrl={profile?.avatar_url} email={profile?.email} />
              <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{profile?.display_name || (profileLoading ? 'Loading...' : 'User')}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.email || (profileLoading ? 'Fetching profile' : '')}</p>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              if (item.soon) {
                const toneClasses = getSoonToneClasses(item.soonTone);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${toneClasses.row}`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses.iconWrap}`}>
                      <Icon size={16} />
                    </div>
                    <span className="font-bold">{item.label}</span>
                    <span className={`ml-auto rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${toneClasses.badge}`}>
                      Soon
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.id}
                  to={item.href!}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-500' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="space-y-3 mb-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-soft)' }}>
                <p className="text-xs text-slate-500 mb-1">Monthly Plan</p>
                <p className="font-black text-lg">
                  {usageLoading ? (
                    <span className="text-slate-500">...</span>
                  ) : planQuestionsLimit === -1 ? (
                    <span>High limit</span>
                  ) : (
                    <>
                      {planQuestionsRemaining}{' '}
                      <span className="text-slate-500 font-normal text-sm">
                        / {planQuestionsLimit} left
                      </span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  New questions use this monthly plan first.
                </p>
              </div>

              <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--surface-soft)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Extra Credits</p>
                    <p className="font-black text-lg">{usageLoading ? '...' : extraCreditsRemaining}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Wallet size={18} />
                  </div>
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  {usesExtraCredits
                    ? 'Used only after your monthly plan runs out.'
                    : 'No extra credits are being used right now.'}
                </p>
              </div>
            </div>
            {!usageLoading && planReached && usesExtraCredits && (
              <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Your monthly plan is finished. New questions now use extra credits.
              </div>
            )}
            {!usageLoading && planReached && extraCreditsRemaining <= 0 && (
              <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                You are out of monthly questions and extra credits.
              </div>
            )}
            {usage?.subscriptionTier === 'free' && !usageLoading && (
              <Link 
                to="/payments-coming-soon"
                className="block w-full py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-center text-sm font-bold"
              >
                Upgrade
              </Link>
            )}
          </div>

          <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full hover:bg-red-500/10 text-red-400 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="lg:hidden h-16 border-b flex items-center justify-between px-4 flex-shrink-0" style={{ backgroundColor: 'var(--surface-header)', borderColor: 'var(--border-color)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-white/5">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-black">Oryx</span>
          </div>
          <button onClick={() => navigate('/settings')}>
            <UserAvatar photoUrl={profile?.avatar_url} email={profile?.email} size="sm" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
