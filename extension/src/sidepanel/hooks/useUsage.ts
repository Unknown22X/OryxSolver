import { useState, useCallback, useMemo } from 'react';
import { getApiUrl } from '../services/apiConfig';
import { getAccessToken } from '../auth/supabaseAuthClient';
import { buildUsageSnapshot, mergeUsageSnapshot } from '../utils/usageHelpers';
import { getPlanUsageMetric } from '../utils/usagePresentation';
import type { UsageSnapshot, UpgradeMoment } from '../types';

const INITIAL_USAGE: UsageSnapshot = {
  subscriptionTier: 'free',
  subscriptionStatus: 'inactive',
  monthlyQuestionsUsed: 0,
  monthlyQuestionsLimit: 15,
  monthlyQuestionsRemaining: 15,
  monthlyImagesUsed: 0,
  monthlyImagesLimit: 5,
  monthlyBulkUsed: 0,
  monthlyBulkLimit: 3,
  paygoCreditsRemaining: 0,
  stepQuestionsUsed: 0,
};

export function useUsage() {
  const [usage, setUsage] = useState<UsageSnapshot>(INITIAL_USAGE);

  const syncProfile = useCallback(async () => {
    const apiUrl = getApiUrl('/sync-profile', import.meta.env.VITE_SYNC_PROFILE_API_URL);
    if (!apiUrl) {
      console.warn('VITE_SYNC_PROFILE_API_URL is not set. Skipping profile sync.');
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const dataJson = await res.json();
        if (dataJson?.usage) {
          const nextUsage = buildUsageSnapshot(dataJson.usage);
          setUsage((prev) => mergeUsageSnapshot(prev, nextUsage));
        }
      }
    } catch (error) {
      console.error('Profile sync failed:', error);
    }
  }, []);

  const resetUsage = useCallback(() => setUsage(INITIAL_USAGE), []);

  const questionUsage = getPlanUsageMetric(usage.monthlyQuestionsUsed, usage.monthlyQuestionsLimit);
  const imageUsage = getPlanUsageMetric(usage.monthlyImagesUsed, usage.monthlyImagesLimit);
  const effectiveUsagePercent = Math.max(
    Math.min(questionUsage.percentUsed, 100),
    Math.min(imageUsage.percentUsed, 100),
  );

  const upgradeMoment = useMemo<UpgradeMoment>(() => {
    if (usage.subscriptionTier === 'pro' || usage.subscriptionTier === 'premium') {
      return { level: null, percent: effectiveUsagePercent, title: '', message: '' };
    }

    const hasNoCredits = (usage.paygoCreditsRemaining || 0) <= 0;

    if (effectiveUsagePercent >= 100 && hasNoCredits) {
      return {
        level: 'paywall',
        percent: effectiveUsagePercent,
        title: 'Free limit reached',
        message: `You've used your free questions this month. Upgrade to Pro or Premium for more usage.`,
      };
    }

    if (effectiveUsagePercent >= 90 && hasNoCredits) {
      return {
        level: 'strong',
        percent: effectiveUsagePercent,
        title: 'Almost out of free usage',
        message: 'You are close to your monthly free limit. Upgrade to Pro for higher limits.',
      };
    }

    if (effectiveUsagePercent >= 70 && hasNoCredits) {
      return {
        level: 'soft',
        percent: effectiveUsagePercent,
        title: 'Heads up',
        message: 'You have used most of your free usage. Upgrade to Pro for more room.',
      };
    }

    return { level: null, percent: effectiveUsagePercent, title: '', message: '' };
  }, [effectiveUsagePercent, usage]);

  return {
    usage,
    setUsage,
    syncProfile,
    resetUsage,
    upgradeMoment,
    effectiveUsagePercent
  };
}
