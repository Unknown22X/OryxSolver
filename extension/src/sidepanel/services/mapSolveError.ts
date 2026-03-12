const SOLVE_ERROR_MESSAGES: Record<string, string> = {
  AI_TIMEOUT: 'The question took too long to solve. If it is a huge list, try breaking it into smaller chunks! 🐢',
  AI_INCOMPLETE_OUTPUT: 'The AI got cut off while thinking. Please retry. ✍️',
  AI_QUOTA_EXCEEDED: 'Oryx is super busy right now! We hit a brief capacity limit. Please wait a moment and hit retry. 🐪',
  AI_PROVIDER_ERROR: 'The AI service is temporarily overloaded. Please wait 10-15 seconds and retry. 🔄',
  AI_PROXY_ERROR: 'The AI service is temporarily overloaded. Please wait 10-15 seconds and retry. 🔄',
  RETRYABLE_AI_OUTPUT: 'The response was slightly incomplete. Please hit retry! 🔄',
  QUESTION_INCOMPLETE: 'Your question is missing required data. Please include the full equation/question and retry.',
  LIMIT_EXCEEDED: 'You have reached your free usage limit.',
  CREDIT_LIMIT_REACHED: 'You have reached your free question limit. Upgrade to Pro for unlimited solutions! 🌟',
  MONTHLY_IMAGE_LIMIT_EXCEEDED: 'Monthly free image limit reached.',
  IMAGE_LIMIT_REACHED: 'Monthly image limit reached. Upgrade to Pro for more uploads! 👁️',
  IMAGE_LIMIT_REACHED_FREE: 'Free plan allows only 1 image per message.',
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
