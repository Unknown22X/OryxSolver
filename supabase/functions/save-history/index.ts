import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseUserClient } from '../_shared/db.ts';
import { saveHistoryEntry } from '../_shared/history.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';
import type { SaveHistoryRequest, SaveHistoryResponse } from '../_shared/contracts.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/save-history', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests', { retryAfter: rateLimit.retryAfter });
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    const body = (await req.json()) as SaveHistoryRequest;
    const question = String(body?.question ?? '').trim();
    const answer = String(body?.answer ?? '').trim();
    const source = String(body?.source ?? 'extension').trim() || 'extension';

    if (!question || !answer) {
      return jsonError(400, 'INVALID_BODY', 'question and answer are required');
    }
    if (question.length > 12000 || answer.length > 24000) {
      return jsonError(413, 'PAYLOAD_TOO_LARGE', 'question or answer is too large');
    }
    if (!/^[a-z0-9_-]{1,32}$/i.test(source)) {
      return jsonError(400, 'INVALID_SOURCE', 'source must be a simple identifier');
    }

    const user = await verifySupabaseAccessToken(token);
    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }
    const supabase = createSupabaseUserClient(token);
    const result = await saveHistoryEntry(supabase, {
      authUserId: user.id,
      question,
      answer,
      source,
    });

    const response: SaveHistoryResponse = {
      api_version: 'v1',
      ok: true,
      saved: result.saved,
      id: result.id,
    };
    return jsonOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save-history failed';
    return jsonError(500, 'SAVE_HISTORY_FAILED', message);
  }
});
