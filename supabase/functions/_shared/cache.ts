import { createSupabaseAdminClient } from '../_shared/db.ts';

export interface CachedAnswer {
  question_normalized: string;
  question_text: string;
  answer: string;
}

export function normalizeForCache(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]$/, '')
    .trim();
}

async function ensureCacheTable(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  try {
    await supabase.from('questions_cache').select('id').limit(1);
  } catch {
    console.log('[CACHE] Creating questions_cache table...');
    await supabase.rpc('exec_sql', {
      query: `CREATE TABLE IF NOT EXISTS public.questions_cache (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        question_normalized text NOT NULL UNIQUE,
        question_text text NOT NULL,
        answer text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_questions_cache_normalized ON public.questions_cache (question_normalized);
      ALTER TABLE public.questions_cache ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "questions_cache_read" ON public.questions_cache FOR SELECT TO authenticated USING (true);
      CREATE POLICY "questions_cache_insert" ON public.questions_cache FOR INSERT TO authenticated WITH CHECK (true);`
    });
  }
}

export async function getCachedAnswer(question: string): Promise<CachedAnswer | null> {
  await ensureCacheTable();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeForCache(question);

  const { data, error } = await supabase
    .from('questions_cache')
    .select('question_normalized, question_text, answer')
    .eq('question_normalized', normalized)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as CachedAnswer;
}

export async function saveToCache(question: string, answer: string): Promise<void> {
  await ensureCacheTable();
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeForCache(question);

  await supabase.from('questions_cache').upsert({
    question_normalized: normalized,
    question_text: question,
    answer: answer,
  }, { onConflict: 'question_normalized' });
}
