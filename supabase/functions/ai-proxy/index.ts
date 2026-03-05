import '@supabase/functions-js/edge-runtime.d.ts';
import { buildPrompt, buildSuggestions, type GenerationMode, type StyleMode } from './modePrompts.ts';

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
  mode?: GenerationMode;
  styleMode?: StyleMode;
};

function normalizeMcqAnswer(question: string, answer: string): string {
  const hasMcqSignal =
    /\b(a|b|c|d)\b[\).:-]/i.test(question) ||
    /\boption\b/i.test(question) ||
    /\bchoose\b/i.test(question) ||
    /\bwhich\b/i.test(question) ||
    /\bmcq\b/i.test(question);

  if (!hasMcqSignal) return answer.trim();

  const letterMatch = answer.match(/\b([A-D])\b/i) || answer.match(/^\s*([A-D])[\).:-]?/i);
  if (letterMatch?.[1]) return letterMatch[1].toUpperCase();
  return answer.trim();
}

function parseStructuredOutput(raw: string, question: string): { answer: string; explanation: string; steps: string[] } {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { answer: 'Answer available in explanation', explanation: raw, steps: [] };
  }

  const answerLine = lines.find((line) => /^FINAL_ANSWER\s*:/i.test(line)) ?? lines[0];
  const answerRaw = answerLine.replace(/^FINAL_ANSWER\s*:/i, '').trim();
  const answer = normalizeMcqAnswer(question, answerRaw || 'Answer available in explanation');

  const stepStartIndex = lines.findIndex((line) => /^STEPS\s*:/i.test(line));
  const rawStepLines = stepStartIndex >= 0 ? lines.slice(stepStartIndex + 1) : lines.slice(1);
  const steps = rawStepLines
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+[\).:-]\s*/, '').trim())
    .filter(Boolean);

  const explanation = steps.length > 0 ? steps.join('\n') : raw;
  return { answer, explanation, steps };
}

async function callGemini(
  question: string,
  imageParts: InlineImagePart[],
  mode: GenerationMode,
  styleMode: StyleMode,
): Promise<{ answer: string; explanation: string; steps: string[]; model: string; suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }> }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new AppError(500, 'AI_KEY_MISSING', 'Missing GEMINI_API_KEY secret');
  }

  const defaultPrimary = 'gemini-2.5-pro';
  const defaultBackup = 'gemini-2.5-flash';
  const normalModel = Deno.env.get('GEMINI_MODEL_NORMAL') || defaultPrimary;
  const fastModel = Deno.env.get('GEMINI_MODEL_FAST') || 'gemini-2.5-flash';
  const backupModel = Deno.env.get('GEMINI_MODEL_BACKUP') || defaultBackup;
  const primaryModel = mode === 'fast_fallback' ? fastModel : normalModel;
  const modelChain = [primaryModel, backupModel].filter((value, index, arr) => value && arr.indexOf(value) === index);
  const prompt = buildPrompt({
    question,
    styleMode,
    generationMode: mode,
    hasImages: imageParts.length > 0,
  });

  let fullText = '';
  let resolvedModel = primaryModel;
  let lastErrorText = '';
  let lastStatus = 500;
  const perAttemptTimeoutMs = mode === 'fast_fallback' ? 6000 : 10000;

  for (const model of modelChain) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeoutMs);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, ...imageParts],
            },
          ],
          generationConfig: mode === 'fast_fallback'
            ? { maxOutputTokens: 420, temperature: 0.0 }
            : { maxOutputTokens: 1000, temperature: 0.1 },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErrorText = errText;
        lastStatus = res.status;
        const shouldTryNext =
          res.status === 429 ||
          res.status === 404 ||
          res.status >= 500;
        if (shouldTryNext) continue;
        throw new AppError(502, 'AI_PROVIDER_ERROR', `AI provider failed: ${res.status}`, errText);
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      fullText = Array.isArray(parts)
        ? parts.map((p: { text?: string }) => p?.text ?? '').join('\n').trim()
        : '';

      if (!fullText) {
        lastErrorText = 'Empty response from model';
        lastStatus = 502;
        continue;
      }

      resolvedModel = model;
      break;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastErrorText = `Model ${model} timed out`;
        lastStatus = 504;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!fullText) {
    if (lastStatus === 429) {
      throw new AppError(429, 'AI_QUOTA_EXCEEDED', 'AI provider quota exceeded. Retry later.', lastErrorText);
    }
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'All configured AI models failed.', lastErrorText);
  }

  const parsed = parseStructuredOutput(fullText, question);

  return {
    answer: parsed.answer,
    explanation: parsed.explanation,
    steps: parsed.steps,
    model: resolvedModel,
    suggestions: buildSuggestions(styleMode),
  };
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
    const mode = body.mode === 'fast_fallback' ? 'fast_fallback' : 'normal';
    const styleMode: StyleMode = body.styleMode ?? 'standard';

    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }

    const ai = await callGemini(question, imageParts, mode, styleMode);
    return new Response(
      JSON.stringify({
        ok: true,
        answer: ai.answer,
        explanation: ai.explanation,
        steps: ai.steps,
        model: ai.model,
        suggestions: ai.suggestions,
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
