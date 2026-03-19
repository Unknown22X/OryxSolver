-- Question caching to reduce AI costs
-- Stores normalized question text + answer for exact-match caching

CREATE TABLE IF NOT EXISTS public.questions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_normalized text NOT NULL UNIQUE,
  question_text text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_questions_cache_normalized 
ON public.questions_cache (question_normalized);

-- Enable RLS
ALTER TABLE public.questions_cache ENABLE ROW LEVEL SECURITY;

-- Cache entries are shared across users, so only server-side service access is allowed.
CREATE POLICY "questions_cache_service_access" ON public.questions_cache
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
