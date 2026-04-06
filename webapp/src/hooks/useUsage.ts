import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchEdge } from '../lib/edge';
import { toPublicErrorMessage } from '../lib/supabaseAuth';
import {
  USAGE_REFRESH_EVENT,
  USAGE_UPDATED_EVENT,
  type UsageEventPayload,
} from '../lib/usageEvents';
import type { User } from '@supabase/supabase-js';

export interface UsageData {
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

function toUsageData(usage?: Partial<UsageEventPayload> | null): UsageData {
  if (!usage) return DEFAULT_USAGE;

  return {
    subscriptionTier: usage.subscriptionTier ?? DEFAULT_USAGE.subscriptionTier,
    subscriptionStatus: usage.subscriptionStatus ?? DEFAULT_USAGE.subscriptionStatus,
    monthlyQuestionsUsed: usage.monthlyQuestionsUsed ?? DEFAULT_USAGE.monthlyQuestionsUsed,
    monthlyQuestionsLimit: usage.monthlyQuestionsLimit ?? DEFAULT_USAGE.monthlyQuestionsLimit,
    monthlyQuestionsRemaining: usage.monthlyQuestionsRemaining ?? DEFAULT_USAGE.monthlyQuestionsRemaining,
    stepQuestionsUsed: usage.stepQuestionsUsed ?? DEFAULT_USAGE.stepQuestionsUsed,
    monthlyImagesUsed: usage.monthlyImagesUsed ?? DEFAULT_USAGE.monthlyImagesUsed,
    monthlyImagesLimit: usage.monthlyImagesLimit ?? DEFAULT_USAGE.monthlyImagesLimit,
    monthlyBulkUsed: usage.monthlyBulkUsed ?? DEFAULT_USAGE.monthlyBulkUsed,
    monthlyBulkLimit: usage.monthlyBulkLimit ?? DEFAULT_USAGE.monthlyBulkLimit,
    paygoCreditsRemaining: usage.paygoCreditsRemaining ?? DEFAULT_USAGE.paygoCreditsRemaining,
  };
}

export function useUsage(user: User | null): UseUsageReturn {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastKnownUsageRef = useRef<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsage(DEFAULT_USAGE);
      lastKnownUsageRef.current = DEFAULT_USAGE;
      setError(null);
      setLoading(false);
      return;
    }

    setLoading((prev) => lastKnownUsageRef.current === null || prev);
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

      if (!data?.usage) {
        const fallback = lastKnownUsageRef.current ?? DEFAULT_USAGE;
        setUsage(fallback);
        lastKnownUsageRef.current = fallback;
        setError('Usage data is temporarily unavailable.');
        return;
      }

      const nextUsage = toUsageData(data.usage);
      lastKnownUsageRef.current = nextUsage;
      setUsage(nextUsage);
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError(toPublicErrorMessage(err, 'Usage data is temporarily unavailable.'));
      const fallback = lastKnownUsageRef.current ?? DEFAULT_USAGE;
      setUsage(fallback);
      lastKnownUsageRef.current = fallback;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    const handleUsageUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UsageEventPayload>).detail;
      const nextUsage = toUsageData(detail);
      lastKnownUsageRef.current = nextUsage;
      setUsage(nextUsage);
      setError(null);
      setLoading(false);
    };

    const handleUsageRefresh = () => {
      void fetchUsage();
    };

    window.addEventListener(USAGE_UPDATED_EVENT, handleUsageUpdated as EventListener);
    window.addEventListener(USAGE_REFRESH_EVENT, handleUsageRefresh);
    window.addEventListener('focus', handleUsageRefresh);

    return () => {
      window.removeEventListener(USAGE_UPDATED_EVENT, handleUsageUpdated as EventListener);
      window.removeEventListener(USAGE_REFRESH_EVENT, handleUsageRefresh);
      window.removeEventListener('focus', handleUsageRefresh);
    };
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage,
  };
}
