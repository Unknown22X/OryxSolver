import { createSupabaseAdminClient } from '../_shared/db.ts';

export interface CachedAnswer {
  question_normalized: string;
  question_text: string;
  answer: string;
  explanation: string;
  steps: string[];
}

function normalizeArabicForCache(question: string): string {
  return question
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[“”"']/g, '')
    .replace(/[،؛]/g, ',')
    .replace(/[؟]/g, '?')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[^\p{L}\p{N}\s.,!?;:()\-+=/*^<>[\]{}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeForCache(question: string): string {
  return normalizeArabicForCache(question)
    .toLowerCase()
    .replace(/[.,!?;:()\-]+$/g, '')
    .trim();
}

async function ensureCacheTable(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('questions_cache').select('id').limit(1);

  if (!error) {
    // Attempt to add new columns if they don't exist (fails silently if they do)
    await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE public.questions_cache ADD COLUMN IF NOT EXISTS explanation text DEFAULT '';
        ALTER TABLE public.questions_cache ADD COLUMN IF NOT EXISTS steps jsonb DEFAULT '[]'::jsonb;
      `
    });
    return;
  }

  if (error.code !== '42P01') {
    throw error;
  }

  console.log('[CACHE] Creating questions_cache table...');
  await supabase.rpc('exec_sql', {
    query: `CREATE TABLE IF NOT EXISTS public.questions_cache (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      question_normalized text NOT NULL UNIQUE,
      question_text text NOT NULL,
      answer text NOT NULL,
      explanation text NOT NULL DEFAULT '',
      steps jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_questions_cache_normalized ON public.questions_cache (question_normalized);
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
      WITH CHECK (true);`
  });
}

export async function getCachedAnswer(question: string): Promise<CachedAnswer | null> {
  await ensureCacheTable();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeForCache(question);

  const { data, error } = await supabase
    .from('questions_cache')
    .select('question_normalized, question_text, answer, explanation, steps')
    .eq('question_normalized', normalized)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    steps: Array.isArray(data.steps) ? data.steps : []
  } as CachedAnswer;
}

export async function saveToCache(question: string, answer: string, explanation: string = '', steps: string[] = []): Promise<void> {
  await ensureCacheTable();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeForCache(question);

  await supabase.from('questions_cache').upsert({
    question_normalized: normalized,
    question_text: question,
    answer: answer,
    explanation: explanation,
    steps: steps,
  }, { onConflict: 'question_normalized' });
}
