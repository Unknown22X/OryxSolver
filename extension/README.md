# OryxSolver – Chrome Extension

> **AI-powered academic solver** that lives in your browser's side panel. Snap a question, get instant step-by-step solutions.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Styling System](#styling-system)
- [Hooks & State Management](#hooks--state-management)
- [Components](#components)
- [Services & API](#services--api)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Build & Deploy](#build--deploy)
- [Contributing Guidelines](#contributing-guidelines)

---

## Overview

OryxSolver is a Chrome Extension built with **React 19**, **Vite**, and **Tailwind CSS v4**. It renders inside Chrome's Side Panel and connects to a backend AI solver (Gemini-based) via REST API. Users can:

- Type or photograph a math/science/humanities question
- Get instant, verified step-by-step solutions
- Manage conversation history
- Quote specific solution steps for follow-up questions
- Choose answer modes: Standard, Exam, ELI5, Step-by-step, Gen Alpha

The extension uses **Supabase** for authentication (email + OTP), user profiles, credits, and subscription management.

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│                  Chrome Side Panel                  │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  useAuth  │  │ useUsage │  │    useSolve      │ │
│  │  hook     │  │  hook    │  │    hook           │ │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │              │                 │           │
│       v              v                 v           │
│  ┌─────────────────────────────────────────────┐   │
│  │              App.tsx (orchestrator)          │   │
│  │  Delegates rendering to child components    │   │
│  └────────────────────┬────────────────────────┘   │
│                       │                            │
│   ┌───────────┬───────┼───────────┬────────────┐   │
│   │           │       │           │            │   │
│   v           v       v           v            v   │
│ AuthView  HeroView  Response  HistoryPanel  Modals │
│                      Panel                         │
└────────────────────────────────────────────────────┘
                        │
                        v
              ┌──────────────────┐
              │  Backend API      │
              │  /solve           │
              │  /sync-profile    │
              │  Supabase Auth    │
              └──────────────────┘
```

**Key Principle:** Business logic lives in **hooks**, UI lives in **components**, API calls live in **services**. The main `App.tsx` is a thin orchestrator (~200 lines) that wires everything together.

---

## Directory Structure

```
extension/
├── public/
│   └── icons/              # Extension icons (16, 48, 128px)
├── src/
│   ├── index.css            # CSS entry point (imports design system)
│   ├── App.css              # Shadcn/UI theme variables (secondary app)
│   │
│   └── sidepanel/
│       ├── App.tsx           # Main orchestrator component
│       ├── index.tsx         # React DOM render entry
│       ├── index.html        # HTML template for side panel
│       ├── types.ts          # Centralized TypeScript types
│       │
│       ├── styles/           # 🎨 Design System (CSS)
│       │   ├── tokens.css    #   Design tokens (colors, radii, shadows, animations)
│       │   ├── base.css      #   HTML resets, body defaults, scrollbars
│       │   ├── components.css#   Reusable component classes (@apply)
│       │   └── utilities.css #   Custom utility classes
│       │
│       ├── hooks/            # 🧠 Business Logic
│       │   ├── useAuth.ts    #   Auth flows (sign-in, sign-up, OTP, profile)
│       │   ├── useUsage.ts   #   Credit tracking, tier analysis, upgrade moments
│       │   └── useSolve.ts   #   AI interaction, chat sessions, error handling
│       │
│       ├── components/       # 🖼️ UI Components
│       │   ├── AuthView.tsx           # Authentication forms
│       │   ├── HeroView.tsx           # Homepage dashboard
│       │   ├── SidePanelHeader.tsx     # Top navigation bar
│       │   ├── MessageComposer.tsx     # Input with image uploads
│       │   ├── ResponsePanel.tsx       # Answer + step timeline
│       │   ├── AnswerHeroCard.tsx      # Final answer display
│       │   ├── StepTimeline.tsx        # Step-by-step visualization
│       │   ├── HistoryPanel.tsx        # Conversation history sidebar
│       │   ├── RichText.tsx            # Markdown/LaTeX renderer
│       │   └── modals/
│       │       ├── ProfileModal.tsx    # Account settings (multi-pane)
│       │       └── UpgradeModal.tsx    # Pro subscription modal
│       │
│       ├── services/         # 🔌 API Layer
│       │   ├── solveApi.ts           # POST /solve request
│       │   ├── apiConfig.ts          # URL resolution helpers
│       │   ├── contracts.ts          # Request/response type definitions
│       │   ├── mapSolveError.ts      # Error code → user-friendly messages
│       │   └── supabaseClient.ts     # Supabase instance
│       │
│       ├── auth/             # 🔒 Authentication
│       │   └── supabaseAuthClient.ts # Supabase auth wrapper
│       │
│       └── utils/            # 🛠️ Helpers
│           ├── usageHelpers.ts       # Usage snapshot build/merge
│           ├── validation.ts         # Email validation with typo detection
│           └── parseExplanationSteps.ts # Split explanation into steps
│
├── manifest.json             # Chrome Extension manifest (v3)
├── vite.config.ts            # Vite + CRXJS plugin config
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
└── .env                      # Environment variables (not committed)
```

---

## Styling System

This project uses **Tailwind CSS v4** with a layered design system approach.

### Philosophy

| Approach | When to Use |
|---|---|
| **Inline utilities** | One-off, element-specific styling (e.g., a specific margin or unique layout) |
| **Component classes (`@apply`)** | Patterns repeated 3+ times across components (buttons, inputs, cards) |
| **React component extraction** | Complex UI patterns with logic + markup (modals, panels) |

### CSS File Organization

| File | Purpose |
|---|---|
| `styles/tokens.css` | Design tokens: brand colors, radii, shadows, keyframe animations |
| `styles/base.css` | HTML resets, body defaults, scrollbar themes |
| `styles/components.css` | Reusable component classes using `@apply` |
| `styles/utilities.css` | One-off helper utilities (scrollbar hiding, dot patterns) |

### Available Component Classes

**Buttons:**
- `oryx-btn-primary` – Gradient CTA (indigo → violet)
- `oryx-btn-secondary` – Dark neutral button
- `oryx-btn-ghost` – Outline/transparent button
- `oryx-btn-danger` – Red destructive action
- `oryx-btn-pill` – Small rounded pill tag

**Inputs:**
- `oryx-input` – Standard text input with focus ring
- `oryx-input--icon` – Input with left icon padding
- `oryx-label` – Uppercase tracking label

**Toggles:**
- `oryx-toggle` + `oryx-toggle--on/--off`
- `oryx-toggle__knob` + `oryx-toggle__knob--on/--off`

**Modals:**
- `oryx-modal-overlay` – Full-screen flex container
- `oryx-modal-backdrop` – Blurred dark backdrop
- `oryx-modal-panel` – Rounded white card

**Cards & Layout:**
- `oryx-card-glass` – Frosted glass card
- `oryx-card-tool` – Toolkit grid item with hover effects
- `oryx-menu-item` – Settings menu row

**Typography:**
- `oryx-caption` – Small uppercase tracking text
- `oryx-stat-value` / `oryx-stat-label` – Stats display
- `oryx-divider`, `oryx-divider__line`, `oryx-divider__label` – Section separator

**Misc:**
- `oryx-icon-box` – Colored icon container
- `oryx-close-btn` – Modal close button

---

## Hooks & State Management

### `useAuth(onProfileSync)`
Manages the complete authentication lifecycle:
- Email + password sign-in/sign-up
- OTP code verification
- Profile updates (display name, avatar)
- Session persistence via Supabase
- Resend cooldown timer

### `useUsage()`
Tracks user plan limits and triggers upgrade prompts:
- Credit usage (questions per month)
- Image upload limits
- Step question quotas
- "Upgrade Moment" analyzer (soft → strong → paywall)

### `useSolve(usage, setUsage, quotedStep, setQuotedStep, onLimitExceeded)`
Handles the core AI solving flow:
- Builds conversation history for context
- Sends multipart form data (text + images)
- Parses structured AI responses
- Manages chat session state
- Rate-limits consecutive sends (2s cooldown)

---

## Components

| Component | Responsibility |
|---|---|
| `App.tsx` | Thin orchestrator: wires hooks → components |
| `AuthView` | Login/signup forms with password toggle and OTP |
| `HeroView` | Homepage dashboard with toolkit grid and trust stats |
| `SidePanelHeader` | Top bar with credits, dark mode, and profile avatar |
| `MessageComposer` | Rich input with image attachments and style modes |
| `ResponsePanel` | Answer card + step timeline + reasoning log |
| `HistoryPanel` | Sliding conversation history with rename/delete |
| `ProfileModal` | Multi-pane account settings (profile, preferences, security) |
| `UpgradeModal` | Pro subscription prompt with feature checklist |

---

## Services & API

### `postSolveRequest(token, request) → SolveResponse`
Sends a question to the AI backend. Returns: answer, explanation, steps, usage data, suggestions, and metadata (model, conversation ID).

### `getApiUrl(path, override?) → string`
Resolves API endpoints using `VITE_API_BASE_URL` or per-endpoint overrides.

### `mapSolveErrorMessage(code, fallback) → string`
Maps backend error codes to user-friendly messages (e.g., `LIMIT_EXCEEDED` → "You've reached your monthly limit").

---

## Environment Variables

Create an `.env` file in `extension/`:

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API Endpoints
VITE_API_BASE_URL=https://your-api.example.com
VITE_SOLVE_API_URL=https://your-api.example.com/solve        # Optional override
VITE_SYNC_PROFILE_API_URL=https://your-api.example.com/sync-profile  # Optional override

# Upgrade
VITE_UPGRADE_URL=https://your-site.com/upgrade
```

---

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
cd extension
npm install
```

### Run (dev mode)
```bash
npm run dev
```
This starts Vite in dev mode with HMR. Load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/dist` folder

### Type Check
```bash
npx tsc --noEmit
```

---

## Build & Deploy

```bash
npm run build
```

This runs TypeScript type-checking (`tsc -b`) then builds with Vite + CRXJS. The output goes to `dist/`.

---

## Contributing Guidelines

### Code Style
- **Hooks first** – Complex logic belongs in hooks, not components
- **Semantic classes** – Use `oryx-*` classes from `components.css` for repeated patterns
- **Inline for unique** – One-off positioning or sizing can stay inline
- **No magic numbers** – Use design tokens from `tokens.css`
- **Types in `types.ts`** – All shared interfaces go in the centralized types file

### Adding a New Component
1. Create the file in `components/` (or `components/modals/` for overlays)
2. Define its props type at the top of the file
3. Use existing `oryx-*` classes where possible
4. If a new pattern appears 3+ times, extract it to `components.css`

### Adding a New Hook
1. Create the file in `hooks/`
2. Import types from `../types`
3. Return a clean interface object (avoid exposing internal state directly)
4. Document the hook's purpose with a JSDoc comment

---

## License

All rights reserved. OryxSolver Team.
