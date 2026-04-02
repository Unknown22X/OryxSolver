import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
const isProd = import.meta.env.MODE === 'production';

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
  });

  Sentry.setTag('surface', 'chrome_extension');
} else if (isProd) {
  console.warn("Sentry DSN not found. Error monitoring disabled.");
}
