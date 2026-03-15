import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import 'katex/dist/katex.min.css';
import App from './App.tsx';
import { initSentry } from './services/sentry';
import * as Sentry from "@sentry/react";

initSentry();

const root = document.getElementById('root');
if (!root) {
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

createRoot(root).render(
  <StrictMode>
    <SentryApp />
  </StrictMode>,
);
