import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { hasValidInternalToken } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  if (!hasValidInternalToken(req)) {
    return jsonError(401, 'UNAUTHORIZED_INTERNAL_CALL', 'Unauthorized');
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from('questions_cache').select('id').limit(1);
  
  if (error && error.code === '42P01') {
    console.log('Creating questions_cache table...');
    
    await supabase.rpc('exec_sql', {
      query: `CREATE TABLE IF NOT EXISTS public.questions_cache (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        question_normalized text NOT NULL UNIQUE,
        question_text text NOT NULL,
        answer text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`
    });
    
    await supabase.rpc('exec_sql', {
      query: `CREATE INDEX IF NOT EXISTS idx_questions_cache_normalized ON public.questions_cache (question_normalized)`
    });
    
    await supabase.rpc('exec_sql', {
      query: `ALTER TABLE public.questions_cache ENABLE ROW LEVEL SECURITY`
    });

    await supabase.rpc('exec_sql', {
      query: `DROP POLICY IF EXISTS "questions_cache_read" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_insert" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_public_read" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_public_insert" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_service_read" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_service_insert" ON public.questions_cache;
      DROP POLICY IF EXISTS "questions_cache_service_access" ON public.questions_cache;
      CREATE POLICY "questions_cache_service_access" ON public.questions_cache
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true)`
    });
    
    return jsonOk({ ok: true, message: 'Table created' });
  }
  
  return jsonOk({ ok: true, message: 'Table already exists' });
});
