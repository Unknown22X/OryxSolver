import { createSupabaseAdminClient } from '../_shared/db.ts';
import { sha256Hex } from './security.ts';

type RateLimitConfig = {
  requests: number;
  windowMs: number;
};

const LIMITS = {
  '/solve': { requests: 10, windowMs: 60 * 1000 },
  '/ai-proxy': { requests: 30, windowMs: 60 * 1000 },
  '/auth': { requests: 5, windowMs: 60 * 1000 },
  '/signup': { requests: 3, windowMs: 60 * 1000 },
  '/login': { requests: 10, windowMs: 60 * 1000 },
  '/sync-profile': { requests: 10, windowMs: 60 * 1000 },
  '/history': { requests: 60, windowMs: 60 * 1000 },
  '/create-checkout': { requests: 5, windowMs: 60 * 1000 },
  '/admin-metrics': { requests: 20, windowMs: 60 * 1000 },
  '/save-history': { requests: 20, windowMs: 60 * 1000 },
  '/check-account-limit': { requests: 1, windowMs: 24 * 60 * 60 * 1000 },
  default: { requests: 30, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitConfig>;

type RateLimitRow = {
  allowed: boolean;
  retry_after: number;
  remaining: number;
};

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return 'unknown';
}

export async function checkRateLimit(
  endpoint: string,
  subject: string,
): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
  const config = LIMITS[endpoint as keyof typeof LIMITS] ?? LIMITS.default;

  try {
    const hashedSubject = await sha256Hex(subject.trim().toLowerCase() || 'unknown');
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .rpc('check_request_rate_limit', {
        p_bucket: endpoint,
        p_subject: hashedSubject,
        p_max_requests: config.requests,
        p_window_seconds: Math.ceil(config.windowMs / 1000),
      })
      .single<RateLimitRow>();

    if (error || !data) {
      console.error(`[RATE_LIMIT] Failed for ${endpoint}:`, error?.message ?? 'missing data');
      return { allowed: true };
    }

    return {
      allowed: Boolean(data.allowed),
      retryAfter: data.retry_after > 0 ? data.retry_after : undefined,
      remaining: typeof data.remaining === 'number' ? data.remaining : undefined,
    };
  } catch (error) {
    console.error(`[RATE_LIMIT] Unexpected failure for ${endpoint}:`, error);
    return { allowed: true };
  }
}
