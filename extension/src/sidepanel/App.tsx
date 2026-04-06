import { useState, useEffect, useRef } from 'react';
import * as Sentry from "@sentry/react";
import MessageComposer from './components/MessageComposer';
import SidePanelHeader from './components/SidePanelHeader';
import AuthView from './components/AuthView';
import HeroView from './components/HeroView';
import { useAuth } from './hooks/useAuth';
import { useInlineQuestionBridge } from './hooks/useInlineQuestionBridge';
import { useUsage } from './hooks/useUsage';
import { useSolve } from './hooks/useSolve';
import { useTranslation } from 'react-i18next';
import { Suspense, lazy } from 'react';

import Banner from './components/Banner';
import MaintenanceOverlay from './components/MaintenanceOverlay';
import ServiceStatusBanner from './components/ServiceStatusBanner';

const HistoryPanel = lazy(() => import('./components/HistoryPanel'));
const ProfileModal = lazy(() => import('./components/modals/ProfileModal'));
const UpgradeModal = lazy(() => import('./components/modals/UpgradeModal'));
const ResponsePanel = lazy(() => import('./components/ResponsePanel'));

import { getAccessToken } from './auth/supabaseAuthClient';
import { supabase } from './services/supabaseClient';
import { deleteHistory, fetchConversation, renameConversation } from './services/historyApi';
import { analytics } from './services/analyticsService';
import { fetchExtensionPublicConfig } from './services/appConfig';
import { captureCroppedAreaToFile } from './services/cameraCapture';
import { sanitizeExternalUrl } from './services/safeExternalUrl';
import { identifyUser as identifyAnalyticsUser, initPosthog, resetUser as resetAnalyticsUser } from './services/posthog';
import type { ChatTurn, StyleMode } from './types';
import { useServiceHealth } from './hooks/useServiceHealth';

function isStyleMode(value: string | null | undefined): value is StyleMode {
  return value === 'standard' || value === 'exam' || value === 'eli5' || value === 'step_by_step' || value === 'gen_alpha';
}

const SESSION_STORAGE_MAX_TURNS = 8;
const SESSION_TEXT_MAX_CHARS = 5000;
const SESSION_STEPS_MAX = 10;
const SESSION_STORAGE_MAX_BYTES = 350_000;

function trimText(value: unknown, max = SESSION_TEXT_MAX_CHARS): string {
  if (typeof value !== 'string') return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function sanitizeSessionTurn(turn: any): ChatTurn | null {
  if (!turn || typeof turn !== 'object') return null;
  const id = typeof turn.id === 'string' ? turn.id : String(Date.now());
  const question = trimText(turn.question, 2000);
  const images = Array.isArray(turn.images)
    ? turn.images.filter((img: unknown): img is string => typeof img === 'string').slice(0, 4)
    : [];

  const responseRaw = turn.response ?? {};
  const response = {
    answer: trimText(responseRaw.answer),
    explanation: trimText(responseRaw.explanation),
    steps: Array.isArray(responseRaw.steps)
      ? responseRaw.steps.filter((s: unknown): s is string => typeof s === 'string').slice(0, SESSION_STEPS_MAX)
      : undefined,
    suggestions: [],
  };

  return {
    id,
    question,
    images,
    isBulk: turn.isBulk === true,
    response,
  };
}

function sanitizeStoredSession(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((turn) => sanitizeSessionTurn(turn))
    .filter((turn): turn is ChatTurn => turn !== null)
    .slice(-SESSION_STORAGE_MAX_TURNS);
}

function scheduleIdle(task: () => void) {
  const withIdle = window as Window & {
    requestIdleCallback?: (callback: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof withIdle.requestIdleCallback === 'function') {
    return withIdle.requestIdleCallback(task, { timeout: 1200 });
  }
  return window.setTimeout(task, 120);
}

function cancelScheduled(handle: number) {
  const withIdle = window as Window & {
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof withIdle.cancelIdleCallback === 'function') {
    withIdle.cancelIdleCallback(handle);
    return;
  }
  window.clearTimeout(handle);
}

export default function App() {
  const EXTENSION_TUTORIAL_KEY = 'oryx_extension_tutorial_opened_v1';
  const { i18n } = useTranslation();
  const [legalVersions, setLegalVersions] = useState({
    termsVersion: '2026-03-18',
    privacyVersion: '2026-03-18',
  });
  const [supportEmail, setSupportEmail] = useState('support@oryxsolver.com');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [bannerConfig, setBannerConfig] = useState<any>(null);
  // --- Global State & Hooks ---
  const { usage, setUsage, syncProfile, resetUsage, upgradeMoment } = useUsage();
  const { health, retryCountdowns, refresh: refreshHealth } = useServiceHealth();
  
  const [quotedStep, setQuotedStep] = useState<{ text: string; index: number } | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  
  const { 
    authUser, isAuthLoading, isAuthBusy, authMessage, authEmail, authPassword, 
    authOtpCode, isOtpRequested, authView, authMethod, resendCooldown,
    setAuthEmail, setAuthPassword, setAuthOtpCode, setAuthMethod, setAuthView,
    handleSignIn, handleGoogleSignIn, handleSignUp, handleVerifyOtpCode, handleResendOtp, handleResetPassword, signOut, updateProfile,
    updatePassword, resetAuthState, refreshAuth,
  } = useAuth(syncProfile, legalVersions);

  const {
    isSending, sendError, chatSession, setChatSession,
    activeConversationId, setActiveConversationId, handleSend, clearSession, setSendError
  } = useSolve(usage, setUsage, quotedStep, setQuotedStep, () => setIsUpgradeModalOpen(true), i18n.language);
  const solveBlocked =
    health.readOnly &&
    (health.dependencies.network.status === 'outage' ||
      health.dependencies.backend.status !== 'healthy' ||
      health.dependencies.ai.status !== 'healthy' ||
      health.dependencies.db.status !== 'healthy');
  const cloudHistoryReadOnly = health.readOnly && (health.dependencies.db.status !== 'healthy' || health.dependencies.network.status === 'outage');
  const shouldShowServiceBanner = authUser
    ? health.readOnly
    : health.dependencies.network.status === 'outage' ||
      health.dependencies.backend.status === 'outage' ||
      health.dependencies.auth.status === 'outage' ||
      health.dependencies.backend.status === 'maintenance' ||
      health.dependencies.auth.status === 'maintenance';

  // --- UI State ---
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem('oryx_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    const legacyDark = localStorage.getItem('oryx_dark_mode');
    if (legacyDark === 'true') return 'dark';
    if (legacyDark === 'false') return 'light';
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (!window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [settingsPanel, setSettingsPanel] = useState<'menu' | 'profile' | 'appearance' | 'history' | 'usage' | 'password' | 'support'>('menu');
  const [styleMode, setStyleMode] = useState<StyleMode>('standard');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [authCallbackState, setAuthCallbackState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handle = scheduleIdle(() => {
      initPosthog();
    });
    return () => {
      cancelScheduled(handle);
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      identifyAnalyticsUser(authUser.id, {
        email: authUser.email,
        displayName: authUser.displayName,
      });
      Sentry.setUser({
        id: authUser.id,
        email: authUser.email ?? undefined,
        username: authUser.displayName ?? undefined,
      });
      return;
    }

    resetAnalyticsUser();
    Sentry.setUser(null);
  }, [authUser]);

  useEffect(() => {
    if (chatSession.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [chatSession]);
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [saveHistory, setSaveHistory] = useState(() => localStorage.getItem('oryx_save_history') !== 'false');
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [useAnalytics, setUseAnalytics] = useState(() => localStorage.getItem('oryx_analytics') !== 'false');
  const [autoCopy, setAutoCopy] = useState(() => localStorage.getItem('oryx_auto_copy') === 'true');
  const [inlineContextSnippet, setInlineContextSnippet] = useState<string | null>(null);
  const isThreadLocked = Boolean(activeConversationId || chatSession.length > 0);

  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
  const latestResponse = chatSession.length > 0 ? chatSession[chatSession.length - 1].response : null;
  const logoUrl = '/app_icons/logo.png';
  const webAppBaseUrl = (() => {
    const explicit = sanitizeExternalUrl(String(import.meta.env.VITE_WEBAPP_URL ?? '').trim(), [
      'oryxsolver.com',
      'www.oryxsolver.com',
      'localhost',
      '127.0.0.1',
    ]);
    if (explicit) {
      try {
        return new URL(explicit).origin;
      } catch {
        return '';
      }
    }
    return 'https://oryxsolver.com';
  })();
  const upgradeUrl = webAppBaseUrl
    ? `${webAppBaseUrl}/subscription${authUser ? `?source=extension&user=${encodeURIComponent(authUser.id)}` : ''}`
    : '';
  const onboardingUrl = webAppBaseUrl
    ? `${webAppBaseUrl}/onboarding${authUser ? '?source=extension' : ''}`
    : '';
  const needsOnboarding = Boolean(authUser && !authUser.onboardingCompleted);

  // --- Effects & Lifecycle ---
  useEffect(() => {
    analytics.track('app_opened');
    
    const tutorialOpened = localStorage.getItem(EXTENSION_TUTORIAL_KEY);
    if (!tutorialOpened && webAppBaseUrl) {
      chrome.tabs.create({ url: `${webAppBaseUrl}/how-it-works` });
      localStorage.setItem(EXTENSION_TUTORIAL_KEY, 'true');
    }
  }, [webAppBaseUrl]);

  useEffect(() => {
    if (!supabase) return;
    if (!window.location.hash.includes('access_token')) return;
    setAuthCallbackState('processing');

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setAuthCallbackState('error');
      if (window.history?.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error('Failed to complete OAuth callback in extension:', error);
          setAuthCallbackState('error');
          return;
        }
        setAuthCallbackState('success');
      })
      .finally(() => {
        if (window.history?.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }
      });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLegalVersions() {
      try {
        const config = await fetchExtensionPublicConfig();
        if (!active) return;
        setLegalVersions({
          termsVersion: config.termsVersion,
          privacyVersion: config.privacyVersion,
        });
        setSupportEmail(config.supportEmail);
        setMaintenanceMode(config.maintenanceMode);
        setBannerConfig(config.banner);
      } catch (error) {
        console.error('Failed to load extension legal versions:', error);
      }
    }
    const handle = scheduleIdle(() => {
      void loadLegalVersions();
    });
    return () => {
      active = false;
      cancelScheduled(handle);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!saveHistory) {
      localStorage.removeItem('oryx_current_session');
      localStorage.removeItem('oryx_active_conv_id');
      setIsSessionHydrated(true);
      return;
    }
    const handle = scheduleIdle(() => {
      if (!active) return;
      const saved = localStorage.getItem('oryx_current_session');
      const savedId = localStorage.getItem('oryx_active_conv_id');
      if (saved) {
        try {
          if (saved.length > SESSION_STORAGE_MAX_BYTES) {
            console.warn('[session] Stored session too large. Clearing local cache.');
            localStorage.removeItem('oryx_current_session');
          } else {
            const parsed = JSON.parse(saved);
            if (active) setChatSession(sanitizeStoredSession(parsed));
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (savedId && active) setActiveConversationId(savedId);
      if (active) setIsSessionHydrated(true);
    });
    return () => {
      active = false;
      cancelScheduled(handle);
    };
  }, [saveHistory, setChatSession, setActiveConversationId]);

  useEffect(() => {
    if (!saveHistory || !isSessionHydrated) return;
    const compactSession = sanitizeStoredSession(chatSession);
    localStorage.setItem('oryx_current_session', JSON.stringify(compactSession));
    if (activeConversationId) localStorage.setItem('oryx_active_conv_id', activeConversationId);
    else localStorage.removeItem('oryx_active_conv_id');
  }, [chatSession, activeConversationId, saveHistory, isSessionHydrated]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    if (media.addEventListener) {
      media.addEventListener('change', handler);
    } else {
      media.addListener(handler);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler);
      } else {
        media.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('oryx_theme', themeMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [themeMode, isDarkMode]);

  useEffect(() => {
    localStorage.setItem('oryx_save_history', String(saveHistory));
  }, [saveHistory]);

  useEffect(() => {
    if (authUser) {
      setProfileName(authUser.displayName || '');
      setProfilePhotoUrl(authUser.photoURL || '');
    }
  }, [authUser]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (!(e.ctrlKey && e.shiftKey && e.key === 'H') && !(e.ctrlKey && e.key === 'n')) return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); setIsHistoryOpen(p => !p); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); clearSession(); document.getElementById('composer-input')?.focus(); }
      if (e.ctrlKey && e.key === 'c' && !window.getSelection()?.toString() && latestResponse?.answer) {
        navigator.clipboard.writeText(latestResponse.answer);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [latestResponse, clearSession]);

  useEffect(() => {
    if (autoCopy && latestResponse?.answer && !isSending) {
      navigator.clipboard.writeText(latestResponse.answer).catch(e => console.error('Auto-copy failed', e));
    }
  }, [latestResponse, autoCopy, isSending]);

  useInlineQuestionBridge({
    handleSend,
    setInlineContextSnippet,
  });

  useEffect(() => {
    if (!isSending) {
      setInlineContextSnippet(null);
    }
  }, [isSending]);

  // --- Handlers ---
  const handleSignOutAction = async () => {
    await signOut();
    clearSession();
    resetUsage();
    resetAuthState();
    setIsProfileOpen(false);
  };

  const handleSaveProfileAction = async () => {
    try {
      await updateProfile({ displayName: profileName, photoURL: profilePhotoUrl });
      setProfileMessage('Profile updated.');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (e: any) {
      setProfileMessage(e.message || 'Update failed');
    }
  };

  const handleClearHistoryAction = async () => {
    if (!confirm('Clear all question history?')) return;
    try {
      const token = await getAccessToken();
      await deleteHistory(token, { all: true });
      clearSession();
      setProfileMessage('History cleared.');
    } catch (e) { setProfileMessage('Failed to clear history.'); }
  };

  const handleDeleteConversation = async (id: string | null) => {
    if (!id) return;
    const token = await getAccessToken();
    await deleteHistory(token, { conversationId: id });
    if (activeConversationId === id) clearSession();
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    if (!id) return;
    const token = await getAccessToken();
    await renameConversation(token, id, newTitle);
    if (activeConversationId === id) {
       setChatSession(prev => prev.map((turn, i) => i === 0 ? { ...turn, question: newTitle } : turn));
    }
  };

  // --- Screen Capture Handler ---
  const handleCaptureScreen = async (): Promise<File | null> => {
    return await captureCroppedAreaToFile();
  };

  // --- Render ---
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#0a0c1b]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    }>
      <div className="oryx-shell-bg relative flex h-screen flex-col overflow-hidden font-sans text-slate-900 transition-colors duration-300 dark:text-slate-100">
      {maintenanceMode && <MaintenanceOverlay />}
      {!maintenanceMode && shouldShowServiceBanner && (
        <ServiceStatusBanner
          health={health}
          retryCountdowns={retryCountdowns}
          onRetry={() => void refreshHealth()}
        />
      )}
      <div className="pointer-events-none absolute inset-0 overflow-hidden dark:hidden">
        <div className="absolute -top-[12%] left-1/2 h-[36%] w-[86%] -translate-x-1/2 rounded-[100%] bg-indigo-200/28 blur-[90px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-15%,rgba(99,102,241,0.08)_0%,transparent_56%)]" />
      </div>
      {/* Background Glows for Dark Mode */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 dark:opacity-100">
        <div className="absolute -top-[15%] left-1/2 h-[50%] w-[90%] -translate-x-1/2 rounded-[100%] bg-indigo-500/14 blur-[100px]" />
        <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_50%_-10%,rgba(79,70,229,0.2)_0%,transparent_58%)]" />
      </div>

      <SidePanelHeader
        appName="Oryx Solver"
        monthlyUsed={usage.monthlyQuestionsUsed}
        monthlyLimit={usage.monthlyQuestionsLimit}
        isSignedIn={!!authUser}
        userEmail={authUser?.email}
        userPhotoUrl={authUser?.photoURL}
        isPro={usage.subscriptionTier !== 'free'}
        planLabel={usage.subscriptionTier === 'premium' ? 'Premium Account' : usage.subscriptionTier === 'pro' ? 'Pro Account' : undefined}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => {
          setThemeMode((prev) => (prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system'));
        }}
        onToggleHistory={() => {
          const next = !isHistoryOpen;
          setIsHistoryOpen(next);
          if (next) analytics.track('history_opened');
        }}
        onOpenSettings={() => {
          setIsProfileOpen(true);
          analytics.track('settings_opened');
        }}
        showCredits={!!authUser}
        paygoRemaining={usage.paygoCreditsRemaining}
        onOpenUpgrade={() => {
          setIsUpgradeModalOpen(true);
          analytics.track('upgrade_modal_opened', { source: 'header' });
        }}
        webAppBaseUrl={webAppBaseUrl}
      />

      {bannerConfig?.active && (
        <Banner 
          message={bannerConfig.message} 
          type={bannerConfig.type} 
          id="announcement"
        />
      )}

      {isSending && inlineContextSnippet && (
        <div className="z-10 mx-3 mt-2 rounded-2xl border border-indigo-100/60 bg-indigo-50/80 px-3 py-2 text-[11px] font-medium text-indigo-700 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-1 dark:border-indigo-500/30 dark:bg-indigo-900/40 dark:text-indigo-200">
          <span className="mr-1 font-black uppercase tracking-widest text-[9px] text-indigo-500">Solving from page</span>
          <span className="sr-only">Current inline question context</span>
          <span className="block truncate" aria-hidden="true">"{inlineContextSnippet}"</span>
        </div>
      )}

      {authCallbackState !== 'idle' && !authUser && (
        <div className="z-20 mx-3 mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[12px] font-semibold text-emerald-200 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-1">
          {authCallbackState === 'processing' && 'Finishing sign-in...'}
          {authCallbackState === 'success' && 'Signed in. You can close this tab and open the extension.'}
          {authCallbackState === 'error' && 'Sign-in failed. Please try again from the extension.'}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {!authUser && !isAuthLoading ? (
          <AuthView
            view={authView}
            method={authMethod}
            email={authEmail}
            password={authPassword}
            otpCode={authOtpCode}
            isOtpRequested={isOtpRequested}
            isBusy={isAuthBusy}
            message={authMessage}
            resendCooldown={resendCooldown}
            logoUrl={logoUrl}
            onSetEmail={setAuthEmail}
            onSetPassword={setAuthPassword}
            onSetOtpCode={setAuthOtpCode}
            onSetMethod={setAuthMethod}
            onSetView={setAuthView}
            onSignIn={handleSignIn}
            onSignInWithGoogle={handleGoogleSignIn}
            onSignUp={handleSignUp}
            onVerifyOtp={handleVerifyOtpCode}
            onResendOtp={handleResendOtp}
            onResetPassword={handleResetPassword}
          />
        ) : isAuthLoading ? (
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="oryx-shell-panel-strong flex flex-col items-center gap-3 rounded-3xl border px-8 py-10 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Loading account
              </p>
            </div>
          </main>
        ) : needsOnboarding ? (
          <main className="flex flex-1 items-center justify-center p-6">
            <section className="oryx-shell-panel-strong flex max-w-md flex-col items-start gap-4 rounded-[32px] border px-6 py-7 text-left shadow-xl">
              <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-200">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">Setup required</p>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Complete onboarding first
                </h2>
                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                  The extension is signed in, but your account setup is not finished yet. Complete onboarding once in the web app, then come back here.
                </p>
              </div>
              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!onboardingUrl) return;
                    chrome.tabs.create({ url: onboardingUrl });
                  }}
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                >
                  Open onboarding
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refreshAuth().then(() => syncProfile());
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/70"
                >
                  Refresh
                </button>
              </div>
            </section>
          </main>
        ) : (
          <main className={`flex min-h-0 flex-1 flex-col bg-transparent custom-scrollbar ${(!latestResponse && !isSending) ? 'overflow-hidden' : 'overflow-y-auto space-y-4 p-4 pb-40'}`}>
            {sendError && (
              <div className="w-full max-w-2xl mx-auto mb-4 mt-4 px-4 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-red-400/5 p-4 text-[13px] text-red-700 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 dark:border-red-400/20 dark:from-red-500/20 dark:to-red-400/10 dark:text-red-300 flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-red-100 p-1 flex-shrink-0 dark:bg-red-900/50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="flex-1 font-medium leading-relaxed">
                  {sendError}
                </div>
                <button onClick={() => setSendError(null)} className="ml-2 rounded-full p-1 hover:bg-red-200/50 dark:hover:bg-red-800/50 transition-colors text-red-500 flex-shrink-0">
                  <span className="sr-only">Dismiss</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}

            {!latestResponse ? (
              <HeroView
                logoUrl={logoUrl}
                onSend={(p) => handleSend({ ...p, language: i18n.language })}
                onCaptureScreen={handleCaptureScreen} 
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                isSending={isSending}
                usage={usage}
                onOpenUpgrade={() => {
                  setIsUpgradeModalOpen(true);
                  analytics.track('upgrade_modal_opened', { source: 'hero_usage_card' });
                }}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {chatSession.map((turn) => (
                  <div key={turn.id} className="flex flex-col gap-4">
                    {/* User Question Bubble */}
                    <div className="flex flex-col items-end gap-1 px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-indigo-600 px-5 py-3.5 text-[14px] font-medium text-white shadow-md relative overflow-hidden group">
                        {turn.isBulk && (
                           <div className="absolute top-0 right-0 bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/50 border-b border-l border-white/5">
                             Bulk Request
                           </div>
                        )}
                        <div className={turn.isBulk ? "mt-2" : ""}>
                          {turn.question || "Captured Screen"}
                        </div>
                        {turn.images && turn.images.length > 0 && (
                          <div className={`mt-3 grid gap-1.5 ${turn.images.length > 3 ? 'grid-cols-4' : turn.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {turn.images.map((src, i) => (
                              <div key={i} className="relative aspect-square w-full min-w-[40px] overflow-hidden rounded-lg border border-white/20 bg-black/10">
                                <img src={src} className="h-full w-full object-cover transition-transform hover:scale-110" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* AI Response Panel */}
                    <ResponsePanel
                      question={turn.question}
                      response={turn.response}
                      onQuoteStep={(text, index) => setQuotedStep({ text, index })}
                      onSuggestionClick={(s: any) => handleSend({ text: s.prompt, images: [], styleMode, language: i18n.language })}
                      conversationId={turn.id}
                    />
                  </div>
                ))}
              </div>
            )}
            <div ref={scrollRef} />
          </main>
        )}
      </div>

      {authUser && latestResponse && !needsOnboarding && (
        <div className="fixed bottom-0 left-0 right-0 w-full z-20">
           <div className="w-full">
              <MessageComposer
                onSend={(p) => handleSend({ ...p, language: i18n.language })}
                onCaptureScreen={handleCaptureScreen} 
                styleMode={styleMode}
                onStyleModeChange={setStyleMode}
                isHero={false}
                isSending={isSending}
                quotedStep={quotedStep}
                onClearQuote={() => setQuotedStep(null)}
                disabledModes={usage.subscriptionTier === 'free' ? ['gen_alpha', 'step_by_step'] : []}
                modeLocked={isThreadLocked}
                serviceUnavailable={solveBlocked}
                serviceUnavailableMessage={solveBlocked ? 'Solving is paused while services recover. Your draft stays here.' : null}
              />
           </div>
        </div>
      )}

      {isHistoryOpen && (
        <HistoryPanel
          onClose={() => setIsHistoryOpen(false)}
          onSelect={async (conversationId: string) => {
            setIsHistoryOpen(false);
            try {
              const token = await getAccessToken();
              const data = await fetchConversation(token, conversationId);
              if (data && data.length > 0) {
                const threadStyleMode = data.map((entry) => entry.style_mode).find(isStyleMode);
                const turns = data
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map(entry => ({
                    id: entry.id,
                    question: entry.question,
                    images: entry.image_urls || [],
                    isBulk: entry.is_bulk || false,
                    response: {
                      answer: entry.answer,
                      explanation: entry.explanation || '',
                      steps: Array.isArray(entry.steps) ? entry.steps : undefined,
                      suggestions: [],
                    },
                  }));
                setChatSession(turns);
                setActiveConversationId(conversationId);
                if (threadStyleMode) {
                  setStyleMode(threadStyleMode);
                }
              }
            } catch (e) {
              console.error('Failed to load conversation', e);
            }
          }}
          onNewSolve={() => { clearSession(); setIsHistoryOpen(false); }}
          onOpenSettings={() => { setIsHistoryOpen(false); setIsProfileOpen(true); }}
          onDeleteConversation={handleDeleteConversation}
          onOpenUpgrade={() => {
            setIsHistoryOpen(false);
            setIsUpgradeModalOpen(true);
            analytics.track('upgrade_modal_opened', { source: 'history_panel' });
          }}
          onRenameConversation={handleRenameConversation}
          historyEnabled={saveHistory}
          onEnableHistory={() => setSaveHistory(true)}
          tier={usage.subscriptionTier || 'free'}
          readOnly={cloudHistoryReadOnly}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          authUser={authUser}
          profileName={profileName}
          profilePhotoUrl={profilePhotoUrl}
          onSetProfileName={setProfileName}
          onSetProfilePhotoUrl={setProfilePhotoUrl}
          onSaveProfile={handleSaveProfileAction}
          onSignOut={handleSignOutAction}
          themeMode={themeMode}
          onSetThemeMode={setThemeMode}
          saveHistory={saveHistory}
          onToggleSaveHistory={setSaveHistory}
          useAnalytics={useAnalytics}
          onToggleAnalytics={(val) => {
            setUseAnalytics(val);
            localStorage.setItem('oryx_analytics', String(val));
          }}
          onClearHistory={handleClearHistoryAction}
          onDeleteAccount={() => {}}
          profileMessage={profileMessage}
          isBusy={isAuthBusy}
          tier={usage?.subscriptionTier || 'free'}
          settingsPanel={settingsPanel}
          onSetSettingsPanel={setSettingsPanel}
          autoCopy={autoCopy}
          onToggleAutoCopy={(val) => {
            setAutoCopy(val);
            localStorage.setItem('oryx_auto_copy', String(val));
          }}
          newPassword={newPassword}
          confirmNewPassword={confirmNewPassword}
          onSetNewPassword={setNewPassword}
          onSetConfirmNewPassword={setConfirmNewPassword}
          onChangePassword={async () => {
            setProfileMessage(null);
            if (!newPassword.trim() || newPassword.length < 8) {
              setProfileMessage('Password must be at least 8 characters.');
              return;
            }
            if (newPassword !== confirmNewPassword) {
              setProfileMessage('Passwords do not match.');
              return;
            }
            try {
              await updatePassword(newPassword);
              setNewPassword('');
              setConfirmNewPassword('');
              setProfileMessage('Password updated.');
            } catch (e: any) {
              setProfileMessage(e?.message || 'Password update failed.');
            }
          }}
          monthlyQuestionsLimit={usage.monthlyQuestionsLimit}
          monthlyQuestionsUsed={usage.monthlyQuestionsUsed}
          monthlyImagesUsed={usage.monthlyImagesUsed}
          monthlyImagesLimit={usage.monthlyImagesLimit}
          supportEmail={supportEmail}
          webAppBaseUrl={webAppBaseUrl}
        />
      )}

      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          upgradeMoment={upgradeMoment}
          upgradeUrl={upgradeUrl}
        />
      )}
      </div>
    </Suspense>
  );
}
