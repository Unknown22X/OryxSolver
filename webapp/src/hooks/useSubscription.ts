import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type SubscriptionRecord = {
  createdAt: string | null;
  tier: 'free' | 'pro' | 'premium';
  status: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
  provider: string | null;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type CreditWalletRecord = {
  grantedCredits: number;
  usedCredits: number;
  remainingCredits: number;
};

export type CreditActivityRecord = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  source: string;
  createdAt: string;
};

type SubscriptionState = {
  subscription: SubscriptionRecord;
  wallet: CreditWalletRecord;
  creditActivity: CreditActivityRecord[];
};

const DEFAULT_SUBSCRIPTION: SubscriptionRecord = {
  createdAt: null,
  tier: 'free',
  status: 'inactive',
  provider: null,
  providerSubscriptionId: null,
  providerCustomerId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

const DEFAULT_WALLET: CreditWalletRecord = {
  grantedCredits: 0,
  usedCredits: 0,
  remainingCredits: 0,
};

export function useSubscription(user: User | null) {
  const [data, setData] = useState<SubscriptionState>({
    subscription: DEFAULT_SUBSCRIPTION,
    wallet: DEFAULT_WALLET,
    creditActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    if (!user) {
      setData({
        subscription: DEFAULT_SUBSCRIPTION,
        wallet: DEFAULT_WALLET,
        creditActivity: [],
      });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [subscriptionResult, walletResult, ledgerResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('created_at, tier, status, provider, provider_subscription_id, provider_customer_id, current_period_end, cancel_at_period_end')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('credit_wallets')
          .select('granted_credits, used_credits')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('credit_ledger')
          .select('id, delta, balance_after, reason, source, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (subscriptionResult.error) throw subscriptionResult.error;
      if (walletResult.error) throw walletResult.error;
      if (ledgerResult.error) throw ledgerResult.error;

      const subscription: SubscriptionRecord = subscriptionResult.data
        ? {
            createdAt: subscriptionResult.data.created_at ?? null,
            tier:
              subscriptionResult.data.tier === 'premium'
                ? 'premium'
                : subscriptionResult.data.tier === 'pro'
                  ? 'pro'
                  : 'free',
            status:
              subscriptionResult.data.status === 'active' ||
              subscriptionResult.data.status === 'trialing' ||
              subscriptionResult.data.status === 'canceled' ||
              subscriptionResult.data.status === 'past_due'
                ? subscriptionResult.data.status
                : 'inactive',
            provider: subscriptionResult.data.provider ?? null,
            providerSubscriptionId: subscriptionResult.data.provider_subscription_id ?? null,
            providerCustomerId: subscriptionResult.data.provider_customer_id ?? null,
            currentPeriodEnd: subscriptionResult.data.current_period_end ?? null,
            cancelAtPeriodEnd: Boolean(subscriptionResult.data.cancel_at_period_end),
          }
        : DEFAULT_SUBSCRIPTION;

      const grantedCredits = walletResult.data?.granted_credits ?? 0;
      const usedCredits = walletResult.data?.used_credits ?? 0;

      setData({
        subscription,
        wallet: {
          grantedCredits,
          usedCredits,
          remainingCredits: Math.max(grantedCredits - usedCredits, 0),
        },
        creditActivity: (ledgerResult.data ?? []).map((entry) => ({
          id: entry.id,
          delta: entry.delta,
          balanceAfter: entry.balance_after,
          reason: entry.reason,
          source: entry.source,
          createdAt: entry.created_at,
        })),
      });
    } catch (err) {
      console.error('Failed to load subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  return {
    subscription: data.subscription,
    wallet: data.wallet,
    creditActivity: data.creditActivity,
    loading,
    error,
    refetch: loadSubscription,
  };
}
