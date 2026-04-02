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
  const rateLimit = await checkRateLimit('/cancel-subscription', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  const apiKey = Deno.env.get('LEMON_SQUEEZY_API_KEY');
  if (!apiKey) {
    return jsonError(500, 'CONFIG_ERROR', 'Lemon Squeezy is not configured.');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('provider, provider_subscription_id, current_period_end, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriptionError) {
      return jsonError(500, 'SUBSCRIPTION_LOOKUP_FAILED', subscriptionError.message);
    }

    if (!subscription?.provider_subscription_id || subscription.provider !== 'lemon_squeezy') {
      return jsonError(404, 'SUBSCRIPTION_NOT_FOUND', 'No cancellable paid subscription was found for this account.');
    }

    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscription.provider_subscription_id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[CANCEL_SUBSCRIPTION] Lemon Squeezy error:', errorBody);
      return jsonError(502, 'CANCEL_SUBSCRIPTION_FAILED', 'Subscription could not be cancelled.');
    }

    const payload = await response.json();
    const attributes = payload?.data?.attributes ?? {};
    const currentPeriodEnd = attributes.ends_at ?? attributes.renews_at ?? subscription.current_period_end ?? null;

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      return jsonError(500, 'SUBSCRIPTION_UPDATE_FAILED', updateError.message);
    }

    return jsonOk({
      api_version: 'v1',
      ok: true,
      status: 'canceled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Subscription cancellation failed';
    return jsonError(500, 'CANCEL_SUBSCRIPTION_FAILED', message);
  }
});
