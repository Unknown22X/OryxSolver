import { Link, useSearchParams } from 'react-router-dom';
import { Clock3, ArrowRight } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';

export default function PaymentsComingSoonPage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');

  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="flex min-h-[calc(100vh-6rem)] items-center justify-center px-6 pt-28 pb-16">
        <section className="oryx-surface-panel-strong w-full max-w-2xl rounded-[40px] p-8 text-center shadow-2xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-500">
            <Clock3 className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Payments coming soon
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white">
            Billing is not live yet
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 dark:text-slate-300">
            Upgrade buttons are temporarily routed here until subscription checkout and self-serve billing are fully ready.
            {plan ? ` Requested plan: ${plan}.` : ''}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/pricing"
              className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              Back to pricing
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-6 py-3 text-sm font-bold transition hover:bg-slate-50 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--border-color)' }}
            >
              Return to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
