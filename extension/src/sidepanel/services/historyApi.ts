import { getApiUrl } from './apiConfig';
import type { ApiError, HistoryEntry, HistoryListResponse } from './contracts';
import { applyServiceHealthError, markSuccess, resilientFetch } from './serviceHealth';

type HistoryListParams = {
  limit?: number;
  before?: string;
  conversationId?: string;
};

function getHistoryApiUrl(): string {
  const url = getApiUrl('/history', import.meta.env.VITE_HISTORY_API_URL);
  if (!url) {
    throw new Error('History API URL is missing. Set VITE_API_BASE_URL or VITE_HISTORY_API_URL in extension/.env');
  }
  return url;
}

const HISTORY_CACHE_KEY = 'oryx_extension_history_cache';

export function readCachedHistoryList(): HistoryListResponse | null {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as HistoryListResponse) : null;
  } catch {
    return null;
  }
}

async function parseApiError(res: Response): Promise<never> {
  const errText = await res.text();
  let message = `Request failed: ${res.status}`;
  let code: string | undefined;
  try {
    const errJson = JSON.parse(errText) as ApiError;
    if (typeof errJson.error === 'string' && errJson.error.trim()) message = errJson.error;
    if (typeof errJson.code === 'string' && errJson.code.trim()) code = errJson.code;
  } catch {
    if (errText.trim()) message = `${message} ${errText}`;
  }
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.code = code;
  error.status = res.status;
  applyServiceHealthError(error, 'db');
  throw error;
}

export async function fetchHistoryList(
  token: string,
  params: HistoryListParams = {},
): Promise<HistoryListResponse> {
  const base = getHistoryApiUrl();
  const url = new URL(base);
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.before) url.searchParams.set('before', params.before);
  if (params.conversationId) url.searchParams.set('conversation_id', params.conversationId);

  const res = await resilientFetch(
    url.toString(),
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    {
      dependency: 'db',
      safeToRetry: true,
      timeoutMs: 12000,
    },
  );

  if (!res.ok) {
    return parseApiError(res);
  }

  const data = (await res.json()) as HistoryListResponse;
  if (!params.conversationId) {
    try {
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data));
    } catch {
      // Ignore cache failures.
    }
  }
  markSuccess('db', 'History loaded.');
  return data;
}

export async function fetchConversation(
  token: string,
  conversationId: string,
  limit = 200,
): Promise<HistoryEntry[]> {
  const data = await fetchHistoryList(token, { conversationId, limit });
  return data.entries || [];
}

export async function deleteHistory(
  token: string,
  params: { conversationId?: string; all?: boolean },
): Promise<void> {
  const base = getHistoryApiUrl();
  const url = new URL(base);
  if (params.conversationId) {
    url.searchParams.set('conversation_id', params.conversationId);
  } else if (params.all) {
    url.searchParams.set('all', 'true');
  }

  const res = await resilientFetch(
    url.toString(),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
    {
      dependency: 'db',
      safeToRetry: false,
      timeoutMs: 12000,
    },
  );

  if (!res.ok) {
    await parseApiError(res);
  }
}

export async function renameConversation(
  token: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const res = await resilientFetch(
    getHistoryApiUrl(),
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation_id: conversationId, title }),
    },
    {
      dependency: 'db',
      safeToRetry: false,
      timeoutMs: 12000,
    },
  );

  if (!res.ok) {
    await parseApiError(res);
  }
}
