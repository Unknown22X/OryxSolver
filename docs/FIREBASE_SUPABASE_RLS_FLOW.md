# Firebase -> Supabase RLS Flow

This is the current auth/RLS flow used by OryxSolver.

## Short answer

Yes, we are doing your 1-9 flow, with one precision:
- Supabase does **not** convert Firebase JWT into a new Supabase JWT in this setup.
- It validates the Firebase JWT (third-party auth config) and exposes claims to Postgres (`auth.jwt()`), including `sub`.

## End-to-end flow

1. User signs in from extension using Firebase Auth.
   - File: `extension/src/sidepanel/auth/firebaseClient.ts`
   - UI flow: `extension/src/sidepanel/App.tsx`

2. Firebase issues an ID token (`JWT`) with `sub = firebase uid`.

3. Extension calls edge functions with:
   - `Authorization: Bearer <firebase-id-token>`
   - Files:
     - `extension/src/sidepanel/services/solveApi.ts`
     - `extension/src/sidepanel/App.tsx` (sync profile call)

4. Edge function verifies token with Firebase.
   - File: `supabase/functions/_shared/auth.ts` (`verifyFirebaseIdToken`)
   - Used by:
     - `supabase/functions/solve/index.ts`
     - `supabase/functions/sync-profile/index.ts`
     - `supabase/functions/save-history/index.ts`

5. Edge function creates a Supabase client bound to that same bearer token.
   - File: `supabase/functions/_shared/db.ts` (`createSupabaseUserClient`)

6. Supabase/PostgREST validates token claims and runs SQL under that JWT context.
   - Claims are available in policies through `auth.jwt()`.

7. Query runs against `profiles` (or other tables) using that user-scoped client.
   - Profile helpers:
     - `supabase/functions/_shared/profile.ts`

8. RLS policy checks ownership:
   - `firebase_uid = auth.jwt()->>'sub'`
   - File: `supabase/migrations/20260306_profiles_rls_firebase.sql`

9. Result: only the owner row is readable/updatable/insertable under RLS.

## Role gate used by solve

`/solve` also enforces onboarding/authorization role in app logic:
- `profile.role` must be `authenticated`
- File: `supabase/functions/solve/index.ts`

This is separate from RLS and used as a product/business gate.

## Security notes

- `INTERNAL_EDGE_TOKEN` is server-only secret.
- Never place it in extension env files.
- Internal token is only used server-to-server:
  - `supabase/functions/_shared/ai.ts`
  - `supabase/functions/set-authenticated-role/index.ts`
