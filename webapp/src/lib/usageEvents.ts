export interface UsageEventPayload {
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
}

export const USAGE_UPDATED_EVENT = 'oryx:usage-updated';
export const USAGE_REFRESH_EVENT = 'oryx:usage-refresh';

export function broadcastUsageUpdated(usage: UsageEventPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<UsageEventPayload>(USAGE_UPDATED_EVENT, { detail: usage }));
}

export function requestUsageRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(USAGE_REFRESH_EVENT));
}
