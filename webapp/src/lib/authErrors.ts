export type AuthFlowError = {
  code: string;
  description: string;
};

function toParams(input: string) {
  const normalized = input.startsWith('#') || input.startsWith('?') ? input.slice(1) : input;
  return new URLSearchParams(normalized);
}

export function readAuthFlowError(search: string, hash: string): AuthFlowError | null {
  const merged = new URLSearchParams();
  for (const source of [search, hash]) {
    const params = toParams(source);
    params.forEach((value, key) => merged.set(key, value));
  }

  const code =
    merged.get('auth_error_code') ||
    merged.get('error_code') ||
    merged.get('auth_error') ||
    merged.get('error');
  const description =
    merged.get('auth_error_description') ||
    merged.get('error_description') ||
    '';

  if (!code) return null;
  return {
    code: code.trim().toLowerCase(),
    description: description.trim(),
  };
}

export function getFriendlyAuthErrorMessage(error: AuthFlowError) {
  switch (error.code) {
    case 'otp_expired':
      return 'That email link has expired. Request a fresh link and try again.';
    case 'access_denied':
      return error.description || 'That sign-in link is no longer valid. Please try again.';
    case 'email_not_confirmed':
      return 'Confirm your email address first, then sign in again.';
    default:
      return error.description || 'Authentication could not be completed. Please try again.';
  }
}
