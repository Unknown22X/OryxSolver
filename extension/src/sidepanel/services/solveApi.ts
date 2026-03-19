import { getApiUrl } from './apiConfig';
import type { ApiError, SolveRequest, SolveResponse } from './contracts';
import { assertSolveResponse } from './responseGuards';

export async function postSolveRequest(
  token: string,
  request: SolveRequest,
): Promise<SolveResponse> {
  const solveApiUrl = getApiUrl('/solve', import.meta.env.VITE_SOLVE_API_URL);
  if (!solveApiUrl) {
    throw new Error('Solve API URL is missing. Set VITE_API_BASE_URL or VITE_SOLVE_API_URL in extension/.env');
  }

  const form = new FormData();
  form.append('question', request.question);
  form.append('style_mode', request.styleMode);

  for (const image of request.images) {
    if (image instanceof File) {
      console.log('[ORYX-API] Sending file:', image.name, image.size, image.type);
      form.append('images', image);
    } else if (typeof image === 'object' && 'url' in image) {
      const imageUrl = String(image.url ?? '').trim();
      if (!imageUrl) continue;
      if (/^https?:\/\//i.test(imageUrl)) {
        const error = new Error('Remote image URLs are not supported. Capture or upload the image directly instead.') as Error & { code?: string };
        error.code = 'REMOTE_IMAGE_URLS_NOT_ALLOWED';
        throw error;
      }
      console.log('[ORYX-API] Sending image_url:', imageUrl.substring(0, 50));
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

  const requestId = crypto.randomUUID?.() || Date.now().toString(36);

  const res = await fetch(solveApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': requestId,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `Upload failed: ${res.status}`;
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

  const data: unknown = await res.json();
  return assertSolveResponse(data);
}
