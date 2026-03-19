import { fetchEdge } from './edge';

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
  return fetchEdge<HistoryListResponse>(path, { method: 'GET' });
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
