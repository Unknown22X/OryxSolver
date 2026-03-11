import '@supabase/functions-js/edge-runtime.d.ts';
import { buildPrompt, buildSuggestions, type GenerationMode, type StyleMode } from './modePrompts.ts';
import { AppError, jsonError } from '../_shared/http.ts';


type InlineImagePart = { inlineData: { mimeType: string; data: string } };

type AiProxyRequest = {
  question?: string;
  imageParts?: InlineImagePart[];
  mode?: GenerationMode;
  styleMode?: StyleMode;
  history?: Array<{ role: 'user' | 'model', text: string }>;
};

function isComplexPrompt(question: string, imageParts: InlineImagePart[], styleMode: StyleMode): boolean {
  if (imageParts.length > 0) return true;
  if (styleMode === 'step_by_step') return true;

  const text = question.trim();
  const lower = text.toLowerCase();
  if (text.length > 550) return true;
  if ((text.match(/\n/g) ?? []).length >= 4) return true;

  const complexSignals = [
    /\bprove\b/i,
    /\bderive\b/i,
    /\banaly[sz]e\b/i,
    /\bjustify\b/i,
    /\bcompare\b/i,
    /\bevaluate\b/i,
    /\bintegral\b/i,
    /\bderivative\b/i,
    /\bmatrix\b/i,
    /\bprobability\b/i,
    /\bcomplexity\b/i,
    /\bdebug\b/i,
    /\btime complexity\b/i,
  ];
  return complexSignals.some((pattern) => pattern.test(lower));
}

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

  const answerLine = lines.find((line) => /^FINAL_ANSWER\s*:/i.test(line));
  const answerRaw = answerLine
    ? answerLine.replace(/^FINAL_ANSWER\s*:/i, '').trim()
    : '';
  const answer = normalizeMcqAnswer(question, answerRaw || 'Answer available in explanation');

  const stepStartIndex = lines.findIndex((line) => /^STEPS\s*:/i.test(line));
  const rawStepLines = stepStartIndex >= 0 ? lines.slice(stepStartIndex + 1) : lines.slice(1);
  const steps = rawStepLines
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+[\).:-]\s*/, '').trim())
    .filter(Boolean);

  const explanation = steps.length > 0 ? steps.join('\n') : raw;
  return { answer, explanation, steps };
}

function hasUsableStructuredOutput(question: string, raw: string): boolean {
  const parsed = parseStructuredOutput(raw, question);
  const explanationText = parsed.explanation.trim();
  const endsCleanly = /[.!?):]$/.test(explanationText);

  const isPlaceholderAnswer =
    parsed.answer.trim().length === 0 ||
    parsed.answer.trim().toLowerCase() === 'answer available in explanation';

  // If it doesn't end cleanly, it's definitely truncated.
  if (!endsCleanly) return false;

  if (!isPlaceholderAnswer) {
    // For standard answers, we still want high quality.
    return parsed.steps.length >= 2 && explanationText.length >= 120;
  }

  // For conversational/quiz responses, we allow fewer steps and shorter length.
  return (parsed.steps.length >= 1 || explanationText.length >= 40);
}

async function callGemini(
  question: string,
  imageParts: InlineImagePart[],
  mode: GenerationMode,
  styleMode: StyleMode,
  history: Array<{ role: 'user' | 'model', text: string }> = []
): Promise<{ answer: string; explanation: string; steps: string[]; model: string; suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }> }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new AppError(500, 'AI_KEY_MISSING', 'Missing GEMINI_API_KEY secret');
  }

  const defaultPrimary = 'gemini-1.5-pro';
  const defaultBackup = 'gemini-2.0-flash';
  const normalModel = Deno.env.get('GEMINI_MODEL_NORMAL') || defaultPrimary;
  const fastModel = Deno.env.get('GEMINI_MODEL_FAST') || 'gemini-2.0-flash';
  const cheapModel = Deno.env.get('GEMINI_MODEL_CHEAP') || fastModel;
  const strongModel = Deno.env.get('GEMINI_MODEL_STRONG') || normalModel;
  const backupModel = Deno.env.get('GEMINI_MODEL_BACKUP') || defaultBackup;
  const complexPrompt = isComplexPrompt(question, imageParts, styleMode);

  const modelChain =
    mode === 'fast_fallback'
      ? [cheapModel, strongModel, backupModel]
      : complexPrompt
        ? [strongModel, cheapModel, backupModel]
        : [cheapModel, strongModel, backupModel];
  const dedupedModelChain = modelChain.filter((value, index, arr) => value && arr.indexOf(value) === index);
  const contextPrefix = history.length > 0
    ? `PREVIOUS CONVERSATION (for context only):\n${history.map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.text}`).join('\n\n')}\n\n====================\n\nNEW FOLLOW-UP QUESTION:\n`
    : '';
  
  const hasHistory = history.length > 0;

  const prompt = buildPrompt({
    question: contextPrefix + question,
    styleMode,
    generationMode: mode,
    hasImages: imageParts.length > 0,
    isFollowUp: hasHistory,
  });

  let fullText = '';
  let resolvedModel = dedupedModelChain[0];
  let lastErrorText = '';
  let lastStatus = 500;
  const perAttemptTimeoutMs = mode === 'fast_fallback' ? 6000 : 10000;
  const primaryMaxOutputTokens =
    mode === 'fast_fallback'
      ? (complexPrompt || styleMode === 'step_by_step' ? 1400 : 1000)
      : (complexPrompt || styleMode === 'step_by_step' ? 4096 : 3000);

  for (const model of dedupedModelChain) {
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
            ? { maxOutputTokens: primaryMaxOutputTokens, temperature: 0.0 }
            : { maxOutputTokens: primaryMaxOutputTokens, temperature: 0.1 },
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
      const candidate = data?.candidates?.[0];
      const finishReason = String(candidate?.finishReason ?? '');
      const parts = candidate?.content?.parts;
      fullText = Array.isArray(parts)
        ? parts.map((p: { text?: string }) => p?.text ?? '').join('\n').trim()
        : '';

      if (!fullText) {
        lastErrorText = 'Empty response from model';
        lastStatus = 502;
        continue;
      }

      if (finishReason === 'MAX_TOKENS') {
        const hasUsablePartial = hasUsableStructuredOutput(question, fullText);

        if (!hasUsablePartial) {
          // Try one continuation pass before failing this model.
          try {
            const continuationController = new AbortController();
            const continuationTimeout = setTimeout(
              () => continuationController.abort(),
              perAttemptTimeoutMs + 3000,
            );
            const continuationPrompt = [
              prompt,
              '',
              'Previous output was truncated. Continue exactly from where it stopped.',
              'Rules:',
              '- Do not restart or repeat FINAL_ANSWER.',
              '- Continue with remaining STEPS only.',
              '- Keep the same language and format.',
              '',
              'Previous partial output:',
              fullText,
            ].join('\n');

            const continuationRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: continuationPrompt }] }],
                generationConfig: mode === 'fast_fallback'
                  ? { maxOutputTokens: 1400, temperature: 0.0 }
                  : { maxOutputTokens: 2000, temperature: 0.1 },
              }),
              signal: continuationController.signal,
            });
            clearTimeout(continuationTimeout);

            if (continuationRes.ok) {
              const continuationJson = await continuationRes.json();
              const continuationParts = continuationJson?.candidates?.[0]?.content?.parts;
              const continuationText = Array.isArray(continuationParts)
                ? continuationParts.map((p: { text?: string }) => p?.text ?? '').join('\n').trim()
                : '';

              if (continuationText) {
                const merged = `${fullText}\n${continuationText}`.trim();
                if (hasUsableStructuredOutput(question, merged)) {
                  fullText = merged;
                } else {
                  lastErrorText = `Model ${model} continuation still incomplete`;
                  lastStatus = 503;
                  fullText = '';
                  continue;
                }
              } else {
                lastErrorText = `Model ${model} continuation empty`;
                lastStatus = 503;
                fullText = '';
                continue;
              }
            } else {
              lastErrorText = `Model ${model} continuation failed: ${continuationRes.status}`;
              lastStatus = continuationRes.status >= 500 ? 502 : 503;
              fullText = '';
              continue;
            }
          } catch {
            lastErrorText = `Model ${model} continuation timed out`;
            lastStatus = 503;
            fullText = '';
            continue;
          }
        }
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
    if (lastStatus === 504) {
      throw new AppError(504, 'AI_TIMEOUT', 'AI provider timed out. Please retry.', lastErrorText);
    }
    if (lastStatus === 503 && /MAX_TOKENS/i.test(lastErrorText)) {
      throw new AppError(503, 'AI_INCOMPLETE_OUTPUT', 'AI output was truncated. Please retry.', { retryable: true });
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
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }

    const ai = await callGemini(question, imageParts, mode, styleMode, history);
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
