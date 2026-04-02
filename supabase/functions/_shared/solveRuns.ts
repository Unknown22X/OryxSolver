import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SolveRunLog = {
  authUserId: string;
  mode: 'normal' | 'fast_fallback';
  styleMode: string;
  model?: string | null;
  latencyMs: number;
  status: 'success' | 'error';
  errorCode?: string | null;
  usedFallback: boolean;
  extractionQaWarnings?: string[];
  originalQuestion?: string;
};

export async function logSolveRun(
  supabase: SupabaseClient,
  log: SolveRunLog,
): Promise<void> {
  const { error } = await supabase.from('solve_runs').insert({
    auth_user_id: log.authUserId,
    mode: log.mode,
    style_mode: log.styleMode,
    model: log.model ?? null,
    latency_ms: Math.max(0, Math.round(log.latencyMs)),
    status: log.status,
    error_code: log.errorCode ?? null,
    used_fallback: log.usedFallback,
    extraction_qa_warnings: log.extractionQaWarnings ?? [],
    original_question: log.originalQuestion ?? null,
  });

  if (error) {
    throw new Error(`Solve run log failed: ${error.message}`);
  }
}
