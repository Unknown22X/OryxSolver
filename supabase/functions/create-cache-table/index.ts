import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonOk } from '../_shared/http.ts';

Deno.serve(async () => {
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
    
    return jsonOk({ ok: true, message: 'Table created' });
  }
  
  return jsonOk({ ok: true, message: 'Table already exists' });
});
