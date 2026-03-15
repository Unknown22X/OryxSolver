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

-- Allow read for authenticated users (for caching lookups)
CREATE POLICY "questions_cache_read" ON public.questions_cache
FOR SELECT TO authenticated USING (true);

-- Allow insert for authenticated users (for saving new cache entries)
CREATE POLICY "questions_cache_insert" ON public.questions_cache
FOR INSERT TO authenticated WITH CHECK (true);
