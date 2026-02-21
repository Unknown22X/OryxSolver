# OryxSolver: AI Homework Helper

OryxSolver is a modern Chrome Extension designed to seamlessly assist students with homework questions directly on their educational platforms (like Microsoft Forms). It uses a powerful AI backend to provide step-by-step explanations, safely injected into a side panel.

## 🚀 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui
- **Extension Framework**: Manifest V3, `@crxjs/vite-plugin`
- **Authentication**: Clerk (Chrome Extension specific SDK)
- **Backend & Database**: Supabase (PostgreSQL)
- **Edge Logic**: Deno-based Supabase Edge Functions
- **AI Model**: Google Gemini 2.0 Flash-Lite
- **Payments**: Polar.sh
- **Caching**: `pgvector` for semantic similarity matching

## 📁 Project Structure

```text
OryxSolver/
├── extension/                # The React Chrome Extension
│   ├── public/               # Static assets & icons
│   ├── src/
│   │   ├── background.ts     # Service Worker (Clerk sync, API proxy)
│   │   ├── content/          # Scripts injected into web pages
│   │   ├── popup/            # Extension popup UI (Login)
│   │   └── sidepanel/        # Main React App for explanations
│   ├── manifest.json         # Chrome Extension config
│   └── vite.config.ts        # Vite + CRXJS config
│
├── supabase/                 # The Backend
│   ├── functions/            # Edge Functions (Deno)
│   │   ├── ai-proxy/         # Handles AI requests & caching
│   │   └── polar-webhook/    # Handles payment events
│   └── migrations/           # SQL database schema
│
└── ARCHITECTURE.md           # Detailed technical documentation
```

## 🛠️ Getting Started (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- Supabase CLI (`npm i -g supabase`)
- Docker Desktop (required to run Supabase locally)

### 2. Environment Variables
Create a `.env` in the root directory and fill in your keys:
- **Clerk**: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Supabase**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Polar.sh**: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`
- **Gemini**: `GEMINI_API_KEY`

### 3. Start the Backend
```bash
# Start local Supabase instance (requires Docker)
npx supabase start
```

### 4. Start the Extension
```bash
cd extension
npm install
npm run dev
```

### 5. Load the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** in the top right.
3. Click **"Load unpacked"** and select the `OryxSolver/extension/dist` folder.

## 📝 Next Steps for the Developer
As the project owner, here are the remaining decisions and implementations:

- [ ] **Finalize Content Script Selectors**: Decide which specific websites (Canvas, Moodle, etc.) need hardcoded DOM selectors vs. heuristic scanning.
- [ ] **Build the Side Panel UI**: Use `shadcn/ui` components to design a clean, markdown-supported explanation view.
- [ ] **Prompt Engineering**: Refine the system prompt sent to Gemini to ensure it acts strictly as a "tutor" and not just an answer-bot.
- [ ] **Deploy Supabase**: Push the local migrations and Edge Functions to the live Supabase project.

---
*For a deep dive into the code logic, caching strategy, and security architecture, please read `ARCHITECTURE.md`.*
