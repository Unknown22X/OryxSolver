import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type UsageEventType = 'solve' | 'image_vision' | 'bulk_solve' | 'step_followup';

export async function recordUsageEvent(
  supabase: SupabaseClient,
  userId: string,
  type: UsageEventType,
  creditsSpent: number,
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase.from('usage_events').insert({
    user_id: userId,
    event_type: type,
    credits_spent: creditsSpent,
    metadata: metadata
  });

  if (error) {
    console.error(`[USAGE] Failed to record usage event: ${error.message}`);
  }
}
