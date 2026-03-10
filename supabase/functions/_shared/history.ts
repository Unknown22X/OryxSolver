import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function saveHistoryEntry(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    question: string;
    answer: string;
    source?: string;
  },
): Promise<{ saved: boolean; id: string | null }> {
  const { authUserId, question, answer, source = 'extension' } = params;

  const { data, error } = await supabase
    .from('history_entries')
    .insert({
      user_id: authUserId,
      question,
      answer,
      source,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    return { saved: false, id: null };
  }

  return { saved: true, id: data?.id ?? null };
}
