import { fetchEdge } from './edge';
import { sanitizeExternalUrl } from './safeExternalUrl';

export type CheckoutResponse = {
  api_version: 'v1';
  ok: true;
  checkoutUrl: string;
};

type BillingPortalResponse = {
  api_version: 'v1';
  ok: true;
  portalUrl: string;
};

type CancelSubscriptionResponse = {
  api_version: 'v1';
  ok: true;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export async function createCheckout(plan: string): Promise<string> {
  const res = await fetchEdge<CheckoutResponse>('/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  const checkoutUrl = sanitizeExternalUrl(res.checkoutUrl);
  if (!checkoutUrl) {
    throw new Error('Received an invalid checkout URL from the billing service.');
  }
  return checkoutUrl;
}

export async function createBillingPortalSession(): Promise<string> {
  const res = await fetchEdge<BillingPortalResponse>('/create-billing-portal', {
    method: 'POST',
  });
  const portalUrl = sanitizeExternalUrl(res.portalUrl);
  if (!portalUrl) {
    throw new Error('Received an invalid billing portal URL from the billing service.');
  }
  return portalUrl;
}

export async function cancelSubscription(): Promise<CancelSubscriptionResponse> {
  return fetchEdge<CancelSubscriptionResponse>('/cancel-subscription', {
    method: 'POST',
  });
}
