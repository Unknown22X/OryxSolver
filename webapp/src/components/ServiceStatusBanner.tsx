import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import type { ServiceHealthSnapshot } from '../lib/serviceHealth';

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

export default function ServiceStatusBanner({ health, retryCountdowns, onRetry }: Props) {
  if (health.overall === 'healthy') return null;

  const firstBlockedDependency = (['backend', 'auth', 'db', 'ai'] as const).find(
    (dependency) => health.dependencies[dependency].status !== 'healthy',
  );
  const retryCountdown = firstBlockedDependency ? retryCountdowns?.[firstBlockedDependency] ?? 0 : 0;

  return (
    <div className={`relative z-[70] w-full px-4 py-2 text-sm font-semibold shadow-lg ${getBannerTone(health)}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        {health.dependencies.network.status === 'outage' ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
            {health.readOnly ? 'Read-only mode' : 'Service notice'}
          </div>
          <div className="truncate">{health.message}</div>
        </div>
        {retryCountdown > 0 ? (
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
            Retry in {retryCountdown}s
          </span>
        ) : null}
        {onRetry ? (
          <button
            onClick={() => void onRetry()}
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition hover:bg-white/25"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
