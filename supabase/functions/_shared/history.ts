import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function saveHistoryEntry(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    question: string;
    answer: string;
    explanation?: string;
    source?: string;
    conversationId?: string;
    styleMode?: string;
    image_urls?: string[];
    is_bulk?: boolean;
    steps?: string[];
  },
): Promise<{ saved: boolean; id: string | null }> {
  const { authUserId, question, answer, source = 'extension' } = params;

  const { data, error } = await supabase
    .from('history_entries')
    .insert({
      user_id: authUserId,
      question,
      answer,
      explanation: params.explanation,
      source,
      conversation_id: params.conversationId,
      style_mode: params.styleMode,
      image_urls: params.image_urls || [],
      is_bulk: params.is_bulk || false,
      steps: params.steps ?? [],
      created_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    return { saved: false, id: null };
  }

  return { saved: true, id: data?.id ?? null };
}
