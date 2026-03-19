import type { UsageSnapshot } from '../types';

/**
 * Normalizes usage data from the API into a standardized UsageSnapshot.
 */
export function buildUsageSnapshot(source: unknown): UsageSnapshot {
  const usage = (source ?? {}) as Record<string, unknown>;

  const questionsUsed = (usage.monthlyQuestionsUsed ?? 0) as number;
  const stepUsed = (usage.stepQuestionsUsed ?? 0) as number;
  const questionsLimit = (usage.monthlyQuestionsLimit ?? 15) as number;
  const tier = (usage.subscriptionTier ?? 'free') as string;
  const status = (usage.subscriptionStatus ?? 'inactive') as string;
  const remainingOverride = usage.monthlyQuestionsRemaining as number | undefined;
  const remaining =
    typeof remainingOverride === 'number'
      ? remainingOverride
      : questionsLimit === -1
        ? -1
        : Math.max(questionsLimit - questionsUsed, 0);

  return {
    subscriptionTier: tier === 'premium' ? 'premium' : tier === 'pro' ? 'pro' : 'free',
    subscriptionStatus: status === 'active' || status === 'trialing' ? 'active' : status === 'canceled' ? 'canceled' : status === 'past_due' ? 'past_due' : 'inactive',
    monthlyQuestionsUsed: typeof questionsUsed === 'number' && questionsUsed >= 0 ? questionsUsed : 0,
    monthlyQuestionsLimit: typeof questionsLimit === 'number' ? questionsLimit : 15,
    monthlyQuestionsRemaining: remaining,
    monthlyImagesUsed: (usage.monthlyImagesUsed ?? 0) as number,
    monthlyImagesLimit: (usage.monthlyImagesLimit ?? 5) as number,
    monthlyBulkUsed: (usage.monthlyBulkUsed ?? 0) as number,
    monthlyBulkLimit: (usage.monthlyBulkLimit ?? 3) as number,
    paygoCreditsRemaining: (usage.paygoCreditsRemaining ?? 0) as number,
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
    incoming.monthlyQuestionsLimit === previous.monthlyQuestionsLimit
  ) {
    return {
      ...incoming,
      monthlyQuestionsUsed: Math.max(previous.monthlyQuestionsUsed, incoming.monthlyQuestionsUsed),
      monthlyQuestionsRemaining:
        incoming.monthlyQuestionsLimit === -1
          ? -1
          : Math.max(incoming.monthlyQuestionsLimit - Math.max(previous.monthlyQuestionsUsed, incoming.monthlyQuestionsUsed), 0),
      monthlyImagesUsed: Math.max(previous.monthlyImagesUsed, incoming.monthlyImagesUsed),
      stepQuestionsUsed: Math.max(previous.stepQuestionsUsed, incoming.stepQuestionsUsed),
    };
  }
  return incoming;
}
