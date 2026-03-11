import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (req) => {
  // Internal-only endpoint: protected by shared secret, not user JWT.
  const internalToken = Deno.env.get('INTERNAL_EDGE_TOKEN') ?? '';
  const provided = req.headers.get('x-internal-token') ?? '';
  if (!internalToken || provided !== internalToken) {
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
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          auth_user_id: authUserId,
          email: userEmail || null,
          email_verified: true,
          role: 'authenticated',
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
