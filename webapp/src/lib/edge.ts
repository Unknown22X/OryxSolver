import { getFunctionUrl } from './functions';
import { applyServiceHealthError, resilientFetch } from './serviceHealth';
import { getSessionWithRetry, toSafeSupabaseError } from './supabaseAuth';

function buildEdgeError(message: string, code?: string, status?: number) {
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.code = code;
  error.status = status;
  return error;
}

export async function getAccessToken(): Promise<string> {
  try {
    const { data, error } = await getSessionWithRetry({
      fallbackMessage: 'Authentication is temporarily unavailable. Please retry.',
    });
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) {
      throw new Error('No active session. Please sign in again.');
    }
    return token;
  } catch (error) {
    applyServiceHealthError(error, 'auth');
    throw toSafeSupabaseError(error, 'Authentication is temporarily unavailable. Please retry.');
  }
}

export async function fetchEdge<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const url = getFunctionUrl(path);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  // Critical for Supabase API Gateway to identify project context
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey) {
    headers.set('apikey', anonKey);
  }

  const resp = await resilientFetch(
    url,
    {
      ...init,
      headers,
    },
    {
      dependency: 'backend',
      safeToRetry: (init.method ?? 'GET').toUpperCase() === 'GET',
      timeoutMs: 12000,
    },
  );

  if (!resp.ok) {
   let message = `Request failed with status ${resp.status}`;
    let code: string | undefined;
    let errorBody: any;
    try {
      const errorText = await resp.text();
      try {
        errorBody = JSON.parse(errorText);
      } catch (e) {
        message = errorText || message;
      }
      if (errorBody) {
        code = errorBody.code;
        message = errorBody.error?.message || errorBody.error || errorBody.message || message;
      }
    } catch (e) {
      // Ignore
    }
    
    const retryAfter =
      resp.headers.get('Retry-After') ??
      (typeof errorBody?.retryAfter === 'number' ? String(errorBody.retryAfter) : undefined) ??
      (typeof errorBody?.details?.retryAfter === 'number' ? String(errorBody.details.retryAfter) : undefined);
    const error = buildEdgeError(typeof message === 'string' ? message : JSON.stringify(message), code, resp.status);
    if (retryAfter) {
      (error as Error & { retryAfterSec?: number }).retryAfterSec = Number.parseInt(retryAfter, 10);
    }
    applyServiceHealthError(error, 'backend');
    throw error;
  }

  return (await resp.json()) as T;
}

export async function fetchEdgeStream(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const url = getFunctionUrl(path);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey) {
    headers.set('apikey', anonKey);
  }

  const resp = await resilientFetch(
    url,
    {
      ...init,
      headers,
    },
    {
      dependency: 'backend',
      safeToRetry: false,
      timeoutMs: 45000,
    },
  );

  if (!resp.ok) {
    let message = `Request failed with status ${resp.status}`;
    let code: string | undefined;
    let errorBody: any;
    try {
      const errorText = await resp.text();
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        message = errorText || message;
      }
      if (errorBody) {
        code = errorBody.code;
        message = errorBody.error?.message || errorBody.error || errorBody.message || message;
      }
    } catch {
      // Ignore
    }

    const retryAfter =
      resp.headers.get('Retry-After') ??
      (typeof errorBody?.retryAfter === 'number' ? String(errorBody.retryAfter) : undefined) ??
      (typeof errorBody?.details?.retryAfter === 'number' ? String(errorBody.details.retryAfter) : undefined);
    const error = buildEdgeError(typeof message === 'string' ? message : JSON.stringify(message), code, resp.status);
    if (retryAfter) {
      (error as Error & { retryAfterSec?: number }).retryAfterSec = Number.parseInt(retryAfter, 10);
    }
    applyServiceHealthError(error, 'backend');
    throw error;
  }

  return resp;
}
