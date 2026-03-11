import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseUserClient } from '../_shared/db.ts';
import { saveHistoryEntry } from '../_shared/history.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import type { SaveHistoryRequest, SaveHistoryResponse } from '../_shared/contracts.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
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

    const user = await verifySupabaseAccessToken(token);
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
