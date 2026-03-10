const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const AUTH_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Email or password is incorrect.' },
  { pattern: /email not confirmed/i, message: 'Please verify your email first.' },
  { pattern: /user already registered/i, message: 'This email is already in use. Try signing in.' },
  { pattern: /token has expired/i, message: 'Code expired. Request a new code and try again.' },
  { pattern: /invalid token/i, message: 'Invalid code. Please check the code and try again.' },
  { pattern: /otp/i, message: 'Invalid verification code. Request a new code and try again.' },
  { pattern: /password should be at least/i, message: 'Password should be at least 6 characters.' },
  { pattern: /rate limit/i, message: 'Too many attempts. Please wait and try again.' },
  { pattern: /network/i, message: 'Network error. Check your internet connection.' },
];

export function mapSupabaseAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return FALLBACK_MESSAGE;
  const message = String((error as { message?: unknown }).message ?? '').trim();
  if (!message) return FALLBACK_MESSAGE;

  for (const item of AUTH_ERROR_PATTERNS) {
    if (item.pattern.test(message)) return item.message;
  }

  return message;
}
