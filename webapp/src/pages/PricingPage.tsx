import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Check, Coins } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analyticsClient';

export default function PricingPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const navigate = useNavigate();

  const PLANS = [
    {
      id: 'free',
      name: t('pricing.free_name'),
      price: '0',
      description: t('pricing.free_desc'),
      titleClass: 'pricing-title-free',
      features: [
        'pricing.free_usage',
        'pricing.free_img',
        'pricing.free_bulk',
        'pricing.free_modes',
        'pricing.free_hist',
        'pricing.free_support',
      ],
      featured: false,
    },
    {
      id: 'pro',
      name: t('pricing.pro_name'),
      price: '3.99',
      description: t('pricing.pro_desc'),
      titleClass: 'pricing-title-pro',
      features: [
        'pricing.pro_usage',
        'pricing.pro_img',
        'pricing.pro_bulk',
        'pricing.pro_modes',
        'pricing.pro_processing',
        'pricing.pro_sync',
      ],
      featured: true,
    },
    {
      id: 'premium',
      name: t('pricing.premium_name'),
      price: '9.99',
      description: t('pricing.premium_desc'),
      titleClass: 'pricing-title-premium',
      features: [
        'pricing.premium_usage',
        'pricing.premium_img',
        'pricing.premium_bulk',
        'pricing.premium_modes',
        'pricing.premium_hist',
        'pricing.premium_support',
      ],
      featured: false,
    },
  ];

  const CREDIT_PACKAGES = [
    { credits: 10, price: '0.99', badge: 'Mini' },
    { credits: 20, price: '1.99', badge: 'Starter' },
    { credits: 50, price: '4.99', badge: 'Best value', featured: true },
    { credits: 100, price: '8.99', badge: 'Study week' },
    { credits: 200, price: '14.99', badge: 'Exam prep' },
    { credits: 500, price: '29.99', badge: 'Power pack' },
  ];

  const FAQS = [
    {
      q: t('pricing.faq_1_q'),
      a: t('pricing.faq_1_a'),
    },
    {
      q: t('pricing.faq_2_q'),
      a: t('pricing.faq_2_a'),
    },
    {
      q: t('pricing.faq_3_q'),
      a: t('pricing.faq_3_a'),
    },
    {
      q: t('pricing.faq_4_q'),
      a: t('pricing.faq_4_a'),
    },
  ];

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
    <MarketingLayout className="oryx-shell-bg">
      <main className="marketing-section">
        <div className="marketing-container">
          <section className="mx-auto mb-16 max-w-3xl text-center">
            <div className="marketing-badge">
              <span>{t('pricing.heading_badge')}</span>
            </div>

            <h1 className="marketing-heading marketing-title-xl mt-8 text-[color:var(--text-primary)]">
              {t('pricing.heading_main')}
              <span className="block gradient-text-animated">{t('pricing.heading_gradient')}</span>
            </h1>

            <p className="marketing-copy mt-6 text-lg sm:text-xl">
              {t('pricing.heading_desc')}
            </p>

            <div className="mt-10 inline-flex rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] p-1.5">
              <button
                onClick={() => setShowCredits(false)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${!showCredits ? 'gradient-btn' : 'text-[color:var(--text-secondary)]'}`}
              >
                {t('pricing.tab_monthly')}
              </button>
              <button
                onClick={() => setShowCredits(true)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${showCredits ? 'gradient-btn' : 'text-[color:var(--text-secondary)]'}`}
              >
                {t('pricing.tab_credits')}
              </button>
            </div>
          </section>

          {!showCredits ? (
            <section className="grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div key={plan.id} className={`marketing-panel relative flex flex-col p-8 ${plan.featured ? 'border-[color:var(--brand-border-strong)]' : ''}`}>
                  {plan.featured && (
                    <div className="marketing-badge absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                      <span>{t('pricing.highly_recommended')}</span>
                    </div>
                  )}

                  <div className={`${plan.featured ? 'mt-4' : ''}`}>
                    <p className={`text-4xl font-bold tracking-[-0.05em] ${plan.titleClass}`}>{plan.name}</p>
                    <p className="marketing-copy mt-3 text-base">{plan.description}</p>
                    <div className="mt-5 inline-flex rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[color:var(--brand-accent)]">
                      {t(`pricing.${plan.id}_usage_badge`)}
                    </div>
                  </div>

                  <div className="mt-10 flex items-end gap-2">
                    <span className="text-lg font-bold text-[color:var(--text-muted)]">$</span>
                    <span className="text-6xl font-black tracking-[-0.04em] text-[color:var(--text-primary)]">{plan.price}</span>
                    <span className="pb-3 text-sm font-bold text-[color:var(--text-muted)]">{t('pricing.month')}</span>
                  </div>

                  <ul className="mt-10 flex-1 space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3 text-base font-semibold text-[color:var(--text-secondary)]">
                        <div className="mt-0.5 rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-accent-soft)] p-1 text-[color:var(--brand-accent)]">
                          <Check size={12} />
                        </div>
                        <span>{t(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    className={`${plan.featured ? 'gradient-btn' : 'marketing-secondary-btn'} mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm`}
                  >
                    {plan.id === 'free'
                      ? t('pricing.get_started')
                      : plan.id === 'pro'
                        ? t('pricing.upgrade_to_pro')
                        : t('pricing.go_premium')}
                  </button>
                </div>
              ))}
            </section>
          ) : (
            <section>
              <div className="mb-10 text-center">
                <h2 className="marketing-heading marketing-title-lg text-[color:var(--text-primary)]">
                  {t('pricing.credits_heading')}
                </h2>
                <p className="marketing-copy mx-auto mt-4 max-w-2xl text-base">
                  {t('pricing.credits_sub')}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {CREDIT_PACKAGES.map((pkg) => (
                  <div key={pkg.credits} className={`marketing-panel flex flex-col p-5 ${pkg.featured ? 'border-[color:var(--brand-border-strong)]' : ''}`}>
                    <div className="marketing-icon-tile">
                      <Coins className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{pkg.badge}</p>
                    <div className="mt-4 text-4xl font-black tracking-[-0.04em] text-[color:var(--text-primary)]">{pkg.credits}</div>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">{t('pricing.credits_unit')}</p>
                    <div className="mt-5 flex items-end gap-1.5">
                      <span className="text-base font-bold text-[color:var(--text-muted)]">$</span>
                      <span className="text-4xl font-black tracking-[-0.04em] text-[color:var(--text-primary)]">{pkg.price}</span>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('pricing.one_time_pack')}</p>
                    <button
                      onClick={() => handleUpgrade(`credits_${pkg.credits}`)}
                      className={`${pkg.featured ? 'gradient-btn' : 'marketing-secondary-btn'} mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm`}
                    >
                      {t('pricing.buy_credits')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-16">
            <div className="mb-8 text-center">
              <p className="marketing-eyebrow">{t('pricing.faq_pre_title')}</p>
              <h2 className="marketing-heading marketing-title-md mt-3 text-[color:var(--text-primary)]">
                {t('pricing.faq_title2')}
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {FAQS.map((item, index) => (
                <div key={index} className="marketing-panel p-6">
                  <p className="text-lg font-black text-[color:var(--text-primary)]">{item.q}</p>
                  <p className="marketing-copy mt-3 text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="marketing-panel-strong mx-auto max-w-4xl p-10 text-center sm:p-14">
              <p className="marketing-eyebrow">{t('pricing.get_started_pre')}</p>
              <h3 className="marketing-heading marketing-title-lg mt-4 text-[color:var(--text-primary)]">
                {t('pricing.get_started_heading')}
              </h3>
              <p className="marketing-copy mx-auto mt-4 max-w-2xl text-base">
                {t('pricing.get_started_desc')}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base">
                  {t('pricing.create_free_acc')}
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
