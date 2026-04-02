import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

type SubscriptionRow = {
  status: string | null;
  tier: string | null;
};

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'on_trial',
]);

function isMissingRelationError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist/i.test(error.message ?? '') ||
    /could not find the table/i.test(error.message ?? '')
  );
}

function formatStepError(step: string, error: SupabaseLikeError): Error {
  return new Error(`${step} failed: ${error.message ?? 'Unknown database error'}`);
}

async function runCleanupStep(
  step: string,
  operation: () => Promise<{ error: SupabaseLikeError | null }>,
) {
  const { error } = await operation();
  if (error && !isMissingRelationError(error)) {
    throw formatStepError(step, error);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/delete-account', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('status, tier')
      .eq('user_id', user.id)
      .maybeSingle<SubscriptionRow>();

    if (subscriptionError && !isMissingRelationError(subscriptionError)) {
      throw formatStepError('Subscription lookup', subscriptionError);
    }

    const subscriptionStatus = subscription?.status?.toLowerCase() ?? 'inactive';
    const subscriptionTier = subscription?.tier?.toLowerCase() ?? 'free';
    const hasPaidSubscription = (subscriptionTier === 'pro' || subscriptionTier === 'premium') &&
      BLOCKING_SUBSCRIPTION_STATUSES.has(subscriptionStatus);

    if (hasPaidSubscription) {
      return jsonError(
        409,
        'ACTIVE_SUBSCRIPTION',
        'Cancel your paid subscription before deleting your account.',
      );
    }

    await runCleanupStep('History cleanup', () =>
      supabaseAdmin.from('history_entries').delete().eq('user_id', user.id)
    );
    await runCleanupStep('Solve run cleanup', () =>
      supabaseAdmin.from('solve_runs').delete().eq('auth_user_id', user.id)
    );
    await runCleanupStep('Feedback cleanup', () =>
      supabaseAdmin.from('feedback').delete().eq('user_id', user.id)
    );
    await runCleanupStep('Analytics cleanup', () =>
      supabaseAdmin.from('analytics_events').delete().eq('user_id', user.id)
    );
    await runCleanupStep('Account creation tracking cleanup by user', () =>
      supabaseAdmin.from('account_creation_tracking').delete().eq('user_id', user.id)
    );

    if (user.email) {
      await runCleanupStep('Account creation tracking cleanup by email', () =>
        supabaseAdmin.from('account_creation_tracking').delete().eq('email', user.email)
      );
    }

    await runCleanupStep('App config ownership reset', () =>
      supabaseAdmin.from('app_config').update({ updated_by: null }).eq('updated_by', user.id)
    );

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      throw new Error(`Auth user deletion failed: ${deleteUserError.message}`);
    }

    return jsonOk({
      api_version: 'v1',
      ok: true,
      deleted: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Account deletion failed';
    return jsonError(500, 'DELETE_ACCOUNT_FAILED', message);
  }
});
