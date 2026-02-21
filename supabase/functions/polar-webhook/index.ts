import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Webhooks } from "npm:@polar-sh/supabase";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// 1. Initialize Supabase Admin Client
// We use the SERVICE_ROLE_KEY because this function needs permission
// to bypass Row Level Security (RLS) to update any user's profile.
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);
// 2. Initialize Polar Webhooks Handler
const polarWebhooks = Webhooks({
  webhookSecret: Deno.env.get("POLAR_WEBHOOK_SECRET") || "",

  // This function triggers whenever Polar sends a valid event
  onPayload: async (payload) => {
    console.log("Received Polar webhook:", payload.type);
    try {
      // 3. Handle Subscription Creation / Updates
      if (payload.type === "subscription.created" || payload.type === "subscription.updated") {
        const subscription = payload.data;

        // Polar allows you to attach custom metadata to checkouts.
        // We will pass the Clerk user ID as 'customer_id' or in metadata during checkout
        // so we know which user to update in Supabase.
        const userId = subscription.customer_id; // (Adjust based on how you pass the Clerk ID)

        if (!userId) {
          console.error("No user ID found in subscription data");
          return;
        }
        // Update the user's profile to 'pro' status
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

      // 4. Handle Subscription Cancellations
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
      // We don't throw here because we still want to return a 200 to Polar
      // so they know we received it, even if our DB update failed temporarily.
    }
  }
});
// 5. Start the server
serve(async (req) => {
  try {
    // The Polar utility automatically handles parsing the request,
    // validating the cryptographic signature, and calling our onPayload function.
    return await polarWebhooks(req);
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Webhook Error", { status: 400 });
  }
});
