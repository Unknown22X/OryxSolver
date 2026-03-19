
-- ============================================================
-- PERFORMANCE: Wrap auth.jwt() calls in (SELECT ...) subquery
-- to prevent per-row re-evaluation. This is a Supabase best
-- practice for RLS performance at scale.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

-- ═══════ profiles ═══════
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth_user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
CREATE POLICY "profiles_update_own_safe"
ON public.profiles FOR UPDATE TO authenticated
USING (auth_user_id = (SELECT auth.jwt() ->> 'sub'))
WITH CHECK (auth_user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE TO authenticated
USING (auth_user_id = (SELECT auth.jwt() ->> 'sub'));

-- ═══════ history_entries ═══════
DROP POLICY IF EXISTS "history_entries_select_own" ON public.history_entries;
CREATE POLICY "history_entries_select_own"
ON public.history_entries FOR SELECT TO authenticated
USING (user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "history_entries_insert_own" ON public.history_entries;
CREATE POLICY "history_entries_insert_own"
ON public.history_entries FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "history_entries_update_own" ON public.history_entries;
CREATE POLICY "history_entries_update_own"
ON public.history_entries FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.jwt() ->> 'sub'))
WITH CHECK (user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "history_entries_delete_own" ON public.history_entries;
CREATE POLICY "history_entries_delete_own"
ON public.history_entries FOR DELETE TO authenticated
USING (user_id = (SELECT auth.jwt() ->> 'sub'));

-- ═══════ solve_runs ═══════
DROP POLICY IF EXISTS "solve_runs_select_own" ON public.solve_runs;
CREATE POLICY "solve_runs_select_own"
ON public.solve_runs FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "solve_runs_insert_own" ON public.solve_runs;
CREATE POLICY "solve_runs_insert_own"
ON public.solve_runs FOR INSERT TO authenticated
WITH CHECK (auth_user_id = (SELECT auth.jwt() ->> 'sub'));
;
