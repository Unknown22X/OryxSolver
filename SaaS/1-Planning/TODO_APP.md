# OryxSolver App TODO (High-Level)

This file captures what is still left to do in the app based on current goals.
It is intentionally high-level and grouped by area.

## UI Improvements
- Reduce empty hero space and bring input higher in the first view.
- Convert example prompts into clickable chips and decide whether they auto-send.
- Strengthen the "Final Answer" visual hierarchy (bigger answer, clearer label).
- Improve step timeline readability and visual progression (current vs completed).
- Revisit dark-mode contrast and hover alignment across chips/buttons.

## Settings Additions
- Add preferences for theme (dark/light/system).
- Add usage/limits view (credits, images) inside settings.
- Add account actions (password change, email status, sign out).
- Add model/mode help link and mode descriptions.

## Bug Fixes
- History view should show explanation/steps, not just the final answer.
- Ensure long step lists are fully scrollable.
- Ensure the composer is always available after a solve.
- Fix any remaining Tailwind class issues and layout overflow edges.

## Full App Verification
- End-to-end test: sign-up/sign-in, verify email, solve, history view, sign out.
- Test screenshot capture flow across multiple sites and after tab reload.
- Test CSP and permissions in manifest (host permissions, connect-src).
- Validate build on Windows and on a clean environment.

## Web App (Marketing + Billing)
- Build a landing page (features, examples, trust).
- Add a pricing/upgrade page.
- Connect upgrade flow to payment provider.
- Decide auth flow between extension and web app (SSO vs separate).

## Onboarding
- Design and implement onboarding flow for first-time users (quick tour + first solve).

## Plan Gap Check (Repo vs IMPLEMENTATION_PLAN.md)

### Phase B: Backend + Data Model
- Data model does not match plan v1 schema. Only `history_entries` and `solve_runs` are defined.
  Missing tables: `users`, `subscriptions`, `usage_events`, `questions`, `solutions`, `attachments`.
  See: `supabase/migrations/20260306_history_entries.sql`,
  `supabase/migrations/202603080001_create_solve_runs.sql`.
- API endpoints incomplete vs plan:
  - `/solve` exists: `supabase/functions/solve/index.ts`.
  - `/sync-profile` exists: `supabase/functions/sync-profile/index.ts`.
  - `/history` GET missing (only `save-history` exists).
  - `/feedback` missing.
- "Backend skeleton" exists as Supabase Edge Functions, but plan data model and contracts are not fully implemented.

### Phase C: AI Orchestration + Quality
- Orchestration + fallbacks exist (`supabase/functions/solve/index.ts`, `supabase/functions/ai-proxy/index.ts`).
- Missing plan items:
  - No golden test set.
  - No regression snapshots.
  - No automated schema validation tests.

### Phase D/E/F/G: UX, DOM Detection, Vision, Injection
- Code exists for math rendering, DOM extraction, capture overlay, injection.
- Missing exit criteria validation:
  - No extraction accuracy tests.
  - No injection success-rate validation.
  - No capture flow stability tests.
  These require QA or automated tests, not just code.

### Phase H: Usage, Plans, Billing
- Server-side usage limits enforced in `/solve` and usage returned (`supabase/functions/solve/index.ts`).
- Billing webhook exists (`supabase/functions/polar-webhook/index.ts`).
- Missing vs plan:
  - No `usage_events` table or tracking beyond `profiles.used_credits`.
  - No explicit plan enforcement layer beyond `/solve`.
  - No `/history` or `/feedback` endpoints to support analytics loops.

### Phase I: Security, Observability, QA
- Partial observability via `solve_runs` logging exists (`supabase/functions/_shared/solveRuns.ts`).
- Missing vs plan:
  - No error monitoring integration (e.g., Sentry).
  - No dashboards.
  - No documented QA matrix or automated smoke tests.

## Pricing $ Money 
- Calcualte the App costs
- Reduce the Ai costs
- Write better prompts 
