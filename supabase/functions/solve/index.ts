import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifyFirebaseIdToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
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

async function callAiProxy(
  question: string,
  imageParts: Array<{ inlineData: { mimeType: string; data: string } }>,
): Promise<{ answer: string; explanation: string; steps: string[] }> {
  const internalToken = Deno.env.get('INTERNAL_EDGE_TOKEN');
  if (!internalToken) {
    throw new AppError(500, 'INTERNAL_TOKEN_MISSING', 'Missing INTERNAL_EDGE_TOKEN secret');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new AppError(500, 'SUPABASE_URL_MISSING', 'Missing SUPABASE_URL');
  }

  const url = `${supabaseUrl}/functions/v1/ai-proxy`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': internalToken,
    },
    body: JSON.stringify({
      question,
      imageParts,
    }),
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
  };
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
    const question = String(form.get('question') ?? '').trim();
    if (!question) {
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }
    const imageParts = await extractImageParts(form);

    const supabase = createSupabaseAdminClient();
    const user = await verifyFirebaseIdToken(token);

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

    const ai = await callAiProxy(question, imageParts);

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
          steps: [
            ...ai.steps,
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
