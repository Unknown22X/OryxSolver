import { getApiUrl } from './apiConfig';
import type { ApiError, SolveRequest, SolveResponse, SolveStreamEvent } from './contracts';
import { assertSolveResponse, isSolveResponse } from './responseGuards';
import { applyServiceHealthError, resilientFetch } from './serviceHealth';

function buildSolveForm(request: SolveRequest, stream = false) {
  const form = new FormData();
  form.append('question', request.question);
  form.append('style_mode', request.styleMode);
  if (stream) {
    form.append('stream', 'true');
  }
  if (request.language) {
    form.append('language', request.language);
  }

  for (const image of request.images) {
    if (image instanceof File) {
      console.log('[ORYX-API] Sending file:', image.name, image.size, image.type);
      form.append('images', image);
    } else if (typeof image === 'object' && 'url' in image) {
      const imageUrl = String(image.url ?? '').trim();
      if (!imageUrl) continue;
      form.append('image_urls', imageUrl);
    }
  }
  if (request.history && request.history.length > 0) {
    form.append('history', JSON.stringify(request.history));
  }
  if (request.conversationId) {
    form.append('conversation_id', request.conversationId);
  }
  if (request.quotedStep) {
    form.append('quoted_step', JSON.stringify(request.quotedStep));
  }
  if (request.isBulk) {
    form.append('is_bulk', 'true');
  }

  return form;
}

function buildApiError(message: string, code?: string, status?: number) {
  const error = new Error(message) as Error & { code?: string; status?: number };
  error.code = code;
  error.status = status;
  return error;
}

async function parseErrorResponse(res: Response) {
  const errText = await res.text();
  let message = `Upload failed: ${res.status}`;
  let code: string | undefined;
  let retryAfterSec: number | undefined;
  try {
    const errJson = JSON.parse(errText) as ApiError;
    if (typeof errJson.error === 'string' && errJson.error.trim()) message = errJson.error;
    if (typeof errJson.code === 'string' && errJson.code.trim()) code = errJson.code;
    if (typeof (errJson as ApiError & { retryAfter?: number }).retryAfter === 'number') {
      retryAfterSec = (errJson as ApiError & { retryAfter?: number }).retryAfter;
    }
  } catch {
    if (errText.trim()) message = `${message} ${errText}`;
  }
  const error = buildApiError(message, code, res.status) as Error & { retryAfterSec?: number };
  error.retryAfterSec =
    retryAfterSec ?? (Number.parseInt(res.headers.get('Retry-After') ?? '', 10) || undefined);
  applyServiceHealthError(error, code?.startsWith('AI_') ? 'ai' : 'backend');
  throw error;
}

function isStreamEvent(value: unknown): value is SolveStreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown };
  return event.type === 'status' || event.type === 'preview' || event.type === 'final' || event.type === 'error';
}

async function* parseNdjsonStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SolveStreamEvent, void, void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed: unknown = JSON.parse(trimmed);
          if (isStreamEvent(parsed)) {
            yield parsed;
          } else {
            console.warn('[ORYX-API] Ignoring malformed stream event shape');
          }
        } catch (error) {
          console.warn('[ORYX-API] Ignoring malformed NDJSON line', error);
        }
      }
    }

    const finalLine = buffer.trim();
    if (finalLine) {
      try {
        const parsed: unknown = JSON.parse(finalLine);
        if (isStreamEvent(parsed)) {
          yield parsed;
        } else {
          console.warn('[ORYX-API] Ignoring malformed trailing stream event shape');
        }
      } catch (error) {
        console.warn('[ORYX-API] Ignoring malformed trailing NDJSON line', error);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function postSolveRequest(
  token: string,
  request: SolveRequest,
  options?: { signal?: AbortSignal }
): Promise<SolveResponse> {
  const solveApiUrl = getApiUrl('/solve', import.meta.env.VITE_SOLVE_API_URL);
  if (!solveApiUrl) {
    throw new Error('Solve API URL is missing. Set VITE_API_BASE_URL or VITE_SOLVE_API_URL in extension/.env');
  }

  const form = buildSolveForm(request, false);

  const requestId = crypto.randomUUID?.() || Date.now().toString(36);
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const res = await resilientFetch(
      solveApiUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-request-id': requestId,
        },
        body: form,
        signal: options?.signal ?? controller.signal,
      },
      {
        dependency: 'ai',
        safeToRetry: false,
        timeoutMs: 30000,
      },
    );
    clearTimeout(timeout);

    if (res.status === 429 && attempt < maxRetries) {
      const waitTime = (attempt + 1) * 2500;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    if (!res.ok) {
      await parseErrorResponse(res);
    }

    const data: unknown = await res.json();
    return assertSolveResponse(data);
  }

  throw new Error('Max retries reached');
}

export async function streamSolveRequest(
  token: string,
  request: SolveRequest,
  handlers: {
    onEvent: (event: SolveStreamEvent) => void;
  },
  options?: { signal?: AbortSignal }
): Promise<SolveResponse> {
  const solveApiUrl = getApiUrl('/solve', import.meta.env.VITE_SOLVE_API_URL);
  if (!solveApiUrl) {
    throw new Error('Solve API URL is missing. Set VITE_API_BASE_URL or VITE_SOLVE_API_URL in extension/.env');
  }

  const form = buildSolveForm(request, true);
  const requestId = crypto.randomUUID?.() || Date.now().toString(36);
  const res = await resilientFetch(
    solveApiUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-request-id': requestId,
      },
      body: form,
      signal: options?.signal,
    },
    {
      dependency: 'ai',
      safeToRetry: false,
      timeoutMs: 45000,
    },
  );

  if (!res.ok) {
    await parseErrorResponse(res);
  }

  if (!res.body) {
    throw new Error('Streaming solve returned no body.');
  }

  let finalResponse: SolveResponse | null = null;
  for await (const event of parseNdjsonStream(res.body)) {
    handlers.onEvent(event);
    if (event.type === 'error') {
      throw buildApiError(event.message, event.code, res.status);
    }
    if (event.type === 'final') {
      if (!isSolveResponse(event.data)) {
        throw new Error('Invalid final response from backend stream.');
      }
      finalResponse = event.data;
    }
  }

  if (!finalResponse) {
    throw buildApiError('Streaming solve ended before final response.', 'STREAM_INTERRUPTED');
  }

  return assertSolveResponse(finalResponse);
}
