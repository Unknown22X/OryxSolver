import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketingLayout from '../components/MarketingLayout';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analyticsClient';
import {
  ArrowRight,
  Bolt,
  Check,
  Coins,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const PLANS = [
  {
    id: 'free',
    name: 'Free Starter',
    price: '0',
    period: 'month',
    description: 'Perfect for trying OryxSolver with real homework.',
    icon: <Zap size={22} className="text-amber-500 dark:text-amber-300" />,
    cta: 'Get Started',
    features: [
      '15 questions per month',
      '5 image uploads',
      '3 bulk solves',
      'Standard, Exam, and ELI5',
      'Basic history',
      'Community support',
    ],
    featured: false,
    accentName: 'text-amber-500 dark:text-amber-300',
  },
  {
    id: 'pro',
    name: 'Oryx Pro',
    price: '3.99',
    period: 'month',
    description: 'The standard for serious students.',
    icon: <Bolt size={22} className="text-sky-600 dark:text-teal-300" />,
    cta: 'Upgrade to Pro',
    features: [
      '100 questions per month',
      '50 image uploads',
      '15 bulk solves',
      'All 5 AI modes',
      'Priority processing',
      'Early feature access',
      'Cloud history sync',
    ],
    featured: true,
    accentName: 'text-sky-600 dark:text-teal-300',
  },
  {
    id: 'premium',
    name: 'Premium Elite',
    price: '9.99',
    period: 'month',
    description: 'Higher limits for power users.',
    icon: <Crown size={22} className="text-fuchsia-600 dark:text-pink-300" />,
    cta: 'Go Premium',
    features: [
      '500 questions per month',
      '200 image uploads',
      '30 bulk solves',
      'All 5 AI modes',
      'Unlimited history',
      'Premium support',
      'Custom AI presets',
      'Highest speed priority',
    ],
    featured: false,
    accentName: 'text-fuchsia-600 dark:text-pink-300',
  },
];

const CREDIT_PACKAGES = [
  {
    credits: 10,
    price: '0.99',
    featured: false,
    badge: 'Mini',
  },
  {
    credits: 20,
    price: '1.99',
    featured: false,
    badge: 'Starter',
  },
  {
    credits: 50,
    price: '4.99',
    featured: true,
    badge: 'Best value',
  },
  {
    credits: 100,
    price: '8.99',
    featured: false,
    badge: 'Study week',
  },
  {
    credits: 200,
    price: '14.99',
    featured: false,
    badge: 'Exam prep',
  },
  {
    credits: 500,
    price: '29.99',
    featured: false,
    badge: 'Power pack',
  },
];

const FAQS = [
  {
    q: 'What counts as a question?',
    a: 'A new top-level solve uses a monthly question. Follow-ups stay in the same thread and keep context.',
  },
  {
    q: 'When do extra credits help?',
    a: 'Use them when you want more solves without changing your plan. They work as extra usage on top of the monthly setup.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Start free first, then move to a higher-limit option when you need more room.',
  },
  {
    q: 'Do I need a subscription for credits?',
    a: 'No. Credit packs are one-time purchases and stay separate from the monthly plan structure.',
  },
];

export default function PricingPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleUpgrade = (planId: string) => {
    if (!user && planId === 'free') {
      navigate('/signup');
      return;
    }

    if (!user && planId !== 'free') {
      navigate('/login');
      return;
    }

    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }

    trackEvent('pricing_selection', { plan: planId });
    navigate(`/payments-coming-soon?plan=${encodeURIComponent(planId)}`);
  };

  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="relative overflow-hidden pb-24 pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]" style={{ background: 'var(--marketing-glow)' }} />
        <div className="pointer-events-none absolute right-[10%] top-[20%] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-[130px]" />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <section className="mx-auto mb-16 max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-teal-300" />
              {t('pricing.heading_badge', { defaultValue: 'Pick your study setup' })}
            </div>
            <h1 className="marketing-heading mt-8 text-[3.3rem] font-extrabold text-slate-950 dark:text-white sm:text-[4.1rem] md:text-[5.1rem] md:leading-[0.98]">
              {t('pricing.heading_main', { defaultValue: 'Pricing that fits' })}
              <span className="block gradient-text-animated">{t('pricing.heading_gradient', { defaultValue: 'how you study.' })}</span>
            </h1>
            <p className="mt-6 text-xl font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t('pricing.heading_desc', { defaultValue: 'Start free, compare higher-limit options, and choose the setup that matches your workload. Paid upgrades open soon.' })}
            </p>

            <div className="mt-10 inline-flex rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <button
                onClick={() => setShowCredits(false)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${!showCredits ? 'gradient-btn shadow-lg shadow-sky-500/12' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
              >
                {t('pricing.tab_monthly', { defaultValue: 'Monthly plans' })}
              </button>
              <button
                onClick={() => setShowCredits(true)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${showCredits ? 'gradient-btn shadow-lg shadow-sky-500/12' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
              >
                {t('pricing.tab_credits', { defaultValue: 'One-time credits' })}
              </button>
            </div>
          </section>

          {!showCredits ? (
            <section className="grid gap-6 pt-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-[32px] border p-8 ${
                    plan.featured
                      ? 'border-sky-300 bg-gradient-to-b from-sky-100/95 via-white to-indigo-100/85 shadow-[0_36px_110px_-52px_rgba(8,145,178,0.42)] dark:border-teal-300/35 dark:from-sky-500/12 dark:via-[#121433] dark:to-indigo-500/12'
                      : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,248,255,0.9))] shadow-[0_28px_80px_-54px_rgba(15,23,42,0.28)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(12,17,30,0.96),rgba(9,13,24,0.9))]'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_40px_-24px_rgba(99,102,241,0.7)]">
                      {t('pricing.highly_recommended', { defaultValue: 'Highly recommended' })}
                    </div>
                  )}
                  <div className="flex h-full flex-col">
                    <div className="oryx-marketing-icon h-14 w-14">
                      {plan.icon}
                    </div>

                    <div className="mt-8">
                      <p className={`text-4xl font-black tracking-[-0.03em] ${plan.accentName}`}>{t(`pricing.${plan.id}_name`, { defaultValue: plan.name })}</p>
                      <p className="mt-3 text-lg font-medium text-slate-500 dark:text-slate-400">{t(`pricing.${plan.id}_desc`, { defaultValue: plan.description })}</p>
                    </div>

                    <div className="mt-10 flex items-end gap-2">
                      <span className="align-super text-lg font-bold text-slate-500">$</span>
                      <span className="text-6xl font-black tabular-nums text-slate-950 dark:text-white">{plan.price}</span>
                      <span className="pb-3 text-sm font-bold text-slate-500 dark:text-slate-400">{t('pricing.month', { defaultValue: '/month' })}</span>
                    </div>

                    <ul className="mt-10 flex-1 space-y-4">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-base font-semibold text-slate-700 dark:text-slate-200">
                          <div className="mt-0.5 rounded-full bg-indigo-500/10 p-1 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                            <Check size={12} />
                          </div>
                          <span>{t(`pricing.${plan.id}_${i === 0 ? 'q' : i === 1 ? 'img' : i === 2 ? 'bulk' : i === 3 ? 'modes' : i === 4 ? (plan.id === 'free' ? 'hist' : plan.id === 'pro' ? 'processing' : 'hist') : i === 5 ? (plan.id === 'free' ? 'support' : plan.id === 'pro' ? 'early' : 'support') : i === 6 ? (plan.id === 'pro' ? 'sync' : 'presets') : 'speed'}`, { defaultValue: feature })}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/82 px-4 py-3 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                      {t('pricing.plan_notice', { defaultValue: 'See the full plan structure now. Paid upgrades will open as soon as checkout is ready.' })}
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${
                        plan.featured
                          ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]'
                          : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                      }`}
                    >
                      {plan.id === 'free' ? t('pricing.get_started', { defaultValue: plan.cta }) : plan.id === 'pro' ? t('pricing.upgrade_to_pro', { defaultValue: plan.cta }) : t('pricing.go_premium', { defaultValue: plan.cta })}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <section className="mx-auto max-w-7xl pt-6">
              <div className="mb-10 text-center">
                <h2 className="marketing-heading text-4xl font-extrabold text-slate-950 dark:text-white">
                  {t('pricing.credits_heading', { defaultValue: 'Extra credits when you need more.' })}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('pricing.credits_sub', { defaultValue: 'Simple one-time packs for extra solves, without changing your monthly plan.' })}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CREDIT_PACKAGES.map((pkg, i) => (
                  <div
                    key={pkg.credits}
                    className={`relative flex flex-col overflow-hidden rounded-[28px] border p-5 text-left ${
                      pkg.featured
                        ? 'border-sky-300 bg-gradient-to-b from-sky-100/92 via-white to-indigo-100/82 shadow-[0_28px_70px_-46px_rgba(59,130,246,0.35)] dark:border-teal-300/35 dark:from-sky-500/12 dark:via-[#121433] dark:to-indigo-500/10'
                        : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,248,255,0.9))] shadow-[0_28px_80px_-54px_rgba(15,23,42,0.28)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(12,17,30,0.96),rgba(9,13,24,0.9))]'
                    }`}
                  >
                    {pkg.featured && (
                      <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_-24px_rgba(99,102,241,0.7)]">
                        {t(`pricing.credit_${i === 0 ? 'mini' : i === 1 ? 'starter' : i === 2 ? 'best_value' : i === 3 ? 'study_week' : i === 4 ? 'exam_prep' : 'power_pack'}`, { defaultValue: pkg.badge })}
                      </div>
                    )}

                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-indigo-500 via-blue-500 to-sky-400 text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)]">
                      <Coins className="h-5 w-5" />
                    </div>

                    {!pkg.featured && (
                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{t(`pricing.credit_${i === 0 ? 'mini' : i === 1 ? 'starter' : i === 2 ? 'best_value' : i === 3 ? 'study_week' : i === 4 ? 'exam_prep' : 'power_pack'}`, { defaultValue: pkg.badge })}</p>
                    )}

                    <div className="mt-4">
                      <div className="text-4xl font-black tabular-nums text-slate-950 dark:text-white">{pkg.credits}</div>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('pricing.credits_unit', { defaultValue: 'credits' })}</p>
                    </div>

                    <div className="mt-5 flex items-end gap-1.5">
                      <span className="align-super text-base font-bold text-slate-500">$</span>
                      <span className="text-4xl font-black tabular-nums text-slate-950 dark:text-white">{pkg.price}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t('pricing.one_time_pack', { defaultValue: 'One-time pack' })}
                    </p>

                    <button
                      onClick={() => handleUpgrade(`credits_${pkg.credits}`)}
                      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                        pkg.featured
                          ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]'
                          : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                      }`}
                    >
                      {t('pricing.buy_credits', { defaultValue: 'Buy pack' })}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-16">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('pricing.faq_pre_title', { defaultValue: 'Questions' })}</p>
                <h2 className="marketing-heading mt-3 text-3xl font-extrabold text-slate-950 dark:text-white sm:text-4xl">
                  {t('pricing.faq_title2', { defaultValue: 'A few quick answers before you choose.' })}
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {FAQS.map((item, i) => (
                  <div
                    key={item.q}
                    className="rounded-[28px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_22px_70px_-52px_rgba(15,23,42,0.32)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(12,17,30,0.96),rgba(9,13,24,0.9))]"
                  >
                    <p className="text-lg font-black text-slate-950 dark:text-white">{t(`pricing.faq_${i+1}_q`, { defaultValue: item.q })}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{t(`pricing.faq_${i+1}_a`, { defaultValue: item.a })}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('pricing.get_started_pre', { defaultValue: 'Get started' })}</p>
              <h3 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                {t('pricing.get_started_heading', { defaultValue: 'Start free now. Upgrade when you are ready.' })}
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                {t('pricing.get_started_desc', { defaultValue: 'Create your account, try real homework questions, and see which plan fits your study flow best.' })}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]">
                  {t('pricing.create_free_acc', { defaultValue: 'Create free account' })}
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </MarketingLayout>
  );
}
