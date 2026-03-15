import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { callAiProxy, AiError } from '../_shared/ai.ts';
import { saveHistoryEntry } from '../_shared/history.ts';
import { logSolveRun } from '../_shared/solveRuns.ts';
import { AppError, jsonError } from '../_shared/http.ts';
import {
  consumeCreditForFreeTier,
  consumeMonthlyImageQuotaForFreeTier,
  currentMonthStartIsoDate,
  getProfileForSolve,
} from '../_shared/profile.ts';
import type { SolveSuccessResponse, StyleMode } from '../_shared/contracts.ts';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractImageParts(form: FormData): Promise<Array<{ inlineData: { mimeType: string; data: string } }>> {
  const images = form.getAll('images');
  const imageUrls = form.getAll('image_urls').filter(Boolean);
  const imageEntries = [...images, form.get('image')].filter(Boolean);
  
  const uniqueFiles: File[] = [];
  const seen = new Set<string>();

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) continue;
    const key = `${entry.name}:${entry.size}:${entry.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFiles.push(entry);
  }

  const parts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  const maxFileSizeBytes = 5 * 1024 * 1024;

  // Process standard file uploads
  for (const file of uniqueFiles) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxFileSizeBytes) {
      throw new AppError(413, 'IMAGE_TOO_LARGE', `Image "${file.name}" is too large. Max size is 5MB.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    parts.push({
      inlineData: {
        mimeType: file.type || 'image/png',
        data: bytesToBase64(bytes),
      },
    });
  }

  // Process image URLs
  for (const urlEntry of imageUrls) {
    const url = String(urlEntry);
    if (!url) continue;
    
    // Support Data URLs (base64) directly to avoid fetch errors
    if (url.startsWith('data:image/')) {
      try {
        const [meta, b64] = url.split(',');
        const mimeMatch = meta.match(/data:(.*?);base64/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        if (b64 && b64.length < 10000000) { // ~7MB limit for data urls
          parts.push({
            inlineData: {
              mimeType: mime,
              data: b64,
            },
          });
          continue;
        }
      } catch (err) {
        console.warn(`Failed to parse data URL`, err);
      }
    }

    if (!url.startsWith('http')) continue;
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || 'image/png';
      if (!contentType.startsWith('image/')) continue;
      
      const bytes = new Uint8Array(await resp.arrayBuffer());
      if (bytes.length > maxFileSizeBytes) continue;

      parts.push({
        inlineData: {
          mimeType: contentType,
          data: bytesToBase64(bytes),
        },
      });
    } catch (err) {
      console.warn(`Failed to fetch image from URL: ${url}`, err);
    }
  }

  return parts;
}

function chooseAiMode(
  question: string,
  hasImages: boolean,
  styleMode: StyleMode,
): 'normal' | 'fast_fallback' {
  if (hasImages) return 'normal';
  if (styleMode === 'gen_alpha') return 'normal';

  const trimmed = question.trim();
  const lower = trimmed.toLowerCase();

  const isVeryShort = trimmed.length > 0 && trimmed.length <= 80;
  const mcqSignals = [
    /\b(a|b|c|d)\b[\).:-]/i,
    /\boption\b/i,
    /\bchoose\b/i,
    /\bwhich\b/i,
    /\bmcq\b/i,
  ];
  const hasMcqSignal = mcqSignals.some((pattern) => pattern.test(trimmed));

  const complexSignals = [
    /integral|derivative|limit|matrix|equation|function|probability/i,
    /\bprove\b/i,
    /\bderive\b/i,
    /\bexplain\b/i,
    /\bshow\s+steps\b/i,
    /\btherefore\b/i,
    /\bbecause\b/i,
    /\bmatrix\b/i,
    /\bintegral\b/i,
    /\bderivative\b/i,
    /\blimit\b/i,
    /\bprobability\b/i,
    /\bequation\b/i,
    /\bfunction\b/i,
  ];
  const hasComplexSignal = complexSignals.some((pattern) => pattern.test(lower));

  if (isVeryShort && hasMcqSignal && !hasComplexSignal) {
    return 'fast_fallback';
  }

  return 'normal';
}

function hasMeaningfulAiOutput(ai: { answer: string; explanation: string; steps: string[] }): boolean {
  const answer = ai.answer.trim();
  const explanation = ai.explanation.trim();
  const meaningfulSteps = ai.steps.map((s) => s.trim()).filter((s) => s.length >= 4);

  const isPlaceholderAnswer =
    answer.length === 0 ||
    answer.toLowerCase() === 'answer available in explanation';

  // If we have a real answer (not a placeholder), it's meaningful.
  if (!isPlaceholderAnswer) return true;

  // If it's a placeholder answer, we need some content elsewhere.
  if (meaningfulSteps.length > 0) return true;
  return explanation.length >= 10; // Lowered from 24 to support shorter quiz questions
}

function parseStyleMode(input: string): StyleMode {
  return input === 'exam' || input === 'eli5' || input === 'step_by_step' || input === 'gen_alpha'
    ? input
    : 'standard';
}

function normalizeQuestionForAi(raw: string): string {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

  if (!text) return '';

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  const merged: string[] = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(line);
      continue;
    }

    const isOptionLabel = /^[A-D][).:]?$/.test(line);
    if (isOptionLabel) {
      merged.push(line);
      continue;
    }

    const prevEndsSentence = /[.?!:]$/.test(prev);
    const isShortFragment = line.length <= 18 && prev.length <= 80;
    const prevLooksLabel = /^[A-D][).:]?$/.test(prev);

    if ((isShortFragment && !prevEndsSentence) || prevLooksLabel) {
      merged[merged.length - 1] = `${prev} ${line}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push(line);
    }
  }

  return merged
    .join('\n')
    .replace(/\s*([=+\-*/()])\s*/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

function repairLikelyFractionCopyArtifacts(normalized: string): string {
  const lines = normalized.split('\n');
  if (lines.length === 0) return normalized;

  const optionStart = lines.findIndex((line) => /^[A-D][).:]?\s+/i.test(line));
  const stemEnd = optionStart >= 0 ? optionStart : lines.length;

  const fixed = [...lines];
  for (let i = 0; i < stemEnd; i += 1) {
    const line = fixed[i];
    if (!line.includes('=')) continue;

    // Typical broken clipboard pattern: v = - 150x w  (intended: v = - w/(150x))
    const m1 = line.match(/\b([a-zA-Z])\s*=\s*-\s*([0-9]+[a-zA-Z]?)\s+([a-zA-Z])\b/);
    if (m1) {
      fixed[i] = `${m1[1]} = - ${m1[3]} / (${m1[2]})`;
      continue;
    }

    // Positive variant: v = 150x w  (intended: v = w/(150x))
    const m2 = line.match(/\b([a-zA-Z])\s*=\s*([0-9]+[a-zA-Z]?)\s+([a-zA-Z])\b/);
    if (m2) {
      fixed[i] = `${m2[1]} = ${m2[3]} / (${m2[2]})`;
    }
  }

  return fixed.join('\n');
}

function hasAmbiguousEquationFormatting(text: string): boolean {
  const lower = text.toLowerCase();
  const isEquationChoiceQuestion =
    lower.includes('which equation') || lower.includes('in terms of');
  if (!isEquationChoiceQuestion) return false;

  const hasMcqOptions = /\nA[).:]?\s+/i.test(text) && /\nD[).:]?\s+/i.test(text);
  if (!hasMcqOptions) return false;

  const lines = text.split('\n');
  const optionStart = lines.findIndex((line) => /^[A-D][).:]?\s+/i.test(line));
  const stem = (optionStart >= 0 ? lines.slice(0, optionStart) : lines).join(' ');

  // Suspicious flattened fraction patterns with no slash after '=' in the stem.
  const looksFlattened = /\b[a-zA-Z]\s*=\s*-?\s*[0-9]+[a-zA-Z]?\s+[a-zA-Z]\b/.test(stem);
  const hasDivision = /\/|\bdivided by\b/i.test(stem);

  // Enhancement: Only reject if it's very short and looks flattened.
  // If the stem is long, it likely contains enough context even if formatted poorly.
  const isExtremelyShort = stem.length < 50;

  return isExtremelyShort && looksFlattened && !hasDivision;
}

Deno.serve(async (req) => {
  const requestStartedAt = Date.now();
  const reqId = req.headers.get('x-request-id') || crypto.randomUUID();
  let runAuthUserId: string | null = null;
  let runStyleMode: StyleMode = 'standard';
  let runMode: 'normal' | 'fast_fallback' = 'normal';
  let runUsedFallback = false;
  let runModel: string | null = null;

  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    const form = await req.formData();
    const rawQuestion = String(form.get('question') ?? '').trim();
    const styleMode = parseStyleMode(String(form.get('style_mode') ?? 'standard').trim());
    runStyleMode = styleMode;
    const imageParts = await extractImageParts(form);
    const question =
      rawQuestion.length > 0
        ? rawQuestion
        : imageParts.length > 0
          ? 'Solve the attached question image.'
          : '';

    let history: Array<{ role: 'user' | 'model', text: string }> = [];
    const isBulk = form.get('is_bulk') === 'true';
    const historyRaw = form.get('history');
    if (historyRaw) {
      try {
        history = JSON.parse(String(historyRaw));
      } catch (err) {
        console.warn(`[${reqId}] Failed to parse history:`, err);
      }
    }
    const providedConversationId = String(form.get('conversation_id') || '').trim();
    const conversationId = providedConversationId || crypto.randomUUID();
    const normalizedQuestion = normalizeQuestionForAi(question);
    if (!normalizedQuestion) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }
    const repairedQuestion = repairLikelyFractionCopyArtifacts(normalizedQuestion);

    const user = await verifySupabaseAccessToken(token);
    runAuthUserId = user.id;
    const supabase = createSupabaseUserClient(token);
    const supabaseAdmin = createSupabaseAdminClient();

    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    const profile = await getProfileForSolve(supabase, user.id);
    if (!profile) {
      return jsonError(403, 'PROFILE_NOT_FOUND', 'Profile not found. Please sync profile first.');
    }
    if (profile.role !== 'authenticated') {
      return jsonError(403, 'ROLE_REQUIRED', 'User must complete onboarding');
    }

    const tier = profile.subscription_tier ?? 'free';
    const status = profile.subscription_status ?? 'inactive';
    const allCredits = profile.all_credits && profile.all_credits > 0 ? profile.all_credits : 50;
    const creditsUsed = profile.used_credits ?? 0;

    if (imageParts.length === 0 && tier !== 'pro' && hasAmbiguousEquationFormatting(repairedQuestion)) {
      return jsonError(
        422,
        'QUESTION_INCOMPLETE',
        'Equation formatting is ambiguous after copy. Please paste the full equation in plain text or attach a screenshot.',
      );
    }
    if (tier === 'pro' && status !== 'active') {
      return jsonError(402, 'PRO_SUBSCRIPTION_INACTIVE', 'Pro subscription is inactive');
    }

    if (tier === 'pro' && imageParts.length > 20) {
      return jsonError(400, 'IMAGE_LIMIT_EXCEEDED_PRO', 'Pro users can upload up to 20 images per bulk message.');
    }

    const freeImageLimit = isBulk ? 10 : 1;
    if (tier !== 'pro' && imageParts.length > freeImageLimit) {
      // For Free users, instead of erroring on auto-extracted images, we truncate.
      // This prevents "IMAGE_LIMIT_EXCEEDED" errors for Inline/Bulk solves.
      imageParts.splice(freeImageLimit);
    }

    const imageCount = imageParts.length;

    let nextCreditsUsed = creditsUsed;
    let nextMonthlyImagesUsed = profile.monthly_images_used ?? 0;
    if (tier !== 'pro') {
      if (creditsUsed >= allCredits) {
        return jsonError(429, 'CREDIT_LIMIT_REACHED', 'You have reached your free question limit. Upgrade to Pro for unlimited solutions.');
      }
      if (imageCount > 0) {
        const monthStart = currentMonthStartIsoDate();
        const currentMonthlyImagesUsed =
          profile.monthly_images_period === monthStart ? (profile.monthly_images_used ?? 0) : 0;
        if (currentMonthlyImagesUsed + imageCount > 10) {
          return jsonError(429, 'IMAGE_LIMIT_REACHED', 'Monthly image limit reached. Upgrade to Pro for more uploads.');
        }
      }
    }

    const initialMode = chooseAiMode(repairedQuestion, imageCount > 0, styleMode);
    runMode = initialMode;
    let aiFallbackUsed = false;
    let ai;
    try {
      ai = await callAiProxy(repairedQuestion, imageParts, initialMode, styleMode, history);
    } catch (error) {
      if (error instanceof AiError && (
        error.code === 'AI_TIMEOUT' ||
        error.code === 'AI_INCOMPLETE_OUTPUT' ||
        error.code === 'AI_PROVIDER_ERROR'
      )) {
        aiFallbackUsed = true;
        try {
          ai = await callAiProxy(repairedQuestion, imageParts, 'fast_fallback', styleMode, history);
        } catch (fallbackError) {
          if (fallbackError instanceof AiError && fallbackError.code === 'AI_INCOMPLETE_OUTPUT') {
            const conciseQuestion = `${repairedQuestion}\n\nOutput constraint: Keep response concise with max 3 steps while preserving correctness.`;
            try {
              ai = await callAiProxy(conciseQuestion, imageParts, 'fast_fallback', styleMode, history);
            } catch (finalFallbackError) {
              if (finalFallbackError instanceof AiError && finalFallbackError.code === 'AI_INCOMPLETE_OUTPUT') {
                const ultraCompactQuestion =
                  `${repairedQuestion}\n\nOutput constraint: Return FINAL_ANSWER and only 2 short reasoning steps.`;
                ai = await callAiProxy(ultraCompactQuestion, imageParts, 'fast_fallback', 'standard', history);
              } else {
                throw finalFallbackError;
              }
            }
          } else {
            throw fallbackError;
          }
        }
      } else {
        throw error;
      }
    }

    if (!hasMeaningfulAiOutput(ai)) {
      return jsonError(
        503,
        'RETRYABLE_AI_OUTPUT',
        'AI returned incomplete output. Please retry. Credits were not consumed.',
        { retryable: true },
      );
    }

    if (ai.answer.trim().toUpperCase() === 'INCOMPLETE_QUESTION') {
      return jsonError(
        422,
        'QUESTION_INCOMPLETE',
        'Oryx needs more context or the question is incomplete. Please try rephrasing or attaching a clear screenshot.',
      );
    }
    runUsedFallback = aiFallbackUsed;
    runMode = aiFallbackUsed ? 'fast_fallback' : initialMode;
    runModel = ai.model ?? null;

    if (tier !== 'pro') {
      nextCreditsUsed = await consumeCreditForFreeTier(
        supabaseAdmin,
        profile.id,
        creditsUsed,
      );
      if (imageCount > 0) {
        const imageQuota = await consumeMonthlyImageQuotaForFreeTier(
          supabaseAdmin,
          profile.id,
          profile.monthly_images_used ?? 0,
          profile.monthly_images_period ?? null,
          imageCount,
        );
        nextMonthlyImagesUsed = imageQuota.nextMonthlyUsed;
      }
    }

    // History persistence is best-effort and should never fail solve.
    const { id: historyId } = await saveHistoryEntry(supabaseAdmin, {
      authUserId: user.id,
      question: repairedQuestion,
      answer: ai.answer,
      explanation: ai.explanation,
      conversationId,
      styleMode,
      image_urls: form.getAll('image_urls').filter(Boolean).map(url => String(url)),
      is_bulk: isBulk,
      steps: ai.steps,
    });

    const isBulkAsk = 
      question.includes("answer key for the following questions") ||
      question.includes("Create an answer key for these practice questions");

    const responseBody: SolveSuccessResponse = {
      api_version: 'v1',
      ok: true,
      answer: ai.answer,
      explanation: ai.explanation,
      usage: {
        subscriptionTier: tier === 'pro' ? 'pro' : 'free',
        subscriptionStatus: status === 'active' ? 'active' : status === 'canceled' ? 'canceled' : 'inactive',
        totalCredits: allCredits,
        usedCredits: nextCreditsUsed,
        remainingCredits: Math.max(allCredits - nextCreditsUsed, 0),
        monthlyImagesUsed: nextMonthlyImagesUsed,
        monthlyImagesLimit: 10,
      },
      metadata: {
        model: ai.model,
        aiMode: aiFallbackUsed ? 'fast_fallback' : initialMode,
        styleMode,
        conversationId,
        isBulk
      },
      suggestions: ai.suggestions,
      steps: isBulkAsk ? ai.steps : [
        ...ai.steps,
        ...(aiFallbackUsed ? ['Fast fallback mode was used to reduce latency.'] : []),
        tier === 'pro'
          ? 'Pro plan: usage not capped by credits.'
          : `Credits used: ${nextCreditsUsed}/${allCredits}. Images this month: ${nextMonthlyImagesUsed}/10`,
      ],
    };

    void logSolveRun(supabaseAdmin, {
      authUserId: user.id,
      mode: runMode,
      styleMode: runStyleMode,
      model: runModel,
      latencyMs: Date.now() - requestStartedAt,
      status: 'success',
      usedFallback: runUsedFallback,
    }).catch((error) => {
      console.error(`[${reqId}] Solve run logging failed:`, error);
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (runAuthUserId) {
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        await logSolveRun(supabaseAdmin, {
          authUserId: runAuthUserId,
          mode: runMode,
          styleMode: runStyleMode,
          model: runModel,
          latencyMs: Date.now() - requestStartedAt,
          status: 'error',
          errorCode: err instanceof AiError || err instanceof AppError ? err.code : 'SOLVE_FAILED',
          usedFallback: runUsedFallback,
        });
      } catch (logError) {
        console.error(`[${reqId}] Solve run logging failed:`, logError);
      }
    }

    console.error(`[${reqId}] Solve error:`, err);

    if (err instanceof AiError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Solve request failed';
    return jsonError(500, 'SOLVE_FAILED', message);
  }
});
