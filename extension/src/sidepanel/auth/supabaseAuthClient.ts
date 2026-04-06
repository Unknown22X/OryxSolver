import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getApiUrl } from '../services/apiConfig';
import { sanitizeExternalUrl } from '../services/safeExternalUrl';
import { supabase } from '../services/supabaseClient';
import { applyServiceHealthError, canPerformDependencyAction, resilientFetch } from '../services/serviceHealth';

export type AuthUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  onboardingCompleted: boolean;
};

function getAuthRedirectUrl(): string {
  return chrome.runtime.getURL('src/sidepanel/index.html');
}

// Auto-close handler for auth tabs and PKCE code exchange
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const errorMsg = params.get('error');

  if (code) {
    // PKCE Flow: We received a code. We must exchange it for a session.
    // The sidepanel / background shares chrome.storage.local, so the code_verifier
    // that Supabase automatically set before redirecting will be available here.
    supabase?.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error('Failed to exchange code for session:', error.message);
      }
      // Extremely wide windows are the temporary auth tab. Auto close it.
      if (window.innerWidth > 600) {
        window.close();
      }
    }).catch((err) => {
      console.error('Exception during code exchange:', err);
      if (window.innerWidth > 600) window.close();
    });
  } else if (errorMsg) {
    // If the user cancelled the flow or an error occurred
    console.error('OAuth Error:', params.get('error_description') || errorMsg);
    if (window.innerWidth > 600) {
      setTimeout(() => window.close(), 2000); // Give user time to read, then close
    }
  } else if (window.location.hash.includes('access_token=') || window.location.hash.includes('provider_token=')) {
    // Legacy Implicit Flow fallback
    if (window.innerWidth > 600) {
      setTimeout(() => window.close(), 1500);
    }
  }
}

function mapUser(user: SupabaseUser | null): AuthUser | null {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const onboardingCompleted =
    metadata.onboarding_completed === true ||
    (typeof metadata.onboarding_completed_at === 'string' &&
      metadata.onboarding_completed_at.trim().length > 0);
  return {
    id: user.id,
    email: user.email ?? null,
    emailVerified: !!user.email_confirmed_at,
    displayName:
      typeof metadata.display_name === 'string'
        ? metadata.display_name
        : typeof metadata.full_name === 'string'
          ? metadata.full_name
          : null,
    photoURL:
      typeof metadata.photo_url === 'string'
        ? metadata.photo_url
        : typeof metadata.avatar_url === 'string'
          ? metadata.avatar_url
          : null,
    onboardingCompleted,
  };
}

export const isSupabaseAuthConfigured = !!supabase;

export async function getAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      applyServiceHealthError(error, 'auth');
      throw error;
    }
    const token = data.session?.access_token;
    if (!token) {
      // Don't report missing session as a service health failure.
      throw new Error('No active auth session. Please sign in again.');
    }
    return token;
  } catch (error) {
    // Already reported above if it was a Supabase API error.
    // If it was the manual missing token error, we don't report it.
    if ((error as Error).message.includes('No active auth session')) {
      throw error;
    }
    // For any other unexpected errors, report to health system.
    applyServiceHealthError(error, 'auth');
    throw error;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('Failed to load user for analytics:', error.message);
    return null;
  }
  return data.user?.id ?? null;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const user = mapUser(data.user ?? null);
  if (!user) throw new Error('Sign-in succeeded but no user was returned.');
  return user;
}

export async function signInWithGoogle(): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }

  // Supabase automatically generates and stores the PKCE code_challenge and code_verifier 
  // behind the scenes when flowType is 'pkce'.
  const start = performance.now();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      skipBrowserRedirect: true,
    },
  });
  const oauthUrlReadyMs = Math.round(performance.now() - start);
  console.info(`[auth-perf] Google OAuth URL ready in ${oauthUrlReadyMs}ms`);
  if (error) throw error;
  if (!data?.url) {
    throw new Error('Google sign-in could not be started.');
  }
  const tabCreateStart = performance.now();
  await chrome.tabs.create({ url: data.url });
  const tabCreateMs = Math.round(performance.now() - tabCreateStart);
  console.info(`[auth-perf] OAuth tab created in ${tabCreateMs}ms`);
}

type SignUpMetadata = {
  accepted_terms?: boolean;
  accepted_privacy?: boolean;
  accepted_legal_at?: string;
  accepted_terms_version?: string;
  accepted_privacy_version?: string;
};

export async function signUpWithPassword(
  email: string,
  password: string,
  metadata?: SignUpMetadata,
): Promise<AuthUser | null> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: metadata,
    },
  });
  if (error) throw error;
  return mapUser(data.user ?? null);
}

export async function sendEmailOtp(
  email: string,
  shouldCreateUser: boolean,
  metadata?: SignUpMetadata,
): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      emailRedirectTo: getAuthRedirectUrl(),
      data: metadata,
    },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthUser> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  // Try 'signup' first (for password signups), then 'email' (for OTP/MagicLink login),
  // then 'magiclink' (legacy fallback).
  const attempts: Array<'signup' | 'email' | 'magiclink'> = ['signup', 'email', 'magiclink'];
  let lastError: Error | null = null;

  for (const type of attempts) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (!error) {
      const user = mapUser(data.user ?? null);
      if (!user) throw new Error('OTP verified but no user was returned.');
      return user;
    }
    lastError = error;
  }

  throw lastError ?? new Error('OTP verification failed');
}

export async function resendVerificationEmail(email: string): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) throw error;
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }

  // Determine the best base URL to redirect the user to finish password reset on the web app.
  const webAppBaseUrl = sanitizeExternalUrl(import.meta.env.VITE_WEBAPP_URL, [
    'oryxsolver.com',
    'www.oryxsolver.com',
    'localhost',
    '127.0.0.1',
  ]) || 'https://oryxsolver.com';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${webAppBaseUrl}/reset-password`,
  });
  if (error) throw error;
}

export async function refreshAuthUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;

  return mapUser(user ?? session.user ?? null);
}

export async function signOutUser(): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Authentication is temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateCurrentUserProfile(
  profile: { displayName: string | null; photoURL: string | null },
): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Profile updates are temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: profile.displayName,
      photo_url: profile.photoURL,
    },
  });
  if (error) throw error;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const syncUrl = getApiUrl('/sync-profile', import.meta.env.VITE_SYNC_PROFILE_API_URL);
  if (!accessToken || !syncUrl) return;

  try {
    await resilientFetch(
      syncUrl,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      {
        dependency: 'db',
        safeToRetry: false,
        timeoutMs: 12000,
      },
    );
  } catch (syncError) {
    applyServiceHealthError(syncError, 'db');
    console.error('Extension profile sync failed:', syncError);
  }
}

export async function updateUserPassword(password: string): Promise<void> {
  if (!canPerformDependencyAction('auth')) {
    throw new Error('Password updates are temporarily unavailable. Please try again shortly.');
  }
  if (!supabase) {
    throw new Error(
      'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and ensure extension/.env.local is not overriding extension/.env with blank values.',
    );
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export function subscribeAuthState(
  callback: (user: AuthUser | null) => void,
): () => void {
  if (!supabase) {
    callback(null);
    return () => undefined;
  }

  void supabase.auth.getSession().then(({ data }) => {
    callback(mapUser(data.session?.user ?? null));
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(mapUser(session?.user ?? null));
  });

  return () => data.subscription.unsubscribe();
}
