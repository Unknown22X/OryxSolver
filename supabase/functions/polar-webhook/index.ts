/**
 * Polar Webhook Handler
 *
 * Receives subscription lifecycle events from Polar.sh and updates the
 * user's profile accordingly. Uses service_role client to bypass RLS
 * since webhook calls don't carry a user JWT.
 *
 * Portability note: If migrating from Supabase, replace the Supabase
 * client calls with your own database adapter.
 */
import '@supabase/functions-js/edge-runtime.d.ts';
import { Webhooks } from 'npm:@polar-sh/supabase';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

const polarWebhooks = Webhooks({
  webhookSecret: Deno.env.get('POLAR_WEBHOOK_SECRET') || '',

  onPayload: async (payload) => {
    console.log('Received Polar webhook:', payload.type);
    const supabase = createSupabaseAdminClient();

    try {
      if (
        payload.type === 'subscription.created' ||
        payload.type === 'subscription.updated'
      ) {
        const subscription = payload.data;
        const customerId = subscription.customer_id;

        if (!customerId) {
          console.error('No customer_id found in subscription data');
          return;
        }

        // Look up user by paddle_customer_id (stored during checkout flow).
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'pro',
            subscription_status: subscription.status,
            paddle_customer_id: customerId,
          })
          .eq('paddle_customer_id', customerId);

        if (error) throw error;
        console.log(`Successfully upgraded customer ${customerId} to Pro.`);
      }

      if (payload.type === 'subscription.canceled') {
        const subscription = payload.data;
        const customerId = subscription.customer_id;

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
          })
          .eq('paddle_customer_id', customerId);

        if (error) throw error;
        console.log(`Downgraded customer ${customerId} to Free.`);
      }
    } catch (err) {
      console.error('Error updating database:', err);
    }
  },
});

Deno.serve(async (req) => {
  try {
    return await polarWebhooks(req);
  } catch (error) {
    console.error('Webhook processing error:', error);
    return jsonError(400, 'WEBHOOK_ERROR', 'Webhook processing failed');
  }
});
