import { useEffect, useMemo, useState } from 'react';
import { Mail, Lock, Key, ArrowRight, X, Eye, EyeOff, Settings, Trash2, User, ChevronRight, LogOut, Sun, Moon, Bell, Globe, Shield } from 'lucide-react';
import MessageComposer from './components/MessageComposer';
import { captureCroppedAreaToFile } from './services/cameraCapture';
import SidePanelHeader from './components/SidePanelHeader';
import ResponsePanel from './components/ResponsePanel';
import HistoryPanel from './components/HistoryPanel';
import { parseExplanationSteps } from './utils/parseExplanationSteps';
import {
  getAccessToken,
  refreshAuthUser,
  resendVerificationEmail,
  signInWithPassword,
  signOutUser,
  signUpWithPassword,
  sendEmailOtp,
  subscribeAuthState,
  type AuthUser,
  updateCurrentUserProfile,
  updateUserPassword,
  verifyEmailOtp,
  isSupabaseAuthConfigured,
} from './auth/supabaseAuthClient';
import { mapSupabaseAuthError } from './auth/mapSupabaseAuthError';
import type { AiResponse, AiSuggestion, SendPayload, StyleMode } from './types';
import { postSolveRequest } from './services/solveApi';
import { getApiUrl } from './services/apiConfig';
import { mapSolveErrorMessage } from './services/mapSolveError';

type AuthView = 'sign-in' | 'sign-up';
type AuthMethod = 'password' | 'code';
type UsageSnapshot = {
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'active' | 'inactive' | 'canceled';
  totalCredits: number;
  usedCredits: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
};

const DEFAULT_SUGGESTIONS: AiSuggestion[] = [
  { label: 'Step-by-step Solve 📝', prompt: 'Break this problem down step-by-step.', styleMode: 'step_by_step' as const },
  { label: 'Explain like I\'m 5 🍼', prompt: 'Explain this like I am 5 years old.', styleMode: 'eli5' as const },
  { label: 'Gen Alpha Slang 🧢', prompt: 'Explain this in Gen Alpha slang, but keep it correct.', styleMode: 'gen_alpha' as const },
];

type UpgradeMoment = {
  level: 'soft' | 'strong' | 'paywall' | null;
  percent: number;
  title: string;
  message: string;
};

function buildUsageSnapshot(source: unknown): UsageSnapshot {
  const usage = (source ?? {}) as Record<string, unknown>;
  return {
    subscriptionTier: usage.subscriptionTier === 'pro' ? 'pro' : 'free',
    subscriptionStatus: usage.subscriptionStatus === 'active' ? 'active' : 'inactive',
    totalCredits: typeof usage.totalCredits === 'number' && usage.totalCredits > 0
      ? usage.totalCredits
      : 50,
    usedCredits: typeof usage.usedCredits === 'number' && usage.usedCredits >= 0
      ? usage.usedCredits
      : 0,
    monthlyImagesUsed: typeof usage.monthlyImagesUsed === 'number' && usage.monthlyImagesUsed >= 0
      ? usage.monthlyImagesUsed
      : 0,
    monthlyImagesLimit: typeof usage.monthlyImagesLimit === 'number' && usage.monthlyImagesLimit > 0
      ? usage.monthlyImagesLimit
      : 10,
  };
}

function mergeUsageSnapshot(previous: UsageSnapshot, incoming: UsageSnapshot): UsageSnapshot {
  // Avoid stale async profile fetches that can regress usage after a successful solve.
  if (
    incoming.subscriptionTier === previous.subscriptionTier &&
    incoming.totalCredits === previous.totalCredits
  ) {
    return {
      ...incoming,
      usedCredits: Math.max(previous.usedCredits, incoming.usedCredits),
      monthlyImagesUsed: Math.max(previous.monthlyImagesUsed, incoming.monthlyImagesUsed),
    };
  }
  return incoming;
}

function validateEmailInput(rawEmail: string): { ok: boolean; message?: string } {
  const email = rawEmail.trim().toLowerCase();
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(email)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  const typoDomains = new Set([
    'gmai.com',
    'gmial.com',
    'gmail.co',
    'gmail.con',
    'hotnail.com',
    'outlok.com',
    'yaho.com',
  ]);
  const domain = email.split('@')[1] ?? '';
  if (typoDomains.has(domain)) {
    return { ok: false, message: `Email domain looks wrong (${domain}). Please check it.` };
  }

  return { ok: true };
}

export default function SidePanel() {
  const [usage, setUsage] = useState<UsageSnapshot>({
    subscriptionTier: 'free',
    subscriptionStatus: 'inactive',
    totalCredits: 50,
    usedCredits: 0,
    monthlyImagesUsed: 0,
    monthlyImagesLimit: 10,
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendErrorCode, setSendErrorCode] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<AiResponse | null>(null);

  const [authView, setAuthView] = useState<AuthView>('sign-in');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isVerificationSending, setIsVerificationSending] = useState(false);
  const [isVerificationChecking, setIsVerificationChecking] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'profile' | 'settings' | 'password'>('menu');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [styleMode, setStyleMode] = useState<StyleMode>('standard');
  const [composerSuggestions, setComposerSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const explanationSteps = latestResponse ? parseExplanationSteps(latestResponse.explanation) : [];
  const logoUrl = chrome.runtime.getURL('public/icons/128.png?v=3');
  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL;
  const isSignedIn = !!authUser;
  const isEmailVerified = !!authUser?.emailVerified;
  const creditUsagePercent = usage.totalCredits > 0 ? (usage.usedCredits / usage.totalCredits) * 100 : 0;
  const imageUsagePercent = usage.monthlyImagesLimit > 0
    ? (usage.monthlyImagesUsed / usage.monthlyImagesLimit) * 100
    : 0;
  const effectiveUsagePercent = Math.max(creditUsagePercent, imageUsagePercent);

  const showUpgradeCta = sendErrorCode === 'LIMIT_EXCEEDED' ||
    sendErrorCode === 'MONTHLY_IMAGE_LIMIT_EXCEEDED' ||
    sendErrorCode === 'IMAGE_LIMIT_EXCEEDED_FREE' ||
    sendErrorCode === 'PRO_SUBSCRIPTION_INACTIVE';
  const upgradeMoment = useMemo<UpgradeMoment>(() => {
    if (usage.subscriptionTier === 'pro') {
      return {
        level: null,
        percent: effectiveUsagePercent,
        title: '',
        message: '',
      };
    }

    if (effectiveUsagePercent >= 100) {
      return {
        level: 'paywall',
        percent: effectiveUsagePercent,
        title: 'Free limit reached',
        message: `You've used ${usage.usedCredits} free questions this month. Upgrade to Pro for longer support, more conversations, and premium tools.`,
      };
    }

    if (effectiveUsagePercent >= 90) {
      return {
        level: 'strong',
        percent: effectiveUsagePercent,
        title: 'Almost out of free usage',
        message: 'You are close to your monthly free limit. Upgrade to Pro for higher limits, more images, and priority solving.',
      };
    }

    if (effectiveUsagePercent >= 70) {
      return {
        level: 'soft',
        percent: effectiveUsagePercent,
        title: 'Heads up',
        message: 'You have used most of your free usage for this month. Pro gives you more room before you hit the limit.',
      };
    }

    return {
      level: null,
      percent: effectiveUsagePercent,
      title: '',
      message: '',
    };
  }, [effectiveUsagePercent, usage.subscriptionTier, usage.usedCredits]);

  useEffect(() => {
    if (showUpgradeCta) {
      setIsUpgradeModalOpen(true);
    }
  }, [showUpgradeCta]);

  useEffect(() => {
    if (!isSupabaseAuthConfigured) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = subscribeAuthState((nextUser) => {
      setAuthUser(nextUser);
      setIsAuthLoading(false);

      if (nextUser) {
        setProfileName(nextUser.displayName || '');
        setProfilePhotoUrl(nextUser.photoURL || '');
        void syncProfile();
      }
    });

    return () => unsubscribe();
  }, []);

  async function syncProfile() {
    const apiUrl = getApiUrl('/sync-profile', import.meta.env.VITE_SYNC_PROFILE_API_URL);
    if (!apiUrl) {
      console.warn('VITE_SYNC_PROFILE_API_URL is not set. Skipping profile sync.');
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Profile sync failed: ${res.status} ${errText}`);
      } else {
        const dataJson = await res.json();
        if (dataJson?.profile) {
          const nextUsage = buildUsageSnapshot(dataJson.profile);
          setUsage((prev) => mergeUsageSnapshot(prev, nextUsage));
        }
      }
    } catch (error) {
      console.error('Profile sync failed:', error);
    }
  }

  const handleCaptureScreen = async (): Promise<File | null> => {
    setSendError(null);
    try {
      return await captureCroppedAreaToFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Screen capture failed';
      setSendError(message);
      return null;
    }
  };

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
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
      setAuthMessage(emailValidation.message ?? 'Please enter a valid email.');
      return;
    }

    setIsAuthBusy(true);
    try {
      if (authMethod === 'password') {
        const user = await signInWithPassword(authEmail.trim(), authPassword);
        setAuthPassword('');
        if (!user.emailVerified) {
          setAuthMessage('Verify your email first, or use Email Code mode.');
          setIsAuthBusy(false);
          return;
        }
        setAuthMessage('Signed in.');
        await syncProfile();
      } else {
        await sendEmailOtp(authEmail.trim(), false);
        setAuthOtpCode('');
        setIsOtpRequested(true);
        setResendCooldown(60);
        setAuthMessage('Code sent. Check your email inbox.');
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
      setAuthMessage(emailValidation.message ?? 'Please enter a valid email.');
      return;
    }

    setIsAuthBusy(true);
    try {
      if (authMethod === 'password') {
        await signUpWithPassword(authEmail.trim(), authPassword);
        setAuthPassword('');
        setIsOtpRequested(true);
        setAuthMessage('Account created. Enter the 6-digit code from your email.');
      } else {
        await sendEmailOtp(authEmail.trim(), true);
        setAuthOtpCode('');
        setIsOtpRequested(true);
        setResendCooldown(60);
        setAuthMessage('Verification code sent.');
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
      await syncProfile();
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleResendOtpForAuthForm = async () => {
    if (resendCooldown > 0) return;
    setIsAuthBusy(true);
    setAuthMessage(null);
    try {
      await sendEmailOtp(authEmail.trim(), authView === 'sign-up');
      setResendCooldown(60);
      setAuthMessage('A new code has been sent.');
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!authUser?.email) {
      setAuthMessage('Please sign in first.');
      return;
    }
    setIsVerificationSending(true);
    setAuthMessage(null);
    try {
      await resendVerificationEmail(authUser.email);
      setAuthMessage('Verification email sent. Please check your inbox.');
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsVerificationSending(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (!authUser) return;
    setIsVerificationChecking(true);
    setAuthMessage(null);
    try {
      const refreshedUser = await refreshAuthUser();
      setAuthUser(refreshedUser);
      if (refreshedUser?.emailVerified) {
        setAuthMessage('Email verified. You can now use OryxSolver.');
        await syncProfile();
      } else {
        setAuthMessage('Still not verified. Open your email and click the verify link.');
      }
    } catch (error) {
      setAuthMessage(mapSupabaseAuthError(error));
    } finally {
      setIsVerificationChecking(false);
    }
  };

  const handleSignOut = async () => {
    if (!isSupabaseAuthConfigured) return;
    await signOutUser();
    setLatestResponse(null);
    setSendError(null);
    setUsage({
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      totalCredits: 50,
      usedCredits: 0,
      monthlyImagesUsed: 0,
      monthlyImagesLimit: 10,
    });
    setComposerSuggestions(DEFAULT_SUGGESTIONS);
    setAuthMessage('Signed out.');
    setIsProfileOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!authUser) {
      setProfileMessage('You need to be signed in.');
      return;
    }

    try {
      await updateCurrentUserProfile({
        displayName: profileName.trim() || null,
        photoURL: profilePhotoUrl.trim() || null,
      });
      const refreshedUser = await refreshAuthUser();
      setAuthUser(refreshedUser);
      setProfileMessage('Profile updated.');
      setIsProfileOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update profile';
      setProfileMessage(message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      setProfileMessage('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setProfileMessage('Passwords do not match.');
      return;
    }
    if (!isSupabaseAuthConfigured) {
      setProfileMessage('Auth not configured.');
      return;
    }
    try {
      await updateUserPassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setProfileMessage('Password updated successfully!');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to update password.');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      if (!isSupabaseAuthConfigured) throw new Error('Not configured');
      // Sign out locally — actual deletion should be handled by a server-side edge function
      // For now, we sign the user out and show a message
      await signOutUser();
      setLatestResponse(null);
      setSendError(null);
      setAuthMessage('Account deletion requested. Contact support to finalize.');
      setIsProfileOpen(false);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Failed to process request.');
    }
  };

  const handleSend = async ({ text, images, styleMode }: SendPayload) => {
    if (!text.trim() && images.length === 0) return;

    setIsSending(true);
    setSendError(null);
    setSendErrorCode(null);
    setComposerSuggestions([]);

    try {
      if (!authUser) {
        throw new Error('Please sign in before sending a question.');
      }
      if (!authUser.emailVerified) {
        throw new Error('Please verify your email before sending questions.');
      }

      const token = await getAccessToken();

      const dataJson = await postSolveRequest(token, {
        question: text,
        styleMode,
        images,
      });
      if (dataJson?.usage) {
        const nextUsage = buildUsageSnapshot(dataJson.usage);
        setUsage((prev) => mergeUsageSnapshot(prev, nextUsage));
      }
      const answer =
        typeof dataJson?.answer === 'string' && dataJson.answer.trim()
          ? dataJson.answer.trim()
          : 'Answer available in explanation';

      const explanation =
        typeof dataJson?.explanation === 'string' && dataJson.explanation.trim()
          ? dataJson.explanation.trim()
          : Array.isArray(dataJson?.steps)
            ? dataJson.steps.map((step: unknown) => String(step)).join('\n')
            : JSON.stringify(dataJson, null, 2);

      const suggestions = Array.isArray(dataJson?.suggestions)
        ? dataJson.suggestions
            .filter((s: unknown) => typeof s === 'object' && s !== null)
            .map((s: unknown) => {
              const item = s as { label?: unknown; prompt?: unknown; styleMode?: unknown };
              return {
                label: typeof item.label === 'string' ? item.label : 'Try this',
                prompt: typeof item.prompt === 'string' ? item.prompt : '',
                ...(typeof item.styleMode === 'string' ? { styleMode: item.styleMode as StyleMode } : {}),
              };
            })
            .filter((s: { prompt: string }) => s.prompt.trim().length > 0)
        : [];

      setLatestResponse({ answer, explanation, suggestions });
      setComposerSuggestions(suggestions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      let code: string | null = null;
      if (error instanceof Error && typeof (error as Error & { code?: string }).code === 'string') {
        code = (error as Error & { code?: string }).code ?? null;
        setSendErrorCode(code);
      }
      setSendError(mapSolveErrorMessage(code, message));
      console.error('Error sending to AI:', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleUpgradeClick = () => {
    if (!upgradeUrl) {
      setSendError('Upgrade URL is not configured. Set VITE_UPGRADE_URL in extension/.env');
      return;
    }
    window.open(upgradeUrl, '_blank');
  };



  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,#e5e9ef_0%,#d9dee6_54%,#e6eaf0_100%)] font-sans text-slate-900 transition-colors duration-300 dark:bg-slate-900 dark:bg-none dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgba(255,255,255,0.34),transparent_60%)] dark:opacity-10" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(15,23,42,0.09)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_48%,rgba(255,255,255,0.03)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.007] [background-image:radial-gradient(#0f172a_0.65px,transparent_0.65px)] [background-size:3px_3px] dark:[background-image:radial-gradient(#ffffff_0.65px,transparent_0.65px)] dark:opacity-[0.02]" />

      <SidePanelHeader
        logoUrl={logoUrl}
        appName="Oryx Solver"
        usedCredits={usage.usedCredits}
        totalCredits={usage.totalCredits}
        isSignedIn={isSignedIn}
        userEmail={authUser?.email}
        userPhotoUrl={authUser?.photoURL}
        isPro={usage.subscriptionTier === 'pro'}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        onToggleHistory={() => setIsHistoryOpen(!isHistoryOpen)}
        onOpenProfile={() => {
          setProfileMessage(null);
          setIsProfileOpen((v) => !v);
        }}
      />

      {isHistoryOpen && (
        <div 
          className="fixed inset-0 z-50 flex animate-in fade-in duration-300"
          onClick={(e) => { if (e.target === e.currentTarget) setIsHistoryOpen(false); }}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div className="relative h-full w-[85%] max-w-[300px] bg-white shadow-2xl animate-in slide-in-from-left duration-500 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
            <HistoryPanel 
               onClose={() => setIsHistoryOpen(false)}
               onNewSolve={() => setLatestResponse(null)}
               onOpenSettings={() => {
                 setProfileMessage(null);
                 setIsProfileOpen(true);
               }}
               onSelect={(resp) => {
                 setLatestResponse(resp);
                 setIsHistoryOpen(false);
               }}
            />
          </div>
        </div>
      )}


      {isSignedIn && isProfileOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsProfileOpen(false); }}
        >
          <div className="relative w-full max-w-sm rounded-t-[32px] border-t border-white/50 bg-white/98 shadow-2xl backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
            {/* Handle Bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* Panel Header */}
            <div className="flex items-center gap-3 px-6 py-4">
              {settingsPanel !== 'menu' && (
                <button
                  type="button"
                  onClick={() => { setSettingsPanel('menu'); setProfileMessage(null); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
              )}
              <div className="flex-1">
                <p className="text-lg font-black tracking-tight text-slate-900">
                  {settingsPanel === 'menu' && 'Account'}
                  {settingsPanel === 'profile' && 'My Profile'}
                  {settingsPanel === 'settings' && 'App Settings'}
                  {settingsPanel === 'password' && 'Security'}
                </p>
                {settingsPanel === 'menu' && (
                  <p className="text-xs font-medium text-slate-500 truncate">{authUser?.email}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setIsProfileOpen(false); setSettingsPanel('menu'); setProfileMessage(null); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="max-h-[70vh] overflow-y-auto px-4 pb-8 text-slate-900">
              {/* Menu View */}
              {settingsPanel === 'menu' && (
                <div className="space-y-2 p-2">
                  <button
                    type="button"
                    onClick={() => { setSettingsPanel('profile'); setProfileMessage(null); }}
                    className="group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-indigo-50/50 active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                      <User size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">Profile & Usage</p>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Plan: {usage.subscriptionTier}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSettingsPanel('password'); setProfileMessage(null); setNewPassword(''); setConfirmNewPassword(''); }}
                    className="group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-violet-50/50 active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors shadow-sm">
                      <Shield size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">Security</p>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Manage password</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-violet-400 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSettingsPanel('settings'); setProfileMessage(null); }}
                    className="group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors shadow-sm">
                      <Settings size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">Settings</p>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Theme & App options</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </button>

                  <div className="my-4 mx-4 border-t border-slate-100" />

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-red-50 active:scale-[0.98]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors shadow-sm">
                      <LogOut size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-600">Sign Out</p>
                      <p className="text-[11px] font-medium text-red-400 uppercase tracking-widest">End session</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Profile Edit View */}
              {settingsPanel === 'profile' && (
                <div className="p-2 space-y-6">
                  {/* Usage Summary */}
                  <div className="rounded-[24px] bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-4">Plan Usage</p>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-bold text-slate-700">Credits</span>
                          <span className="font-black text-indigo-600">{usage.usedCredits} / {usage.totalCredits}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000"
                            style={{ width: `${(usage.usedCredits / usage.totalCredits) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-50">
                        <span className="text-slate-500 font-medium">Status</span>
                        <span className="font-bold text-emerald-600 uppercase tracking-widest">{usage.subscriptionStatus}</span>
                      </div>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-4 px-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Display Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Avatar URL</label>
                      <input
                        type="url"
                        value={profilePhotoUrl}
                        onChange={(e) => setProfilePhotoUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="w-full rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.98]"
                    >
                      Save Profile
                    </button>
                  </div>
                  {profileMessage && <p className="text-center text-xs font-bold text-indigo-600 animate-pulse">{profileMessage}</p>}
                </div>
              )}

              {/* Password View */}
              {settingsPanel === 'password' && (
                <div className="p-2 space-y-4">
                  <div className="px-2 space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                        />
                        <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600">
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      className="w-full rounded-2xl bg-violet-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-100 transition hover:bg-violet-700 active:scale-[0.98]"
                    >
                      Update Security
                    </button>
                  </div>
                  {profileMessage && <p className="text-center text-xs font-bold text-violet-600 animate-pulse">{profileMessage}</p>}
                </div>
              )}

              {/* Settings View */}
              {settingsPanel === 'settings' && (
                <div className="p-2 space-y-6">
                  <div className="space-y-3 px-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Preferences</p>
                    
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 text-slate-700">
                        {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                        <span className="text-sm font-bold">Dark Mode</span>
                      </div>
                      <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100 shadow-sm opacity-60">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Bell size={18} />
                        <span className="text-sm font-bold">Notifications</span>
                      </div>
                      <div className="h-6 w-11 rounded-full bg-slate-200" />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100 shadow-sm opacity-60">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Globe size={18} />
                        <span className="text-sm font-bold">Language</span>
                      </div>
                      <span className="text-xs font-black text-slate-400">EN</span>
                    </div>

                    <div className="pt-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Advanced</p>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.98]"
                      >
                        <Trash2 size={18} />
                        Permanently Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* History View Logic Removed from Profile Menu */}
            </div>
          </div>
        </div>
      )}

      {!isSignedIn && !isAuthLoading && (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[40px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl transition-all duration-500">
            {/* Top Branding */}
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-white shadow-xl shadow-indigo-100 ring-1 ring-slate-100 transition-transform hover:scale-105 duration-300">
                <img src={logoUrl} alt="OryxSolver" className="h-full w-full object-cover p-3 rounded-2xl" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {authView === 'sign-in' ? 'Welcome Back' : 'Get Started'}
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                {authView === 'sign-in' 
                  ? 'Sign in to access your solving history.' 
                  : 'Join OryxSolver and solve anything instantly.'}
              </p>
            </div>

            {/* Auth Form Section */}
            <div className="px-8 pb-10">
              {/* Method Switcher */}
              <div className="mb-6 flex rounded-2xl bg-slate-100/50 p-1.5 ring-1 ring-slate-200/50">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('password');
                    setIsOtpRequested(false);
                    setAuthOtpCode('');
                    setAuthMessage(null);
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                    authMethod === 'password'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('code');
                    setAuthPassword('');
                    setAuthMessage(null);
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                    authMethod === 'code'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Email Code
                </button>
              </div>

              <div className="space-y-4">
                {/* Email Input */}
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                {/* Password Input */}
                {authMethod === 'password' && (
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Your password"
                      className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-10 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                {/* OTP Input (Conditional) */}
                <div className={`group relative transition-all duration-300 ${isOtpRequested ? 'block' : 'hidden'}`}>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Key size={18} />
                  </div>
                  <input
                    type="text"
                    value={authOtpCode}
                    onChange={(e) => setAuthOtpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-4 text-sm font-semibold tracking-wider outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-3">
                  {!isOtpRequested ? (
                    <button
                      type="button"
                      disabled={isAuthBusy}
                      onClick={authView === 'sign-in' ? handleSignIn : handleSignUp}
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                    >
                      <span>{isAuthBusy ? 'Processing...' : (authView === 'sign-in' ? 'Sign In' : 'Create Account')}</span>
                      {!isAuthBusy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isAuthBusy}
                        onClick={handleVerifyOtpCode}
                        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {isAuthBusy ? 'Verifying...' : 'Verify & Continue'}
                      </button>
                      <button
                        type="button"
                        disabled={isAuthBusy || resendCooldown > 0}
                        onClick={handleResendOtpForAuthForm}
                        className="w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition disabled:text-slate-400"
                      >
                        {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </>
                  )}

                  {/* Toggle Sign In / Sign Up */}
                  <div className="pt-4 flex items-center justify-center gap-2">
                    <span className="text-xs text-slate-500">
                      {authView === 'sign-in' ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMessage(null);
                        setIsOtpRequested(false);
                        setAuthOtpCode('');
                        setAuthPassword('');
                        setAuthView((v) => (v === 'sign-in' ? 'sign-up' : 'sign-in'));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:underline underline-offset-4"
                    >
                      {authView === 'sign-in' ? 'Sign Up' : 'Log In'}
                    </button>
                  </div>
                </div>

                {/* Bottom Messages */}
                {!isSupabaseAuthConfigured && (
                  <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2 text-center text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
                    Configuration missing in extension/.env
                  </p>
                )}
                {authMessage && (
                  <p className="mt-4 text-center text-xs font-medium text-slate-600 animate-in fade-in slide-in-from-top-1">
                    {authMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {isSignedIn && !isEmailVerified && (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          {/* Background Orbs */}
          <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />

          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-2xl backdrop-blur-2xl">
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4 shadow-inner ring-1 ring-white/50">
                <Mail size={44} className="text-amber-600 drop-shadow-sm" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Verify Email</h1>
              <p className="mt-2 text-sm font-medium text-slate-500/80">
                A verification link and a code were sent to <span className="text-indigo-600 font-semibold">{authUser?.email}</span>
              </p>
            </div>

            <div className="px-8 pb-10 space-y-6">
              {/* OTP Input for Verification */}
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Key size={18} />
                </div>
                <input
                  type="text"
                  value={authOtpCode}
                  onChange={(e) => setAuthOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-4 text-sm font-semibold tracking-widest outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleVerifyOtpCode}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Confirm Code
                </button>

                <div className="grid grid-cols-1 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleResendVerificationEmail}
                    disabled={isVerificationSending}
                    className="rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-indigo-600 disabled:opacity-50"
                  >
                    {isVerificationSending ? 'Sending...' : 'Resend Email'}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshVerificationStatus}
                    disabled={isVerificationChecking}
                    className="rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-indigo-600 disabled:opacity-50"
                  >
                    {isVerificationChecking ? 'Checking...' : 'I used the Magic Link'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-2 text-xs font-bold text-slate-400 hover:text-rose-500 transition flex items-center justify-center gap-1"
                  >
                    Not you? Sign out
                  </button>
                </div>
              </div>

              {authMessage && (
                <p className="text-center text-xs font-medium text-slate-600">
                  {authMessage}
                </p>
              )}
            </div>
          </div>
        </main>
      )}

      {isSignedIn && isEmailVerified && (
        <>
          <div className={`flex flex-1 min-h-0 flex-col ${!latestResponse ? 'justify-center overflow-hidden' : ''}`}>
            <main className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-transparent custom-scrollbar ${!latestResponse ? 'items-center px-4 transition-all duration-700' : 'space-y-4 p-4 pt-4'}`}>
              {!latestResponse && (
                <div className="mx-auto w-full max-w-[340px] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                  <div className="rounded-[40px] px-6 py-2 text-center">
                    <div className="mx-auto mb-6 flex h-[80px] w-[80px] items-center justify-center rounded-[28px] bg-white dark:bg-slate-800 shadow-2xl shadow-indigo-100 ring-1 ring-slate-100 dark:shadow-none dark:ring-slate-700 animate-bounce-subtle">
                      <img src={logoUrl} alt="OryxSolver" className="h-[48px] w-[48px] object-cover" />
                    </div>
                    <h2 className="text-[32px] font-black tracking-tighter text-slate-900 dark:text-slate-50 leading-[1] mb-4">
                      Homework Solved. <br/> Step by Step.
                    </h2>
                    <p className="mx-auto max-w-[280px] text-[16px] font-bold leading-relaxed text-slate-500 dark:text-slate-400">
                      Solve any problem with step-by-step explanations instantly.
                    </p>
                    <div className="mx-auto mt-5 w-full max-w-[300px] rounded-2xl border border-slate-200/70 bg-white/70 p-3 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                        Try these
                      </p>
                      <div className="mt-2 space-y-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                        <p>Solve: 2x + 5 = 17</p>
                        <p>Explain: Photosynthesis</p>
                        <p>Find derivative: x^2 + 3x</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {latestResponse && <ResponsePanel response={latestResponse} steps={explanationSteps} />}
            </main>

            <div className={`shrink-0 transition-all duration-700 ${!latestResponse ? 'mx-auto mt-4 w-full max-w-[420px] px-6 pb-8' : 'w-full'}`}>
              {isSending && (
                <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 animate-in fade-in dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <p className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Oryx is solving...
                  </p>
                  <div className="ml-1 flex items-center gap-1">
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600 [animation-delay:0ms] dark:bg-indigo-300" />
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600 [animation-delay:150ms] dark:bg-indigo-300" />
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600 [animation-delay:300ms] dark:bg-indigo-300" />
                  </div>
                </div>
              )}
              {sendError && !showUpgradeCta && (
                <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-[12px] font-bold text-rose-700 ring-1 ring-rose-200 animate-in fade-in slide-in-from-top-1">
                  <X size={14} />
                  <span>{sendError}</span>
                </div>
              )}
              <MessageComposer
                onSend={handleSend}
                onCaptureScreen={handleCaptureScreen}
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                suggestions={composerSuggestions}
                isHero={!latestResponse}
              />
            </div>
          </div>
        </>
      )}

      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/65 bg-white/92 shadow-xl backdrop-blur-xl">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
              <p className="text-lg font-semibold">Upgrade to Pro</p>
              <p className="mt-1 text-sm text-indigo-100">
                {upgradeMoment.level === 'paywall'
                  ? `You've used ${usage.usedCredits} free questions this month.`
                  : 'Get faster solving with higher limits.'}
              </p>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What you get</p>
                <div className="mt-3 space-y-2 text-sm text-slate-800">
                  <p>- Longer support with higher monthly limits</p>
                  <p>- More conversations and more image uploads</p>
                  <p>- Premium tools and priority processing</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                <span className="font-semibold">Current plan:</span> Free ({usage.usedCredits}/{usage.totalCredits} credits used)
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
                >
                  Go to Upgrade Page
                </button>
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
