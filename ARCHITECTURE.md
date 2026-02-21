# The Master Engineering Encyclopedia: OryxSolver AI Homework Helper

This document is the definitive, exhaustive guide to every technical layer of the OryxSolver project. It covers the architectural philosophy, the complex communication protocols of Chrome Manifest V3, the mathematical foundations of vector search, and a granular line-by-line logical breakdown of the system you are building.

---

## 🏛️ PART 1: SYSTEM TOPOLOGY & THE "THREE WORLDS"

Unlike a standard website where everything runs in a single browser tab, a Chrome Extension is distributed across three isolated "Execution Environments." These environments are strictly sandboxed—they cannot see each other's variables or share memory.

### 1.1 The Infiltrator: Content Script (`extension/src/content/`)
*   **The Concept**: This is code that you "inject" into someone else's website (like Microsoft Forms).
*   **The Logic**: It runs in an "Isolated World." This means if the website has a variable `const x = 1`, your content script cannot see it. However, it *can* see the same DOM (the HTML).
*   **The Limitation**: It is subject to the website's **Content Security Policy (CSP)**. If Microsoft Forms says "no talking to outside APIs," your content script is blocked. It also cannot access your extension's `localStorage` or Auth tokens.

### 1.2 The Orchestrator: Service Worker (`extension/src/background.ts`)
*   **The Concept**: This is the "brain" that runs in the background of Chrome. It has no window and no UI.
*   **The Logic**: It is an event-based system. It spins up when a message is sent and "sleeps" when idle to save the user's battery.
*   **The Power**: It has **privileged access**. It can bypass CSP, make cross-origin fetch requests, and access the Chrome API (tabs, storage, sidepanel). This is the only place we can securely talk to Supabase.

### 1.3 The Command Center: Extension UI (`extension/src/sidepanel/` & `popup/`)
*   **The Concept**: These are full React 19 applications that live inside the extension's private space.
*   **The Logic**: They work like standard web apps but use the `chrome-extension://` protocol. The Side Panel is the primary workspace where students read the long explanations.

---

## 📡 PART 2: THE COMMUNICATION PROTOCOL (MESSAGE PASSING)

Since the worlds are isolated, we use **Asynchronous Message Passing** to move data. This works like a radio system.

### 2.1 The Request Chain (10-Step Lifecycle)
1.  **DOM Detection**: The Content Script uses a `MutationObserver` to watch for new questions.
2.  **Shadow Injection**: It attaches a **Shadow Root** to the question and injects a "✨ Solve" button.
3.  **User Trigger**: The student clicks the button.
4.  **Extension Message**: The Content Script calls `chrome.runtime.sendMessage({ type: 'SOLVE_QUESTION', payload: { text: "..." } })`.
5.  **Background Reception**: The Service Worker hears the message and keeps the channel open using `return true`.
6.  **Auth Synthesis**: The Service Worker asks Clerk for a fresh JWT: `await clerk.session.getToken()`.
7.  **Backend Proxy**: The Service Worker fetches your Supabase Edge Function, passing the Question and the JWT.
8.  **AI Orchestration**: Supabase verifies the user, checks the `pgvector` cache, and (if needed) calls Gemini 2.0 Flash-Lite.
9.  **The Response**: The AI answer travels back to the Service Worker.
10. **Broadcast**: The Service Worker sends the answer back to the Content Script (to show a "Success" icon) AND broadcasts it to the Side Panel to render the full explanation.

📚 **Reference**: [Chrome Extension Messaging Deep Dive](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

---

## 🔒 PART 3: SECURITY ARCHITECTURE (THE VAULT)

### 3.1 The "Zero-Client-Secret" Philosophy
**The Decision**: You have decided that no "Secret" key will ever exist in the extension code.
**The Reason**: A Chrome Extension is just a zip file. Anyone can download it, unzip it, and read every line of JavaScript. If your `GEMINI_API_KEY` is in there, hackers will steal it and run up a $5,000 bill on your account.
**The Implementation**: All keys are stored in Supabase Environment Variables. The extension only holds the **Clerk JWT**, which is a temporary "digital ID card" that expires every hour.

### 3.2 Shadow DOM Encapsulation
**The Problem**: School websites (like Canvas) have very complex CSS. If you inject a button, their styles might make it invisible. Also, some sites run scripts to detect extensions.
**The Logic**: When we use `element.attachShadow({ mode: 'closed' })`, we create a "Black Box." 
- **Styles**: The website's CSS cannot reach inside.
- **Privacy**: The website's JavaScript cannot use `document.querySelector` to find your button.
- **Safety**: This prevents the website from knowing the student is using an AI helper.

📚 **Reference**: [Understanding Shadow DOM Isolation](https://web.dev/articles/shadowdom-v1)

---

## 🧠 PART 4: SEMANTIC CACHING & VECTOR MATH

### 4.1 Why standard SQL fails for AI
If User A asks: *"What is the square root of 16?"*
And User B asks: *"sqrt of 16"*
A normal database (`WHERE question = '...'`) says they are different. You pay Gemini twice.

### 4.2 The `pgvector` Solution
We use **Vector Embeddings**. An embedding is a process that turns a string of text into a list of 768 floating-point numbers.
- **The Process**: We send the question to Google's `text-embedding-004` model.
- **The Result**: We get a "Coordinate" in a 768-dimensional map of human meaning.
- **The Match**: We use the **Cosine Distance** operator (`<=>`) in PostgreSQL.
- **The Math**: `1 - (cache.embedding <=> new.embedding)`. If the result is > 0.95, it means the questions are 95% identical in *meaning*, regardless of spelling.

**This makes OryxSolver profitable by reducing AI costs by up to 80% on popular questions.**

📚 **Reference**: [Introduction to Vector Search](https://supabase.com/docs/guides/ai/vector-embeddings)

---

## 💸 PART 5: THE FINANCIAL ENGINE (POLAR.SH)

### 5.1 Merchant of Record (MoR)
You chose **Polar.sh** because it handles the complex VAT/Taxes for global users.
- **The Checkout**: We generate a link in the Side Panel using the user's Clerk ID.
- **The Payment**: Polar handles the secure Stripe-powered transaction.
- **The Webhook Handshake**: Polar sends a cryptographically signed message to our `polar-webhook` Edge Function.
- **HMAC Verification**: Our code calculates a "Hash" of the message using the `POLAR_WEBHOOK_SECRET`. If our calculation matches the signature in the header, we know the message is 100% real and not a hacker.

---

## 🛠️ PART 6: GRANULAR FILE & LOGIC DIRECTORY

| File Path | Component | Logical Responsibility |
| :--- | :--- | :--- |
| `manifest.json` | Manifest | Defines the "Contract" with Chrome. Lists permissions and service worker locations. |
| `extension/src/background.ts` | Service Worker | The secure proxy. Handles Auth Token sync and routes messages to Supabase. |
| `extension/src/content/index.ts` | Content Script | The DOM Scanner. Uses `MutationObserver` to watch for page changes and inject UI. |
| `extension/src/sidepanel/App.tsx` | React App | The Main UI. Renders Markdown, Math formulas (KaTeX), and handles Login/Billing. |
| `extension/src/lib/utils.ts` | Shared Logic | Helper functions for Tailwind class merging (`cn` utility). |
| `supabase/functions/ai-proxy/` | Edge Function | The Brain. Verifies JWT, generates embeddings, checks cache, calls Gemini. |
| `supabase/functions/polar-webhook/` | Edge Function | The Accountant. Processes payments and updates user subscription tiers. |
| `supabase/migrations/initial.sql` | Database | Defines the tables: `profiles`, `questions_cache`, and `subscriptions`. |
| `.env` | Environment | The central configuration for all API keys (AI, Auth, Payments). |

---

## 🚀 PART 7: LOGICAL FLOWCHARTS

### 7.1 Initialization Flow
1. User installs extension.
2. `background.ts` registers.
3. User opens Side Panel -> `ClerkProvider` checks for session.
4. User logs in -> Clerk syncs token to `background.ts`.

### 7.2 Detection Flow
1. User navigates to Microsoft Forms.
2. `content/index.ts` triggers.
3. Finds `.question-text` elements.
4. Injects `✨ Solve` via Shadow DOM.

---

## 📚 PART 8: EDUCATIONAL REFERENCE MAP (LEARN MORE)

To become a master of this stack, you should read these specific sections of the documentation:

### 8.1 The Frontend Stack
- **React 19 Hooks**: [Learn about `useOptimistic` and `useFormStatus`](https://react.dev/blog/2024/04/25/react-19).
- **Tailwind v4**: [The new engine and JIT compiler](https://tailwindcss.com/docs/v4-beta).
- **CRXJS**: [How Vite builds extensions](https://crxjs.ai/vite-plugin).

### 8.2 The Backend Stack
- **Deno Runtimes**: [How Supabase Edge Functions work](https://deno.land/manual).
- **Postgres RPCs**: [Writing Database Functions in PL/pgSQL](https://supabase.com/docs/guides/database/functions).
- **JWT Security**: [How Bearer Tokens work](https://auth0.com/docs/secure/tokens/json-web-tokens).

### 8.3 The AI Stack
- **Gemini API**: [Prompting for Structured JSON Output](https://ai.google.dev/gemini-api/docs/structured-output).
- **Vector Indexing**: [HNSW vs Flat indexes for speed](https://supabase.com/docs/guides/ai/vector-indexes).

---

## 📝 PART 9: THE DEVELOPER'S OATH (YOUR DECISIONS)

As the owner, you have established these fundamental rules for the project:
1.  **Ownership**: You are the implementer; I am the guide.
2.  **Security**: Secrets never leave the backend.
3.  **Privacy**: Use Shadow DOM to respect the student's privacy on school sites.
4.  **Performance**: Use Semantic Caching to ensure the app is fast and cheap.

**This document will be updated as we build new features. It is the living constitution of OryxSolver.**
