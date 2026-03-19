import { useState, useEffect, useCallback } from 'react';
import { fetchEdge } from '../lib/edge';
import type { User } from '@supabase/supabase-js';

interface UsageData {
  subscriptionTier: 'free' | 'pro' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
  monthlyQuestionsUsed: number;
  monthlyQuestionsLimit: number;
  monthlyQuestionsRemaining: number;
  stepQuestionsUsed: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  monthlyBulkUsed: number;
  monthlyBulkLimit: number;
  paygoCreditsRemaining?: number;
}

interface UseUsageReturn {
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_USAGE: UsageData = {
  subscriptionTier: 'free',
  subscriptionStatus: 'inactive',
  monthlyQuestionsUsed: 0,
  monthlyQuestionsLimit: 15,
  monthlyQuestionsRemaining: 15,
  stepQuestionsUsed: 0,
  monthlyImagesUsed: 0,
  monthlyImagesLimit: 5,
  monthlyBulkUsed: 0,
  monthlyBulkLimit: 3,
  paygoCreditsRemaining: 0,
};

export function useUsage(user: User | null): UseUsageReturn {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsage(DEFAULT_USAGE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchEdge<{
        api_version: 'v1';
        ok: true;
        profileSynced: boolean;
        usage: {
          subscriptionTier: 'free' | 'pro' | 'premium';
          subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
          monthlyQuestionsUsed: number;
          monthlyQuestionsLimit: number;
          monthlyQuestionsRemaining: number;
          stepQuestionsUsed?: number;
          monthlyImagesUsed: number;
          monthlyImagesLimit: number;
          monthlyBulkUsed: number;
          monthlyBulkLimit: number;
          paygoCreditsRemaining?: number;
        } | null;
      }>('/sync-profile', { method: 'POST' });

      if (!data.usage) {
        setUsage(DEFAULT_USAGE);
        return;
      }

      setUsage({
        subscriptionTier: data.usage.subscriptionTier,
        subscriptionStatus: data.usage.subscriptionStatus,
        monthlyQuestionsUsed: data.usage.monthlyQuestionsUsed,
        monthlyQuestionsLimit: data.usage.monthlyQuestionsLimit,
        monthlyQuestionsRemaining: data.usage.monthlyQuestionsRemaining,
        stepQuestionsUsed: data.usage.stepQuestionsUsed ?? 0,
        monthlyImagesUsed: data.usage.monthlyImagesUsed,
        monthlyImagesLimit: data.usage.monthlyImagesLimit,
        monthlyBulkUsed: data.usage.monthlyBulkUsed,
        monthlyBulkLimit: data.usage.monthlyBulkLimit,
        paygoCreditsRemaining: data.usage.paygoCreditsRemaining ?? 0,
      });
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError((err as Error).message);
      setUsage(DEFAULT_USAGE);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
  };
}
