import { supabase } from './supabaseClient';

export async function submitFeedback(params: {
  conversationId: string;
  rating: number; // 1-5
  comment?: string;
}) {
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('feedback')
    .upsert({
      user_id: user.id,
      conversation_id: params.conversationId,
      rating: params.rating,
      comment: params.comment || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id, conversation_id',
    });

  if (error) {
    console.error('Failed to submit feedback:', error);
    throw error;
  }
}
