import type { UsageSnapshot } from '../types';

type UsageMetric = {
  percentUsed: number;
  percentLabel: string;
  progressWidth: string;
  isUnlimited: boolean;
  isExhausted: boolean;
};

export function getPlanUsageMetric(
  used: number,
  limit: number,
  formatter?: (value: number) => string,
): UsageMetric {
  const isUnlimited = limit === -1;
  if (isUnlimited || limit <= 0) {
    return {
      percentUsed: 0,
      percentLabel: 'Unlimited',
      progressWidth: '100%',
      isUnlimited: true,
      isExhausted: false,
    };
  }

  const rawPercent = (used / limit) * 100;
  const percentUsed = Number.isFinite(rawPercent) ? Math.max(rawPercent, 0) : 0;
  const rounded = Math.min(Math.round(percentUsed), 100);

  return {
    percentUsed,
    percentLabel: formatter ? formatter(rounded) : `${rounded}% used`,
    progressWidth: `${Math.min(percentUsed, 100)}%`,
    isUnlimited: false,
    isExhausted: used >= limit,
  };
}

export function getUsageSummary(usage: UsageSnapshot, formatter?: (value: number) => string) {
  return getPlanUsageMetric(
    usage.monthlyQuestionsUsed,
    usage.monthlyQuestionsLimit,
    formatter,
  );
}
