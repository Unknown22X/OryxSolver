-- Harden shared cache access so only backend service-role code can read or write it.

ALTER TABLE public.questions_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_cache_read" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_insert" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_public_read" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_public_insert" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_service_read" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_service_insert" ON public.questions_cache;
DROP POLICY IF EXISTS "questions_cache_service_access" ON public.questions_cache;

CREATE POLICY "questions_cache_service_access" ON public.questions_cache
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
