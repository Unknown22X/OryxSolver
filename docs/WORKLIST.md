# OryxSolver Worklist (as of 2026-04-02)

This is a single “what’s left” checklist that merges your list with what currently exists in the repo.

## ✅ Already exists (needs verification / polish)

- [x] Forgot-password + reset-password flows exist in both webapp and extension (`webapp/src/pages/ResetPasswordPage.tsx`, `extension/src/sidepanel/auth/supabaseAuthClient.ts`).
- [x] “Quiz me” + “Flash cards” appear in the left sidebar as “Soon” items (`webapp/src/components/AppLayout.tsx`).
- [x] Admin area exists in the webapp (`webapp/src/pages/AdminDashboard.tsx`, `webapp/src/pages/admin/*`), plus protected admin Edge Functions (`supabase/functions/admin-*`).
- [x] Credits foundation exists (subscriptions + paygo wallet + ledger) (`supabase/migrations/202603180001_entitlements_foundation.sql`, `supabase/functions/_shared/creditWallet.ts`).
- [x] Usage + limits plumbing exists (webapp + extension hooks, `/sync-profile`, `/solve`) (`webapp/src/hooks/useUsage.ts`, `extension/src/sidepanel/hooks/useUsage.ts`, `supabase/functions/sync-profile/index.ts`, `supabase/functions/solve/index.ts`).

## 🔥 Must-do before any “real” launch

- [ ] **Test the full webapp + extension end-to-end** (real browser/manual): sign up → verify email → onboarding → solve → history → settings → logout → login again → extension solve → ensure history + limits sync.
- [ ] **Fix the credits system/bugs**: confirm monthly limits vs paygo credits consumption order and UI correctness (main suspects: usage calculation and paygo wallet consumption in `supabase/functions/solve/index.ts` and UI in `webapp/src/components/AppLayout.tsx` + pricing/subscription pages).
- [ ] **SMTP setup** (non-code): configure Supabase Auth SMTP + templates so OTP / password reset emails reliably deliver.
- [ ] **Security sweep**: confirm RLS + Edge Functions + admin gating are correct in production; do a quick “attacker mindset” pass with a fresh account.
- [ ] **Scaling sweep**: define p95 targets, run basic load against `/solve`, verify DB indexes and rate limiting behavior.
- [ ] **Cost model**: compute cost per solve (by mode, with/without images) and map to pricing/credit limits.

## Landing + Marketing (remove AI filler / placeholders)

- [ ] Remove “placeholder / future placeholders” copy from `webapp/src/pages/HowItWorksPage.tsx` and replace with your own real feature story.
- [ ] Remove/replace the hero demo placeholders and generic marketing copy in `webapp/src/pages/LandingPage.tsx` (demo slot, fake stats labels, placeholder steps).
- [ ] Fix/verify every marketing page for wording + UX + consistency:
  - `webapp/src/pages/LandingPage.tsx`
  - `webapp/src/pages/HowItWorksPage.tsx`
  - `webapp/src/pages/PricingPage.tsx`
  - `webapp/src/pages/FaqPage.tsx`
  - `webapp/src/pages/ModesPage.tsx`
  - `webapp/src/pages/PaymentsComingSoonPage.tsx`
- [ ] Implement a real **Features** page/section (MarketingLayout links to “Features” but there is no dedicated `/features` route; current nav targets `/#features` in `webapp/src/components/MarketingLayout.tsx`).

## Webapp product work

- [ ] Improve AI response formatting in the webapp (rendering + structure): `webapp/src/pages/ChatPage.tsx`, `webapp/src/components/RichText.tsx`.
- [ ] Improve prompts (tone/format/consistency across modes): `supabase/functions/ai-proxy/modePrompts.ts`, `PROMPTS_MODE_CATALOG.md`.
- [ ] Check DB + understand the app (schema + flows): start with `supabase/migrations/*` and `ARCHITECTURE.md` (but rewrite it — it’s currently inconsistent/outdated).
- [ ] Ensure “customizable easily” is real: validate the admin config/settings flows that control marketing/legal content (`webapp/src/pages/admin/Settings.tsx`, `supabase/functions/admin-config/index.ts`, `webapp/src/lib/appConfig.ts`).
- [ ] Add/finish “updates/announcement” customization if you want that as a product surface (current building blocks: `webapp/src/components/AnnouncementBanner.tsx`, `webapp/src/components/NotificationCenter.tsx`).

## Extension product work

- [ ] Improve AI response formatting in the extension: `extension/src/sidepanel/components/ResponsePanel.tsx`, `extension/src/sidepanel/components/RichText.tsx`.
- [ ] Finish/testing of inline injection flows on real targets (MS Forms / Google Forms / Canvas): `extension/src/content/inlineInjector.ts`.
- [ ] Decide “auto-open side panel” behavior for content-script actions (handoff mentions this): `extension/docs/HANDOFF.md`, `extension/src/background.ts`.

## Legal (structure + versioning, not legal advice)

- [ ] Replace Terms/Privacy copy with your own language and verify the versioning + “effective date” strategy:
  - UI pages: `webapp/src/pages/TermsPage.tsx`, `webapp/src/pages/PrivacyPage.tsx`
  - Content source: `webapp/src/lib/appConfig.ts` (fallback) and admin-config (if used)
  - Consent capture: `webapp/src/lib/legalConsent.ts`, plus metadata updates in `webapp/src/App.tsx`

## Docs cleanup (remove AI slop + fix inconsistencies)

- [ ] Rewrite or delete outdated docs that reference the wrong stack/providers (currently inconsistent with the repo):
  - `README.md`
  - `ARCHITECTURE.md`
  - `IMPLEMENTATION_PLAN.md`

