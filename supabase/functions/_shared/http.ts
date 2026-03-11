/**
 * Shared HTTP error utilities for Edge Functions.
 *
 * Portable: If migrating away from Supabase Edge Functions, replace `Response`
 * with your framework's equivalent (e.g., Express `res.status().json()`).
 */

/**
 * Structured application error with HTTP status and machine-readable code.
 */
export class AppError extends Error {
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

/**
 * Returns a JSON `Response` for error conditions.
 */
export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({ error: message, code, ...(details ? { details } : {}) }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

/**
 * Returns a JSON `Response` for success conditions.
 */
export function jsonOk(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
