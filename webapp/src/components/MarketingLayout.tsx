import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Menu, Moon, Sun, X } from 'lucide-react';
import { usePublicAppConfig } from '../hooks/usePublicAppConfig';
import { supabase } from '../lib/supabase';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { MascotIcon } from './MascotIcon';

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
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const footerLinks = useMemo(() => getFooterLinks(config.support.email), [config.support.email]);
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  useEffect(() => {
    document.documentElement.style.setProperty('--marketing-header-height', '88px');
  }, []);

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
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        return;
      }
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className={`marketing-page min-h-screen flex flex-col ${className ?? ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)] backdrop-blur-xl">
        <div className="mx-auto flex h-[var(--marketing-header-height)] max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)] shadow-[var(--brand-shadow-soft)]">
              <MascotIcon name="logo" size="100%" className="scale-110 object-cover" />
            </div>
            <div>
              <span className="marketing-wordmark text-[1.55rem] text-[color:var(--text-primary)]">OryxSolver</span>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.22em] text-[color:var(--text-soft)]">
                {t('landing.tagline')}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-1 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activePath === link.href || (link.href === '/#features' && location.hash === '#features');
              return (
                <button
                  key={link.href}
                  onClick={() => handleNav(link.href)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? 'gradient-btn'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--brand-accent-soft)] hover:text-[color:var(--text-primary)]'
                  }`}
                >
                  {t(`landing.nav_${link.label.toLowerCase().replace(/\s+/g, '_')}`)}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--brand-border-strong)] hover:text-[color:var(--brand-accent)]"
              title={isDarkMode ? t('common.theme_light') : t('common.theme_dark')}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <LanguageSwitcher />

            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to={user ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
              >
                {user ? t('landing.dashboard') : t('landing.sign_in')}
              </Link>

              <Link
                to={user ? '/dashboard' : '/signup'}
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"
              >
                {user ? t('landing.open_app') : t('landing.get_started')}
                <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-[18px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-2.5 text-[color:var(--text-primary)] transition hover:border-[color:var(--brand-border-strong)] md:hidden"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[90] bg-[rgba(10,12,22,0.68)] backdrop-blur-xl md:hidden transition-all duration-300 ${
          isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex h-full flex-col px-6 pt-28">
          <div className="space-y-2">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNav(link.href)}
                className={`w-full rounded-[24px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-5 py-4 text-lg font-bold text-[color:var(--text-primary)] ${isRtl ? 'text-right' : 'text-left'}`}
              >
                {t(`landing.nav_${link.label.toLowerCase().replace(/\s+/g, '_')}`)}
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 pb-10">
            <Link
              to={user ? '/dashboard' : '/login'}
              className="inline-flex w-full items-center justify-center rounded-[24px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-5 py-4 text-base font-bold text-[color:var(--text-primary)]"
            >
              {user ? t('landing.dashboard') : t('landing.sign_in')}
            </Link>
            <Link
              to={user ? '/dashboard' : '/signup'}
              className="gradient-btn inline-flex w-full items-center justify-center gap-2 rounded-[24px] px-5 py-4 text-base"
            >
              {user ? t('landing.open_app') : t('landing.get_started')}
              <ArrowRight className={`h-5 w-5 ${isRtl ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[var(--marketing-header-height)]">{children}</main>

      {showFooter && (
        <footer className={`relative border-t border-[color:var(--brand-border)] pt-16 pb-10 ${footerVariant === 'dark' ? 'bg-[color:var(--brand-surface)]' : ''}`}>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-12 grid gap-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <Link to="/" className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[16px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)]">
                    <MascotIcon name="logo" size="100%" className="scale-110 object-cover" />
                  </div>
                  <span className="marketing-wordmark text-xl text-[color:var(--text-primary)]">OryxSolver</span>
                </Link>
                <p className="mb-5 max-w-sm text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  {t('landing.footer_desc')}
                </p>
                <a href={`mailto:${config.support.email}`} className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--brand-accent)]">
                  <Mail className="h-4 w-4" />
                  {config.support.email}
                </a>
              </div>

              {footerLinks.map((column) => (
                <div key={column.title} className={isRtl ? 'text-right' : 'text-left'}>
                  <h4 className="mb-5 text-sm font-black uppercase tracking-[0.22em] text-[color:var(--text-primary)]">
                    {t(`landing.footer_${column.title.toLowerCase()}`)}
                  </h4>
                  <ul className="space-y-3">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {link.href.startsWith('mailto:') ? (
                          <a href={link.href} className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]">
                            {t(`landing.nav_${link.label.toLowerCase().replace(/\s+/g, '_')}`)}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNav(link.href)}
                            className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                          >
                            {t(`landing.nav_${link.label.toLowerCase().replace(/\s+/g, '_')}`)}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-4 border-t border-[color:var(--brand-border)] pt-8 sm:flex-row">
              <p className="text-xs font-medium tracking-tight text-[color:var(--text-muted)]">{t('landing.copyright')}</p>
              <div className="flex items-center gap-5 text-xs font-medium text-[color:var(--text-muted)]">
                <Link to="/privacy" className="transition-colors hover:text-[color:var(--text-primary)]">{t('landing.privacy_policy')}</Link>
                <Link to="/terms" className="transition-colors hover:text-[color:var(--text-primary)]">{t('landing.terms_of_service')}</Link>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
