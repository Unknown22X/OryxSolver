
-- ============================================================
-- CRITICAL SECURITY FIX: Restrict profile UPDATE to safe columns
-- 
-- Previously, users could UPDATE any column on their own profile,
-- including subscription_tier, used_credits, all_credits, and role.
-- This allowed privilege escalation.
--
-- Fix: Drop the permissive UPDATE policy, replace with one that
-- only allows updating safe columns (display_name, photo_url).
-- Sensitive columns should only be modified by service_role (edge functions).
-- ============================================================

-- 1. Drop the old unrestricted UPDATE policy
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2. Create a new restricted UPDATE policy that only allows
--    users to update their display name, photo URL, and last_seen_at.
--    The WITH CHECK ensures they can't change auth_user_id to hijack another profile.
CREATE POLICY "profiles_update_own_safe"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth_user_id = (auth.jwt() ->> 'sub'))
WITH CHECK (auth_user_id = (auth.jwt() ->> 'sub'));

-- 3. Revoke direct column-level UPDATE on sensitive columns from
--    the authenticated role. Only service_role should touch these.
REVOKE UPDATE (subscription_tier, subscription_status, used_credits, all_credits,
               monthly_images_used, monthly_images_period, step_questions_used,
               role, paddle_customer_id, email_verified, auth_user_id, email)
ON public.profiles FROM authenticated;

-- 4. Explicitly GRANT UPDATE only on safe columns to authenticated users.
GRANT UPDATE (display_name, photo_url, last_seen_at) 
ON public.profiles TO authenticated;

-- 5. Allow service_role full update (for edge functions)
GRANT ALL ON public.profiles TO service_role;
;
