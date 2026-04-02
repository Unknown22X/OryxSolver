const SOLVE_ERROR_MESSAGES: Record<string, string> = {
  AI_TIMEOUT: 'The question took too long to solve. If it is a huge list, try breaking it into smaller chunks.',
  AI_INCOMPLETE_OUTPUT: 'The AI got cut off while thinking. Please retry.',
  AI_QUOTA_EXCEEDED: 'Oryx is busy or the question list is too long. Try breaking it into smaller chunks.',
  AI_PROVIDER_ERROR: 'The AI service is temporarily overloaded. Please wait 10-15 seconds and retry.',
  AI_PROXY_ERROR: 'The AI service is temporarily overloaded. Please wait 10-15 seconds and retry.',
  RETRYABLE_AI_OUTPUT: 'The response was incomplete. Please retry.',
  QUESTION_INCOMPLETE: 'Your question is missing required data. Please include the full question and retry.',
  REMOTE_IMAGE_URLS_NOT_ALLOWED: 'Remote image URLs are blocked. Capture or upload the image directly instead.',
  LIMIT_EXCEEDED: 'You have reached your free usage limit.',
  CREDIT_LIMIT_REACHED: 'Monthly question limit reached. Upgrade to Pro or Premium.',
  QUESTION_LIMIT_REACHED: 'Monthly question limit reached. Upgrade to Pro or Premium.',
  IMAGE_LIMIT_REACHED: 'Monthly image limit reached. Upgrade to Pro or Premium for more uploads.',
  BULK_LIMIT_REACHED: 'Bulk solve limit reached for this plan.',
  MODE_LOCKED: 'This mode is not available on the Free plan.',
  ACCOUNT_LOCKED: 'Your account has been locked by an administrator.',
  PROFILE_NOT_FOUND: 'Your profile could not be found. Try relogging.',
  ROLE_REQUIRED: 'Finish onboarding in the web app, then return to the extension and try again.',
  '429': 'You are sending requests too quickly. Please wait a minute and try again.',
  HISTORY_TOO_LARGE: 'This conversation history is too long. Please start a new chat if you have many follow-ups.',
};

export function mapSolveErrorMessage(code: string | null, fallback?: string): string {
  if (!code) return fallback ?? 'Solve failed. Please try again.';
  return SOLVE_ERROR_MESSAGES[code] ?? fallback ?? 'Solve failed. Please try again.';
}
