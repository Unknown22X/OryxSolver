import { useState, useEffect, useCallback } from 'react';
import {
  subscribeAuthState,
  signInWithPassword,
  signUpWithPassword,
  sendEmailOtp,
  verifyEmailOtp,
  signOutUser,
  refreshAuthUser,
  updateCurrentUserProfile,
  updateUserPassword,
  type AuthUser,
  isSupabaseAuthConfigured
} from '../auth/supabaseAuthClient';
import { mapSupabaseAuthError } from '../auth/mapSupabaseAuthError';
import { validateEmailInput } from '../utils/validation';
import type { AuthView, AuthMethod } from '../types';

export function useAuth(onAuthChange?: () => void) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('sign-in');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerificationSending, setIsVerificationSending] = useState(false);
  const [isVerificationChecking, setIsVerificationChecking] = useState(false);

  // Sync auth state
  useEffect(() => {
    if (!isSupabaseAuthConfigured) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = subscribeAuthState((nextUser) => {
      setAuthUser(nextUser);
      setIsAuthLoading(false);
      if (nextUser && onAuthChange) {
        onAuthChange();
      }
    });

    return () => unsubscribe();
  }, [onAuthChange]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSignIn = async () => {
    if (!isSupabaseAuthConfigured) {
      setAuthMessage('Supabase Auth is not configured.');
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

  const handleSignUp = async () => {
    if (!isSupabaseAuthConfigured) {
      setAuthMessage('Supabase Auth is not configured.');
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
        await signUpWithPassword(authEmail.trim(), authPassword);
        setAuthPassword('');
        setIsOtpRequested(true);
        setAuthMessage('Account created. Enter the 6-digit code or click the magic link sent to your email.');
      } else {
        await sendEmailOtp(authEmail.trim(), true);
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

  const resetAuthState = useCallback(() => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthOtpCode('');
    setIsOtpRequested(false);
    setAuthMessage(null);
  }, []);

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
    resendCooldown,
    isVerificationSending,
    isVerificationChecking,
    setAuthEmail,
    setAuthPassword,
    setAuthOtpCode,
    setAuthView,
    setAuthMethod,
    handleSignIn,
    handleSignUp,
    handleVerifyOtpCode,
    signOut: signOutUser,
    refreshAuth: refreshAuthUser,
    updateProfile: updateCurrentUserProfile,
    updatePassword: updateUserPassword,
    resetAuthState,
    setIsVerificationSending,
    setIsVerificationChecking,
    setAuthMessage
  };
}
