import PostHog from 'posthog-js';

let posthogInstance: ReturnType<typeof PostHog.init> | null = null;

export function initPosthog() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.');
    return null;
  }

  if (posthogInstance) {
    return posthogInstance;
  }

  posthogInstance = PostHog.init(apiKey, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: 'memory',
    debug: import.meta.env.DEV,
  });

  return posthogInstance;
}

export function getPosthog(): ReturnType<typeof PostHog.init> | null {
  if (!posthogInstance) {
    return initPosthog();
  }
  return posthogInstance;
}

export function captureEvent(event: string, properties?: Record<string, any>) {
  const ph = getPosthog();
  if (ph) {
    ph.capture(event, properties);
  }
}

export function identifyUser(userId: string, userProperties?: Record<string, any>) {
  const ph = getPosthog();
  if (ph) {
    ph.identify(userId, userProperties);
  }
}

export function resetUser() {
  const ph = getPosthog();
  if (ph) {
    ph.reset();
  }
}
