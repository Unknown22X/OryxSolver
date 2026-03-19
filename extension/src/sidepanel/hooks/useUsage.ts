import { useState, useCallback, useMemo } from 'react';
import { getApiUrl } from '../services/apiConfig';
import { getAccessToken } from '../auth/supabaseAuthClient';
import { buildUsageSnapshot, mergeUsageSnapshot } from '../utils/usageHelpers';
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

  const creditUsagePercent = usage.monthlyQuestionsLimit > 0
    ? (usage.monthlyQuestionsUsed / usage.monthlyQuestionsLimit) * 100
    : 0;
  const imageUsagePercent = usage.monthlyImagesLimit > 0
    ? (usage.monthlyImagesUsed / usage.monthlyImagesLimit) * 100
    : 0;
  const effectiveUsagePercent = Math.max(creditUsagePercent, imageUsagePercent);

  const upgradeMoment = useMemo<UpgradeMoment>(() => {
    if (usage.subscriptionTier === 'pro' || usage.subscriptionTier === 'premium') {
      return { level: null, percent: effectiveUsagePercent, title: '', message: '' };
    }

    if (effectiveUsagePercent >= 100) {
      return {
        level: 'paywall',
        percent: effectiveUsagePercent,
        title: 'Free limit reached',
        message: `You've used your free questions this month. Upgrade to Pro or Premium for more usage.`,
      };
    }

    if (effectiveUsagePercent >= 90) {
      return {
        level: 'strong',
        percent: effectiveUsagePercent,
        title: 'Almost out of free usage',
        message: 'You are close to your monthly free limit. Upgrade to Pro for higher limits.',
      };
    }

    if (effectiveUsagePercent >= 70) {
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
