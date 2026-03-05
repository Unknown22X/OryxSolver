import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Webhooks } from "npm:@polar-sh/supabase";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// Use service-role client to update profile subscription fields from webhook events.
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

const polarWebhooks = Webhooks({
  webhookSecret: Deno.env.get("POLAR_WEBHOOK_SECRET") || "",

  onPayload: async (payload) => {
    console.log("Received Polar webhook:", payload.type);
    try {
      if (payload.type === "subscription.created" || payload.type === "subscription.updated") {
        const subscription = payload.data;
        const userId = subscription.customer_id;

        if (!userId) {
          console.error("No user ID found in subscription data");
          return;
        }
        const { error } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'pro',
              subscription_status: subscription.status,
              polar_customer_id: subscription.customer_id
            })
            .eq('id', userId);
        if (error) throw error;
        console.log(`Successfully upgraded user ${userId} to Pro.`);
      }

      if (payload.type === "subscription.canceled") {
        const subscription = payload.data;
        const userId = subscription.customer_id;
        const { error } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled'
            })
            .eq('id', userId);
        if (error) throw error;
        console.log(`Downgraded user ${userId} to Free.`);
      }
    } catch (err) {
      console.error("Error updating database:", err);
    }
  }
});

serve(async (req) => {
  try {
    return await polarWebhooks(req);
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Webhook Error", { status: 400 });
  }
});
