const SOLVE_ERROR_MESSAGES: Record<string, string> = {
  AI_TIMEOUT: 'The AI response took too long. Please retry.',
  AI_INCOMPLETE_OUTPUT: 'The AI response was incomplete. Please retry.',
  AI_QUOTA_EXCEEDED: 'AI capacity is temporarily full. Please retry in a minute.',
  AI_PROVIDER_ERROR: 'AI service is temporarily unavailable. Please retry.',
  RETRYABLE_AI_OUTPUT: 'The response was incomplete. Please retry.',
  LIMIT_EXCEEDED: 'You have reached your free usage limit.',
  MONTHLY_IMAGE_LIMIT_EXCEEDED: 'You reached the monthly free image limit.',
  IMAGE_LIMIT_EXCEEDED_FREE: 'Free plan allows only 1 image per message.',
  IMAGE_LIMIT_EXCEEDED_PRO: 'Pro plan allows up to 4 images per message.',
  PRO_SUBSCRIPTION_INACTIVE: 'Your Pro subscription is inactive.',
  ROLE_REQUIRED: 'Please complete onboarding before sending questions.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before sending questions.',
};

export function mapSolveErrorMessage(code: string | null, fallback: string): string {
  if (!code) return fallback;
  return SOLVE_ERROR_MESSAGES[code] ?? fallback;
}

