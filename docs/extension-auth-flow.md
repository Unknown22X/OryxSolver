# Extension Auth Flow Architecture

This document describes the modern **OAuth PKCE (Proof Key for Code Exchange) Flow** used by the Oryx Solver extension, specifically for verifying Google Sign in via Supabase in an isolated Chrome Extension context (Manifest V3).

## 1. Authentication Strategy: Why PKCE?
In traditional modern Single Page Apps (SPAs), Implicit OAuth flows were standard (exchanging tokens directly in `#access_token=`). However, in a Chrome Extension:
1. Tokens in the URL history, while isolated to the `chrome-extension://` scheme, still constitute a small exposure surface to history snapshots or extensions with high privileges.
2. The current **PKCE** strategy significantly mitigates this by enforcing that the extension must exchange a temporary, single-use `?code=` query parameter for full tokens behind the scenes.
3. Supabase automatically hashes a `code_challenge` before opening the Google popup, and the extension must send the secret `code_verifier` with the `code` to complete the exchange.

## 2. Storage Setup (`chrome.storage.local`)
A strictly isolated `localStorage` causes significant problems when the extension scales to a Service Worker (`background.ts`). MV3 Background workers have absolutely zero access to the DOM or `window.localStorage`. 

To solve this we use a **Custom Storage Adapter** in `src/sidepanel/services/supabaseClient.ts`.
- The adapter intercepts standard Supabase `getItem`/`setItem` methods.
- It writes the auth session safely to `chrome.storage.local`.
- If the browser environment exists but `chrome.sendMessage` fails (e.g., local development wrapper), it gracefully falls back to `localStorage`.

## 3. The End-to-End Google Auth Flow
1. **User Request**: The user clicks "Continue with Google" in the sidepanel.
2. **PKCE Start**: `supabase.auth.signInWithOAuth` is called. Supabase creates a `code_verifier` and stores it into `chrome.storage.local`. It returns a redirect URL that includes the hashed `code_challenge` and a security `state` parameter.
3. **Tab Launch**: The extension uses `chrome.tabs.create` to pop open Google's Consent screen.
4. **Redirection Target**: Google securely bounces the user to `objizntvrmckzdpdgqjo.supabase.co`, which then redirects to the whitelisted sidepanel URL: `chrome-extension://<EXTENSION_ID>/src/sidepanel/index.html?code=XXXX`.
5. **Code Interception**: 
   - Before the React app fully renders, `supabaseAuthClient.ts` detects the `?code=` URL parameter.
   - The sidepanel reads the stored `code_verifier` from `chrome.storage.local`.
   - The code automatically executes `supabase.auth.exchangeCodeForSession(code)`.
6. **Graceful Auto-Close**: Once the token exchange resolves, the script triggers a heuristic check: If the window is massive (`innerWidth > 600`), it is correctly identified as the temporary auth tab and uses `window.close()` to shut itself down.
7. **Session Available**: Because `chrome.storage.local` is synchronized across the whole extension, the actual sidepanel instantly detects the new session and automatically routes the user into the dashboard.

## 4. Security Considerations
* **Clickjacking Protection:** The side panel URL (`src/sidepanel/index.html`) is locked down via the `manifest.json` `web_accessible_resources` array. It is set strictly with a `matches` parameter protecting it so that only `*.supabase.co` and `accounts.google.com` can redirect or embed the page.
* **State Parameter:** Validation limits Cross-Site Request Forgery (CSRF). Supabase automatically handles state token validation when parsing the code exchange using its native `exchangeCodeForSession` method.
* **Error Handling:** The redirect handler correctly captures `?error=` parameters (e.g., if a user prematurely clicks "Cancel" on Google's consent screen) gracefully displaying the error before safely closing the hanging tab.
