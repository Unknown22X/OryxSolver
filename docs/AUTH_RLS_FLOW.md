# Supabase Auth to RLS Flow

This is the current auth/RLS flow used by OryxSolver.

## Short answer

Yes. Supabase Auth issues the access token, and Supabase PostgREST/RLS evaluates that same JWT context via `auth.jwt()`.

## End-to-end flow

1. User signs in from extension using Supabase Auth.
   - File: `extension/src/sidepanel/auth/supabaseAuthClient.ts`
   - UI flow: `extension/src/sidepanel/App.tsx`

2. Supabase Auth issues an access token (`JWT`) with `sub = auth user id`.

3. Extension calls edge functions with:
   - `Authorization: Bearer <supabase-access-token>`
   - Files:
     - `extension/src/sidepanel/services/solveApi.ts`
     - `extension/src/sidepanel/App.tsx` (sync profile call)

4. Edge function verifies token via Supabase Auth user lookup.
   - File: `supabase/functions/_shared/auth.ts` (`verifySupabaseAccessToken`)
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

8. RLS policy checks ownership by JWT subject:
   - `auth_user_id = auth.jwt()->>'sub'`
   - File: `supabase/migrations/202603090001_rename_identity_uid_columns.sql`

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
