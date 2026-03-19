import { PostHogProvider } from '@posthog/react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function OryxPostHogProvider({ children }: Props) {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!posthogKey) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: posthogHost,
        ui_host: posthogHost,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        persistence: 'memory',
        debug: import.meta.env.DEV,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
