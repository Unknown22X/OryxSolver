import type { UsageSnapshot } from '../types';

/**
 * Normalizes usage data from the API into a standardized UsageSnapshot.
 */
export function buildUsageSnapshot(source: unknown): UsageSnapshot {
  const usage = (source ?? {}) as Record<string, unknown>;
  
  const used = (usage.usedCredits ?? usage.used_credits ?? usage.creditsUsed ?? usage.credits_used ?? 0) as number;
  const stepUsed = (usage.stepQuestionsUsed ?? usage.step_questions_used ?? 0) as number;
  const total = (usage.totalCredits ?? usage.total_credits ?? usage.creditsLimit ?? usage.limit ?? 50) as number;
  const tier = (usage.subscriptionTier ?? usage.subscription_tier ?? 'free') as string;
  const status = (usage.subscriptionStatus ?? usage.subscription_status ?? 'inactive') as string;

  return {
    subscriptionTier: tier === 'pro' ? 'pro' : 'free',
    subscriptionStatus: status === 'active' ? 'active' : 'inactive',
    totalCredits: typeof total === 'number' && total > 0 ? total : 50,
    usedCredits: typeof used === 'number' && used >= 0 ? used : 0,
    monthlyImagesUsed: (usage.monthlyImagesUsed ?? usage.monthly__images_used ?? 0) as number,
    monthlyImagesLimit: 10,
    stepQuestionsUsed: stepUsed,
  };
}

/**
 * Merges current and previous usage snapshots to prevent UI regressions
 * while waiting for backend consistency.
 */
export function mergeUsageSnapshot(previous: UsageSnapshot, incoming: UsageSnapshot): UsageSnapshot {
  if (
    incoming.subscriptionTier === previous.subscriptionTier &&
    incoming.totalCredits === previous.totalCredits
  ) {
    return {
      ...incoming,
      usedCredits: Math.max(previous.usedCredits, incoming.usedCredits),
      monthlyImagesUsed: Math.max(previous.monthlyImagesUsed, incoming.monthlyImagesUsed),
      stepQuestionsUsed: Math.max(previous.stepQuestionsUsed, incoming.stepQuestionsUsed),
    };
  }
  return incoming;
}
