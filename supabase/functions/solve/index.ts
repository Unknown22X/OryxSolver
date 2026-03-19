import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { callAiProxy, AiError } from '../_shared/ai.ts';
import { saveHistoryEntry } from '../_shared/history.ts';
import { logSolveRun } from '../_shared/solveRuns.ts';
import { getMonthlyUsage, getPlanLimits, isUnlimited, recordUsageEvent } from '../_shared/usage.ts';
import { getCachedAnswer, saveToCache } from '../_shared/cache.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { AppError, corsHeaders, handleOptions, jsonError } from '../_shared/http.ts';
import {
  getProfileForSolve,
  getUserSubscription,
} from '../_shared/profile.ts';
import { consumePaygoCredit, getPaygoCreditsRemaining } from '../_shared/creditWallet.ts';
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

type ImagePart = { inlineData: { mimeType: string; data: string } };

type ExtractedImages = {
  acceptedUrls: string[];
  parts: ImagePart[];
};

function assertQuestionLength(question: string) {
  if (question.length > 12000) {
    throw new AppError(413, 'QUESTION_TOO_LARGE', 'Question is too long. Please shorten it and retry.');
  }
}

function sanitizeConversationId(input: FormDataEntryValue | null): string {
  const raw = String(input ?? '').trim();
  if (!raw) return crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) {
    throw new AppError(400, 'INVALID_CONVERSATION_ID', 'conversation_id must be a UUID.');
  }
  return raw;
}

function parseHistory(input: FormDataEntryValue | null): Array<{ role: 'user' | 'model'; text: string }> {
  if (!input) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(input));
  } catch {
    throw new AppError(400, 'INVALID_HISTORY', 'history must be valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new AppError(400, 'INVALID_HISTORY', 'history must be an array.');
  }

  if (parsed.length > 12) {
    throw new AppError(413, 'HISTORY_TOO_LARGE', 'Too many history items. Send up to 12 turns.');
  }

  let totalChars = 0;
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new AppError(400, 'INVALID_HISTORY', `history[${index}] must be an object.`);
    }

    const role = (entry as { role?: unknown }).role;
    const text = String((entry as { text?: unknown }).text ?? '').trim();
    if (role !== 'user' && role !== 'model') {
      throw new AppError(400, 'INVALID_HISTORY', `history[${index}].role is invalid.`);
    }
    if (!text) {
      throw new AppError(400, 'INVALID_HISTORY', `history[${index}].text is required.`);
    }
    if (text.length > 2000) {
      throw new AppError(413, 'HISTORY_TOO_LARGE', `history[${index}] is too long.`);
    }

    totalChars += text.length;
    if (totalChars > 12000) {
      throw new AppError(413, 'HISTORY_TOO_LARGE', 'Combined history is too large.');
    }

    return { role, text };
  });
}

async function extractImageParts(form: FormData): Promise<ExtractedImages> {
  const images = form.getAll('images');
  const imageUrls = form.getAll('image_urls').filter(Boolean);
  const imageEntries = [...images, form.get('image')].filter(Boolean);

  console.log('[SOLVE] Image entries:', imageEntries.length, 'Image URLs:', imageUrls.length);

  const uniqueFiles: File[] = [];
  const seen = new Set<string>();

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) continue;
    const key = `${entry.name}:${entry.size}:${entry.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFiles.push(entry);
    console.log('[SOLVE] File image:', entry.name, entry.size, entry.type);
  }

  const acceptedUrls: string[] = [];
  const parts: ImagePart[] = [];
  const maxFileSizeBytes = 5 * 1024 * 1024;
  const maxAggregateImageBytes = 15 * 1024 * 1024;
  let totalBytes = 0;

  // Process standard file uploads
  for (const file of uniqueFiles) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxFileSizeBytes) {
      throw new AppError(413, 'IMAGE_TOO_LARGE', `Image "${file.name}" is too large. Max size is 5MB.`);
    }
    totalBytes += file.size;
    if (totalBytes > maxAggregateImageBytes) {
      throw new AppError(413, 'IMAGE_BATCH_TOO_LARGE', 'Combined image uploads exceed the 15MB request limit.');
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
    console.log('[SOLVE] Image URL:', url?.substring(0, 80));
    if (!url) continue;
    
    // Support Data URLs (base64) directly to avoid fetch errors
    if (url.startsWith('data:image/')) {
      try {
        const [meta, b64] = url.split(',');
        const mimeMatch = meta.match(/data:(.*?);base64/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const estimatedBytes = Math.ceil((b64?.length ?? 0) * 0.75);
        if (estimatedBytes > maxFileSizeBytes) {
          throw new AppError(413, 'IMAGE_TOO_LARGE', 'Inline image is too large. Max size is 5MB.');
        }
        totalBytes += estimatedBytes;
        if (totalBytes > maxAggregateImageBytes) {
          throw new AppError(413, 'IMAGE_BATCH_TOO_LARGE', 'Combined image uploads exceed the 15MB request limit.');
        }
        if (b64 && b64.length < 8_000_000) {
          parts.push({
            inlineData: {
              mimeType: mime,
              data: b64,
            },
          });
          acceptedUrls.push(url);
          continue;
        }
      } catch (err) {
        console.warn(`Failed to parse data URL`, err);
      }
    }

    if (/^https?:\/\//i.test(url)) {
      throw new AppError(
        400,
        'REMOTE_IMAGE_URLS_NOT_ALLOWED',
        'Remote image URLs are not supported. Upload the image directly instead.',
      );
    }
  }

  return { acceptedUrls, parts };
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
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[\u201C\u201D\u200C]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
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
  const options = handleOptions(req);
  if (options) return options;
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

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/solve', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.', {
      retryAfter: rateLimit.retryAfter
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
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

    const subscription = await getUserSubscription(supabase, user.id);
    const rawTier = (subscription.tier ?? 'free') as 'free' | 'pro' | 'premium';
    const rawStatus = subscription.status ?? 'inactive';
    const isActiveSubscription = rawStatus === 'active' || rawStatus === 'trialing';
    const tier = isActiveSubscription
      ? (rawTier === 'premium' ? 'premium' : rawTier === 'pro' ? 'pro' : 'free')
      : 'free';
    const status = isActiveSubscription ? rawStatus : 'inactive';
    const planLimits = getPlanLimits(tier);
    const monthlyUsage = await getMonthlyUsage(supabaseAdmin, user.id);

    const paygoRemaining = await getPaygoCreditsRemaining(supabaseAdmin, user.id);

    const form = await req.formData();
    const rawQuestion = String(form.get('question') ?? '').trim();
    assertQuestionLength(rawQuestion);
    const styleMode = parseStyleMode(String(form.get('style_mode') ?? 'standard').trim());
    runStyleMode = styleMode;
    const { acceptedUrls: acceptedImageUrls, parts: imageParts } = await extractImageParts(form);
    const question =
      rawQuestion.length > 0
        ? rawQuestion
        : imageParts.length > 0
          ? 'Solve the attached question image.'
          : '';

    const isBulk = form.get('is_bulk') === 'true';
    const history = parseHistory(form.get('history'));
    const isFollowUp = history.length > 0 && !isBulk;
    const conversationId = sanitizeConversationId(form.get('conversation_id'));
    const normalizedQuestion = normalizeQuestionForAi(question);
    if (!normalizedQuestion) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }
    const repairedQuestion = repairLikelyFractionCopyArtifacts(normalizedQuestion);

    // Check cache first (skip if has images - can't cache images)
    let cachedAnswer: string | null = null;
    if (imageParts.length === 0) {
      const cached = await getCachedAnswer(repairedQuestion);
      if (cached) {
        cachedAnswer = cached.answer;
        console.log(`[CACHE HIT] "${repairedQuestion.substring(0, 50)}..."`);
      }
    }

    if (imageParts.length === 0 && tier === 'free' && hasAmbiguousEquationFormatting(repairedQuestion)) {
      return jsonError(
        422,
        'QUESTION_INCOMPLETE',
        'Equation formatting is ambiguous after copy. Please paste the full equation in plain text or attach a screenshot.',
      );
    }

    if (tier === 'free' && (styleMode === 'gen_alpha' || styleMode === 'step_by_step')) {
      return jsonError(403, 'MODE_LOCKED', 'This mode is not available on the Free plan.');
    }

    const imageCount = imageParts.length;
    const maxImagesPerRequest = 20;
    if (imageCount > maxImagesPerRequest) {
      return jsonError(400, 'IMAGE_LIMIT_EXCEEDED', `You can upload up to ${maxImagesPerRequest} images per request.`);
    }
    const nextQuestionsUsed = monthlyUsage.questionsUsed + (isFollowUp ? 0 : 1);
    const nextBulkUsed = monthlyUsage.bulkUsed + (isBulk ? 1 : 0);
    const nextStepQuestionsUsed = monthlyUsage.stepQuestionsUsed + (isFollowUp ? 1 : 0);
    const nextImagesUsed = monthlyUsage.imagesUsed + imageCount;

    let usePaygoCredit = false;

    if (!isFollowUp && !isUnlimited(planLimits.questions) && nextQuestionsUsed > planLimits.questions) {
      if (tier === 'free' && paygoRemaining > 0) {
        usePaygoCredit = true;
      } else {
        return jsonError(429, 'QUESTION_LIMIT_REACHED', 'Monthly question limit reached. Upgrade to Pro or Premium for more usage.');
      }
    }

    if (isBulk && !isUnlimited(planLimits.bulk) && nextBulkUsed > planLimits.bulk) {
      return jsonError(429, 'BULK_LIMIT_REACHED', 'Bulk solve limit reached for this plan.');
    }

    if (imageCount > 0 && !isUnlimited(planLimits.images) && nextImagesUsed > planLimits.images) {
      return jsonError(429, 'IMAGE_LIMIT_REACHED', 'Monthly image limit reached for this plan.');
    }

    const buildUsagePayload = (
      questionsUsed: number,
      imagesUsed: number,
      bulkUsed: number,
      stepQuestionsUsed: number,
      paygoRemainingOverride: number,
    ) => ({
      subscriptionTier: tier,
      subscriptionStatus: status,
      monthlyQuestionsUsed: questionsUsed,
      monthlyQuestionsLimit: planLimits.questions,
      monthlyQuestionsRemaining: isUnlimited(planLimits.questions)
        ? -1
        : Math.max(planLimits.questions - questionsUsed, 0),
      stepQuestionsUsed,
      monthlyImagesUsed: imagesUsed,
      monthlyImagesLimit: planLimits.images,
      monthlyBulkUsed: bulkUsed,
      monthlyBulkLimit: planLimits.bulk,
      paygoCreditsRemaining: paygoRemainingOverride,
    });
    // Return cached answer if we have one (skip AI, still count usage)
    if (cachedAnswer) {
      const nextPaygoRemaining = usePaygoCredit ? Math.max(paygoRemaining - 1, 0) : paygoRemaining;
      if (usePaygoCredit) {
        await consumePaygoCredit(supabaseAdmin, user.id, 1, {
          conversationId,
          mode: runMode,
          styleMode,
          source: 'cache_hit',
        });
      }

      await recordUsageEvent(supabaseAdmin, user.id, isFollowUp ? 'step_followup' : isBulk ? 'bulk_solve' : 'solve', 1, {
        mode: runMode,
        style: styleMode,
        images: imageCount,
        is_follow_up: isFollowUp,
        conversation_id: conversationId,
      });
      if (imageCount > 0) {
        await recordUsageEvent(supabaseAdmin, user.id, 'image_vision', imageCount, {
          mode: runMode,
          style: styleMode,
          conversation_id: conversationId,
        });
      }

      const responseBody: SolveSuccessResponse = {
        api_version: 'v1',
        ok: true,
        answer: cachedAnswer,
        explanation: '[This answer was retrieved from cache - asked before]',
        usage: buildUsagePayload(nextQuestionsUsed, nextImagesUsed, nextBulkUsed, nextStepQuestionsUsed, nextPaygoRemaining),
        metadata: {
          model: 'cache',
          aiMode: 'normal',
          styleMode,
          conversationId,
          isBulk,
          isFollowUp,
        },
        suggestions: [],
        steps: ['Answer retrieved from cache (no AI call needed)'],
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Save to cache for future (only for text-only questions)
    if (imageCount === 0 && ai.answer.trim().toUpperCase() !== 'INCOMPLETE_QUESTION') {
      try {
        await saveToCache(repairedQuestion, ai.answer);
        console.log(`[CACHE SAVE] "${repairedQuestion.substring(0, 50)}..."`);
      } catch (cacheErr) {
        console.warn('[CACHE SAVE FAILED]', cacheErr);
      }
    }

    // History persistence is best-effort and should never fail solve.
    await saveHistoryEntry(supabaseAdmin, {
      authUserId: user.id,
      question: repairedQuestion,
      answer: ai.answer,
      explanation: ai.explanation,
      conversationId,
      styleMode,
      image_urls: acceptedImageUrls,
      is_bulk: isBulk,
      steps: ai.steps,
    });

    const nextPaygoRemaining = usePaygoCredit ? Math.max(paygoRemaining - 1, 0) : paygoRemaining;
    if (usePaygoCredit) {
      await consumePaygoCredit(supabaseAdmin, user.id, 1, {
        conversationId,
        mode: runMode,
        styleMode,
        source: 'solve',
      });
    }

    const responseBody: SolveSuccessResponse = {
      api_version: 'v1',
      ok: true,
      answer: ai.answer,
      explanation: ai.explanation,
      usage: buildUsagePayload(nextQuestionsUsed, nextImagesUsed, nextBulkUsed, nextStepQuestionsUsed, nextPaygoRemaining),
      metadata: {
        model: ai.model,
        aiMode: aiFallbackUsed ? 'fast_fallback' : initialMode,
        styleMode,
        conversationId,
        isBulk,
        isFollowUp,
      },
      suggestions: ai.suggestions,
      steps: ai.steps,
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

    await recordUsageEvent(supabaseAdmin, user.id, isFollowUp ? 'step_followup' : isBulk ? 'bulk_solve' : 'solve', 1, {
      mode: runMode,
      style: styleMode,
      images: imageCount,
      is_follow_up: isFollowUp,
      conversation_id: conversationId,
    });
    if (imageCount > 0) {
      await recordUsageEvent(supabaseAdmin, user.id, 'image_vision', imageCount, {
        mode: runMode,
        style: styleMode,
        conversation_id: conversationId,
      });
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
