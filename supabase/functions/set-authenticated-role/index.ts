import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const internalToken = Deno.env.get('INTERNAL_EDGE_TOKEN') ?? '';
  const authHeader = req.headers.get('x-internal-token') ?? '';
  if (!internalToken || authHeader !== internalToken) {
    return json(401, { error: 'Unauthorized', code: 'UNAUTHORIZED_INTERNAL_CALL' });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const body = (await req.json()) as { firebaseUid?: string; firebaseEmail?: string };
    const firebaseUid = String(body?.firebaseUid ?? '').trim();
    const firebaseEmail = String(body?.firebaseEmail ?? '').trim();

    if (!firebaseUid) {
      return json(400, { error: 'Missing firebaseUid', code: 'MISSING_FIREBASE_UID' });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          firebase_uid: firebaseUid,
          email: firebaseEmail || null,
          email_verified: true,
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'firebase_uid' },
      )
      .select('id, firebase_uid, role')
      .maybeSingle();

    if (error) {
      return json(500, { error: error.message, code: 'UPSERT_FAILED' });
    }

    return json(200, {
      api_version: 'v1',
      ok: true,
      message: 'User marked as authenticated',
      profile: data ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'set-authenticated-role failed';
    return json(500, { error: message, code: 'SET_AUTHENTICATED_ROLE_FAILED' });
  }
});

