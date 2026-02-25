import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/chrome-extension';
import '../index.css';
import App from './App.tsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const SIDEPANEL_URL = window.location.href;

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found for sidepanel app');
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (!PUBLISHABLE_KEY) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY missing. Rendering sidepanel without Clerk.');
  createRoot(root).render(app);
} else {
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl={SIDEPANEL_URL}
        signInFallbackRedirectUrl={SIDEPANEL_URL}
        signUpFallbackRedirectUrl={SIDEPANEL_URL}
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
