import { supabase } from './supabase';
import { getFunctionUrl } from './functions';

export async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('No active session. Please sign in again.');
  }
  return token;
}

export async function fetchEdge<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const url = getFunctionUrl(path);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(url, {
    ...init,
    headers,
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    const message = errorBody?.error || `Request failed with status ${resp.status}`;
    throw new Error(message);
  }

  return (await resp.json()) as T;
}
