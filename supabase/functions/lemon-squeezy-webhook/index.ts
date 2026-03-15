import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

function verifyLemonSqueezySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const encoder = new TextEncoder();
  const key = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return signature === expectedSignature;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('LEMON_SQUEEZY_SECRET');
  if (!secret) {
    console.error('LEMON_SQUEEZY_SECRET not configured');
    return jsonError(500, 'CONFIG_ERROR', 'Webhook secret not configured');
  }

  const signature = req.headers.get('x-signature') || '';
  const bodyText = await req.text();

  if (!verifyLemonSqueezySignature(bodyText, signature, secret)) {
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
  const customData = payload.meta?.custom_data;
  const subscription = payload.data?.attributes;

  if (!subscription) {
    console.log('No subscription data in payload');
    return jsonOk({ received: true });
  }

  const supabase = createSupabaseAdminClient();

  try {
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const customerId = String(subscription.customer_id || '');
      const status = subscription.status;
      const isActive = status === 'active' || status === 'trialing';
      const userId = customData?.user_id;

      // 1. Try updating by customerId first (standard case)
      let { error, data } = await supabase
        .from('profiles')
        .update({
          subscription_tier: isActive ? 'pro' : 'free',
          subscription_status: status,
          lemon_customer_id: customerId,
        })
        .eq('lemon_customer_id', customerId)
        .select();

      // 2. If no user found by customerId, try updating by the passed user_id metadata
      if (!error && (!data || data.length === 0) && userId) {
        console.log(`No user found with customerId ${customerId}. Trying userId ${userId} from metadata.`);
        const { error: error2 } = await supabase
          .from('profiles')
          .update({
            subscription_tier: isActive ? 'pro' : 'free',
            subscription_status: status,
            lemon_customer_id: customerId,
          })
          .eq('auth_user_id', userId);
        
        if (error2) throw error2;
      } else if (error) {
        throw error;
      }

      console.log(`Updated user for customer ${customerId} to ${isActive ? 'pro' : 'free'}`);
    }

    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      const customerId = String(subscription.customer_id || '');

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'canceled',
        })
        .eq('lemon_customer_id', customerId);

      if (error) throw error;
      console.log(`Downgraded customer ${customerId} to free`);
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
    return jsonError(500, 'PROCESSING_ERROR', 'Error processing webhook');
  }

  return jsonOk({ received: true });
});
