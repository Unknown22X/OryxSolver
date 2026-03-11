import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { getProfileForSolve, upsertProfileFromAuthUser } from '../_shared/profile.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    const supabase = createSupabaseUserClient(token);
    const supabaseAdmin = createSupabaseAdminClient();

    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    // Trusted backend path: after token verification, upsert protected
    // profile fields via service_role (bypasses column-level grants).
    await upsertProfileFromAuthUser(supabaseAdmin, user);

    // Read back profile via user-scoped client to respect RLS.
    const profile = await getProfileForSolve(supabase, user.id);

    return jsonOk({
      api_version: 'v1',
      ok: true,
      profileSynced: true,
      profile: profile
        ? {
            subscriptionTier: profile.subscription_tier ?? 'free',
            subscriptionStatus: profile.subscription_status ?? 'inactive',
            totalCredits:
              profile.all_credits && profile.all_credits > 0 ? profile.all_credits : 50,
            usedCredits: profile.used_credits ?? 0,
            monthlyImagesUsed: profile.monthly_images_used ?? 0,
            monthlyImagesLimit: 10,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile sync failed';
    return jsonError(500, 'SYNC_PROFILE_FAILED', message);
  }
});
