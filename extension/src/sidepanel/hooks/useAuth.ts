import { useState, useEffect, useCallback } from 'react';
import {
  subscribeAuthState,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  sendEmailOtp,
  verifyEmailOtp,
  resendVerificationEmail,
  signOutUser,
  refreshAuthUser,
  updateCurrentUserProfile,
  updateUserPassword,
  sendPasswordResetEmail,
  type AuthUser,
  isSupabaseAuthConfigured
} from '../auth/supabaseAuthClient';
import { mapSupabaseAuthError } from '../auth/mapSupabaseAuthError';
import { validateEmailInput } from '../utils/validation';
import type { AuthView, AuthMethod } from '../types';

type LegalVersions = {
  termsVersion: string;
  privacyVersion: string;
};

const AUTH_USER_CACHE_KEY = 'oryx_cached_auth_user_v1';

function readCachedAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedAuthUser(user: AuthUser | null) {
  try {
    if (!user) {
      localStorage.removeItem(AUTH_USER_CACHE_KEY);
      return;
    }
    localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // Ignore cache persistence errors.
  }
}

export function useAuth(onAuthChange?: () => void, legalVersions?: LegalVersions) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readCachedAuthUser());
  const [isAuthLoading, setIsAuthLoading] = useState(() => readCachedAuthUser() === null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('sign-in');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerificationSending, setIsVerificationSending] = useState(false);
  const [isVerificationChecking, setIsVerificationChecking] = useState(false);

  useEffect(() => {
    if (!isSupabaseAuthConfigured) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = subscribeAuthState((nextUser) => {
      setAuthUser(nextUser);
      writeCachedAuthUser(nextUser);
      setIsAuthLoading(false);
      if (nextUser && onAuthChange) {
        onAuthChange();
      }
    });

    return () => unsubscribe();
  }, [onAuthChange]);

  useEffect(() => {
    if (!isSupabaseAuthConfigured) return;

    const refreshCurrentUser = async () => {
      try {
        const nextUser = await refreshAuthUser();
        setAuthUser(nextUser);
        writeCachedAuthUser(nextUser);
        if (nextUser && onAuthChange) {
          onAuthChange();
        }
      } catch (error) {
        console.error('Failed to refresh current extension user:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshCurrentUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onAuthChange]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSignIn = async () => {
    if (!isSupabaseAuthConfigured) {
      setAuthMessage(
        'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
      );
      return;
    }

    setAuthMessage(null);
    const emailValidation = validateEmailInput(authEmail);
    if (!emailValidation.ok) {
      setAuthMessage(emailValidation.message ?? 'Invalid email.');
      return;
    }

    setIsAuthBusy(true);
    try {
      if (authMethod === 'password') {
        const user = await signInWithPassword(authEmail.trim(), authPassword);
        setAuthPassword('');
        if (!user.emailVerified) {
          setIsOtpRequested(true);
          setAuthMessage('Account not verified. Enter the 6-digit code sent to your email, or click the magic link.');
          setIsAuthBusy(false);
          return;
        }
      } else {
        await sendEmailOtp(authEmail.trim(), false);
        setAuthOtpCode('');
        setIsOtpRequested(true);
        setResendCooldown(60);
        setAuthMessage('Code sent. Enter the 6-digit code or click the magic link in your email.');
      }
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isSupabaseAuthConfigured) {
      setAuthMessage(
        'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
      );
      return;
    }

    setIsAuthBusy(true);
    setAuthMessage(null);
    try {
      await signInWithGoogle();
      setAuthMessage('Google sign-in opened in a new tab. Finish the flow there, then return to the extension.');
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!isSupabaseAuthConfigured) {
      setAuthMessage(
        'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
      );
      return;
    }

    setAuthMessage(null);
    const emailValidation = validateEmailInput(authEmail);
    if (!emailValidation.ok) {
      setAuthMessage(emailValidation.message ?? 'Invalid email.');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      setAuthMessage('You must agree to the Terms and Privacy Policy before creating an account.');
      return;
    }

    setIsAuthBusy(true);
    try {
      const legalMetadata = {
        accepted_terms: true,
        accepted_privacy: true,
        accepted_legal_at: new Date().toISOString(),
        accepted_terms_version: legalVersions?.termsVersion ?? '2026-03-18',
        accepted_privacy_version: legalVersions?.privacyVersion ?? '2026-03-18',
      };

      if (authMethod === 'password') {
        await signUpWithPassword(authEmail.trim(), authPassword, legalMetadata);
        setAuthPassword('');
        setIsOtpRequested(true);
        setAuthMessage('Account created. Enter the 6-digit code or click the magic link sent to your email.');
      } else {
        await sendEmailOtp(authEmail.trim(), true, legalMetadata);
        setAuthOtpCode('');
        setIsOtpRequested(true);
        setResendCooldown(60);
        setAuthMessage('Code sent. Enter the 6-digit code or click the magic link sent to your email.');
      }
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleVerifyOtpCode = async () => {
    if (!isSupabaseAuthConfigured) return;
    if (!authEmail.trim() || !authOtpCode.trim()) {
      setAuthMessage('Enter email and code.');
      return;
    }

    setIsAuthBusy(true);
    setAuthMessage(null);
    try {
      await verifyEmailOtp(authEmail.trim(), authOtpCode.trim());
      setAuthOtpCode('');
      setIsOtpRequested(false);
      setAuthMessage('Verification success!');
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!isSupabaseAuthConfigured) return;
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage('Enter your email first.');
      return;
    }
    if (resendCooldown > 0) return;

    setIsAuthBusy(true);
    setAuthMessage(null);
    try {
      const legalMetadata = authView === 'sign-up'
        ? {
            accepted_terms: true,
            accepted_privacy: true,
            accepted_legal_at: new Date().toISOString(),
            accepted_terms_version: legalVersions?.termsVersion ?? '2026-03-18',
            accepted_privacy_version: legalVersions?.privacyVersion ?? '2026-03-18',
          }
        : undefined;

      if (authMethod === 'password') {
        await resendVerificationEmail(email);
        setAuthMessage('Verification email sent. Use the latest code or magic link.');
      } else {
        await sendEmailOtp(email, authView === 'sign-up', legalMetadata);
        setAuthMessage('A fresh sign-in code has been sent.');
      }
      setResendCooldown(60);
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isSupabaseAuthConfigured) return;
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage('Enter your email to receive a password reset link.');
      return;
    }

    setIsAuthBusy(true);
    setAuthMessage(null);
    try {
      await sendPasswordResetEmail(email);
      setAuthMessage('Password reset link sent! Check your email.');
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const resetAuthState = useCallback(() => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthOtpCode('');
    setIsOtpRequested(false);
    setAuthMessage(null);
    setAcceptedTerms(false);
    setAcceptedPrivacy(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const nextUser = await refreshAuthUser();
      setAuthUser(nextUser);
      writeCachedAuthUser(nextUser);
      if (nextUser && onAuthChange) {
        onAuthChange();
      }
      return nextUser;
    } catch (error) {
      console.error('Failed to refresh extension auth state:', error);
      return authUser;
    }
  }, [authUser, onAuthChange]);

  return {
    authUser,
    isAuthLoading,
    isAuthBusy,
    authMessage,
    authEmail,
    authPassword,
    authOtpCode,
    isOtpRequested,
    authView,
    authMethod,
    acceptedTerms,
    acceptedPrivacy,
    resendCooldown,
    isVerificationSending,
    isVerificationChecking,
    setAuthEmail,
    setAuthPassword,
    setAuthOtpCode,
    setAuthView,
    setAuthMethod,
    setAcceptedTerms,
    setAcceptedPrivacy,
    handleSignIn,
    handleGoogleSignIn,
    handleSignUp,
    handleVerifyOtpCode,
    handleResendOtp,
    handleResetPassword,
    signOut: signOutUser,
    refreshAuth,
    updateProfile: updateCurrentUserProfile,
    updatePassword: updateUserPassword,
    resetAuthState,
    setIsVerificationSending,
    setIsVerificationChecking,
    setAuthMessage
  };
}
