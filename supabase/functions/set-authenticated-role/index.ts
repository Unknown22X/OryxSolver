import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { hasValidInternalToken } from '../_shared/security.ts';

Deno.serve(async (req) => {
  // Internal-only endpoint: protected by shared secret, not user JWT.
  if (!hasValidInternalToken(req)) {
    return jsonError(401, 'UNAUTHORIZED_INTERNAL_CALL', 'Unauthorized');
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  try {
    const body = (await req.json()) as { authUserId?: string; userEmail?: string };
    const authUserId = String(body?.authUserId ?? '').trim();
    const userEmail = String(body?.userEmail ?? '').trim();

    if (!authUserId) {
      return jsonError(400, 'MISSING_AUTH_USER_ID', 'Missing authUserId');
    }

    const supabase = createSupabaseAdminClient();
    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(authUserId);
    if (authUserError || !authUserData.user) {
      return jsonError(404, 'AUTH_USER_NOT_FOUND', authUserError?.message ?? 'Auth user not found');
    }

    const authUser = authUserData.user;
    const emailVerified = Boolean(authUser.email_confirmed_at);
    const resolvedEmail = userEmail || authUser.email || null;
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingProfileError) {
      return jsonError(500, 'PROFILE_LOOKUP_FAILED', existingProfileError.message);
    }

    const nextRole = existingProfile?.role === 'admin' ? 'admin' : emailVerified ? 'authenticated' : 'pending';
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          auth_user_id: authUserId,
          email: resolvedEmail,
          email_verified: emailVerified,
          role: nextRole,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id, auth_user_id, role')
      .maybeSingle();

    if (error) {
      return jsonError(500, 'UPSERT_FAILED', error.message);
    }

    return jsonOk({
      api_version: 'v1',
      ok: true,
      message: 'User marked as authenticated',
      profile: data ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'set-authenticated-role failed';
    return jsonError(500, 'SET_AUTHENTICATED_ROLE_FAILED', message);
  }
});
