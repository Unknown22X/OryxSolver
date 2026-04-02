import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketingLayout from '../components/MarketingLayout';
import { trackEvent } from '../lib/analyticsClient';
import {
  LANDING_FEATURES,
  type LandingFeatureItem,
  LANDING_REVIEWS,
} from '../content/landingFeatures';
import {
  ArrowRight,
  Star,
  CheckCircle2,
  Chrome,
  CirclePlay,
  Camera,
  ExternalLink,
  GraduationCap,
  Layers,
  Shield,
  Workflow,
  ArrowUpRight,
  Brain,
} from 'lucide-react';

const PLACEHOLDER_LOGOS = ['STUDY FLOW', 'CHROME READY', 'THREAD SAVED', 'MODE SELECT', 'QUIZ LATER'];
const HERO_DEMO_STATS = [
  { value: '15', label: 'Free questions' },
  { value: '4', label: 'Core modes' },
  { value: '1', label: 'Thread per solve' },
  { value: 'Web + Chrome', label: 'Same account' },
];
const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Capture',
    description: 'Open the extension and grab the question without retyping everything.',
    mediaLabel: 'Add capture GIF or short video',
  },
  {
    step: '02',
    title: 'Solve',
    description: 'Choose the response mode once, then let Oryx generate a cleaner explanation.',
    mediaLabel: 'Add solving flow demo',
  },
  {
    step: '03',
    title: 'Learn',
    description: 'Review the answer, ask follow-ups in the same thread, and keep the context together.',
    mediaLabel: 'Add follow-up or review demo',
  },
];

const PRICING_PREVIEW = [
  {
    name: 'Free',
    price: '$0',
    detail: '15 monthly questions',
    href: '/signup',
    cta: 'Create account',
    featured: false,
  },
  {
    name: 'Oryx Pro',
    price: '$3.99',
    detail: 'Most popular when billing opens',
    href: '/pricing',
    cta: 'See Pro',
    featured: true,
  },
  {
    name: 'Premium',
    price: '$9.99',
    detail: 'Higher limits, billing soon',
    href: '/pricing',
    cta: 'See Premium',
    featured: false,
  },
];

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const extensionUrl = String(import.meta.env.VITE_CHROME_EXTENSION_URL ?? '').trim();

  const handleCreateAccountClick = (location: string) => {
    trackEvent('cta_click', { location, action: 'signup' });
    navigate('/signup');
  };

  const handleInstallClick = (location: string) => {
    trackEvent('cta_click', { location, action: 'install_extension' });
    if (extensionUrl) {
      window.open(extensionUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate('/how-it-works');
  };

  const getFeaturePresentation = (feature: LandingFeatureItem, index: number) => {
    const toneMap = {
      orange: {
        iconWrap: 'from-orange-500 to-amber-400 text-white shadow-[0_18px_40px_-20px_rgba(249,115,22,0.5)]',
        arrow: 'text-orange-500 dark:text-orange-300',
      },
      violet: {
        iconWrap: 'from-violet-500 to-fuchsia-400 text-white shadow-[0_18px_40px_-20px_rgba(139,92,246,0.5)]',
        arrow: 'text-violet-500 dark:text-violet-300',
      },
      blue: {
        iconWrap: 'from-sky-500 to-blue-400 text-white shadow-[0_18px_40px_-20px_rgba(59,130,246,0.45)]',
        arrow: 'text-sky-500 dark:text-sky-300',
      },
      green: {
        iconWrap: 'from-emerald-500 to-teal-400 text-white shadow-[0_18px_40px_-20px_rgba(16,185,129,0.45)]',
        arrow: 'text-emerald-500 dark:text-emerald-300',
      },
      sky: {
        iconWrap: 'from-cyan-500 to-sky-400 text-white shadow-[0_18px_40px_-20px_rgba(6,182,212,0.45)]',
        arrow: 'text-cyan-500 dark:text-cyan-300',
      },
      indigo: {
        iconWrap: 'from-indigo-500 to-blue-400 text-white shadow-[0_18px_40px_-20px_rgba(99,102,241,0.45)]',
        arrow: 'text-indigo-500 dark:text-indigo-300',
      },
    } as const;

    const icons = [Camera, Brain, Layers, Shield, Chrome, GraduationCap, Workflow];
    const Icon = icons[index % icons.length];
    return {
      Icon,
      ...toneMap[feature.tone],
    };
  };

  return (
    <MarketingLayout className="oryx-shell-bg overflow-x-hidden text-slate-900 dark:text-white" headerVariant="glass" footerVariant="dark">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[32rem]" style={{ background: 'var(--marketing-glow)' }} />
        <div className="absolute left-[10%] top-[18%] h-56 w-56 rounded-full bg-sky-400/10 blur-[110px] dark:bg-teal-300/8" />
        <div className="absolute right-[8%] top-[24%] h-72 w-72 rounded-full bg-blue-500/10 blur-[120px] dark:bg-sky-400/10" />
      </div>

      <section className="relative px-4 pb-18 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="marketing-heading mt-6 text-[3.25rem] font-extrabold text-slate-950 dark:text-white sm:text-[4rem] md:text-[4.2rem] md:leading-[0.98]">
              {t('landing.hero_heading_1')}
              <span className="block gradient-text-animated">{t('landing.hero_heading_2')}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
              {t('landing.hero_sub')}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => handleInstallClick('hero_install')}
                className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-8 py-4 text-base font-black text-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.38)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white sm:w-auto dark:border-white/12 dark:bg-white dark:text-slate-950 dark:hover:border-white/20 dark:hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/90 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.28)] dark:border-white/15 dark:bg-white/8">
                  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                    <path fill="#EA4335" d="M24 4c7.4 0 13.8 4 17.3 9.9H24c-3.7 0-7.1 2-8.9 5.2L9.4 9.3A20.1 20.1 0 0 1 24 4Z" />
                    <path fill="#FBBC04" d="M9.4 9.3 18 24c1.9 3.2 5.3 5.2 9 5.2h11.4A20 20 0 0 1 24 44 20 20 0 0 1 6.7 14.1Z" />
                    <path fill="#34A853" d="M41.3 13.9A19.9 19.9 0 0 1 24 44c7.4 0 13.8-4 17.3-9.9L32.7 19A10.3 10.3 0 0 1 34 24c0 1.8-.4 3.6-1.2 5.2h8.6A20 20 0 0 0 41.3 13.9Z" />
                    <circle cx="24" cy="24" r="7.6" fill="#4285F4" />
                    <circle cx="24" cy="24" r="3.2" fill="#B3D4FF" opacity="0.85" />
                  </svg>
                </span>
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Chrome</span>
                  <span className="mt-1">{t('landing.install_extension')}</span>
                </span>
                {extensionUrl ? <ExternalLink size={16} /> : <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />}
              </button>
              <button
                onClick={() => handleCreateAccountClick('hero_signup')}
                className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01] sm:w-auto"
              >
                {t('landing.create_free_account')}
                <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
              </button>
            </div>

            <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-[34px] border border-slate-200/75 bg-white/75 shadow-[0_34px_120px_-60px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#07101b]/82">
              <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.12),transparent_45%),linear-gradient(180deg,#0b1220,#090f1b)] px-6 py-8 sm:px-10 sm:py-10">
                <div className="absolute inset-0 opacity-60" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), transparent 55%)' }} />
                <div className="absolute inset-x-[10%] bottom-0 h-28 rounded-full bg-sky-500/8 blur-[90px]" />
                <div className="relative flex min-h-[240px] items-center justify-center rounded-[28px] border border-white/8 bg-[#050b16] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[300px]">
                  <button
                    type="button"
                    onClick={() => handleInstallClick('hero_demo')}
                    className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/14 text-white shadow-[0_18px_40px_-24px_rgba(255,255,255,0.45)] transition hover:scale-[1.03] hover:bg-white/18"
                    aria-label="Open demo placeholder"
                  >
                    <CirclePlay className="h-10 w-10 fill-white/90 stroke-[1.8]" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                {t('landing.questions_free')}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                {t('landing.start_in_chrome')}
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                {t('landing.billing_staged')}
              </span>
            </div>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/70 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/86 shadow-[0_20px_70px_-46px_rgba(15,23,42,0.32)] dark:divide-white/8 dark:border-white/10 dark:bg-[#050b16]/88 sm:grid-cols-4 sm:divide-y-0">
                {HERO_DEMO_STATS.map((stat) => (
                  <div key={stat.label} className="px-5 py-5 text-center sm:px-6 sm:py-6">
                    <div className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">
                      {stat.value === 'Web + Chrome' ? t('landing.web_plus_chrome') : stat.value}
                    </div>
                    <div className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {t(`landing.stats.${stat.label.replace(/\s+/g, '_').toLowerCase()}`)}
                    </div>
                  </div>
                ))}
            </div>
            </div>

            <div className="lg:col-span-2 py-2">
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{t('landing.how_it_works')}</p>
                <h2 className="marketing-heading mt-3 text-3xl font-extrabold text-slate-950 dark:text-white sm:text-4xl">
                  {t('landing.three_steps')}
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                  {t('landing.steps_desc')}
                </p>
              </div>

              <div className="mt-10 grid gap-8 lg:grid-cols-3">
                {HOW_IT_WORKS_STEPS.map((item) => (
                  <div key={item.title} className="px-1 text-center">
                    <div className="mx-auto mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] dark:bg-white dark:text-slate-950">
                      {item.step}
                    </div>
                    <h3 className="text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                      {t(`landing.steps.${item.title.toLowerCase()}.title`)}
                    </h3>

                    <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.12),transparent_45%),linear-gradient(180deg,#0b1220,#090f1b)] p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.48)] dark:border-white/10">
                      <div className="relative flex min-h-[180px] items-center justify-center rounded-[22px] border border-white/8 bg-[#050b16] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <div className="absolute inset-0 opacity-60" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), transparent 60%)' }} />
                        <div className="relative flex flex-col items-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/12 text-white">
                            <CirclePlay className="h-7 w-7 fill-white/90 stroke-[1.8]" />
                          </div>
                          <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                            {t(`landing.steps.${item.title.toLowerCase()}.mediaLabel`)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {t(`landing.steps.${item.title.toLowerCase()}.description`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-18 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="oryx-marketing-panel rounded-[30px] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{t('landing.social_proof')}</p>
                <h2 className="marketing-heading mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                  {t('landing.placeholder_wordmarks')}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                {PLACEHOLDER_LOGOS.map((logo) => (
                  <div
                    key={logo}
                    className="rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
                  >
                    {logo}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative border-y border-slate-200/70 bg-transparent px-4 py-20 sm:px-6 dark:border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.06),transparent_42%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.05),transparent_42%)]" />
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t(`landing.features_eyebrow`)}</p>
            <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
              {t(`landing.features_title`)}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t(`landing.features_desc`)}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-2">
            {LANDING_FEATURES.map((feature, index) => {
              const presentation = getFeaturePresentation(feature, index);
              const Icon = presentation.Icon;
              return (
                <div
                  key={feature.id}
                  className="group rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(247,250,255,0.88))] p-8 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.3)] transition duration-200 hover:-translate-y-1 hover:border-slate-300/90 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(8,12,24,0.92),rgba(7,11,22,0.82))] dark:hover:border-white/14"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br ${presentation.iconWrap}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                    {t(`landing.features.${feature.id}.title`)}
                  </h3>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    {t(`landing.features.${feature.id}.description`)}
                  </p>
                  <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${presentation.arrow}`}>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/8 dark:text-amber-200">
              <Star className="h-3.5 w-3.5 fill-current" />
              {t(`landing.reviews_eyebrow`)}
            </div>
            <h2 className="marketing-heading mt-6 text-4xl font-extrabold text-slate-950 dark:text-white sm:text-5xl">
              {t(`landing.reviews_titlePrefix`)}{' '}
              <span className="gradient-text-animated">{t(`landing.reviews_titleHighlight`)}</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {LANDING_REVIEWS.map((review) => (
              <div
                key={review.id}
                className="rounded-[30px] border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,248,255,0.88))] p-7 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.3)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(12,17,30,0.96),rgba(9,13,24,0.9))]"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={`${review.id}-${index}`} className="h-4 w-4 fill-current" />
                  ))}
                </div>

                <p className="mt-5 text-lg leading-relaxed text-slate-700 dark:text-slate-200">
                  "{review.quote}"
                </p>

                <div className="mt-8 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${review.accent} text-sm font-black text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)]`}>
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-950 dark:text-white">{t(`landing.reviews.${review.id}.name`)}</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t(`landing.reviews.${review.id}.role`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('landing.pricing_preview_eyebrow')}</p>
              <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                {t('landing.pricing_preview_title')}
              </h2>
            </div>
            <Link to="/pricing" className="hidden text-sm font-bold text-sky-700 hover:text-teal-700 md:inline-flex dark:text-teal-300 dark:hover:text-teal-200">
              {t('landing.full_pricing')}
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {PRICING_PREVIEW.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[30px] border p-7 ${
                  plan.featured
                    ? 'relative border-sky-300 bg-gradient-to-b from-sky-100/90 to-teal-100/70 shadow-[0_26px_60px_-34px_rgba(8,145,178,0.35)] dark:border-teal-300/35 dark:from-sky-500/12 dark:to-teal-500/10'
                    : 'oryx-marketing-panel'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-6 rounded-full bg-slate-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-white dark:text-slate-950">
                    {t('landing.most_popular', { defaultValue: 'Most popular' })}
                  </div>
                )}
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  {t(`landing.pricing_preview.${plan.name.replace(/\s+/g, '_').toLowerCase()}.name`)}
                </p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="align-super text-lg font-bold text-slate-500">$</span>
                  <span className="text-5xl font-black tabular-nums text-slate-950 dark:text-white">
                    {plan.price.replace('$', '')}
                  </span>
                  <span className="pb-2 text-sm font-bold text-slate-500 dark:text-slate-400">{t('landing.per_month', { defaultValue: '/ month' })}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t(`landing.pricing_preview.${plan.name.replace(/\s+/g, '_').toLowerCase()}.detail`)}
                </p>
                <p className="mt-6 rounded-2xl border border-slate-200/80 bg-white/82 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {t('landing.pricing_preview_billing_soon')}
                </p>
                <Link
                  to={plan.href}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
                    plan.featured
                      ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]'
                      : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {t(`landing.pricing_preview.${plan.name.replace(/\s+/g, '_').toLowerCase()}.cta`)}
                  <ArrowRight size={16} className={isRtl ? 'rotate-180' : ''} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('landing.ready_to_start')}</p>
          <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
            {t('landing.run_one_question')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            {t('landing.run_desc')}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => handleCreateAccountClick('final_signup')}
              className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01] sm:w-auto"
            >
              {t('landing.create_free_account')}
              <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
