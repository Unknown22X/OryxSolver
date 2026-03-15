import { getApiUrl } from './apiConfig';
import type { ApiError, HistoryEntry, HistoryListResponse } from './contracts';

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
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
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

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return parseApiError(res);
  }

  return (await res.json()) as HistoryListResponse;
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

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    await parseApiError(res);
  }
}

export async function renameConversation(
  token: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const res = await fetch(getHistoryApiUrl(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversation_id: conversationId, title }),
  });

  if (!res.ok) {
    await parseApiError(res);
  }
}
