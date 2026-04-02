import { PostHogProvider } from '@posthog/react';
import posthog from 'posthog-js';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

let isPostHogInitialized = false;

export function initPostHog() {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!posthogKey) {
    return null;
  }

  if (!isPostHogInitialized) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      ui_host: posthogHost,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'memory',
      debug: import.meta.env.DEV,
    });
    isPostHogInitialized = true;
  }

  return posthog;
}

export function OryxPostHogProvider({ children }: Props) {
  const client = initPostHog();
  if (!client) {
    return <>{children}</>;
  }

  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}
