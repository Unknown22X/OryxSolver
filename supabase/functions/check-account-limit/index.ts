import { createSupabaseAdminClient } from '../_shared/db.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { sha256Hex } from '../_shared/security.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/check-account-limit', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'ACCOUNT_LIMIT_REACHED', 'Maximum 1 account per 24 hours from this IP.', {
      retryAfter: rateLimit.retryAfter,
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const body = await req.json().catch(() => ({}));
    const email = body.email as string | undefined;
    const ipHash = await sha256Hex(clientIp);
    
    await supabase.from('account_creation_tracking').insert({
      ip_address: ipHash,
      email: email || null,
    }).catch(() => {});
  } catch (e) {
    console.log('Track attempt failed (table may not exist):', e);
  }

  return jsonOk({ allowed: true, remaining: rateLimit.remaining ?? 0 });
});
