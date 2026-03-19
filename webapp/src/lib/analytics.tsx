import { useEffect, type ReactNode } from 'react';
import { usePostHog } from '@posthog/react';
import { useLocation } from 'react-router-dom';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
  const location = useLocation();

  useEffect(() => {
    if (posthog) {
      posthog.capture('$pageview', {
        $pathname: location.pathname,
      });
    }
  }, [location.pathname, posthog]);

  return <>{children}</>;
}
