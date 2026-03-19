import '@supabase/functions-js/edge-runtime.d.ts';
import { grantPaygoCredits } from '../_shared/creditWallet.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { sha256Hex, timingSafeEqual } from '../_shared/security.ts';

async function computeSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function resolveUserId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customUserId: string | undefined,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<string | null> {
  if (customUserId) return customUserId;

  if (subscriptionId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('provider', 'lemon_squeezy')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();
    if (data?.user_id) return String(data.user_id);
  }

  if (customerId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('provider', 'lemon_squeezy')
      .eq('provider_customer_id', customerId)
      .maybeSingle();
    if (data?.user_id) return String(data.user_id);
  }

  return null;
}

function resolveTierFromVariant(variantId: string | number | null | undefined): 'free' | 'pro' | 'premium' {
  const proVariant = Deno.env.get('LEMON_SQUEEZY_VARIANT_PRO');
  const premiumVariant = Deno.env.get('LEMON_SQUEEZY_VARIANT_PREMIUM');
  if (variantId && premiumVariant && String(variantId) === String(premiumVariant)) return 'premium';
  if (variantId && proVariant && String(variantId) === String(proVariant)) return 'pro';
  return 'free';
}

function creditsFromPlan(plan: string | null | undefined): number {
  if (!plan || !plan.startsWith('credits_')) return 0;
  const count = Number(plan.split('_')[1]);
  return Number.isFinite(count) ? count : 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('LEMON_SQUEEZY_SECRET');
  if (!secret) {
    console.error('LEMON_SQUEEZY_SECRET not configured');
    return jsonError(500, 'CONFIG_ERROR', 'Webhook secret not configured');
  }

  const signatureHeader = req.headers.get('x-signature') || '';
  const bodyText = await req.text();

  const expectedSignature = await computeSignature(bodyText, secret);
  if (!signatureHeader || !timingSafeEqual(signatureHeader, expectedSignature)) {
    console.error('Invalid webhook signature');
    return jsonError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Invalid JSON payload');
  }

  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data ?? {};
  const data = payload.data?.attributes;
  const dataId = payload.data?.id ?? null;

  if (!data) {
    return jsonOk({ received: true });
  }

  const supabase = createSupabaseAdminClient();
  const payloadHash = await sha256Hex(bodyText);
  const subscriptionId = dataId ? String(dataId) : null;
  const customerId = data?.customer_id ? String(data.customer_id) : null;

  const { data: webhookRow, error: webhookError } = await supabase
    .from('billing_webhook_events')
    .insert({
      provider: 'lemon_squeezy',
      event_name: String(eventName ?? 'unknown'),
      payload_hash: payloadHash,
      resource_type: payload.data?.type ? String(payload.data.type) : null,
      resource_id: subscriptionId,
      status: 'processing',
    })
    .select('id')
    .maybeSingle();

  if (webhookError) {
    if (webhookError.code === '23505') {
      return jsonOk({ received: true, duplicate: true });
    }
    console.error('Failed to persist webhook event:', webhookError);
    return jsonError(500, 'WEBHOOK_PERSIST_FAILED', 'Unable to persist webhook event');
  }

  const webhookEventId = webhookRow?.id ?? null;

  try {
    const userId = await resolveUserId(
      supabase,
      typeof customData.user_id === 'string' ? customData.user_id : undefined,
      subscriptionId,
      customerId,
    );

    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const variantId = data.variant_id ?? null;
      const status = data.status ?? 'inactive';
      const tierFromPlan = customData.plan ? (customData.plan === 'premium' ? 'premium' : customData.plan === 'pro' ? 'pro' : null) : null;
      const tier = tierFromPlan ?? resolveTierFromVariant(variantId);

      if (userId) {
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            status,
            tier,
            provider: 'lemon_squeezy',
            provider_subscription_id: subscriptionId,
            provider_customer_id: customerId,
            current_period_end: data.renews_at ?? data.ends_at ?? null,
            cancel_at_period_end: !!data.cancelled,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) throw error;
      }
    }

    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      if (userId) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            tier: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) throw error;
      }
    }

    if (eventName === 'order_created') {
      const plan = customData.plan as string | undefined;
      const creditsToAdd = creditsFromPlan(plan ?? null);
      if (userId && creditsToAdd > 0) {
        await grantPaygoCredits(supabase, userId, creditsToAdd, 'purchase', 'lemon_squeezy', {
          eventName,
          orderId: dataId,
          plan: plan ?? null,
        });
      }
    }

    if (webhookEventId) {
      await supabase
        .from('billing_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', webhookEventId);
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
    if (webhookEventId) {
      const errorMessage = err instanceof Error ? err.message.slice(0, 1000) : 'Unknown webhook processing error';
      await supabase
        .from('billing_webhook_events')
        .update({
          status: 'failed',
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId);
    }
    return jsonError(500, 'PROCESSING_ERROR', 'Error processing webhook');
  }

  return jsonOk({ received: true });
});
