import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { MascotIcon } from '../components/MascotIcon';
import AppLayout from '../components/AppLayout';
import { useUsage } from '../hooks/useUsage';
import { useSubscription } from '../hooks/useSubscription';
import { cancelSubscription, createBillingPortalSession, createCheckout } from '../lib/billingApi';



function formatDate(value: string | null, t: any) {
  const notScheduled = t('subscription_page.not_scheduled');
  if (!value) return notScheduled;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notScheduled;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(status: string) {
  return status.replace('_', ' ');
}

function formatReason(reason: string, t: any) {
  const map: Record<string, string> = {
    'backfill_grant': t('subscription_page.reason_backfill_grant'),
    'backfill_consume': t('subscription_page.reason_backfill_consume'),
    'solve': t('subscription_page.reason_solve'),
    'lemon_squeezy_webhook': t('subscription_page.reason_lemon_squeezy'),
    'admin_grant': t('subscription_page.reason_admin_grant'),
    'admin_consume': t('subscription_page.reason_admin_consume'),
    'monthly_reset': t('subscription_page.reason_monthly_reset')
  };
  
  if (map[reason]) return map[reason];
  
  // Fallback: Capitalize first letter and replace underscores
  const clean = reason.replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function UsageCard({
  title,
  used,
  limit,
  accentClass,
  t,
}: {
  title: string;
  used: number;
  limit: number;
  accentClass: string;
  t: any;
}) {
  const percent = limit > 0 && limit !== -1 ? Math.min((used / limit) * 100, 100) : 0;
  const highLimitText = t('subscription_page.high_limit');

  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</p>
        <p className={`text-sm font-black ${accentClass}`}>{limit === -1 ? highLimitText : t('subscription_page.used_percent', { percent: Math.round(percent) })}</p>
      </div>
      <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-white/10">
        <div className={`h-full rounded-full ${accentClass.replace('text-', 'bg-')}`} style={{ width: `${limit === -1 ? 100 : percent}%` }} />
      </div>
      <p className="mt-4 text-xl font-black text-slate-950 dark:text-white">
        {used}
        <span className="ml-2 text-base font-semibold text-slate-500 dark:text-slate-400">
          {t('subscription_page.of')} {limit === -1 ? highLimitText : limit}
        </span>
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-white/10">
      <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-black text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export default function SubscriptionPage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { usage, loading: usageLoading, error: usageError, refetch: refetchUsage } = useUsage(user);
  const {
    subscription,
    wallet,
    creditActivity,
    loading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription(user);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const PLAN_CARDS = useMemo(() => [
    {
      id: 'free',
      label: t('subscription_page.plan_free_label'),
      price: '$0',
      period: t('subscription_page.period_mo'),
      description: t('subscription_page.plan_free_desc'),
      features: [
        t('subscription_page.feature_free_1'),
        t('subscription_page.feature_free_2'),
        t('subscription_page.feature_free_3'),
        t('subscription_page.feature_free_4'),
      ],
    },
    {
      id: 'pro',
      label: t('subscription_page.plan_pro_label'),
      price: '$3.99',
      period: t('subscription_page.period_mo'),
      description: t('subscription_page.plan_pro_desc'),
      features: [
        t('subscription_page.feature_pro_1'),
        t('subscription_page.feature_pro_2'),
        t('subscription_page.feature_pro_3'),
        t('subscription_page.feature_pro_4'),
      ],
    },
    {
      id: 'premium',
      label: t('subscription_page.plan_premium_label'),
      price: '$9.99',
      period: t('subscription_page.period_mo'),
      description: t('subscription_page.plan_premium_desc'),
      features: [
        t('subscription_page.feature_premium_1'),
        t('subscription_page.feature_premium_2'),
        t('subscription_page.feature_premium_3'),
        t('subscription_page.feature_premium_4'),
      ],
    },
  ], [t]);

  const loading = usageLoading || subscriptionLoading;
  const currentPlan = useMemo(
    () => PLAN_CARDS.find((plan) => plan.id === subscription.tier) ?? PLAN_CARDS[0],
    [subscription.tier],
  );

  const canOpenPortal = Boolean(subscription.providerCustomerId && subscription.provider === 'lemon_squeezy');
  const canCancelPlan =
    subscription.tier !== 'free' &&
    subscription.provider === 'lemon_squeezy' &&
    Boolean(subscription.providerSubscriptionId) &&
    !subscription.cancelAtPeriodEnd;
  const includedQuestionsRemaining =
    usage?.monthlyQuestionsLimit === -1
      ? t('subscription_page.high_limit')
      : String(Math.max(usage?.monthlyQuestionsRemaining ?? 0, 0));
  const totalCreditsPurchased = wallet.grantedCredits;
  const creditsSpent = wallet.usedCredits;
  const planStartedOn = formatDate(subscription.createdAt, t);

  const handleCheckout = async (planId: string) => {
    if (planId === 'free') {
      setMessage(t('subscription_page.free_already'));
      return;
    }

    setCheckoutPlan(planId);
    setMessage(null);
    try {
      const checkoutUrl = await createCheckout(planId);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout:', error);
      setMessage(error instanceof Error ? error.message : t('subscription_page.failed_open_checkout'));
    } finally {
      setCheckoutPlan(null);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    setMessage(null);
    try {
      const portalUrl = await createBillingPortalSession();
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      setMessage(
        error instanceof Error
          ? error.message
          : t('subscription_page.no_billing_portal'),
      );
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelPlan = async () => {
    const confirmed = confirm(
      t('subscription_page.cancel_confirm')
    );
    if (!confirmed) return;

    setCancelLoading(true);
    setMessage(null);
    try {
      const result = await cancelSubscription();
      setMessage(t('subscription_page.cancel_scheduled', { date: formatDate(result.currentPeriodEnd, t) }));
      await refetchSubscription();
      await refetchUsage();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      setMessage(error instanceof Error ? error.message : t('subscription_page.failed_cancel_subscription'));
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout currentPage="subscription" user={user}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="subscription" user={user}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-5 lg:px-6 lg:py-5" dir={isRtl ? 'rtl' : 'ltr'}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{t('subscription_page.breadcrumb')}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{t('subscription_page.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-[15px]">
            {t('subscription_page.subtitle')}
          </p>
        </div>

        {(message || usageError || subscriptionError) && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {message || usageError || subscriptionError}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#08111d]/88 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-current" />
                {formatStatus(subscription.status)}
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{currentPlan.label}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-[15px]">
                {subscription.cancelAtPeriodEnd
                  ? t('subscription_page.access_active_until', { date: formatDate(subscription.currentPeriodEnd, t) })
                  : t('subscription_page.renews_on', { date: formatDate(subscription.currentPeriodEnd, t) })}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{t('subscription_page.included_in_plan')}</p>
                  <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{includedQuestionsRemaining}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subscription_page.questions_left')}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{t('subscription_page.paid_credits')}</p>
                  <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{wallet.remainingCredits}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('subscription_page.extra_credits_remaining')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/85 p-4 text-right shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{t('subscription_page.current_price')}</p>
              <div className="mt-2 text-4xl font-black text-slate-950 dark:text-white">
                {currentPlan.price}
                <span className="ml-1 text-lg font-semibold text-slate-500 dark:text-slate-400">{currentPlan.period}</span>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {canCancelPlan && (
                  <button
                    type="button"
                    onClick={handleCancelPlan}
                    disabled={cancelLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/15"
                  >
                    {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    {t('subscription_page.cancel_plan')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenPortal}
                  disabled={!canOpenPortal || portalLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {t('subscription_page.open_billing_portal')}
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckout(subscription.tier === 'free' ? 'pro' : 'premium')}
                  disabled={subscription.tier === 'premium'}
                  className="gradient-btn inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black shadow-lg shadow-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {subscription.tier === 'premium'
                    ? t('subscription_page.current_highest')
                    : subscription.tier === 'free'
                      ? t('subscription_page.upgrade_to_pro')
                      : t('subscription_page.upgrade_to_premium')}
                  {subscription.tier !== 'premium' && <ArrowRight className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <UsageCard title={t('subscription_page.questions')} used={usage?.monthlyQuestionsUsed ?? 0} limit={usage?.monthlyQuestionsLimit ?? 0} accentClass="text-rose-500" t={t} />
          <UsageCard title={t('subscription_page.image_uploads')} used={usage?.monthlyImagesUsed ?? 0} limit={usage?.monthlyImagesLimit ?? 0} accentClass="text-amber-500" t={t} />
          <UsageCard title={t('subscription_page.bulk_solves')} used={usage?.monthlyBulkUsed ?? 0} limit={usage?.monthlyBulkLimit ?? 0} accentClass="text-sky-500" t={t} />
        </section>

        <section className="rounded-[30px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.manage_billing_title')}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t('subscription_page.manage_billing_desc')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={!canOpenPortal || portalLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {t('subscription_page.open_billing_portal')}
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-sky-600 dark:text-teal-300" />
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.billing_summary')}</h2>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <SummaryRow label={t('subscription_page.current_plan')} value={currentPlan.label} />
              <SummaryRow label={t('subscription_page.status')} value={formatStatus(subscription.status)} />
              <SummaryRow label={t('subscription_page.billing_cycle')} value={t('subscription_page.monthly')} />
              <SummaryRow label={t('subscription_page.plan_started')} value={planStartedOn} />
              <SummaryRow label={t('subscription_page.renewal_date')} value={formatDate(subscription.currentPeriodEnd, t)} />
              <SummaryRow label={t('subscription_page.included_monthly_questions')} value={usage?.monthlyQuestionsLimit === -1 ? t('subscription_page.high_limit') : String(usage?.monthlyQuestionsLimit ?? 15)} />
              <SummaryRow label={t('subscription_page.included_monthly_images')} value={String(usage?.monthlyImagesLimit ?? 5)} />
              <SummaryRow label={t('subscription_page.included_bulk_solves')} value={String(usage?.monthlyBulkLimit ?? 3)} />
              <SummaryRow label={t('subscription_page.credits_purchased')} value={String(totalCreditsPurchased)} />
              <SummaryRow label={t('subscription_page.credits_spent')} value={String(creditsSpent)} />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{t('subscription_page.credits_remaining')}</span>
                <span className="font-black text-slate-950 dark:text-white">{wallet.remainingCredits}</span>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-black text-slate-950 dark:text-white">{t('subscription_page.next_billing')}</p>
              <p className="mt-2 text-lg font-black text-sky-700 dark:text-teal-300">
                {subscription.currentPeriodEnd ? `${currentPlan.price} ${t('subscription_page.on')} ${formatDate(subscription.currentPeriodEnd, t)}` : t('subscription_page.no_renewal')}
              </p>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 text-sky-600 dark:text-teal-300" />
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.what_you_paid')}</h2>
            </div>
            {creditActivity.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200/80 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                {t('subscription_page.no_activity')}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {creditActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1.3fr_0.7fr_0.8fr] items-center gap-3 rounded-[22px] border border-slate-200/80 bg-white/85 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div>
                      <p className="font-bold text-slate-950 dark:text-white">{formatReason(entry.reason, t)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(entry.createdAt, t)}</p>
                    </div>
                    <p className={`text-sm font-black ${entry.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                      {entry.delta >= 0 ? '+' : ''}
                      {entry.delta}
                    </p>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {t('subscription_page.balance', { balance: entry.balanceAfter })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-sky-600 dark:text-teal-300" />
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.change_plan')}</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLAN_CARDS.map((plan) => {
              const isCurrent = plan.id === subscription.tier;
              const canUpgrade = plan.id !== 'free' && plan.id !== subscription.tier;
              return (
                <div
                  key={plan.id}
                  className={`rounded-[26px] border p-5 ${
                    isCurrent
                      ? 'border-sky-300 bg-gradient-to-b from-sky-100/92 via-white to-indigo-100/80 shadow-[0_22px_70px_-42px_rgba(59,130,246,0.34)] dark:border-teal-300/30 dark:from-sky-500/12 dark:via-[#10192a] dark:to-indigo-500/10'
                      : 'border-slate-200/80 bg-white/88 shadow-sm dark:border-white/10 dark:bg-white/[0.04]'
                  }`}
                >
                  {isCurrent && (
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-teal-300">
                      <MascotIcon name="sparkle" size={14} />
                      {t('subscription_page.current_plan')}
                    </div>
                  )}
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{plan.label}</p>
                  <div className="mt-4 text-5xl font-black text-slate-950 dark:text-white">
                    {plan.price}
                    <span className="ml-1 text-lg font-semibold text-slate-500 dark:text-slate-400">{plan.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                          <MascotIcon 
                            name={plan.id === 'free' ? "sparkle" : "champion"} 
                            size={16} 
                          />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) return;
                      if (plan.id === 'free') {
                        void handleOpenPortal();
                        return;
                      }
                      void handleCheckout(plan.id);
                    }}
                    disabled={isCurrent || checkoutPlan === plan.id || (plan.id === 'free' && !canOpenPortal)}
                    className={`mt-8 w-full rounded-2xl px-4 py-3 text-sm font-black transition ${
                      isCurrent
                        ? 'cursor-default bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                        : 'gradient-btn shadow-lg shadow-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50'
                    }`}
                  >
                    {isCurrent
                      ? t('subscription_page.current_plan')
                      : plan.id === 'free'
                        ? t('subscription_page.use_billing_portal_cancel')
                        : checkoutPlan === plan.id
                          ? t('subscription_page.opening_checkout')
                          : canUpgrade
                            ? t('subscription_page.choose_plan', { label: plan.label })
                            : t('subscription_page.not_available')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-rose-200/70 bg-rose-50/60 p-6 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">{t('subscription_page.danger_zone')}</p>
              <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.cancel_subscription_title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {subscription.cancelAtPeriodEnd
                  ? t('subscription_page.cancel_subscription_desc', { date: formatDate(subscription.currentPeriodEnd, t) })
                  : t('subscription_page.cancel_subscription_desc_2')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelPlan}
              disabled={!canCancelPlan || cancelLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-white px-5 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/25 dark:bg-white/[0.04] dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {subscription.cancelAtPeriodEnd ? t('subscription_page.cancellation_scheduled') : t('subscription_page.cancel_plan')}
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-sky-600 dark:text-teal-300" />
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('subscription_page.how_usage_works')}</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-black text-slate-950 dark:text-white">{t('subscription_page.plan_allowance_first')}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t('subscription_page.plan_allowance_desc')}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-black text-slate-950 dark:text-white">{t('subscription_page.paid_credits_second')}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t('subscription_page.paid_credits_desc')}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-black text-slate-950 dark:text-white">{t('subscription_page.all_messages_count')}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t('subscription_page.all_messages_desc')}
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              void refetchUsage();
              void refetchSubscription();
            }}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
          >
            {t('subscription_page.refresh_data')}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
