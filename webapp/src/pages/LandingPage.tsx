import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import { trackEvent } from '../lib/analyticsClient';
import { FALLBACK_PUBLIC_CONFIG, fetchPublicAppConfig, type ProductFeature } from '../lib/appConfig';
import {
  ArrowRight,
  CheckCircle2,
  Chrome,
  CirclePlay,
  Clock3,
  ExternalLink,
  FolderKanban,
  GraduationCap,
  Layers,
  Shield,
  Workflow,
} from 'lucide-react';

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 14.4A9.6 9.6 0 0 0 15.35 20H4.6a19.4 19.4 0 0 1 34.3-5L33.55 24a9.6 9.6 0 0 0-9.55-9.6Z" fill="#DB4437" />
      <path d="M33.6 24a9.6 9.6 0 0 1-4.95 8.4L23.3 42.8A19.4 19.4 0 0 0 43.4 20H31.75a9.56 9.56 0 0 1 1.85 4Z" fill="#4285F4" />
      <path d="M28.65 32.4A9.6 9.6 0 0 1 14.4 24a9.56 9.56 0 0 1 .95-4.1L10 10.3A19.4 19.4 0 0 0 23.3 42.8l5.35-10.4Z" fill="#0F9D58" />
      <circle cx="24" cy="24" r="9.6" fill="#F1F1F1" />
      <circle cx="24" cy="24" r="6" fill="#4285F4" />
    </svg>
  );
}

const FEATURE_ICONS = [Chrome, GraduationCap, Layers, Shield, Workflow];
const PLACEHOLDER_LOGOS = ['STUDY FLOW', 'CHROME READY', 'THREAD SAVED', 'MODE SELECT', 'QUIZ LATER'];

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
  const navigate = useNavigate();
  const extensionUrl = String(import.meta.env.VITE_CHROME_EXTENSION_URL ?? '').trim();
  const [features, setFeatures] = useState<ProductFeature[]>(FALLBACK_PUBLIC_CONFIG.features);

  useEffect(() => {
    let active = true;
    async function loadFeatures() {
      try {
        const config = await fetchPublicAppConfig();
        if (!active) return;
        setFeatures(config.features);
      } catch (error) {
        console.error('Failed to load landing features:', error);
      }
    }
    void loadFeatures();
    return () => {
      active = false;
    };
  }, []);

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
              Solve faster.
              <span className="block gradient-text-animated">Understand better.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
              Screenshot a question, choose how you want it explained, and keep the whole solve inside one cleaner study flow.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => handleCreateAccountClick('hero_signup')}
                className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01] sm:w-auto"
              >
                Create free account
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => handleInstallClick('hero_install')}
                className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200/90 bg-white/86 px-7 py-4 text-base font-bold text-slate-900 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white sm:w-auto dark:border-white/12 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <ChromeIcon className="h-5 w-5" />
                Install extension
                {extensionUrl ? <ExternalLink size={16} /> : <ArrowRight size={18} />}
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                15 free monthly questions
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Start in Chrome, continue on web
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                Billing pages staged, not live yet
              </span>
            </div>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[36px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#07111e]/80">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-white/10">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Demo preview</p>
                  <h2 className="marketing-heading mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">
                    Put your real product walkthrough here.
                  </h2>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-teal-200">
                  Demo slot
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(238,245,255,0.82))] p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(10,18,35,0.85))]">
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[24px] border border-slate-200/80 bg-white/78 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-200">
                    <CirclePlay className="h-8 w-8" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                    Demo video placeholder
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Drop your walkthrough video, GIF, or screen recording here when it is ready. The layout is already sized for a real product demo.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="oryx-marketing-panel-strong rounded-[30px] p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Threaded solving</p>
                <h2 className="marketing-heading mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">
                  One question. Cleaner follow-ups.
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  {[
                    ['1', 'Capture', 'Grab the question quickly instead of retyping everything.'],
                    ['2', 'Choose mode', 'Pick the tone before you start so the thread stays consistent.'],
                    ['3', 'Keep context', 'Follow-ups stay inside the same conversation.'],
                  ].map(([step, title, body]) => (
                    <div key={title} className="rounded-[24px] border border-slate-200/70 bg-white/88 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-gradient-soft)', color: 'var(--mode-standard)' }}>
                        <span className="text-sm font-black">{step}</span>
                      </div>
                      <h3 className="text-xl font-black tracking-[-0.02em] text-slate-950 dark:text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="oryx-marketing-panel rounded-[30px] p-6">
                  <div className="flex items-center gap-3">
                    <div className="oryx-marketing-icon h-11 w-11">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Mode selection</p>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Choose it once before the thread starts.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {[
                      ['Standard', 'oryx-chip-standard'],
                      ['Exam', 'oryx-chip-exam'],
                      ['ELI5', 'oryx-chip-eli5'],
                      ['Step-by-step', 'oryx-chip-steps'],
                    ].map(([label, className]) => (
                      <div key={label} className={`oryx-mode-chip ${className} rounded-full px-4 py-2 text-sm font-bold`}>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="oryx-marketing-panel rounded-[30px] p-6">
                  <div className="flex items-center gap-3">
                    <div className="oryx-marketing-icon h-11 w-11">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Prompt starters</p>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Good defaults for the first message.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['Explain the first step', 'Check my answer', 'Summarize this faster', 'Make a practice question'].map((prompt) => (
                      <span key={prompt} className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {prompt}
                      </span>
                    ))}
                  </div>
                </div>
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
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Social proof</p>
                <h2 className="marketing-heading mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                  Placeholder wordmarks for the workflow we're building.
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

      <section id="features" className="relative border-y border-slate-200/70 bg-white/60 px-4 py-20 sm:px-6 dark:border-white/5 dark:bg-black/10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Features</p>
            <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
              Built for how students actually move through a problem.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              The content below stays honest on purpose. It shows what already exists and leaves room for future visuals without pretending they are live today.
            </p>
          </div>

          <div className="oryx-marketing-grid md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
              return (
                <div key={feature.title} className="oryx-marketing-card rounded-[30px] p-8">
                  <div className="oryx-marketing-icon h-14 w-14">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="marketing-heading mt-6 text-2xl font-bold text-slate-950 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pricing preview</p>
              <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                Start free. See the paid plans before billing opens.
              </h2>
            </div>
            <Link to="/pricing" className="hidden text-sm font-bold text-sky-700 hover:text-teal-700 md:inline-flex dark:text-teal-300 dark:hover:text-teal-200">
              Full pricing
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
                    Most popular
                  </div>
                )}
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{plan.name}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="align-super text-lg font-bold text-slate-500">$</span>
                  <span className="text-5xl font-black tabular-nums text-slate-950 dark:text-white">
                    {plan.price.replace('$', '')}
                  </span>
                  <span className="pb-2 text-sm font-bold text-slate-500 dark:text-slate-400">/ month</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{plan.detail}</p>
                <p className="mt-6 rounded-2xl border border-slate-200/80 bg-white/82 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  Billing is coming soon. For now, this routes to the staged payment page.
                </p>
                <Link
                  to={plan.href}
                  className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
                    plan.featured
                      ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]'
                      : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Ready to start</p>
          <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
            Run one real question through the workflow.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            Start with the free account, install the extension if you want the fastest capture flow, and keep the explanation clean enough to review later.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => handleCreateAccountClick('final_signup')}
              className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01] sm:w-auto"
            >
              Create free account
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
