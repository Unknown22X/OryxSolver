import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import MessageComposer from './components/MessageComposer';
import { captureCroppedAreaToFile } from './services/cameraCapture';
import SidePanelHeader from './components/SidePanelHeader';
import ResponsePanel from './components/ResponsePanel';
import { parseExplanationSteps } from './utils/parseExplanationSteps';
import { firebaseAuth, isFirebaseConfigured } from './auth/firebaseClient';
import { mapFirebaseAuthError } from './auth/mapFirebaseAuthError';
import type { AiResponse, SendPayload } from './types';

type AuthView = 'sign-in' | 'sign-up';
type UsageSnapshot = {
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'active' | 'inactive' | 'canceled';
  totalCredits: number;
  usedCredits: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
};


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
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isVerificationSending, setIsVerificationSending] = useState(false);
  const [isVerificationChecking, setIsVerificationChecking] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const explanationSteps = latestResponse ? parseExplanationSteps(latestResponse.explanation) : [];
  const logoUrl = chrome.runtime.getURL('public/icons/128.png');
  const solveApiUrl = import.meta.env.VITE_SOLVE_API_URL;
  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL;
  const marketingUrl = import.meta.env.VITE_MARKETING_URL;
  const isSignedIn = !!authUser;
  const isEmailVerified = !!authUser?.emailVerified;

  const authDisplayName = useMemo(() => authUser?.displayName || authUser?.email || 'your account', [authUser]);
  const showUpgradeCta = sendErrorCode === 'LIMIT_EXCEEDED' ||
    sendErrorCode === 'MONTHLY_IMAGE_LIMIT_EXCEEDED' ||
    sendErrorCode === 'IMAGE_LIMIT_EXCEEDED_FREE' ||
    sendErrorCode === 'PRO_SUBSCRIPTION_INACTIVE';
  const upgradeErrorMessage = showUpgradeCta
    ? sendError ?? 'You reached a free plan limit.'
    : null;

  useEffect(() => {
    if (showUpgradeCta) {
      setIsUpgradeModalOpen(true);
    }
  }, [showUpgradeCta]);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
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
    if (!firebaseAuth?.currentUser) return;
    const apiUrl = import.meta.env.VITE_SYNC_PROFILE_API_URL;
    if (!apiUrl) {
      console.warn('VITE_SYNC_PROFILE_API_URL is not set. Skipping profile sync.');
      return;
    }
    try {
      const token = await firebaseAuth.currentUser.getIdToken(true);
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
          setUsage({
            subscriptionTier: dataJson.profile.subscriptionTier === 'pro' ? 'pro' : 'free',
            subscriptionStatus: dataJson.profile.subscriptionStatus === 'active' ? 'active' : 'inactive',
            totalCredits: typeof dataJson.profile.totalCredits === 'number' && dataJson.profile.totalCredits > 0
              ? dataJson.profile.totalCredits
              : 50,
            usedCredits: typeof dataJson.profile.usedCredits === 'number' && dataJson.profile.usedCredits >= 0
              ? dataJson.profile.usedCredits
              : 0,
            monthlyImagesUsed: typeof dataJson.profile.monthlyImagesUsed === 'number' && dataJson.profile.monthlyImagesUsed >= 0
              ? dataJson.profile.monthlyImagesUsed
              : 0,
            monthlyImagesLimit: typeof dataJson.profile.monthlyImagesLimit === 'number' && dataJson.profile.monthlyImagesLimit > 0
              ? dataJson.profile.monthlyImagesLimit
              : 10,
          });
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

  const handleSignIn = async () => {
    if (!firebaseAuth) {
      setAuthMessage('Firebase is not configured. Check extension/.env values.');
      return;
    }

    setAuthMessage(null);

    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
      setAuthPassword('');
      if (!user.emailVerified) {
        setAuthMessage('Verify your email first. Check your inbox, then click "I verified".');
        return;
      }
      setAuthMessage('Signed in.');
      await syncProfile();
    } catch (error) {
      setAuthMessage(mapFirebaseAuthError(error));
    }
  };

  const handleSignUp = async () => {
    if (!firebaseAuth) {
      setAuthMessage('Firebase is not configured. Check extension/.env values.');
      return;
    }

    setAuthMessage(null);

    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
      await sendEmailVerification(user);
      setAuthPassword('');
      setAuthMessage('Account created. Verification email sent. Verify your email to continue.');
      await syncProfile();
    } catch (error) {
      setAuthMessage(mapFirebaseAuthError(error));
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!firebaseAuth?.currentUser) {
      setAuthMessage('Please sign in first.');
      return;
    }
    setIsVerificationSending(true);
    setAuthMessage(null);
    try {
      await sendEmailVerification(firebaseAuth.currentUser);
      setAuthMessage('Verification email sent. Please check your inbox.');
    } catch (error) {
      setAuthMessage(mapFirebaseAuthError(error));
    } finally {
      setIsVerificationSending(false);
    }
  };

  const handleRefreshVerificationStatus = async () => {
    if (!firebaseAuth?.currentUser) return;
    setIsVerificationChecking(true);
    setAuthMessage(null);
    try {
      await reload(firebaseAuth.currentUser);
      setAuthUser({ ...firebaseAuth.currentUser });
      if (firebaseAuth.currentUser.emailVerified) {
        setAuthMessage('Email verified. You can now use OryxSolver.');
        await syncProfile();
      } else {
        setAuthMessage('Still not verified. Open your email and click the verify link.');
      }
    } catch (error) {
      setAuthMessage(mapFirebaseAuthError(error));
    } finally {
      setIsVerificationChecking(false);
    }
  };

  const handleSignOut = async () => {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
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
    setAuthMessage('Signed out.');
    setIsProfileOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!firebaseAuth?.currentUser) {
      setProfileMessage('You need to be signed in.');
      return;
    }

    try {
      await updateProfile(firebaseAuth.currentUser, {
        displayName: profileName.trim() || null,
        photoURL: profilePhotoUrl.trim() || null,
      });
      setProfileMessage('Profile updated.');
      setIsProfileOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update profile';
      setProfileMessage(message);
    }
  };

  const handleSend = async ({ text, images }: SendPayload) => {
    if (!text.trim() && images.length === 0) return;

    setIsSending(true);
    setSendError(null);
    setSendErrorCode(null);

    try {
      if (!solveApiUrl) {
        throw new Error('VITE_SOLVE_API_URL is missing. Set it in extension/.env');
      }
      if (!firebaseAuth?.currentUser) {
        throw new Error('Please sign in before sending a question.');
      }
      if (!firebaseAuth.currentUser.emailVerified) {
        throw new Error('Please verify your email before sending questions.');
      }

      const token = await firebaseAuth.currentUser.getIdToken();

      const form = new FormData();
      form.append('question', text);
      images.forEach((image) => form.append('images', image));

      const res = await fetch(solveApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        let message = `Upload failed: ${res.status}`;
        let code: string | null = null;
        try {
          const errJson = JSON.parse(errText) as { error?: string; code?: string };
          if (errJson.error) message = errJson.error;
          if (errJson.code) code = errJson.code;
        } catch {
          if (errText.trim()) message = `${message} ${errText}`;
        }
        setSendErrorCode(code);
        throw new Error(message);
      }

      const dataJson = await res.json();
      if (dataJson?.usage) {
        setUsage({
          subscriptionTier: dataJson.usage.subscriptionTier === 'pro' ? 'pro' : 'free',
          subscriptionStatus: dataJson.usage.subscriptionStatus === 'active' ? 'active' : 'inactive',
          totalCredits: typeof dataJson.usage.totalCredits === 'number' && dataJson.usage.totalCredits > 0
            ? dataJson.usage.totalCredits
            : 50,
          usedCredits: typeof dataJson.usage.usedCredits === 'number' && dataJson.usage.usedCredits >= 0
            ? dataJson.usage.usedCredits
            : 0,
          monthlyImagesUsed: typeof dataJson.usage.monthlyImagesUsed === 'number' && dataJson.usage.monthlyImagesUsed >= 0
            ? dataJson.usage.monthlyImagesUsed
            : 0,
          monthlyImagesLimit: typeof dataJson.usage.monthlyImagesLimit === 'number' && dataJson.usage.monthlyImagesLimit > 0
            ? dataJson.usage.monthlyImagesLimit
            : 10,
        });
      }
      const answer =
        typeof dataJson?.answer === 'string' && dataJson.answer.trim()
          ? dataJson.answer.trim()
          : typeof dataJson?.result === 'string' && dataJson.result.trim()
            ? dataJson.result.trim()
            : 'Answer available in explanation';

      const explanation =
        typeof dataJson?.explanation === 'string' && dataJson.explanation.trim()
          ? dataJson.explanation.trim()
          : Array.isArray(dataJson?.steps)
            ? dataJson.steps.map((step: unknown) => String(step)).join('\n')
            : JSON.stringify(dataJson, null, 2);

      setLatestResponse({ answer, explanation });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      setSendError(message);
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

  const handleLearnMoreClick = () => {
    if (!marketingUrl) return;
    window.open(marketingUrl, '_blank');
  };

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,#e5e9ef_0%,#d9dee6_54%,#e6eaf0_100%)] font-sans text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgba(255,255,255,0.34),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(15,23,42,0.09)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.007] [background-image:radial-gradient(#0f172a_0.65px,transparent_0.65px)] [background-size:3px_3px]" />

      <SidePanelHeader
        logoUrl={logoUrl}
        appName="OryxSolver"
        usedCredits={usage.usedCredits}
        totalCredits={usage.totalCredits}
        isSignedIn={isSignedIn}
        userEmail={authUser?.email}
        userPhotoUrl={authUser?.photoURL}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        onOpenLearnMore={handleLearnMoreClick}
        onOpenProfile={() => {
          setProfileMessage(null);
          setIsProfileOpen((v) => !v);
        }}
      />

      {isSignedIn && isProfileOpen && (
        <div className="z-20 mx-4 mt-4 rounded-2xl border border-white/65 bg-white/92 p-4 shadow-lg backdrop-blur-lg">
          <p className="text-sm font-semibold text-slate-900">Account</p>
          <p className="mt-1 text-xs text-slate-600">{authUser?.email}</p>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="url"
              value={profilePhotoUrl}
              onChange={(e) => setProfilePhotoUrl(e.target.value)}
              placeholder="Photo URL (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              Save profile
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
          {profileMessage && <p className="mt-2 text-xs text-slate-700">{profileMessage}</p>}
        </div>
      )}

      {!isSignedIn && !isAuthLoading && (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          <div className="pointer-events-none absolute -top-14 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-6 h-40 w-40 rounded-full bg-violet-300/20 blur-3xl" />

          <div className="relative flex min-h-[340px] w-full max-w-sm flex-col rounded-2xl border border-white/65 bg-white/78 px-6 py-8 text-center shadow-md backdrop-blur-lg">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 via-indigo-50 to-violet-100 shadow-inner">
                <ShieldCheck size={40} className="text-indigo-600" />
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {authView === 'sign-in' ? 'Sign in to continue' : 'Create your account'}
              </p>
              <p className="mt-2 max-w-[260px] text-sm text-slate-700">
                Continue as {authDisplayName} using Firebase auth.
              </p>
            </div>

            <div className="mt-auto space-y-3">
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={authView === 'sign-in' ? handleSignIn : handleSignUp}
                className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
              >
                {authView === 'sign-in' ? 'Sign In' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMessage(null);
                  setAuthView((v) => (v === 'sign-in' ? 'sign-up' : 'sign-in'));
                }}
                className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                {authView === 'sign-in' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
              </button>

              {!isFirebaseConfigured && (
                <p className="text-xs font-medium text-rose-700">
                  Firebase env vars are missing in extension/.env
                </p>
              )}
              {authMessage && <p className="text-xs font-medium text-slate-700">{authMessage}</p>}
            </div>
          </div>
        </main>
      )}

      {isSignedIn && !isEmailVerified && (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          <div className="relative w-full max-w-sm rounded-2xl border border-white/65 bg-white/80 p-6 text-center shadow-md backdrop-blur-lg">
            <p className="text-lg font-semibold text-slate-900">Verify your email</p>
            <p className="mt-2 text-sm text-slate-700">
              We sent a verification link to <span className="font-semibold">{authUser?.email}</span>.
              Please verify your email to unlock solving.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleResendVerificationEmail}
                disabled={isVerificationSending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerificationSending ? 'Sending...' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={handleRefreshVerificationStatus}
                disabled={isVerificationChecking}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerificationChecking ? 'Checking...' : 'I verified'}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
            {authMessage && <p className="mt-3 text-xs font-medium text-slate-700">{authMessage}</p>}
          </div>
        </main>
      )}

      {isSignedIn && isEmailVerified && (
        <>
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/60 bg-white/62 px-6 shadow-sm backdrop-blur-lg">
            <span className="text-lg font-extrabold tracking-tight">See Last Questions</span>
          </div>

          <main className="flex-1 space-y-6 overflow-y-auto bg-transparent p-4">
            <ResponsePanel response={latestResponse} steps={explanationSteps} />
          </main>

          {showUpgradeCta && (
            <div className="mx-4 mb-2 rounded-2xl border border-white/65 bg-white/78 p-3 text-slate-900 shadow-md backdrop-blur-lg">
              <p className="text-sm font-semibold">You reached a free plan limit</p>
              <p className="mt-1 text-xs text-slate-700">
                {upgradeErrorMessage}
              </p>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
          {sendError && !showUpgradeCta && (
            <p className="px-4 pb-2 text-xs font-medium text-rose-700">
              {sendError}
            </p>
          )}
          {isSending && (
            <p className="px-4 pb-2 text-xs font-medium text-slate-700">
              Sending...
            </p>
          )}

          <MessageComposer onSend={handleSend} onCaptureScreen={handleCaptureScreen} />
        </>
      )}

      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/65 bg-white/92 shadow-xl backdrop-blur-xl">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
              <p className="text-lg font-semibold">Upgrade to Pro</p>
              <p className="mt-1 text-sm text-indigo-100">Get faster solving with higher limits.</p>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What you get</p>
                <div className="mt-3 space-y-2 text-sm text-slate-800">
                  <p>- 4 images per message (instead of 1)</p>
                  <p>- Higher monthly solving capacity</p>
                  <p>- Priority processing under load</p>
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
