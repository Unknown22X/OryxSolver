import * as Sentry from '@sentry/react';
import { supabase } from './supabase';

const DEFAULT_RETRY_DELAYS_MS = [250, 700];
const INTERNAL_SUPABASE_PATTERNS = [
  /Lock broken by another request with the 'steal' option/i,
  /Navigator LockManager/i,
  /lockAcquireTimeout/i,
  /not released within \d+ms/i,
  /@supabase\/gotrue-js/i,
  /gotrue/i,
  /AbortError/i,
  /TypeError:\s*Load failed/i,
  /\bLoad failed\b/i,
  /\bFailed to fetch\b/i,
  /\bNetworkError\b/i,
  /\bNetwork request failed\b/i,
  /\bfetch failed\b/i,
  /[a-z0-9]{20}\.supabase\.co/i,
  /supabase\.co/i,
];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? '');
}

export function isTransientSupabaseLockError(error: unknown) {
  const message = getErrorMessage(error);
  const errorName = error instanceof Error ? error.name : '';
  return (
    errorName === 'AbortError' &&
    INTERNAL_SUPABASE_PATTERNS.some((pattern) => pattern.test(message))
  );
}

export function shouldHideSupabaseErrorDetails(error: unknown) {
  const message = getErrorMessage(error);
  return INTERNAL_SUPABASE_PATTERNS.some((pattern) => pattern.test(message));
}

export function toPublicErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Reconnect and try again.';
  }

  const message = getErrorMessage(error).replace(/\s+/g, ' ').trim();
  if (!message || shouldHideSupabaseErrorDetails(error)) {
    return fallbackMessage;
  }

  return message;
}

export function toSafeSupabaseError(error: unknown, fallbackMessage: string) {
  const publicMessage = toPublicErrorMessage(error, fallbackMessage);
  if (!shouldHideSupabaseErrorDetails(error)) {
    return error instanceof Error ? new Error(publicMessage) : new Error(publicMessage);
  }

  const safeError = new Error(publicMessage) as Error & {
    cause?: unknown;
    code?: string;
    status?: number;
    retryAfterSec?: number;
  };
  const original = error as Partial<Error & { code?: string; status?: number; retryAfterSec?: number }>;
  safeError.name = 'SupabaseAuthError';
  safeError.cause = error;
  safeError.code = original.code;
  safeError.status = original.status;
  safeError.retryAfterSec = original.retryAfterSec;
  return safeError;
}

export async function withSupabaseAuthRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  options?: {
    retryDelaysMs?: number[];
    fallbackMessage?: string;
  },
) {
  const retryDelaysMs = options?.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const fallbackMessage =
    options?.fallbackMessage ?? 'Authentication is temporarily unavailable. Please try again.';

  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientSupabaseLockError(error)) {
        throw toSafeSupabaseError(error, fallbackMessage);
      }

      const attemptLabel = `${attempt + 1}/${retryDelaysMs.length + 1}`;
      console.warn(`[supabase-auth] ${operationName} hit a transient lock conflict (${attemptLabel}).`, error);
      Sentry.addBreadcrumb({
        category: 'auth.lock_retry',
        message: `${operationName} retry after transient Supabase auth lock`,
        level: 'warning',
        data: {
          attempt: attempt + 1,
          maxAttempts: retryDelaysMs.length + 1,
        },
      });

      if (attempt >= retryDelaysMs.length) break;
      await wait(retryDelaysMs[attempt]);
    }
  }

  console.error(`[supabase-auth] ${operationName} failed after retries.`, lastError);
  Sentry.captureException(lastError, {
    tags: {
      area: 'supabase-auth',
      operation: operationName,
      transientLock: 'true',
    },
  });
  throw toSafeSupabaseError(lastError, fallbackMessage);
}

export function getSessionWithRetry(options?: {
  retryDelaysMs?: number[];
  fallbackMessage?: string;
}) {
  return withSupabaseAuthRetry('getSession', () => supabase.auth.getSession(), options);
}

export function getUserWithRetry(options?: {
  retryDelaysMs?: number[];
  fallbackMessage?: string;
}) {
  return withSupabaseAuthRetry('getUser', () => supabase.auth.getUser(), options);
}

export function signOutWithRetry(options?: {
  retryDelaysMs?: number[];
  fallbackMessage?: string;
}) {
  return withSupabaseAuthRetry('signOut', () => supabase.auth.signOut(), options);
}

export function updateUserWithRetry(
  attributes: Parameters<typeof supabase.auth.updateUser>[0],
  options?: {
    retryDelaysMs?: number[];
    fallbackMessage?: string;
  },
) {
  return withSupabaseAuthRetry('updateUser', () => supabase.auth.updateUser(attributes), options);
}
