import { createClerkClient } from '@clerk/chrome-extension/background'

// Vite exposes env variables starting with VITE_ to the client
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Please add VITE_CLERK_PUBLISHABLE_KEY to .env");
}

// Exporting the client makes it available to the rest of our background logic later
export const clerk = createClerkClient({
  publishableKey: PUBLISHABLE_KEY,
});

// This is required to keep the service worker alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('OryxSolver installed, Clerk Auth initialized.')
});
