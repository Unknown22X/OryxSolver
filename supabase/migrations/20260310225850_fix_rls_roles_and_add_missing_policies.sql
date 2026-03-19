
-- ============================================================
-- FIX: Change history_entries and solve_runs RLS policies from
-- 'public' role to 'authenticated' role.
-- Also: Add UPDATE policy for history_entries (for renaming),
--        Add DELETE policy for profiles (GDPR),
--        Add index on history_entries.conversation_id.
-- ============================================================

-- ════════════════════════════════════════
-- history_entries: Tighten to 'authenticated' + add UPDATE
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "history_entries_select_own" ON public.history_entries;
DROP POLICY IF EXISTS "history_entries_insert_own" ON public.history_entries;
DROP POLICY IF EXISTS "history_entries_delete_own" ON public.history_entries;

CREATE POLICY "history_entries_select_own"
ON public.history_entries FOR SELECT TO authenticated
USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "history_entries_insert_own"
ON public.history_entries FOR INSERT TO authenticated
WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "history_entries_update_own"
ON public.history_entries FOR UPDATE TO authenticated
USING (user_id = (auth.jwt() ->> 'sub'))
WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "history_entries_delete_own"
ON public.history_entries FOR DELETE TO authenticated
USING (user_id = (auth.jwt() ->> 'sub'));

-- Allow service_role full access (for edge functions)
GRANT ALL ON public.history_entries TO service_role;

-- ════════════════════════════════════════
-- solve_runs: Tighten to 'authenticated'
-- ════════════════════════════════════════
DROP POLICY IF EXISTS "solve_runs_select_own" ON public.solve_runs;
DROP POLICY IF EXISTS "solve_runs_insert_own" ON public.solve_runs;

CREATE POLICY "solve_runs_select_own"
ON public.solve_runs FOR SELECT TO authenticated
USING (auth_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "solve_runs_insert_own"
ON public.solve_runs FOR INSERT TO authenticated
WITH CHECK (auth_user_id = (auth.jwt() ->> 'sub'));

-- Allow service_role full access
GRANT ALL ON public.solve_runs TO service_role;

-- ════════════════════════════════════════
-- profiles: Add DELETE for GDPR compliance
-- ════════════════════════════════════════
CREATE POLICY "profiles_delete_own"
ON public.profiles FOR DELETE TO authenticated
USING (auth_user_id = (auth.jwt() ->> 'sub'));

-- ════════════════════════════════════════
-- Performance: Index on conversation_id
-- ════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_history_entries_conversation_id
ON public.history_entries (conversation_id);
;
