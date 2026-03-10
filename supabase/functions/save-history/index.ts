import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseUserClient } from '../_shared/db.ts';
import { saveHistoryEntry } from '../_shared/history.ts';
import type { SaveHistoryRequest, SaveHistoryResponse } from '../_shared/contracts.ts';

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return json(401, { error: 'Missing or invalid Authorization header', code: 'MISSING_AUTH_HEADER' });
  }

  try {
    const body = (await req.json()) as SaveHistoryRequest;
    const question = String(body?.question ?? '').trim();
    const answer = String(body?.answer ?? '').trim();
    const source = String(body?.source ?? 'extension').trim() || 'extension';

    if (!question || !answer) {
      return json(400, { error: 'question and answer are required', code: 'INVALID_BODY' });
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
    return json(200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'save-history failed';
    return json(500, { error: message, code: 'SAVE_HISTORY_FAILED' });
  }
});
