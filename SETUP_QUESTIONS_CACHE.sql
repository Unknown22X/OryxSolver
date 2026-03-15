-- Run this SQL in Supabase SQL Editor to create the cache table
-- Question caching to reduce AI costs

CREATE TABLE IF NOT EXISTS public.questions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_normalized text NOT NULL UNIQUE,
  question_text text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_cache_normalized 
ON public.questions_cache (question_normalized);

ALTER TABLE public.questions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_cache_read" ON public.questions_cache
FOR SELECT TO authenticated USING (true);

CREATE POLICY "questions_cache_insert" ON public.questions_cache
FOR INSERT TO authenticated WITH CHECK (true);
