import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';
import type { HistoryEntry, HistoryListResponse } from '../_shared/contracts.ts';
import { recordDependencyState } from '../_shared/serviceHealth.ts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!['GET', 'DELETE', 'PATCH'].includes(req.method)) {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/history', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    const user = await verifySupabaseAccessToken(token);
    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    const supabase = createSupabaseUserClient(token);
    const url = new URL(req.url);

    if (req.method === 'DELETE') {
      const conversationId = url.searchParams.get('conversation_id')?.trim();
      const deleteAll = url.searchParams.get('all') === 'true';

      if (!conversationId && !deleteAll) {
        return jsonError(400, 'MISSING_TARGET', 'Provide conversation_id or all=true');
      }
      if (conversationId && !isUuid(conversationId)) {
        return jsonError(400, 'INVALID_CONVERSATION_ID', 'conversation_id must be a UUID.');
      }

      let query = supabase.from('history_entries').delete().eq('user_id', user.id);
      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { error } = await query;
      if (error) {
        return jsonError(500, 'HISTORY_DELETE_FAILED', error.message);
      }

      return jsonOk({ api_version: 'v1', ok: true });
    }

    if (req.method === 'PATCH') {
      const body = (await req.json()) as { conversation_id?: string; title?: string };
      const conversationId = String(body?.conversation_id ?? '').trim();
      const title = String(body?.title ?? '').trim();

      if (!conversationId || !title) {
        return jsonError(400, 'INVALID_BODY', 'conversation_id and title are required');
      }
      if (!isUuid(conversationId)) {
        return jsonError(400, 'INVALID_CONVERSATION_ID', 'conversation_id must be a UUID.');
      }
      if (title.length > 160) {
        return jsonError(413, 'TITLE_TOO_LONG', 'Title is too long.');
      }

      const { error } = await supabase
        .from('history_entries')
        .update({ question: title })
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId);

      if (error) {
        return jsonError(500, 'HISTORY_UPDATE_FAILED', error.message);
      }

      return jsonOk({ api_version: 'v1', ok: true });
    }

    const limit = parseLimit(url.searchParams.get('limit'));
    const before = url.searchParams.get('before')?.trim();
    const conversationId = url.searchParams.get('conversation_id')?.trim();
    if (conversationId && !isUuid(conversationId)) {
      return jsonError(400, 'INVALID_CONVERSATION_ID', 'conversation_id must be a UUID.');
    }

    let query = supabase
      .from('history_entries')
      .select(
        'id, created_at, question, answer, explanation, conversation_id, style_mode, image_urls, is_bulk, steps',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error } = await query;
    if (error) {
      return jsonError(500, 'HISTORY_FETCH_FAILED', error.message);
    }

    const entries = (data ?? []) as HistoryEntry[];
    const nextCursor = entries.length === limit
      ? entries[entries.length - 1]?.created_at ?? null
      : null;

    const response: HistoryListResponse = {
      api_version: 'v1',
      ok: true,
      entries,
      nextCursor,
    };

    return jsonOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'history fetch failed';
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      await recordDependencyState(supabaseAdmin, {
        dependency: 'db',
        status: 'outage',
        message,
        code: 'SUPABASE_UNAVAILABLE',
        source: 'history',
      });
    } catch (_healthError) {
      // Ignore health telemetry failures.
    }
    return jsonError(503, 'SUPABASE_UNAVAILABLE', message);
  }
});
