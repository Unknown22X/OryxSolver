import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import type { ServiceHealthSnapshot } from '../services/serviceHealth';

type Props = {
  health: ServiceHealthSnapshot;
  retryCountdowns?: Partial<Record<'backend' | 'auth' | 'db' | 'ai', number>>;
  onRetry?: () => void | Promise<void>;
};

function getBannerTone(health: ServiceHealthSnapshot) {
  if (health.overall === 'maintenance') return 'bg-amber-500 text-white';
  if (health.dependencies.network.status === 'outage') return 'bg-rose-600 text-white';
  if (health.overall === 'outage') return 'bg-rose-600 text-white';
  return 'bg-indigo-600 text-white';
}

function sanitizeBannerMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('supabase.co') || normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
    return 'Service is temporarily unavailable. Please try again.';
  }
  return message;
}

export default function ServiceStatusBanner({ health, retryCountdowns, onRetry }: Props) {
  if (health.overall === 'healthy' || (health.overall === 'degraded' && !health.readOnly)) return null;

  const firstBlockedDependency = (['backend', 'auth', 'db', 'ai'] as const).find(
    (dependency) => health.dependencies[dependency].status !== 'healthy',
  );
  const retryCountdown = firstBlockedDependency ? retryCountdowns?.[firstBlockedDependency] ?? 0 : 0;

  return (
    <div className={`relative z-[80] mx-3 mt-3 rounded-2xl px-4 py-3 text-xs font-semibold shadow-lg ${getBannerTone(health)}`}>
      <div className="flex items-center gap-3">
        {health.dependencies.network.status === 'outage' ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-80">
            {health.readOnly ? 'Read-only mode' : 'Service notice'}
          </div>
          <div className="leading-relaxed">{sanitizeBannerMessage(health.message)}</div>
        </div>
        {retryCountdown > 0 ? (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]">
            {retryCountdown}s
          </span>
        ) : null}
        {onRetry ? (
          <button
            onClick={() => void onRetry()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] transition hover:bg-white/25"
          >
            <RefreshCw size={10} />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
