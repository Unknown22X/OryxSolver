import '@supabase/functions-js/edge-runtime.d.ts';

class AppError extends Error {
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

function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({ error: message, code, ...(details ? { details } : {}) }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

type InlineImagePart = { inlineData: { mimeType: string; data: string } };

type AiProxyRequest = {
  question?: string;
  imageParts?: InlineImagePart[];
};

async function callGemini(
  question: string,
  imageParts: InlineImagePart[],
): Promise<{ answer: string; explanation: string; steps: string[] }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new AppError(500, 'AI_KEY_MISSING', 'Missing GEMINI_API_KEY secret');
  }

  const prompt = [
    'You are a concise homework helper.',
    'Return clear final answer first, then brief explanation steps.',
    'If images are provided, use them as primary context.',
    '',
    `Question: ${question}`,
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }, ...imageParts],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new AppError(429, 'AI_QUOTA_EXCEEDED', 'AI provider quota exceeded. Retry later.', errText);
    }
    throw new AppError(502, 'AI_PROVIDER_ERROR', `AI provider failed: ${res.status}`, errText);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const fullText = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? '').join('\n').trim()
    : '';

  if (!fullText) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'AI provider returned an empty response');
  }

  const lines = fullText.split('\n').map((line) => line.trim()).filter(Boolean);
  const answer = lines[0] ?? 'Answer available in explanation';
  const steps = lines.slice(1).filter((line) => line.length > 0);

  return { answer, explanation: fullText, steps };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  try {
    const expectedInternalToken = Deno.env.get('INTERNAL_EDGE_TOKEN');
    const providedInternalToken = req.headers.get('x-internal-token') ?? '';
    if (!expectedInternalToken || providedInternalToken !== expectedInternalToken) {
      return jsonError(401, 'UNAUTHORIZED_INTERNAL_CALL', 'Unauthorized internal call');
    }

    const body = (await req.json()) as AiProxyRequest;
    const question = String(body.question ?? '').trim();
    const imageParts = Array.isArray(body.imageParts) ? body.imageParts : [];

    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }

    const ai = await callGemini(question, imageParts);
    return new Response(
      JSON.stringify({
        ok: true,
        answer: ai.answer,
        explanation: ai.explanation,
        steps: ai.steps,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'AI proxy failed';
    return jsonError(500, 'AI_PROXY_FAILED', message);
  }
});
