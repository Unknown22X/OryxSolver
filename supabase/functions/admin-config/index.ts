import '@supabase/functions-js/edge-runtime.d.ts';
import { requireAdminAccess } from '../_shared/admin.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { AppError, handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

const ALLOWED_KEYS = new Set([
  'legal_versions',
  'terms_content',
  'privacy_content',
  'product_features',
  'support_contact',
]);

type ConfigUpdate = {
  key?: unknown;
  value?: unknown;
  isPublic?: unknown;
};

function parseUpdates(input: unknown): Array<{ key: string; value: unknown; is_public: boolean }> {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10) {
    throw new AppError(400, 'INVALID_UPDATES', 'updates must be a non-empty array');
  }

  return input.map((entry) => {
    const update = (typeof entry === 'object' && entry !== null ? entry : {}) as ConfigUpdate;
    const key = String(update.key ?? '').trim();
    if (!ALLOWED_KEYS.has(key)) {
      throw new AppError(400, 'UNSUPPORTED_CONFIG_KEY', `Unsupported config key: ${key || 'unknown'}`);
    }

    return {
      key,
      value: update.value ?? null,
      is_public: update.isPublic !== false,
    };
  });
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!['GET', 'POST'].includes(req.method)) {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/admin-config', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  try {
    const { user, supabaseAdmin } = await requireAdminAccess(req);

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('app_config')
        .select('key,value,is_public,updated_at')
        .order('key', { ascending: true });

      if (error) {
        return jsonError(500, 'APP_CONFIG_FETCH_FAILED', error.message);
      }

      return jsonOk({
        api_version: 'v1',
        ok: true,
        rows: data ?? [],
      });
    }

    const body = await req.json().catch(() => ({}));
    const updates = parseUpdates((body as { updates?: unknown }).updates);
    const now = new Date().toISOString();
    const payload = updates.map((entry) => ({
      key: entry.key,
      value: entry.value,
      is_public: entry.is_public,
      updated_by: user.id,
      updated_at: now,
    }));

    const { error } = await supabaseAdmin.from('app_config').upsert(payload, {
      onConflict: 'key',
    });

    if (error) {
      return jsonError(500, 'APP_CONFIG_SAVE_FAILED', error.message);
    }

    return jsonOk({
      api_version: 'v1',
      ok: true,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return jsonError(error.status, error.code, error.message, error.details);
    }
    const message = error instanceof Error ? error.message : 'Admin config request failed';
    return jsonError(500, 'ADMIN_CONFIG_FAILED', message);
  }
});
