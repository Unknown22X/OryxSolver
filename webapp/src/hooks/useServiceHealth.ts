import { useEffect, useMemo, useState } from 'react';
import {
  fetchPublicServiceHealth,
  getDependencyRetryCountdown,
  getServiceHealthSnapshot,
  markOffline,
  markOnline,
  subscribeServiceHealth,
  type ServiceDependency,
  type ServiceHealthSnapshot,
} from '../lib/serviceHealth';

export function useServiceHealth() {
  const [snapshot, setSnapshot] = useState<ServiceHealthSnapshot>(() => getServiceHealthSnapshot());

  useEffect(() => subscribeServiceHealth(setSnapshot), []);

  useEffect(() => {
    const handleOnline = () => {
      markOnline();
      void fetchPublicServiceHealth().catch(() => {
        // Keep last-known state if refresh fails.
      });
    };
    const handleOffline = () => markOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await fetchPublicServiceHealth();
        if (!cancelled && data.health) setSnapshot(data.health);
      } catch {
        // Ignore health refresh failures; local incidents already update state.
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const retryCountdowns = useMemo(() => {
    const dependencies: Exclude<ServiceDependency, 'network'>[] = ['backend', 'auth', 'db', 'ai'];
    return Object.fromEntries(
      dependencies.map((dependency) => [dependency, getDependencyRetryCountdown(dependency, snapshot)]),
    ) as Record<Exclude<ServiceDependency, 'network'>, number>;
  }, [snapshot]);

  return {
    health: snapshot,
    retryCountdowns,
    refresh: fetchPublicServiceHealth,
  };
}
