import PostHog from 'posthog-js';

let posthogInstance: ReturnType<typeof PostHog.init> | null = null;
let posthogDisabledReason: string | null = null;
const extensionAnalyticsEnabled = String(import.meta.env.VITE_ENABLE_EXTENSION_ANALYTICS ?? '').toLowerCase() === 'true';

function isHostAllowedByExtensionCsp(hostUrl: string): boolean {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) return true;
    const manifest = chrome.runtime.getManifest();
    const rawCsp = manifest.content_security_policy;
    const csp =
      typeof rawCsp === 'string'
        ? rawCsp
        : rawCsp?.extension_pages ?? '';
    const connectSrcPart = csp
      .split(';')
      .map((part: string) => part.trim())
      .find((part: string) => part.startsWith('connect-src '));

    if (!connectSrcPart) return true;

    const host = new URL(hostUrl).host;
    const sources = connectSrcPart
      .replace(/^connect-src\s+/, '')
      .split(/\s+/)
      .map((source: string) => source.trim())
      .filter(Boolean);

    return sources.some((source: string) => {
      if (source === '*' || source === "'self'") return true;
      if (!source.startsWith('http://') && !source.startsWith('https://')) return false;
      try {
        const sourceUrl = new URL(source.replace(/\/\*$/, ''));
        if (sourceUrl.host === host) return true;
        if (sourceUrl.host.startsWith('*.')) {
          const wildcardBase = sourceUrl.host.slice(2);
          return host === wildcardBase || host.endsWith(`.${wildcardBase}`);
        }
      } catch {
        return false;
      }
      return false;
    });
  } catch {
    return true;
  }
}

export function initPosthog() {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!extensionAnalyticsEnabled) {
    posthogDisabledReason = 'Extension analytics disabled (set VITE_ENABLE_EXTENSION_ANALYTICS=true to enable).';
    return null;
  }

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.');
    return null;
  }

  if (posthogInstance) {
    return posthogInstance;
  }
  if (!isHostAllowedByExtensionCsp(host)) {
    if (!posthogDisabledReason) {
      posthogDisabledReason = `PostHog host not in extension CSP connect-src (${host}).`;
      console.warn(posthogDisabledReason);
    }
    return null;
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
