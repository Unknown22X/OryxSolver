import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type UsageEventType = 'solve' | 'image_vision' | 'bulk_solve' | 'step_followup';
export type PlanTier = 'free' | 'pro' | 'premium';

export type PlanLimits = {
  questions: number;
  images: number;
  bulk: number;
};

export type MonthlyUsage = {
  monthStart: string;
  questionsUsed: number;
  imagesUsed: number;
  bulkUsed: number;
  stepQuestionsUsed: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { questions: 15, images: 5, bulk: 3 },
  pro: { questions: 100, images: 50, bulk: 15 },
  premium: { questions: 500, images: 200, bulk: 30 },
};

export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

export function currentMonthStartIsoDate(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString();
}

export async function getMonthlyUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<MonthlyUsage> {
  const monthStart = currentMonthStartIsoDate();

  const { data, error } = await supabase
    .from('usage_events')
    .select('event_type, credits_spent')
    .eq('user_id', userId)
    .gte('created_at', monthStart);

  if (error) {
    console.error(`[USAGE] Failed to read usage events: ${error.message}`);
    return {
      monthStart,
      questionsUsed: 0,
      imagesUsed: 0,
      bulkUsed: 0,
      stepQuestionsUsed: 0,
    };
  }

  let questionsUsed = 0;
  let imagesUsed = 0;
  let bulkUsed = 0;
  let stepQuestionsUsed = 0;

  for (const event of data ?? []) {
    const creditsSpent = typeof event.credits_spent === 'number' ? event.credits_spent : 1;
    switch (event.event_type) {
      case 'solve':
        questionsUsed += creditsSpent || 1;
        break;
      case 'bulk_solve':
        bulkUsed += creditsSpent || 1;
        questionsUsed += creditsSpent || 1;
        break;
      case 'image_vision':
        imagesUsed += creditsSpent || 0;
        break;
      case 'step_followup':
        stepQuestionsUsed += creditsSpent || 1;
        questionsUsed += creditsSpent || 1; // Correctly count follow-ups towards question quota
        break;
      default:
        break;
    }
  }

  return { monthStart, questionsUsed, imagesUsed, bulkUsed, stepQuestionsUsed };
}

export async function recordUsageEvent(
  supabase: SupabaseClient,
  userId: string,
  type: UsageEventType,
  units: number,
  metadata: Record<string, any> = {},
  costUsd: number = 0,
) {
  const { error } = await supabase.from('usage_events').insert({
    user_id: userId,
    event_type: type,
    credits_spent: units,
    metadata: metadata,
    cost_usd: costUsd,
  });

  if (error) {
    console.error(`[USAGE] Failed to record usage event: ${error.message}`);
  }
}
