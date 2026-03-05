import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifyFirebaseIdToken } from '../_shared/auth.ts';
import { createSupabaseUserClient } from '../_shared/db.ts';
import { getProfileForSolve, upsertProfileFromFirebaseUser } from '../_shared/profile.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const user = await verifyFirebaseIdToken(token);
    const supabase = createSupabaseUserClient(token);

    if (!user.emailVerified) {
      return new Response(JSON.stringify({ error: 'Email not verified' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await upsertProfileFromFirebaseUser(supabase, user);
    const profile = await getProfileForSolve(supabase, user.localId);

    return new Response(
        JSON.stringify({
         ok : true, 
         profileSynced : true,
         profile: profile
          ? {
            subscriptionTier: profile.subscription_tier ?? 'free',
            subscriptionStatus: profile.subscription_status ?? 'inactive',
            totalCredits: profile.all_credits && profile.all_credits > 0 ? profile.all_credits : 50,
            usedCredits: profile.used_credits ?? 0,
            monthlyImagesUsed: profile.monthly_images_used ?? 0,
            monthlyImagesLimit: 10,
          }
          : null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile sync failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
