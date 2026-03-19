import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProd = import.meta.env.MODE === 'production';

  if (!dsn) {
    if (isProd) {
      console.warn("Sentry DSN not found. Error monitoring disabled.");
    }
    return;
  }

  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: import.meta.env.MODE,
  });
}
