import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/create-checkout', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  const apiKey = Deno.env.get('LEMON_SQUEEZY_API_KEY');
  if (!apiKey) {
    console.error('[BILLING_PORTAL] Billing provider configuration is missing.');
    return jsonError(503, 'BILLING_PORTAL_UNAVAILABLE', 'Billing management is temporarily unavailable.');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('provider, provider_customer_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriptionError) {
      return jsonError(500, 'SUBSCRIPTION_LOOKUP_FAILED', subscriptionError.message);
    }

    if (!subscription?.provider_customer_id || subscription.provider !== 'lemon_squeezy') {
      return jsonError(404, 'BILLING_PORTAL_UNAVAILABLE', 'No managed billing portal is available for this account yet.');
    }

    const response = await fetch(`https://api.lemonsqueezy.com/v1/customers/${subscription.provider_customer_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[BILLING_PORTAL] Lemon Squeezy error:', errorBody);
      return jsonError(502, 'BILLING_PORTAL_FAILED', 'Billing portal could not be opened.');
    }

    const payload = await response.json();
    const portalUrl = payload?.data?.attributes?.urls?.customer_portal as string | undefined;
    if (!portalUrl) {
      return jsonError(502, 'BILLING_PORTAL_FAILED', 'Billing portal URL missing in response.');
    }

    return jsonOk({
      api_version: 'v1',
      ok: true,
      portalUrl,
      status: subscription.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing portal failed';
    return jsonError(500, 'BILLING_PORTAL_FAILED', message);
  }
});
