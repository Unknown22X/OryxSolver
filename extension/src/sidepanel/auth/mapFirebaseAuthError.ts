import type { FirebaseError } from 'firebase/app';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/email-already-in-use': 'This email is already in use. Try signing in.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Wrong password. Please try again.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/requires-recent-login': 'Please sign in again to continue this action.',
};

export function mapFirebaseAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return FALLBACK_MESSAGE;

  const firebaseError = error as FirebaseError;
  if (!firebaseError.code) return firebaseError.message || FALLBACK_MESSAGE;

  return AUTH_ERROR_MESSAGES[firebaseError.code] || firebaseError.message || FALLBACK_MESSAGE;
}
