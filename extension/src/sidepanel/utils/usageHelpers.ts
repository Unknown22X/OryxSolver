import type { UsageSnapshot } from '../types';

/**
 * Normalizes usage data from the API into a standardized UsageSnapshot.
 */
export function buildUsageSnapshot(source: unknown): Partial<UsageSnapshot> {
  const usage = (source ?? {}) as Record<string, unknown>;
  const result: Partial<UsageSnapshot> = {};

  if (usage.subscriptionTier !== undefined) result.subscriptionTier = usage.subscriptionTier as any;
  if (usage.subscriptionStatus !== undefined) result.subscriptionStatus = usage.subscriptionStatus as any;
  if (usage.monthlyQuestionsUsed !== undefined) result.monthlyQuestionsUsed = usage.monthlyQuestionsUsed as number;
  if (usage.monthlyQuestionsLimit !== undefined) result.monthlyQuestionsLimit = usage.monthlyQuestionsLimit as number;
  if (usage.monthlyImagesUsed !== undefined) result.monthlyImagesUsed = usage.monthlyImagesUsed as number;
  if (usage.monthlyImagesLimit !== undefined) result.monthlyImagesLimit = usage.monthlyImagesLimit as number;
  if (usage.monthlyBulkUsed !== undefined) result.monthlyBulkUsed = usage.monthlyBulkUsed as number;
  if (usage.monthlyBulkLimit !== undefined) result.monthlyBulkLimit = usage.monthlyBulkLimit as number;
  if (usage.paygoCreditsRemaining !== undefined) result.paygoCreditsRemaining = usage.paygoCreditsRemaining as number;
  if (usage.stepQuestionsUsed !== undefined) result.stepQuestionsUsed = usage.stepQuestionsUsed as number;

  if (usage.monthlyQuestionsLimit !== undefined || usage.monthlyQuestionsUsed !== undefined || usage.monthlyQuestionsRemaining !== undefined) {
    const limit = (result.monthlyQuestionsLimit ?? 15);
    const used = (result.monthlyQuestionsUsed ?? 0);
    const over = usage.monthlyQuestionsRemaining as number | undefined;
    result.monthlyQuestionsRemaining = typeof over === 'number' ? over : (limit === -1 ? -1 : Math.max(limit - used, 0));
  }

  return result;
}

export function mergeUsageSnapshot(previous: UsageSnapshot, incoming: Partial<UsageSnapshot>): UsageSnapshot {
  return { ...previous, ...incoming };
}
