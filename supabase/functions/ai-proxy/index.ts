import '@supabase/functions-js/edge-runtime.d.ts';
import { buildPreviewPrompt, buildPrompt, buildSuggestions, type GenerationMode, type StyleMode } from './modePrompts.ts';
import { AppError, jsonError } from '../_shared/http.ts';
import { checkRateLimitMany, getClientIp } from '../_shared/rateLimit.ts';
import { hasValidInternalToken } from '../_shared/security.ts';
import { calculateAiCost, getBudgetStatus, recordAiSpend } from '../_shared/budget.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';


type InlineImagePart = { inlineData: { mimeType: string; data: string } };

type AiProxyRequest = {
  question?: string;
  imageParts?: InlineImagePart[];
  mode?: GenerationMode;
  styleMode?: StyleMode;
  history?: Array<{ role: 'user' | 'model', text: string }>;
  isBulk?: boolean;
  streamPreview?: boolean;
  previewOnly?: boolean;
  preferredLanguage?: string;
};

function isMetaDisclosurePrompt(question: string): boolean {
  const lower = question.trim().toLowerCase();
  if (!lower) return false;

  // Inline extraction can include noise like CSS/JS/menu text, so only classify as
  // meta-disclosure when there is a direct request intent plus explicit target.
  if (lower.length > 420) return false;

  const hasDirectMetaTarget =
    /\b(system prompt|hidden prompt|internal instructions|developer instructions|api key|hidden memory)\b/.test(lower) ||
    /\b(what model|which model|model name)\b/.test(lower);

  const hasRequestIntent =
    /\b(show|share|reveal|tell|give|expose|dump|print|display|what|which)\b/.test(lower);

  const looksLikeStudyQuestion =
    /\b(question|choices?|solve|explain|equation|true|false|final answer)\b/.test(lower) ||
    /[?؟]/.test(lower) ||
    /\b(اختر|السؤال|حل|درجة السؤال|صورة الشكل)\b/.test(lower);

  if (looksLikeStudyQuestion) return false;

  if (hasDirectMetaTarget && hasRequestIntent) return true;

  return [
    /\bwhat did i ask\b/,
    /\bwhat did i say\b/,
    /\bremember\b.*\b(before|earlier|previously)\b/,
  ].some((pattern) => pattern.test(lower));
}

function buildMetaDisclosureResponse(
  question: string,
  preferredLanguage?: string,
): { answer: string; explanation: string; steps: string[]; model: string; suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }> } {
  const lower = question.trim().toLowerCase();

  if (/\bwhat did i ask\b|\bwhat did i say\b|\bremember\b.*\b(before|earlier|previously)\b/.test(lower)) {
    return {
      answer: 'I can work with the current thread context, but I do not expose hidden memory or internal instructions.',
      explanation: 'If you want, I can summarize the visible messages in this conversation or help with the next study question.',
      steps: [],
      model: '',
      suggestions: buildSuggestions('standard', preferredLanguage),
    };
  }

  if (/\bwhat model\b|\bwhich model\b|\bgemini\b|\bprovider\b|\bapi key\b/.test(lower)) {
    return {
      answer: 'I am OryxSolver, and I cannot share internal model, provider, or key details.',
      explanation: 'I can still help with homework, explanations, examples, and practice questions.',
      steps: [],
      model: '',
      suggestions: buildSuggestions('standard', preferredLanguage),
    };
  }

  return {
    answer: 'I cannot share my hidden prompt or internal instructions.',
    explanation: 'I can explain what I help with: studying, solving homework, giving examples, and creating practice questions.',
    steps: [],
    model: '',
    suggestions: buildSuggestions('standard', preferredLanguage),
  };
}

function isComplexPrompt(question: string, imageParts: InlineImagePart[], styleMode: StyleMode): boolean {
  if (question.includes("Create an answer key for these practice questions")) return false;
  if (imageParts.length > 0) return true;
  if (styleMode === 'step_by_step') return true;

  const text = question.trim();
  const lower = text.toLowerCase();
  if (text.length > 550) return true;
  if ((text.match(/\n/g) || []).length >= 4) return true;

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
  const text = answer.trim();
  if (!text) return 'Answer available in explanation';

  // 1. Explicit Conclusion Patterns (Higher Confidence)
  // Match "Final Answer: B", "Choice: B", "Option B", "Answer: B"
  const conclusionMatch = text.match(/\b(final\s+)?(answer|choice|option|result)\s*:\s*\b([A-D])\b/i);
  if (conclusionMatch?.[3]) return conclusionMatch[3].toUpperCase();

  // 2. MCQ Signal Check
  const hasMcqSignal =
    /\b(a|b|c|d)\b[\).:-]/i.test(question) ||
    /\boption\b/i.test(question) ||
    /\bchoose\b/i.test(question) ||
    /\bmcq\b/i.test(question);

  if (!hasMcqSignal) return text;

  // 3. Start-of-string Letter Pattern (Common in well-formatted output)
  // Match "B) Explanation..." or "B. Explanation..." or just "B"
  const startMatch = text.match(/^\s*([A-D])\b[\).:-]?/i);
  if (startMatch?.[1]) return startMatch[1].toUpperCase();

  // 4. Fallback: Last isolated letter mentioned
  const matches = Array.from(text.matchAll(/\b([A-D])\b/gi));
  if (matches.length > 0) {
      return matches[matches.length - 1][1].toUpperCase();
  }

  return text;
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[*`]/g, '').trim().toLowerCase();
}

function parseStructuredOutput(raw: string, question: string): { answer: string; explanation: string; steps: string[] } {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { answer: 'Answer available in explanation', explanation: raw, steps: [] };
  }

  const hasExplicitSections = lines.some((line) =>
    /^(FINAL_ANSWER|ANSWER|RESULT|STEPS|EXPLANATION)\s*:/i.test(line),
  );

  if (!hasExplicitSections) {
    const plainText = raw.trim();
    const normalizedMcq = normalizeMcqAnswer(question, plainText);
    if (normalizedMcq !== plainText && normalizedMcq.length === 1) {
      return { answer: normalizedMcq, explanation: plainText, steps: [] };
    }
    return { answer: plainText, explanation: '', steps: [] };
  }

  let answerRaw = '';
  const steps: string[] = [];
  const explanationLines: string[] = [];
  let currentSection: 'steps' | 'explanation' | null = null;

  for (const line of lines) {
    if (/^(FINAL_ANSWER|ANSWER|RESULT)\s*:/i.test(line)) {
      answerRaw = line.replace(/^(FINAL_ANSWER|ANSWER|RESULT)\s*:/i, '').trim();
      currentSection = null;
      continue;
    }

    if (/^STEPS\s*:/i.test(line)) {
      currentSection = 'steps';
      const inlineStep = line.replace(/^STEPS\s*:/i, '').trim();
      if (inlineStep) {
        steps.push(inlineStep.replace(/^[-*]\s*/, '').replace(/^\d+[\).:-]\s*/, '').trim());
      }
      continue;
    }

    if (/^EXPLANATION\s*:/i.test(line)) {
      currentSection = 'explanation';
      const inlineExplanation = line.replace(/^EXPLANATION\s*:/i, '').trim();
      if (inlineExplanation) {
        explanationLines.push(inlineExplanation);
      }
      continue;
    }

    if (currentSection === 'steps') {
      const normalizedStep = line.replace(/^[-*]\s*/, '').replace(/^\d+[\).:-]\s*/, '').trim();
      if (normalizedStep) {
        steps.push(normalizedStep);
      }
      continue;
    }

    if (currentSection === 'explanation') {
      explanationLines.push(line);
    }
  }

  if (!answerRaw && lines.length <= 3) {
    answerRaw = lines[lines.length - 1];
  }

  const answer = normalizeMcqAnswer(question, answerRaw || 'Answer available in explanation');
  const rawExplanation = explanationLines.join('\n').trim() || (steps.length > 0 ? '' : raw);
  const explanation =
    normalizeComparableText(rawExplanation) === normalizeComparableText(steps.join('\n'))
      ? ''
      : rawExplanation;

  return { answer, explanation, steps };
}

/** Dedicated parser for bulk answer keys - extracts ANSWER_KEY section and strips number prefixes */
function parseBulkOutput(raw: string): { answer: string; explanation: string; steps: string[] } {
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  
  // Find the ANSWER_KEY: or FINAL_ANSWERS: marker
  const answerKeyIndex = lines.findIndex((line) => /^(ANSWER[_ ]?KEY|FINAL[_ ]?ANSWERS)\s*:/i.test(line));
  const linesToParse = answerKeyIndex >= 0 ? lines.slice(answerKeyIndex + 1) : lines;
  
  // Filter to only numbered lines (skip any trailing commentary)
  const numberedLines = linesToParse.filter((line) => /^\d+[\).:\-]/.test(line));
  
  // Strip the number prefix (e.g., "13. x+3" -> "x+3") to prevent Markdown ordered list rendering
  const cleanedLines = numberedLines.map((line) => line.replace(/^\d+[\).:\-]\s*/, '').trim());
  
  if (cleanedLines.length > 0) {
    return {
      answer: 'Answer Key',
      explanation: cleanedLines.join('\n'),
      steps: cleanedLines,
    };
  }
  
  // Fallback: treat all non-empty lines as answers if no numbered format detected
  return {
    answer: 'Answer Key',
    explanation: lines.join('\n'),
    steps: lines,
  };
}

function hasUsableStructuredOutput(question: string, raw: string, isBulk = false): boolean {
  if (isBulk) {
    const bulkParsed = parseBulkOutput(raw);
    return bulkParsed.steps.length > 0 || bulkParsed.explanation.trim().length > 0;
  }

  const parsed = parseStructuredOutput(raw, question);
  const explanationText = parsed.explanation.trim();
  
  const endsCleanly = /[.!-):]$/.test(explanationText);

  const isPlaceholderAnswer =
    parsed.answer.trim().length === 0 ||
    parsed.answer.trim().toLowerCase() === 'answer available in explanation';

  // If it doesn't end cleanly, it's definitely truncated.
  if (!endsCleanly && explanationText.length > 0) return false;

  if (!isPlaceholderAnswer) {
    return parsed.steps.length >= 1 && (explanationText.length === 0 || explanationText.length >= 20);
  }

  // For conversational/quiz responses, we allow fewer steps and shorter length.
  return (parsed.steps.length >= 1 || explanationText.length >= 40);
}

async function callGemini(
  question: string,
  imageParts: InlineImagePart[],
  mode: GenerationMode,
  styleMode: StyleMode,
  history: Array<{ role: 'user' | 'model', text: string }> = [],
  isBulk = false,
  options?: {
    previewOnly?: boolean;
    preferredLanguage?: string;
  },
): Promise<{
  answer: string;
  explanation: string;
  steps: string[];
  model: string;
  suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  cost_usd?: number;
}> {
  if (isMetaDisclosurePrompt(question)) {
    return buildMetaDisclosureResponse(question, options?.preferredLanguage);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new AppError(500, 'AI_KEY_MISSING', 'Missing GEMINI_API_KEY secret');
  }

  // Model routing strategy:
  // - Simple/conversational: gemini-2.0-flash-lite (fast, ~1-2s)
  // - Complex/bulk: gemini-2.5-flash (stronger reasoning, worth the wait)
  // - Backup: gemini-2.0-flash
  const normalModel = Deno.env.get('GEMINI_MODEL_NORMAL') || 'gemini-2.0-flash';
  const fastModel = Deno.env.get('GEMINI_MODEL_FAST') || 'gemini-2.0-flash-lite';
  const cheapModel = Deno.env.get('GEMINI_MODEL_CHEAP') || 'gemini-2.0-flash-lite';
  const strongModel = Deno.env.get('GEMINI_MODEL_STRONG') || 'gemini-2.5-flash';
  const backupModel = Deno.env.get('GEMINI_MODEL_BACKUP') || 'gemini-2.0-flash';
  const isBulkAsk = 
    isBulk ||
    question.includes("answer key for the following questions") ||
    question.includes("Create an answer key for these practice questions") ||
    (question.match(/QUESTION\s*\d+:/gi) || []).length >= 2;

  const complexPrompt = isComplexPrompt(question, imageParts, styleMode);
  const previewOnly = options?.previewOnly === true;

  const modelChain =
    previewOnly
      ? [fastModel]
      : mode === 'fast_fallback'
      ? [cheapModel, backupModel, strongModel]
      : isBulkAsk
        ? [strongModel, backupModel, cheapModel]
        : complexPrompt
          ? [strongModel, cheapModel, backupModel]
          : [cheapModel, strongModel, backupModel];

  const dedupedModelChain = modelChain.filter((value, index, arr) => value && arr.indexOf(value) === index);
  const priorContext = history.length > 0
    ? `PREVIOUS CONVERSATION (for context only):\n${history.map(h => `${h.role === 'user' ? 'USER' : 'AI'}: ${h.text}`).join('\n\n')}`
    : '';
  
  const hasHistory = history.length > 0;

  const prompt = previewOnly
      ? buildPreviewPrompt({
        question,
        priorContext,
        styleMode,
        hasImages: imageParts.length > 0,
        preferredLanguage: options?.preferredLanguage,
      })
    : buildPrompt({
        question,
        priorContext,
        styleMode,
        generationMode: mode,
        hasImages: imageParts.length > 0,
        isFollowUp: hasHistory,
        isBulk: isBulkAsk,
        preferredLanguage: options?.preferredLanguage,
      });

  let fullText = '';
  let resolvedModel = dedupedModelChain[0];
  let lastErrorText = '';
  let lastStatus = 500;
  let lastUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
  let lastCost = 0;
  const perAttemptTimeoutMs = previewOnly ? 6000 : mode === 'fast_fallback' ? 6000 : 25000;

  const primaryMaxOutputTokens = previewOnly
    ? 500
    : isBulkAsk
    ? 8192
    : mode === 'fast_fallback'
      ? (complexPrompt || styleMode === 'step_by_step' ? 1400 : 1000)
      : (complexPrompt || styleMode === 'step_by_step' ? 4096 : 3000);
  const bulkTimeoutMs = 45000; // Safer gap below Supabase 60s gateway

  for (const model of dedupedModelChain) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), isBulkAsk ? bulkTimeoutMs : perAttemptTimeoutMs);
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
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: {
            maxOutputTokens: primaryMaxOutputTokens,
            temperature: previewOnly ? 0.0 : (isBulkAsk ? 0.0 : (mode === 'fast_fallback' ? 0.0 : 0.1)),
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErrorText = errText;
        lastStatus = res.status;
        console.warn(`[ai-proxy] Model ${model} failed: ${res.status} - ${errText.slice(0, 200)}`);
        const shouldTryNext =
          res.status === 429 ||
          res.status === 404 ||
          res.status >= 500;
        if (shouldTryNext) {
          // Small delay before trying next model when rate-limited
          if (res.status === 429) await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw new AppError(502, 'AI_PROVIDER_ERROR', `AI provider failed: ${res.status}`, errText);
      }

      const data = await res.json();
      const usage = data?.usageMetadata;
      const candidate = data?.candidates?.[0];
      const finishReason = String(candidate?.finishReason || '');
      const parts = candidate?.content?.parts;
      // Filter out Gemini 2.5 thinking tokens (thought: true) — these are internal
      // model reasoning and must never be shown to users or parsed as answer steps.
      fullText = Array.isArray(parts)
        ? parts
            .filter((p: { text?: string; thought?: boolean }) => !p.thought)
            .map((p: { text?: string }) => p?.text || '')
            .join('\n')
            .trim()
        : '';

      lastUsage = {
        prompt_tokens: Number(usage?.promptTokenCount || 0),
        completion_tokens: Number(usage?.candidatesTokenCount || 0),
        total_tokens: Number(usage?.totalTokenCount || 0),
      };

      lastCost = calculateAiCost(lastUsage.prompt_tokens, lastUsage.completion_tokens, resolvedModel);

      if (!fullText) {
        lastErrorText = 'Empty response from model';
        lastStatus = 502;
        continue;
      }

      if (finishReason === 'MAX_TOKENS') {
        if (previewOnly) {
          resolvedModel = model;
          break;
        }
        // For bulk answers, just accept whatever we got - don't retry
        if (isBulkAsk) {
          resolvedModel = model;
          break;
        }

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
              '- Continue with the remaining STEPS and EXPLANATION only.',
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
                safetySettings: [
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
                ],
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
                ? continuationParts.map((p: { text?: string }) => p?.text || '').join('\n').trim()
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

  // Use dedicated bulk parser for bulk requests
  if (isBulkAsk) {
    const bulkParsed = parseBulkOutput(fullText);
    return {
      answer: bulkParsed.answer,
      explanation: bulkParsed.explanation,
      steps: bulkParsed.steps,
      model: resolvedModel,
      suggestions: [],
      usage: lastUsage,
      cost_usd: lastCost,
    };
  }

  const parsed = parseStructuredOutput(fullText, question);

  return {
    answer: parsed.answer,
    explanation: parsed.explanation,
    steps: parsed.steps,
    model: resolvedModel,
    suggestions: previewOnly ? [] : buildSuggestions(styleMode, options?.preferredLanguage),
    usage: lastUsage,
    cost_usd: lastCost,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const userId = req.headers.get('x-user-id')?.trim();
  const rateLimit = await checkRateLimitMany('/ai-proxy', [
    ...(userId ? [`user:${userId}`] : []),
    `ip:${clientIp}`,
  ]);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  const supabaseAdmin = createSupabaseAdminClient();

  try {
    if (!hasValidInternalToken(req)) {
      return jsonError(401, 'UNAUTHORIZED_INTERNAL_CALL', 'Unauthorized internal call');
    }

    // 1. Budget Pre-Check
    const budget = await getBudgetStatus(supabaseAdmin);
    if (budget.is_blocked) {
      return jsonError(402, 'AI_BUDGET_EXCEEDED', 'Monthly AI budget has been reached. Service is temporarily paused.');
    }

    const body = (await req.json()) as AiProxyRequest;
    const question = String(body.question || '').trim();
    const imageParts = Array.isArray(body.imageParts) ? body.imageParts : [];
    const mode = body.mode === 'fast_fallback' ? 'fast_fallback' : 'normal';
    const styleMode: StyleMode = body.styleMode || 'standard';
    const history = Array.isArray(body.history) ? body.history : [];
    const isBulk = Boolean(body.isBulk);
    const previewOnly = body.previewOnly === true || body.streamPreview === true;
    const preferredLanguage = body.preferredLanguage;

    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }
    if (question.length > 12000) {
      return jsonError(413, 'QUESTION_TOO_LARGE', 'Question is too long.');
    }
    if (imageParts.length > 20) {
      return jsonError(413, 'IMAGE_LIMIT_EXCEEDED', 'Too many image parts.');
    }
    if (history.length > 12) {
      return jsonError(413, 'HISTORY_TOO_LARGE', 'Too many history items.');
    }

    const ai = await callGemini(question, imageParts, mode, styleMode, history, isBulk, {
      previewOnly,
      preferredLanguage,
    });

    // 2. Cost Calculation & Spend Recording
    if (ai.usage) {
      const cost = calculateAiCost(ai.usage.prompt_tokens, ai.usage.completion_tokens, ai.model);
      console.log(`[ai-proxy] Recording spend: $${cost} for ${ai.model} (${ai.usage.total_tokens} tokens)`);
      
      // Perform atomic database update
      await recordAiSpend(supabaseAdmin, cost);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ...ai,
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
