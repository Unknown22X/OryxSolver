import { fetchEdge } from './edge';
import { applyServiceHealthError, markSuccess } from './serviceHealth';

export type HistoryEntry = {
  id: string;
  created_at: string;
  question: string;
  answer: string;
  explanation?: string | null;
  conversation_id?: string | null;
  style_mode?: string | null;
  image_urls?: string[];
  is_bulk?: boolean;
  steps?: string[];
};

export type HistoryListResponse = {
  api_version: 'v1';
  ok: true;
  entries: HistoryEntry[];
  nextCursor: string | null;
};

const HISTORY_CACHE_KEY = 'oryx_history_cache';

export function readCachedHistoryList(): HistoryListResponse | null {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as HistoryListResponse) : null;
  } catch {
    return null;
  }
}

function writeCachedHistoryList(data: HistoryListResponse) {
  try {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore cache write failures.
  }
}

export async function fetchHistoryList(params?: {
  limit?: number;
  before?: string;
  conversationId?: string;
}): Promise<HistoryListResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.before) search.set('before', params.before);
  if (params?.conversationId) search.set('conversation_id', params.conversationId);
  const query = search.toString();
  const path = query ? `/history?${query}` : '/history';
  try {
    const data = await fetchEdge<HistoryListResponse>(path, { method: 'GET' });
    if (!params?.conversationId) writeCachedHistoryList(data);
    markSuccess('db', 'History loaded.');
    return data;
  } catch (error) {
    applyServiceHealthError(error, 'db');
    throw error;
  }
}

export async function fetchAllHistoryEntries(params?: {
  limit?: number;
  maxPages?: number;
}): Promise<HistoryEntry[]> {
  const pageLimit = Math.min(params?.limit ?? 200, 200);
  const maxPages = Math.max(params?.maxPages ?? 6, 1);
  const entries: HistoryEntry[] = [];
  let before: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await fetchHistoryList({ limit: pageLimit, before });
    if (!data.entries.length) break;
    entries.push(...data.entries);
    if (!data.nextCursor) break;
    before = data.nextCursor;
  }

  return entries;
}

export async function deleteHistory(params: { conversationId?: string; all?: boolean }): Promise<void> {
  const search = new URLSearchParams();
  if (params.all) search.set('all', 'true');
  if (params.conversationId) search.set('conversation_id', params.conversationId);
  const query = search.toString();
  const path = query ? `/history?${query}` : '/history';
  await fetchEdge(path, { method: 'DELETE' });
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await fetchEdge('/history', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, title }),
  });
}
