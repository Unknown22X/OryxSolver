import type { StyleMode } from './contracts.ts';

export class AiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function callAiProxy(
  question: string,
  imageParts: Array<{ inlineData: { mimeType: string; data: string } }>,
  mode: 'normal' | 'fast_fallback' = 'normal',
  styleMode: StyleMode = 'standard',
  history: Array<{ role: 'user' | 'model', text: string }> = [],
  isBulk = false,
  userId?: string,
  options?: {
    streamPreview?: boolean;
    previewOnly?: boolean;
    preferredLanguage?: string;
  },
): Promise<{ 
  answer: string; 
  explanation: string; 
  steps: string[]; 
  model: string; 
  suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }>;
  cost_usd?: number;
}> {
  const internalToken = Deno.env.get('INTERNAL_EDGE_TOKEN');
  if (!internalToken) {
    throw new AiError(500, 'INTERNAL_TOKEN_MISSING', 'Missing INTERNAL_EDGE_TOKEN secret');
  }

  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ??
    Deno.env.get('PROJECT_URL');
  if (!supabaseUrl) {
    throw new AiError(500, 'SUPABASE_URL_MISSING', 'Missing SUPABASE_URL');
  }

  const url = `${supabaseUrl}/functions/v1/ai-proxy`;
  const controller = new AbortController();
  // Must be larger than ai-proxy total attempt window (including fallback models),
  // otherwise solve aborts while ai-proxy is still processing.
  const timeoutMs = mode === 'fast_fallback' ? 18000 : 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: JSON.stringify({
        question,
        imageParts,
        mode,
        styleMode,
        history,
        isBulk,
        streamPreview: options?.streamPreview === true,
        previewOnly: options?.previewOnly === true,
        preferredLanguage: options?.preferredLanguage,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      let code = 'AI_PROXY_ERROR';
      let message = `AI proxy failed: ${res.status}`;
      try {
        const errJson = JSON.parse(errText) as { code?: string; error?: string };
        if (typeof errJson.code === 'string') code = errJson.code;
        if (typeof errJson.error === 'string') message = errJson.error;
      } catch {
        if (errText.trim()) message = `${message} ${errText}`;
      }
      // Preserve the actual status code from ai-proxy instead of blindly converting to 502
      const status = res.status === 429 ? 429
        : res.status === 503 ? 503
        : res.status === 504 ? 504
        : 502;
      throw new AiError(status, code, message);
    }

    const data = await res.json();
    return {
      answer: typeof data?.answer === 'string' ? data.answer : (typeof data?.text === 'string' ? data.text : 'Answer available in explanation'),
      explanation: typeof data?.explanation === 'string' ? data.explanation : '',
      steps: Array.isArray(data?.steps) ? data.steps.map((s: unknown) => String(s)) : [],
      model: typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : 'unknown',
      suggestions: Array.isArray(data?.suggestions)
        ? data.suggestions
            .filter((s: unknown) => typeof s === 'object' && s !== null)
            .map((s: unknown) => {
              const item = s as { label?: unknown; prompt?: unknown; styleMode?: unknown };
              return {
                label: typeof item.label === 'string' ? item.label : 'Try this',
                prompt: typeof item.prompt === 'string' ? item.prompt : '',
                ...(typeof item.styleMode === 'string' ? { styleMode: item.styleMode as StyleMode } : {}),
              };
            })
            .filter((s: { label: string; prompt: string }) => s.prompt.trim().length > 0)
        : [],
      cost_usd: typeof data?.cost_usd === 'number' ? data.cost_usd : 0,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiError(504, 'AI_TIMEOUT', 'AI response timed out. Please retry.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
