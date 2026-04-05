import '@supabase/functions-js/edge-runtime.d.ts';
import { getBearerToken, verifySupabaseAccessToken } from '../_shared/auth.ts';
import { createSupabaseAdminClient, createSupabaseUserClient } from '../_shared/db.ts';
import { callAiProxy, callAiProxyStream, AiError } from '../_shared/ai.ts';
import { persistHistoryImageFiles, saveHistoryEntry } from '../_shared/history.ts';
import { logSolveRun } from '../_shared/solveRuns.ts';
import { getMonthlyUsage, getPlanLimits, isUnlimited, recordUsageEvent } from '../_shared/usage.ts';
import { getCachedAnswer, saveToCache } from '../_shared/cache.ts';
import { checkRateLimitMany, getClientIp } from '../_shared/rateLimit.ts';
import { AppError, corsHeaders, handleOptions, jsonError } from '../_shared/http.ts';
import {
  getProfileForSolve,
  getUserSubscription,
  upsertProfileFromAuthUser,
} from '../_shared/profile.ts';
import { consumePaygoCredit, getPaygoCreditsRemaining } from '../_shared/creditWallet.ts';
import type { SolveStatusEvent, SolveStreamEvent, SolveSuccessResponse, StyleMode } from '../_shared/contracts.ts';
import { recordDependencyState } from '../_shared/serviceHealth.ts';

type AiProxyStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'final';
      data: {
        answer?: string;
        explanation?: string;
        steps?: string[];
        model?: string;
        suggestions?: Array<{ label?: string; prompt?: string; styleMode?: StyleMode }>;
        cost_usd?: number;
      };
    }
  | { type: 'error'; code?: string; message: string };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function isPrivateIpHost(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const parts = match.slice(1).map((value) => Number.parseInt(value, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isRemoteImageUrlAllowed(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // Only allow https URLs (or http for localhost during local development).
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
    return false;
  }

  // Basic SSRF guard: block obvious local/private hosts and IP ranges.
  if (hostname === '0.0.0.0') return false;
  if (hostname.endsWith('.local')) return false;
  if (isLocalhost) return false;
  if (isPrivateIpHost(hostname)) return false;

  return true;
}

type ImagePart = { inlineData: { mimeType: string; data: string } };

type ExtractedImages = {
  acceptedUrls: string[];
  parts: ImagePart[];
  uploads: File[];
};

const MAX_HISTORY_ENTRY_CHARS = 12000;
const MAX_HISTORY_INPUT_ITEMS = 20;
const MAX_HISTORY_TOTAL_CHARS = 24000;
const TARGET_HISTORY_ITEMS = 6;
const SAFE_HISTORY_CHAR_BUDGET = 16000;

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

  if (parsed.length > MAX_HISTORY_INPUT_ITEMS) {
    throw new AppError(413, 'HISTORY_TOO_LARGE', `Too many history items. Send up to ${MAX_HISTORY_INPUT_ITEMS} entries.`);
  }

  const validated = parsed.map((entry, index) => {
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
    if (text.length > MAX_HISTORY_ENTRY_CHARS) {
      throw new AppError(413, 'HISTORY_TOO_LARGE', `history[${index}] is too long.`);
    }

    return { role, text };
  });

  let totalChars = 0;
  const trimmedNewestFirst: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (let index = validated.length - 1; index >= 0; index -= 1) {
    const entry = validated[index];
    if (
      trimmedNewestFirst.length >= TARGET_HISTORY_ITEMS ||
      totalChars + entry.text.length > SAFE_HISTORY_CHAR_BUDGET
    ) {
      continue;
    }

    trimmedNewestFirst.push(entry);
    totalChars += entry.text.length;
  }

  const trimmed = trimmedNewestFirst.reverse();
  if (totalChars > MAX_HISTORY_TOTAL_CHARS) {
    throw new AppError(413, 'HISTORY_TOO_LARGE', 'Combined history is too large.');
  }

  return trimmed;
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
      if (!isRemoteImageUrlAllowed(url)) {
        throw new AppError(
          400,
          'REMOTE_IMAGE_URL_BLOCKED',
          'Remote image URLs must be https and not point to local/private hosts. Please upload the image directly.',
        );
      }
      try {
        console.log('[SOLVE] Fetching remote image:', url.substring(0, 100));
        const imgResp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);
        
        const contentType = imgResp.headers.get('content-type') || 'image/png';
        if (!contentType.startsWith('image/')) {
          console.warn('[SOLVE] Skip non-image URL:', url);
          continue;
        }

        const contentLength = parseInt(imgResp.headers.get('content-length') || '0', 10);
        if (contentLength > maxFileSizeBytes) {
          throw new AppError(413, 'IMAGE_TOO_LARGE', `Remote image at ${url.substring(0, 30)}... is too large.`);
        }

        const buffer = await imgResp.arrayBuffer();
        if (buffer.byteLength > maxFileSizeBytes) {
          throw new AppError(413, 'IMAGE_TOO_LARGE', 'Remote image content exceeds 5MB limit.');
        }

        totalBytes += buffer.byteLength;
        if (totalBytes > maxAggregateImageBytes) {
          throw new AppError(413, 'IMAGE_BATCH_TOO_LARGE', 'Total image size including remote URLs exceeds 15MB limit.');
        }

        parts.push({
          inlineData: {
            mimeType: contentType,
            data: bytesToBase64(new Uint8Array(buffer)),
          },
        });
        acceptedUrls.push(url);
        continue;
      } catch (err) {
        console.error(`[SOLVE] Failed to fetch remote image: ${url}`, err);
        if (parts.length > 0) {
          console.warn('[SOLVE] Skipping remote image because another image part is already attached:', url.substring(0, 100));
          continue;
        }
        throw new AppError(400, 'REMOTE_IMAGE_FETCH_FAILED', `Failed to retrieve image: ${url}. Please upload it directly.`);
      }
    }
  }

  return {
    acceptedUrls,
    parts,
    uploads: uniqueFiles.filter((file) => file.type.startsWith('image/')),
  };
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

function isCacheSafeRequest(params: {
  imageCount: number;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  quotedStep: unknown;
  isBulk: boolean;
}) {
  return params.imageCount === 0 &&
    params.history.length === 0 &&
    !params.quotedStep &&
    !params.isBulk;
}

function isPreviewEligibleRequest(params: {
  imageCount: number;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  quotedStep: unknown;
  isBulk: boolean;
  styleMode: StyleMode;
  repairedQuestion: string;
}) {
  return params.imageCount === 0 &&
    !params.isBulk &&
    !params.quotedStep &&
    params.history.length <= 4 &&
    (params.styleMode === 'standard' || params.styleMode === 'exam' || params.styleMode === 'eli5') &&
    params.repairedQuestion.length <= 220;
}

function getPreviewRejectionReasons(params: {
  imageCount: number;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  quotedStep: unknown;
  isBulk: boolean;
  styleMode: StyleMode;
  repairedQuestion: string;
}) {
  const reasons: string[] = [];
  if (params.imageCount > 0) reasons.push('has_images');
  if (params.isBulk) reasons.push('is_bulk');
  if (params.quotedStep) reasons.push('quoted_step');
  if (params.history.length > 4) reasons.push('history_too_long');
  if (!['standard', 'exam', 'eli5'].includes(params.styleMode)) reasons.push('style_mode_not_supported');
  if (params.repairedQuestion.length > 220) reasons.push('question_too_long');
  return reasons;
}

type StreamWrite = (event: SolveStreamEvent) => void;

function createStreamWriter(): { response: Response; write: StreamWrite; close: () => void } {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  return {
    response: new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    }),
    write(event) {
      if (!controllerRef || closed) return;
      try {
        controllerRef.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      } catch (error) {
        closed = true;
        controllerRef = null;
        console.warn('[solve] stream write failed', error);
      }
    },
    close() {
      if (!controllerRef || closed) return;
      try {
        controllerRef.close();
      } catch (error) {
        console.warn('[solve] stream close failed', error);
      } finally {
        closed = true;
        controllerRef = null;
      }
    },
  };
}

function isAiProxyStreamEvent(value: unknown): value is AiProxyStreamEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as { type?: unknown };
  return event.type === 'delta' || event.type === 'final' || event.type === 'error';
}

async function readAiProxyStream(
  response: Response,
  onDelta: (text: string) => void,
): Promise<{
  answer: string;
  explanation: string;
  steps: string[];
  model: string;
  suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }>;
  cost_usd?: number;
}> {
  if (!response.body) {
    throw new AiError(502, 'AI_STREAM_MISSING', 'AI stream returned no body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: {
    answer?: string;
    explanation?: string;
    steps?: string[];
    model?: string;
    suggestions?: Array<{ label?: string; prompt?: string; styleMode?: StyleMode }>;
    cost_usd?: number;
  } | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (!isAiProxyStreamEvent(parsed)) continue;

        if (parsed.type === 'delta') {
          onDelta(parsed.text);
          continue;
        }

        if (parsed.type === 'error') {
          throw new AiError(502, parsed.code || 'AI_PROXY_STREAM_ERROR', parsed.message);
        }

        finalPayload = parsed.data;
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      try {
        const parsed: unknown = JSON.parse(trailing);
        if (isAiProxyStreamEvent(parsed)) {
          if (parsed.type === 'delta') {
            onDelta(parsed.text);
          } else if (parsed.type === 'error') {
            throw new AiError(502, parsed.code || 'AI_PROXY_STREAM_ERROR', parsed.message);
          } else {
            finalPayload = parsed.data;
          }
        }
      } catch {
        // Ignore malformed trailing fragments.
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalPayload) {
    throw new AiError(503, 'AI_STREAM_INTERRUPTED', 'AI stream ended before the final response.');
  }

  return {
    answer: typeof finalPayload.answer === 'string' ? finalPayload.answer : '',
    explanation: typeof finalPayload.explanation === 'string' ? finalPayload.explanation : '',
    steps: Array.isArray(finalPayload.steps) ? finalPayload.steps.map((step) => String(step)) : [],
    model: typeof finalPayload.model === 'string' && finalPayload.model.trim() ? finalPayload.model : 'unknown',
    suggestions: Array.isArray(finalPayload.suggestions)
      ? finalPayload.suggestions
          .filter((item) => typeof item?.prompt === 'string' && item.prompt.trim())
          .map((item) => ({
            label: typeof item?.label === 'string' ? item.label : 'Try this',
            prompt: String(item?.prompt || ''),
            ...(typeof item?.styleMode === 'string' ? { styleMode: item.styleMode } : {}),
          }))
      : [],
    cost_usd: typeof finalPayload.cost_usd === 'number' ? finalPayload.cost_usd : 0,
  };
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return true;
  }
  return false;
}

function buildSolveSuccessResponse(params: {
  ai: { answer: string; explanation: string; suggestions: Array<{ label: string; prompt: string; styleMode?: StyleMode }>; steps: string[]; model: string };
  usage: ReturnType<typeof getPlanLimits>;
  usagePayload: {
    subscriptionTier: 'free' | 'pro' | 'premium';
    subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
    monthlyQuestionsUsed: number;
    monthlyQuestionsLimit: number;
    monthlyQuestionsRemaining: number;
    stepQuestionsUsed?: number;
    monthlyImagesUsed: number;
    monthlyImagesLimit: number;
    monthlyBulkUsed: number;
    monthlyBulkLimit: number;
    paygoCreditsRemaining?: number;
  };
  aiMode: 'normal' | 'fast_fallback';
  styleMode: StyleMode;
  conversationId: string;
  isBulk: boolean;
  isFollowUp: boolean;
}): SolveSuccessResponse {
  return {
    api_version: 'v1',
    ok: true,
    answer: params.ai.answer,
    explanation: params.ai.explanation,
    usage: params.usagePayload,
    metadata: {
      model: params.ai.model,
      aiMode: params.aiMode,
      styleMode: params.styleMode,
      conversationId: params.conversationId,
      isBulk: params.isBulk,
      isFollowUp: params.isFollowUp,
    },
    suggestions: params.ai.suggestions,
    steps: params.ai.steps,
  };
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

  const form = await req.formData();
  const streamRequested = String(form.get('stream') ?? '').trim().toLowerCase() === 'true';
  const streamContext = streamRequested ? createStreamWriter() : null;
  const emitStream = (event: SolveStreamEvent) => {
    if (!streamContext) return;
    streamContext.write(event);
  };
  const emitStatus = (phase: SolveStatusEvent['phase']) => {
    emitStream({ type: 'status', phase });
  };
  const emitStreamError = (code: string | undefined, message: string) => {
    emitStream({ type: 'error', code, message });
    streamContext?.close();
  };

  const clientIp = getClientIp(req);
  const token = getBearerToken(req);
  if (!token) {
    if (streamContext) {
      emitStreamError('MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
      return streamContext.response;
    }
    return jsonError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  try {
    emitStatus('auth');
    const user = await verifySupabaseAccessToken(token);
    runAuthUserId = user.id;
    const rateLimit = await checkRateLimitMany('/solve', [`user:${user.id}`, `ip:${clientIp}`]);
    if (!rateLimit.allowed) {
      if (streamContext) {
        emitStreamError('RATE_LIMITED', 'Too many requests. Please wait before trying again.');
        return streamContext.response;
      }
      return jsonError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.', {
        retryAfter: rateLimit.retryAfter,
      });
    }
    const supabase = createSupabaseUserClient(token);
    const supabaseAdmin = createSupabaseAdminClient();

    if (!user.emailVerified) {
      if (streamContext) {
        emitStreamError('EMAIL_NOT_VERIFIED', 'Email not verified');
        return streamContext.response;
      }
      return jsonError(403, 'EMAIL_NOT_VERIFIED', 'Email not verified');
    }

    emitStatus('preparing');
    const profilePromise = getProfileForSolve(supabase, user.id);
    const subscriptionPromise = getUserSubscription(supabase, user.id);
    const monthlyUsagePromise = getMonthlyUsage(supabaseAdmin, user.id);
    const paygoRemainingPromise = getPaygoCreditsRemaining(supabaseAdmin, user.id);

    const rawQuestion = String(form.get('question') ?? '').trim();
    assertQuestionLength(rawQuestion);
    const styleMode = parseStyleMode(String(form.get('style_mode') ?? 'standard').trim());
    runStyleMode = styleMode;
    const preferredLanguage = String(form.get('language') ?? '').trim() || undefined;
    const surface = String(form.get('surface') ?? '').trim().toLowerCase();
    const responseSurface = surface === 'webapp' ? 'webapp' : surface === 'extension' ? 'extension' : undefined;
    const quotedStep = form.get('quoted_step');
    const { acceptedUrls: acceptedImageUrls, parts: imageParts, uploads: uploadedImageFiles } = await extractImageParts(form);
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
      if (streamContext) {
        emitStreamError('QUESTION_REQUIRED', 'Question is required');
        return streamContext.response;
      }
      return jsonError(400, 'QUESTION_REQUIRED', 'Question is required');
    }
    const repairedQuestion = repairLikelyFractionCopyArtifacts(normalizedQuestion);
    const imageCount = imageParts.length;
    const realtimeStreamingEnabled = streamRequested && responseSurface === 'webapp' && !isBulk;
    const cacheSafe = isCacheSafeRequest({
      imageCount,
      history,
      quotedStep,
      isBulk,
    });
    const previewEligible = !realtimeStreamingEnabled && streamRequested && isPreviewEligibleRequest({
      imageCount,
      history,
      quotedStep,
      isBulk,
      styleMode,
      repairedQuestion,
    });
    const previewRejectionReasons = getPreviewRejectionReasons({
      imageCount,
      history,
      quotedStep,
      isBulk,
      styleMode,
      repairedQuestion,
    });
    console.log(`[${reqId}] preview eligibility`, {
      eligible: previewEligible,
      reasons: previewRejectionReasons,
      normalizedRepairedQuestionLength: repairedQuestion.length,
      historyItems: history.length,
    });

    if (streamContext && cacheSafe) {
      emitStatus('cache');
    }
    const cachePromise = cacheSafe ? getCachedAnswer(repairedQuestion) : Promise.resolve(null);
    const [profile, subscription, monthlyUsage, paygoRemaining, cachedAnswer] = await Promise.all([
      profilePromise,
      subscriptionPromise,
      monthlyUsagePromise,
      paygoRemainingPromise,
      cachePromise,
    ]);

    if (!profile) {
      if (streamContext) {
        emitStreamError('PROFILE_NOT_FOUND', 'Profile not found. Please sync profile first.');
        return streamContext.response;
      }
      return jsonError(403, 'PROFILE_NOT_FOUND', 'Profile not found. Please sync profile first.');
    }
    let effectiveProfile = profile;
    if (effectiveProfile.role === 'pending' && user.emailVerified) {
      await upsertProfileFromAuthUser(supabaseAdmin, user);
      effectiveProfile = await getProfileForSolve(supabase, user.id);
    }

    const canSolve =
      effectiveProfile &&
      ['authenticated', 'admin', 'support', 'read-only'].includes(effectiveProfile.role ?? '');

    if (!canSolve) {
      if (streamContext) {
        emitStreamError('ROLE_REQUIRED', 'Account setup is incomplete. Finish onboarding or refresh your profile and try again.');
        return streamContext.response;
      }
      return jsonError(403, 'ROLE_REQUIRED', 'Account setup is incomplete. Finish onboarding or refresh your profile and try again.');
    }

    const rawTier = (subscription.tier ?? 'free') as 'free' | 'pro' | 'premium';
    const rawStatus = subscription.status ?? 'inactive';
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const hasFuturePeriod = periodEnd && !Number.isNaN(periodEnd.getTime()) && periodEnd.getTime() > Date.now();
    const isActiveSubscription =
      rawStatus === 'active' ||
      rawStatus === 'trialing' ||
      (rawStatus === 'canceled' && Boolean(hasFuturePeriod));
    const tier = isActiveSubscription
      ? (rawTier === 'premium' ? 'premium' : rawTier === 'pro' ? 'pro' : 'free')
      : 'free';
    const status = isActiveSubscription ? rawStatus : 'inactive';
    const planLimits = getPlanLimits(tier);

    console.log(`[${reqId}] cache lookup`, { cacheSafe, hit: Boolean(cachedAnswer) });
    if (cachedAnswer) {
      console.log(`[CACHE HIT] "${repairedQuestion.substring(0, 50)}..."`);
    }

    if (imageParts.length === 0 && tier === 'free' && hasAmbiguousEquationFormatting(repairedQuestion)) {
      if (streamContext) {
        emitStreamError('QUESTION_INCOMPLETE', 'Equation formatting is ambiguous after copy. Please paste the full equation in plain text or attach a screenshot.');
        return streamContext.response;
      }
      return jsonError(
        422,
        'QUESTION_INCOMPLETE',
        'Equation formatting is ambiguous after copy. Please paste the full equation in plain text or attach a screenshot.',
      );
    }

    if (tier === 'free' && (styleMode === 'gen_alpha' || styleMode === 'step_by_step')) {
      if (streamContext) {
        emitStreamError('MODE_LOCKED', 'This mode is not available on the Free plan.');
        return streamContext.response;
      }
      return jsonError(403, 'MODE_LOCKED', 'This mode is not available on the Free plan.');
    }

    const maxImagesPerRequest = 20;
    if (imageCount > maxImagesPerRequest) {
      if (streamContext) {
        emitStreamError('IMAGE_LIMIT_EXCEEDED', `You can upload up to ${maxImagesPerRequest} images per request.`);
        return streamContext.response;
      }
      return jsonError(400, 'IMAGE_LIMIT_EXCEEDED', `You can upload up to ${maxImagesPerRequest} images per request.`);
    }
    const nextQuestionsUsed = monthlyUsage.questionsUsed + 1;
    const nextBulkUsed = monthlyUsage.bulkUsed + (isBulk ? 1 : 0);
    const nextStepQuestionsUsed = monthlyUsage.stepQuestionsUsed + (isFollowUp ? 1 : 0);
    const nextImagesUsed = monthlyUsage.imagesUsed + imageCount;

    let usePaygoCredit = false;

    if (!isUnlimited(planLimits.questions) && nextQuestionsUsed > planLimits.questions) {
      if (tier === 'free' && paygoRemaining > 0) {
        usePaygoCredit = true;
      } else {
        if (streamContext) {
          emitStreamError('QUESTION_LIMIT_REACHED', 'Monthly question limit reached. Upgrade to Pro or Premium for more usage.');
          return streamContext.response;
        }
        return jsonError(429, 'QUESTION_LIMIT_REACHED', 'Monthly question limit reached. Upgrade to Pro or Premium for more usage.');
      }
    }

    if (isBulk && !isUnlimited(planLimits.bulk) && nextBulkUsed > planLimits.bulk) {
      if (streamContext) {
        emitStreamError('BULK_LIMIT_REACHED', 'Bulk solve limit reached for this plan.');
        return streamContext.response;
      }
      return jsonError(429, 'BULK_LIMIT_REACHED', 'Bulk solve limit reached for this plan.');
    }

    if (imageCount > 0 && !isUnlimited(planLimits.images) && nextImagesUsed > planLimits.images) {
      if (streamContext) {
        emitStreamError('IMAGE_LIMIT_REACHED', 'Monthly image limit reached for this plan.');
        return streamContext.response;
      }
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
    if (cachedAnswer) {
      const nextPaygoRemaining = usePaygoCredit ? Math.max(paygoRemaining - 1, 0) : paygoRemaining;
      const responseBody: SolveSuccessResponse = {
        api_version: 'v1',
        ok: true,
        answer: cachedAnswer.answer,
        explanation: cachedAnswer.explanation || '[This answer was retrieved from cache - asked before]',
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
        steps: cachedAnswer.steps?.length > 0 ? cachedAnswer.steps : ['Answer retrieved from cache (no AI call needed)'],
      };

      const cachedPostWork = (async () => {
        const persistedImageRefs = await persistHistoryImageFiles(supabaseAdmin, user.id, uploadedImageFiles);
        await saveHistoryEntry(supabaseAdmin, {
          authUserId: user.id,
          question: repairedQuestion,
          answer: cachedAnswer.answer,
          explanation: cachedAnswer.explanation || '[This answer was retrieved from cache - asked before]',
          conversationId,
          styleMode,
          image_urls: [...acceptedImageUrls, ...persistedImageRefs],
          is_bulk: isBulk,
          steps: cachedAnswer.steps?.length > 0 ? cachedAnswer.steps : ['Answer retrieved from cache (no AI call needed)'],
        });
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
        await logSolveRun(supabaseAdmin, {
          authUserId: user.id,
          mode: runMode,
          styleMode: runStyleMode,
          model: 'cache',
          latencyMs: Date.now() - requestStartedAt,
          status: 'success',
          usedFallback: false,
        });
      })().catch((error) => {
        console.error(`[${reqId}] Cached solve post-work failed:`, error);
      });

      if (!scheduleBackgroundTask(cachedPostWork)) {
        await cachedPostWork;
      }

      if (streamContext) {
        emitStream({ type: 'final', data: responseBody });
        streamContext.close();
        return streamContext.response;
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const initialMode = chooseAiMode(repairedQuestion, imageCount > 0, styleMode);
    runMode = initialMode;
    let aiFallbackUsed = false;
    let ai: Awaited<ReturnType<typeof callAiProxy>>;
    let previewLatencyMs: number | null = null;
    let finalAiStartedAt = Date.now();
    const runAiAttempt = async (
      questionToSolve: string,
      modeOverride: 'normal' | 'fast_fallback',
      styleOverride: StyleMode,
    ) => {
      if (realtimeStreamingEnabled && streamContext) {
        const response = await callAiProxyStream(
          questionToSolve,
          imageParts,
          modeOverride,
          styleOverride,
          history,
          isBulk,
          user.id,
          {
            preferredLanguage,
            surface: responseSurface,
          },
        );
        return await readAiProxyStream(response, (text) => {
          emitStream({ type: 'delta', text });
        });
      }

      return await callAiProxy(questionToSolve, imageParts, modeOverride, styleOverride, history, isBulk, user.id, {
        preferredLanguage,
        surface: responseSurface,
      });
    };

    const runFinalAi = async (questionToSolve: string, styleOverride: StyleMode = styleMode) => {
      try {
        return await runAiAttempt(questionToSolve, initialMode, styleOverride);
      } catch (error) {
        if (error instanceof AiError && (
          error.code === 'AI_TIMEOUT' ||
          error.code === 'AI_STREAM_INTERRUPTED' ||
          error.code === 'AI_INCOMPLETE_OUTPUT' ||
          error.code === 'AI_PROVIDER_ERROR'
        )) {
          aiFallbackUsed = true;
          emitStatus('refining');
          try {
            return await runAiAttempt(questionToSolve, 'fast_fallback', styleOverride);
          } catch (fallbackError) {
            if (fallbackError instanceof AiError && fallbackError.code === 'AI_INCOMPLETE_OUTPUT') {
              const conciseQuestion = responseSurface === 'webapp'
                ? `${questionToSolve}\n\nOutput constraint: Keep the reply concise, natural, and complete. Use short paragraphs or compact bullets only if they help clarity.`
                : `${questionToSolve}\n\nOutput constraint: Keep response concise with max 3 steps while preserving correctness.`;
              try {
                return await runAiAttempt(conciseQuestion, 'fast_fallback', styleOverride);
              } catch (finalFallbackError) {
                if (finalFallbackError instanceof AiError && finalFallbackError.code === 'AI_INCOMPLETE_OUTPUT') {
                  const ultraCompactQuestion = responseSurface === 'webapp'
                    ? `${questionToSolve}\n\nOutput constraint: Give the most helpful short answer possible in natural chat style. No rigid labels.`
                    : `${questionToSolve}\n\nOutput constraint: Return FINAL_ANSWER and only 2 short reasoning steps.`;
                  return await runAiAttempt(ultraCompactQuestion, 'fast_fallback', 'standard');
                }
                throw finalFallbackError;
              }
            }
            throw fallbackError;
          }
        }
        throw error;
      }
    };

    if (previewEligible) {
      emitStatus('calling_ai');
      const previewStartedAt = Date.now();
      try {
        const preview = await callAiProxy(
          repairedQuestion,
          imageParts,
          'fast_fallback',
          styleMode,
          history,
          false,
          user.id,
          { streamPreview: true, previewOnly: true, preferredLanguage, surface: responseSurface },
        );
        previewLatencyMs = Date.now() - previewStartedAt;
        console.log(`[${reqId}] preview completed`, { previewLatencyMs });
        if (preview.answer.trim().toUpperCase() !== 'INCOMPLETE_QUESTION' && hasMeaningfulAiOutput(preview)) {
          emitStream({
            type: 'preview',
            answer: preview.answer,
            explanation: preview.explanation,
            steps: preview.steps,
          });
        }
      } catch (previewError) {
        previewLatencyMs = Date.now() - previewStartedAt;
        console.warn(`[${reqId}] preview failed; continuing to final`, {
          previewLatencyMs,
          error: previewError instanceof Error ? previewError.message : String(previewError),
        });
      }
    }

    emitStatus('calling_ai');
    finalAiStartedAt = Date.now();
    try {
      ai = await runFinalAi(repairedQuestion);
      try {
        await recordDependencyState(supabaseAdmin, {
          dependency: 'ai',
          status: 'healthy',
          message: 'AI provider requests are succeeding.',
          source: 'solve',
        });
      } catch (_healthError) {
        // Ignore health telemetry failures.
      }
    } catch (error) {
      throw error;
    }
    const finalLatencyMs = Date.now() - finalAiStartedAt;
    console.log(`[${reqId}] final AI completed`, { finalLatencyMs, aiFallbackUsed });

    if (!hasMeaningfulAiOutput(ai)) {
      if (streamContext) {
        emitStreamError('RETRYABLE_AI_OUTPUT', 'AI returned incomplete output. Please retry. Credits were not consumed.');
        return streamContext.response;
      }
      return jsonError(
        503,
        'RETRYABLE_AI_OUTPUT',
        'AI returned incomplete output. Please retry. Credits were not consumed.',
        { retryable: true },
      );
    }

    if (ai.answer.trim().toUpperCase() === 'INCOMPLETE_QUESTION') {
      if (streamContext) {
        emitStreamError('QUESTION_INCOMPLETE', 'Oryx needs more context or the question is incomplete. Please try rephrasing or attaching a clear screenshot.');
        return streamContext.response;
      }
      return jsonError(
        422,
        'QUESTION_INCOMPLETE',
        'Oryx needs more context or the question is incomplete. Please try rephrasing or attaching a clear screenshot.',
      );
    }
    runUsedFallback = aiFallbackUsed;
    runMode = aiFallbackUsed ? 'fast_fallback' : initialMode;
    runModel = ai.model ?? null;
    const nextPaygoRemaining = usePaygoCredit ? Math.max(paygoRemaining - 1, 0) : paygoRemaining;
    const responseBody = buildSolveSuccessResponse({
      ai,
      usage: planLimits,
      usagePayload: buildUsagePayload(nextQuestionsUsed, nextImagesUsed, nextBulkUsed, nextStepQuestionsUsed, nextPaygoRemaining),
      aiMode: aiFallbackUsed ? 'fast_fallback' : initialMode,
      styleMode,
      conversationId,
      isBulk,
      isFollowUp,
    });

    emitStatus('finalizing');
    const postAnswerWork = (async () => {
      const persistedImageRefs = await persistHistoryImageFiles(supabaseAdmin, user.id, uploadedImageFiles);
      if (cacheSafe && ai.answer.trim().toUpperCase() !== 'INCOMPLETE_QUESTION') {
        try {
          await saveToCache(repairedQuestion, ai.answer, ai.explanation, ai.steps);
          console.log(`[CACHE SAVE] "${repairedQuestion.substring(0, 50)}..."`);
        } catch (cacheErr) {
          console.warn('[CACHE SAVE FAILED]', cacheErr);
        }
      }

      await saveHistoryEntry(supabaseAdmin, {
        authUserId: user.id,
        question: repairedQuestion,
        answer: ai.answer,
        explanation: ai.explanation,
        conversationId,
        styleMode,
        image_urls: [...acceptedImageUrls, ...persistedImageRefs],
        is_bulk: isBulk,
        steps: ai.steps,
      });

      if (usePaygoCredit) {
        await consumePaygoCredit(supabaseAdmin, user.id, 1, {
          conversationId,
          mode: runMode,
          styleMode,
          source: 'solve',
        });
      }

      await recordUsageEvent(supabaseAdmin, user.id, isFollowUp ? 'step_followup' : isBulk ? 'bulk_solve' : 'solve', 1, {
        mode: runMode,
        style: styleMode,
        images: imageCount,
        is_follow_up: isFollowUp,
        conversation_id: conversationId,
      }, ai.cost_usd || 0);
      if (imageCount > 0) {
        await recordUsageEvent(supabaseAdmin, user.id, 'image_vision', imageCount, {
          mode: runMode,
          style: styleMode,
          conversation_id: conversationId,
        });
      }

      await logSolveRun(supabaseAdmin, {
        authUserId: user.id,
        mode: runMode,
        styleMode: runStyleMode,
        model: runModel,
        latencyMs: Date.now() - requestStartedAt,
        status: 'success',
        usedFallback: runUsedFallback,
      });
      console.log(`[${reqId}] solve timings`, {
        previewLatencyMs,
        finalLatencyMs,
        totalLatencyMs: Date.now() - requestStartedAt,
      });
    })().catch((error) => {
      console.error(`[${reqId}] Post-answer work failed:`, error);
    });

    if (!scheduleBackgroundTask(postAnswerWork)) {
      await postAnswerWork;
    }

    if (streamContext) {
      emitStream({ type: 'final', data: responseBody });
      streamContext.close();
      return streamContext.response;
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
      try {
        const supabaseAdmin = createSupabaseAdminClient();
        await recordDependencyState(supabaseAdmin, {
          dependency: 'ai',
          status: err.status >= 500 || err.code === 'RATE_LIMITED' ? 'outage' : 'degraded',
          message: err.message,
          code: err.code,
          retryAfterSec:
            typeof err.details === 'object' &&
            err.details !== null &&
            'retryAfter' in err.details &&
            typeof (err.details as { retryAfter?: unknown }).retryAfter === 'number'
              ? (err.details as { retryAfter: number }).retryAfter
              : undefined,
          source: 'solve',
        });
      } catch (_healthError) {
        // Ignore health telemetry failures.
      }
      if (streamContext) {
        emitStreamError(err.code, err.message);
        return streamContext.response;
      }
      return jsonError(err.status, err.code, err.message, err.details);
    }
    if (err instanceof AppError) {
      if (streamContext) {
        emitStreamError(err.code, err.message);
        return streamContext.response;
      }
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Solve request failed';
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      await recordDependencyState(supabaseAdmin, {
        dependency: 'backend',
        status: 'outage',
        message,
        code: 'SERVICE_DEGRADED',
        source: 'solve',
      });
    } catch (_healthError) {
      // Ignore health telemetry failures.
    }
    if (streamContext) {
      emitStreamError('SOLVE_FAILED', message);
      return streamContext.response;
    }
    return jsonError(500, 'SOLVE_FAILED', message);
  }
});
