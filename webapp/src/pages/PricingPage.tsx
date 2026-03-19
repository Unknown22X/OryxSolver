import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analyticsClient';
import {
  ArrowRight,
  Bolt,
  Check,
  ChevronDown,
  Crown,
  Info,
  MousePointerClick,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    period: 'month',
    description: 'Good for trying the workflow with real questions.',
    icon: <Zap size={22} className="text-amber-500 dark:text-amber-300" />,
    cta: 'Create account',
    features: ['15 questions / month', '5 image uploads', '3 bulk solves', 'Standard, Exam, and ELI5'],
    featured: false,
  },
  {
    id: 'pro',
    name: 'Oryx Pro',
    price: '3.99',
    period: 'month',
    description: 'The clearest default for regular weekly use.',
    icon: <Bolt size={22} className="text-sky-600 dark:text-teal-300" />,
    cta: 'Open Pro page',
    features: ['100 questions / month', '50 image uploads', '15 bulk solves', 'All 5 AI modes', 'Cloud history sync'],
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '9.99',
    period: 'month',
    description: 'Higher limits for heavy study weeks.',
    icon: <Crown size={22} className="text-fuchsia-600 dark:text-pink-300" />,
    cta: 'Open Premium page',
    features: ['500 questions / month', '200 image uploads', '30 bulk solves', 'All 5 AI modes', 'Priority support'],
    featured: false,
  },
];

const CREDIT_PACKAGES = [
  { credits: 10, price: '1.99', note: 'Small refill', featured: false },
  { credits: 25, price: '4.99', note: 'Most flexible pack', featured: true },
  { credits: 100, price: '14.99', note: 'Best for exam weeks', featured: false },
];

const FAQS = [
  { q: 'What counts as a question?', a: 'A new top-level solve uses your monthly plan allowance. Follow-up questions stay inside the same thread and do not start a new chat.' },
  { q: 'Can I pay right now?', a: 'Not yet. Upgrade actions route to a payment-coming-soon page while checkout and billing management are being finished.' },
  { q: 'Can I cancel anytime?', a: 'Self-serve cancellation is not live yet. Subscription management will appear once billing is fully enabled.' },
  { q: 'How do credits fit in?', a: 'Credits are separate from monthly plan questions. They are treated as extra usage on top of the plan model, not a replacement for it.' },
];

export default function PricingPage() {
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
              Billing staged
            </div>
            <h1 className="marketing-heading mt-8 text-[3.3rem] font-extrabold text-slate-950 dark:text-white sm:text-[4.1rem] md:text-[5.1rem] md:leading-[0.98]">
              Simple pricing.
              <span className="block gradient-text-animated">No fake checkout.</span>
            </h1>
            <p className="mt-6 text-xl font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Compare the plan structure now, then use the coming-soon page for any paid route until billing is ready.
            </p>

            <div className="mt-10 inline-flex rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-sm dark:border-white/10 dark:bg-white/5">
              <button
                onClick={() => setShowCredits(false)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${!showCredits ? 'gradient-btn shadow-lg shadow-sky-500/12' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
              >
                Monthly plans
              </button>
              <button
                onClick={() => setShowCredits(true)}
                className={`rounded-full px-6 py-3 text-sm font-bold transition ${showCredits ? 'gradient-btn shadow-lg shadow-sky-500/12' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
              >
                One-time credits
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
                      ? 'border-sky-300 bg-gradient-to-b from-sky-100/92 via-white to-teal-100/78 shadow-[0_30px_90px_-46px_rgba(8,145,178,0.42)] dark:border-teal-300/35 dark:from-sky-500/12 dark:via-[#08111d] dark:to-teal-500/10'
                      : 'oryx-marketing-panel'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-4 left-7 rounded-full bg-slate-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-white dark:text-slate-950">
                      Most popular
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{plan.name}</p>
                      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{plan.description}</p>
                    </div>
                    <div className="oryx-marketing-icon h-12 w-12">
                      {plan.icon}
                    </div>
                  </div>

                  <div className="mt-8 flex items-end gap-2">
                    <span className="align-super text-lg font-bold text-slate-500">$</span>
                    <span className="text-6xl font-black tabular-nums text-slate-950 dark:text-white">{plan.price}</span>
                    <span className="pb-3 text-sm font-bold text-slate-500 dark:text-slate-400">/ {plan.period}</span>
                  </div>

                  <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/82 px-4 py-3 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                    Paid routes are visible now, but billing still goes to the staged coming-soon page.
                  </div>

                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <Check size={12} />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${
                      plan.featured
                        ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]'
                        : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </section>
          ) : (
            <section className="mx-auto max-w-5xl pt-6">
              <div className="mb-10 text-center">
                <h2 className="marketing-heading text-4xl font-extrabold text-slate-950 dark:text-white">
                  Extra credits, clearly separated.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Credit packs stay distinct from monthly questions so the usage model stays predictable once billing launches.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {CREDIT_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.credits}
                    className={`rounded-[30px] border p-7 text-center ${pkg.featured ? 'border-sky-300 bg-gradient-to-b from-sky-100/90 to-teal-100/75 dark:border-teal-300/35 dark:from-sky-500/12 dark:to-teal-500/10' : 'oryx-marketing-panel'}`}
                  >
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Credit pack</p>
                    <div className="mt-5 text-5xl font-black tabular-nums text-slate-950 dark:text-white">{pkg.credits}</div>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{pkg.note}</p>
                    <div className="mt-6 flex items-end justify-center gap-2">
                      <span className="align-super text-lg font-bold text-slate-500">$</span>
                      <span className="text-5xl font-black tabular-nums text-slate-950 dark:text-white">{pkg.price}</span>
                    </div>
                    <button
                      onClick={() => handleUpgrade(`credits_${pkg.credits}`)}
                      className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition ${pkg.featured ? 'gradient-btn shadow-lg shadow-sky-500/15 hover:scale-[1.01]' : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                    >
                      Open staged payment page
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-18 grid gap-6 border-t border-slate-200/70 py-16 md:grid-cols-3 dark:border-white/5">
            {[
              { icon: <Shield size={18} />, title: 'Pricing stays honest', desc: 'No pretending checkout is live when it is not.' },
              { icon: <MousePointerClick size={18} />, title: 'Every paid CTA works', desc: 'All paid actions go to the same clear coming-soon destination.' },
              { icon: <Info size={18} />, title: 'Usage model is explicit', desc: 'Plans, follow-ups, and credits are explained in plain language.' },
            ].map((item) => (
              <div key={item.title} className="oryx-marketing-panel rounded-[28px] p-6">
                <div className="oryx-marketing-icon h-12 w-12">
                  {item.icon}
                </div>
                <h3 className="marketing-heading mt-5 text-2xl font-bold text-slate-950 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.desc}</p>
              </div>
            ))}
          </section>

          <section className="mx-auto max-w-4xl py-6">
            <h2 className="marketing-heading text-center text-4xl font-extrabold text-slate-950 dark:text-white">
              Questions before billing opens?
            </h2>
            <div className="mt-8 grid gap-4">
              {FAQS.map((faq) => (
                <details key={faq.q} className="oryx-marketing-panel rounded-[28px] p-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-black text-slate-950 dark:text-white">
                    <span>{faq.q}</span>
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  </summary>
                  <p className="mt-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Next step</p>
              <h3 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                Start free now. Check billing later.
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                The workflow is usable today. Paid billing and subscription controls are the part still being staged.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]">
                  Create free account
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
