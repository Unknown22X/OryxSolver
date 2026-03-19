import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { usePublicAppConfig } from '../hooks/usePublicAppConfig';
import { supabase } from '../lib/supabase';

type MarketingLayoutProps = {
  children: React.ReactNode;
  className?: string;
  headerVariant?: 'solid' | 'glass';
  footerVariant?: 'solid' | 'dark';
  showFooter?: boolean;
};

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
];

function getFooterLinks(supportEmail: string) {
  return [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/#features' },
        { label: 'How It Works', href: '/how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Modes', href: '/modes' },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'FAQ', href: '/faq' },
        { label: 'Contact Support', href: `mailto:${supportEmail}` },
      ],
    },
  ];
}

export default function MarketingLayout({
  children,
  className,
  footerVariant = 'solid',
  showFooter = true,
}: MarketingLayoutProps) {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem('oryx_theme');
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (!window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const { config } = usePublicAppConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const footerLinks = useMemo(() => getFooterLinks(config.support.email), [config.support.email]);

  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('oryx_theme', themeMode);
  }, [isDarkMode, themeMode]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  const handleNav = (href: string) => {
    if (href.startsWith('/#')) {
      const targetId = href.split('#')[1];
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
        return;
      }
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    navigate(href);
  };

  const handleToggleTheme = () => {
    setThemeMode((prev) => {
      if (prev === 'system') return systemPrefersDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <div className={`min-h-screen flex flex-col ${className ?? ''}`}>
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-slate-200/70 bg-white/72 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#06101d]/78">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/6">
              <Sparkles className="h-5 w-5 text-sky-600 dark:text-teal-300" />
            </div>
            <div>
              <span className="text-xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                OryxSolver
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                Faster study flow
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 shadow-sm backdrop-blur md:flex dark:border-white/10 dark:bg-white/5">
            {NAV_LINKS.map((link) => {
              const isActive = activePath === link.href || (link.href === '/#features' && location.hash === '#features');
              return (
                <button
                  key={link.href}
                  onClick={() => handleNav(link.href)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/78 text-slate-700 shadow-sm backdrop-blur transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-teal-300/30 dark:hover:text-white"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              {user ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  Sign In
                </Link>
              )}

              <Link
                to={user ? '/dashboard' : '/signup'}
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm shadow-lg shadow-sky-500/15 transition hover:scale-[1.01]"
              >
                {user ? 'Open app' : 'Get Started'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-2xl border border-slate-200 bg-white/80 p-2.5 text-slate-900 transition-all hover:bg-slate-100 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-xl md:hidden transition-all duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex h-full flex-col px-6 pt-28">
          <div className="space-y-2">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNav(link.href)}
                className="w-full rounded-3xl border border-white/8 bg-white/5 px-5 py-4 text-left text-lg font-bold text-white transition-colors hover:bg-white/10"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pb-10">
            {user ? (
              <Link
                to="/dashboard"
                className="gradient-btn inline-flex w-full items-center justify-center gap-2 rounded-3xl px-5 py-4 text-base"
              >
                Open app
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center rounded-3xl border border-white/20 px-5 py-4 text-base font-bold text-white"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="gradient-btn inline-flex w-full items-center justify-center gap-2 rounded-3xl px-5 py-4 text-base"
                >
                  Get Started
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      {showFooter && (
        <footer className="relative overflow-hidden border-t border-slate-200/70 bg-transparent pt-16 pb-10 dark:border-white/5">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                footerVariant === 'dark'
                  ? 'linear-gradient(180deg, rgba(5,7,20,0.08) 0%, rgba(5,7,20,0) 38%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 36%)',
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: 'var(--marketing-glow)' }} />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-12 grid gap-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div>
                <Link to="/" className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/85 shadow-sm dark:border-white/10 dark:bg-white/6">
                    <Sparkles className="h-5 w-5 text-sky-600 dark:text-teal-300" />
                  </div>
                  <span className="text-xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">OryxSolver</span>
                </Link>
                <p className="mb-5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Capture questions, get cleaner explanations, and keep the study flow moving between Chrome and the web app.
                </p>
                <a href={`mailto:${config.support.email}`} className="inline-flex items-center gap-2 text-sm font-bold text-sky-700 transition-colors hover:text-teal-700 dark:text-teal-300 dark:hover:text-teal-200">
                  <Mail className="h-4 w-4" />
                  {config.support.email}
                </a>
              </div>

              {footerLinks.map((column) => (
                <div key={column.title}>
                  <h4 className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-slate-900 dark:text-white">{column.title}</h4>
                  <ul className="space-y-3">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {link.href.startsWith('mailto:') ? (
                          <a href={link.href} className="text-sm font-medium text-slate-500 transition-colors hover:text-sky-700 dark:hover:text-teal-200">
                            {link.label}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNav(link.href)}
                            className="text-sm font-medium text-slate-500 transition-colors hover:text-sky-700 dark:hover:text-teal-200"
                          >
                            {link.label}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200/70 pt-8 sm:flex-row dark:border-white/5">
              <p className="text-xs font-medium tracking-tight text-slate-500">Copyright 2026 OryxSolver.</p>
              <div className="flex items-center gap-5 text-xs font-medium text-slate-500">
                <Link to="/privacy" className="transition-colors hover:text-slate-900 dark:hover:text-slate-300">Privacy Policy</Link>
                <Link to="/terms" className="transition-colors hover:text-slate-900 dark:hover:text-slate-300">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
