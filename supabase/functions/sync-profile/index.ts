import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { getPaygoCreditsRemaining } from '../_shared/creditWallet.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { getProfileForSolve, getUserSubscription, upsertProfileFromAuthUser } from '../_shared/profile.ts';
import { getMonthlyUsage, getPlanLimits, isUnlimited } from '../_shared/usage.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/sync-profile', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
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

    const profile = await getProfileForSolve(supabase, user.id);
    const subscription = await getUserSubscription(supabase, user.id);
    const rawTier = (subscription.tier ?? 'free') as 'free' | 'pro' | 'premium';
    const rawStatus = subscription.status ?? 'inactive';
    const isActiveSubscription = rawStatus === 'active' || rawStatus === 'trialing';
    const tier = isActiveSubscription
      ? (rawTier === 'premium' ? 'premium' : rawTier === 'pro' ? 'pro' : 'free')
      : 'free';
    const status = isActiveSubscription ? rawStatus : 'inactive';
    const limits = getPlanLimits(tier);
    const monthlyUsage = await getMonthlyUsage(supabaseAdmin, user.id);
    const paygoRemaining = await getPaygoCreditsRemaining(supabaseAdmin, user.id);

    return jsonOk({
      api_version: 'v1',
      ok: true,
      profileSynced: true,
      usage: profile
        ? {
            subscriptionTier: tier,
            subscriptionStatus: status,
            monthlyQuestionsUsed: monthlyUsage.questionsUsed,
            monthlyQuestionsLimit: limits.questions,
            monthlyQuestionsRemaining: isUnlimited(limits.questions)
              ? -1
              : Math.max(limits.questions - monthlyUsage.questionsUsed, 0),
            stepQuestionsUsed: monthlyUsage.stepQuestionsUsed,
            monthlyImagesUsed: monthlyUsage.imagesUsed,
            monthlyImagesLimit: limits.images,
            monthlyBulkUsed: monthlyUsage.bulkUsed,
            monthlyBulkLimit: limits.bulk,
            paygoCreditsRemaining: paygoRemaining,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile sync failed';
    return jsonError(500, 'SYNC_PROFILE_FAILED', message);
  }
});
