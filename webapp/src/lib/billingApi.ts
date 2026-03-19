import { fetchEdge } from './edge';
import { sanitizeExternalUrl } from './safeExternalUrl';

export type CheckoutResponse = {
  api_version: 'v1';
  ok: true;
  checkoutUrl: string;
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
