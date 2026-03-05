import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifyFirebaseIdToken } from '../_shared/auth.ts';
import { createSupabaseUserClient } from '../_shared/db.ts';
import {
  consumeCreditForFreeTier,
  consumeMonthlyImageQuotaForFreeTier,
  currentMonthStartIsoDate,
  getProfileForSolve,
} from '../_shared/profile.ts';

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

type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

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
  const imageEntries = [...form.getAll('images'), form.get('image')].filter(Boolean);
  const uniqueFiles: File[] = [];
  const seen = new Set<string>();

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) continue;
    const key = `${entry.name}:${entry.size}:${entry.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFiles.push(entry);
  }

  const maxFileSizeBytes = 5 * 1024 * 1024;
  const selected = uniqueFiles;

  const parts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (const file of selected) {
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

  if (isPlaceholderAnswer) return false;
  if (meaningfulSteps.length > 0) return true;
  return explanation.length >= 24;
}

async function callAiProxy(
  question: string,
  imageParts: Array<{ inlineData: { mimeType: string; data: string } }>,
  mode: 'normal' | 'fast_fallback' = 'normal',
  styleMode: StyleMode = 'standard',
): Promise<{ answer: string; explanation: string; steps: string[]; model: string; suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }> }> {
  const internalToken = Deno.env.get('INTERNAL_EDGE_TOKEN');
  if (!internalToken) {
    throw new AppError(500, 'INTERNAL_TOKEN_MISSING', 'Missing INTERNAL_EDGE_TOKEN secret');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new AppError(500, 'SUPABASE_URL_MISSING', 'Missing SUPABASE_URL');
  }

  const url = `${supabaseUrl}/functions/v1/ai-proxy`;
  const controller = new AbortController();
  const timeoutMs = mode === 'fast_fallback' ? 7000 : 12000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken,
      },
      body: JSON.stringify({
        question,
        imageParts,
        mode,
        styleMode,
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
      throw new AppError(res.status === 429 ? 429 : 502, code, message);
    }

    const data = await res.json();
    return {
      answer: typeof data?.answer === 'string' ? data.answer : 'Answer available in explanation',
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
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(504, 'AI_TIMEOUT', 'AI response timed out. Please retry.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
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
    const styleModeRaw = String(form.get('style_mode') ?? 'standard').trim();
    const styleMode: StyleMode =
      styleModeRaw === 'exam' ||
      styleModeRaw === 'eli5' ||
      styleModeRaw === 'step_by_step' ||
      styleModeRaw === 'gen_alpha'
        ? styleModeRaw
        : 'standard';
    const imageParts = await extractImageParts(form);
    const question =
      rawQuestion.length > 0
        ? rawQuestion
        : imageParts.length > 0
          ? 'Solve the attached question image.'
          : '';
    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }

    const user = await verifyFirebaseIdToken(token);
    const supabase = createSupabaseUserClient(token);

    if (!user.emailVerified) {
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    const profile = await getProfileForSolve(supabase, user.localId);
    if (!profile) {
      return jsonError(403, 'PROFILE_NOT_FOUND', 'Profile not found. Please sync profile first.');
    }

    const tier = profile.subscription_tier ?? 'free';
    const status = profile.subscription_status ?? 'inactive';
    const allCredits = profile.all_credits && profile.all_credits > 0 ? profile.all_credits : 50;
    const creditsUsed = profile.used_credits ?? 0;
    const imageCount = imageParts.length;



    if (tier === 'pro' && status !== 'active') {
      return jsonError(402, 'PRO_SUBSCRIPTION_INACTIVE', 'Pro subscription is inactive');
    }

    if (tier === 'pro' && imageCount > 4) {
      return jsonError(400, 'IMAGE_LIMIT_EXCEEDED_PRO', 'Pro users can upload up to 4 images per message.');
    }

    if (tier !== 'pro' && imageCount > 1) {
      return jsonError(400, 'IMAGE_LIMIT_EXCEEDED_FREE', 'Free users can upload only 1 image per message.');
    }

    let nextCreditsUsed = creditsUsed;
    let nextMonthlyImagesUsed = profile.monthly_images_used ?? 0;
    if (tier !== 'pro') {
      if (creditsUsed >= allCredits) {
        return jsonError(429, 'LIMIT_EXCEEDED', 'Credit limit reached');
      }
      if (imageCount > 0) {
        const monthStart = currentMonthStartIsoDate();
        const currentMonthlyImagesUsed =
          profile.monthly_images_period === monthStart ? (profile.monthly_images_used ?? 0) : 0;
        if (currentMonthlyImagesUsed + imageCount > 10) {
          return jsonError(429, 'MONTHLY_IMAGE_LIMIT_EXCEEDED', 'Free users can upload up to 10 images per month.');
        }
      }
    }

    const initialMode = chooseAiMode(question, imageCount > 0, styleMode);
    let aiFallbackUsed = false;
    let ai;
    try {
      ai = await callAiProxy(question, imageParts, initialMode, styleMode);
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_TIMEOUT') {
        aiFallbackUsed = true;
        ai = await callAiProxy(question, [], 'fast_fallback', styleMode);
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

    if (tier !== 'pro') {
      nextCreditsUsed = await consumeCreditForFreeTier(
        supabase,
        profile.id,
        creditsUsed,
      );
      if (imageCount > 0) {
        const imageQuota = await consumeMonthlyImageQuotaForFreeTier(
          supabase,
          profile.id,
          profile.monthly_images_used ?? 0,
          profile.monthly_images_period ?? null,
          imageCount,
        );
        nextMonthlyImagesUsed = imageQuota.nextMonthlyUsed;
      }
    }

    return new Response(
        JSON.stringify({
          ok: true,
          answer: ai.answer,
          explanation: ai.explanation,
          usage: {
            subscriptionTier: tier,
            subscriptionStatus: status,
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
          },
          suggestions: ai.suggestions,
          steps: [
            ...ai.steps,
            ...(aiFallbackUsed ? ['Fast fallback mode was used to reduce latency.'] : []),
            tier === 'pro'
              ? 'Pro plan: usage not capped by credits.'
              : `Credits used: ${nextCreditsUsed}/${allCredits}. Images this month: ${nextMonthlyImagesUsed}/10`,
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Solve request failed';
    return jsonError(500, 'SOLVE_FAILED', message);
  }
});

