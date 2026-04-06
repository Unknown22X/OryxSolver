import "../instrument";
import { createRoot } from 'react-dom/client';
import '../index.css';
import App from './App.tsx';
import * as Sentry from "@sentry/react";
import '../i18n';

const panelBootStart = performance.now();
let loaderRemoved = false;
let loaderFallbackTimer: number | null = null;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found for sidepanel app');
}

const SentryApp = Sentry.withErrorBoundary(App, {
  fallback: (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0a0c1b] p-8 text-center text-white">
      <h1 className="text-2xl font-black mb-4">Something went wrong</h1>
      <p className="text-slate-400 mb-8">Oryx Solver encountered an unexpected error. We've been notified and are looking into it.</p>
      <button 
        onClick={() => window.location.reload()}
        className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105"
      >
        Reload App
      </button>
    </div>
  ),
});

const root = createRoot(rootElement, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

function removeInitialLoader() {
  if (loaderRemoved) return;
  loaderRemoved = true;
  if (loaderFallbackTimer !== null) {
    window.clearTimeout(loaderFallbackTimer);
    loaderFallbackTimer = null;
  }
  document.getElementById('oryx-initial-loader')?.remove();
  const bootMs = Math.round(performance.now() - panelBootStart);
  console.info(`[panel-perf] First render ready in ${bootMs}ms`);
}

root.render(
  <SentryApp />,
);

requestAnimationFrame(() => {
  requestAnimationFrame(removeInitialLoader);
});
loaderFallbackTimer = window.setTimeout(removeInitialLoader, 2500);
