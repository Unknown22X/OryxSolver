import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getApiUrl } from '../services/apiConfig';
import { supabase } from '../services/supabaseClient';

export type AuthUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
};

function getAuthRedirectUrl(): string {
  return chrome.runtime.getURL('src/sidepanel/index.html');
}

function mapUser(user: SupabaseUser | null): AuthUser | null {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
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
  };
}

export const isSupabaseAuthConfigured = !!supabase;

export async function getAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('No active auth session. Please sign in again.');
  return token;
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
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const user = mapUser(data.user ?? null);
  if (!user) throw new Error('Sign-in succeeded but no user was returned.');
  return user;
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
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
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
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
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
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
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
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) throw error;
}

export async function refreshAuthUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  try {
    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    
    // If we have a session but it might be stale, refetch user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    
    return mapUser(user);
  } catch (error) {
    console.error('Failed to refresh auth user:', error);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateCurrentUserProfile(
  profile: { displayName: string | null; photoURL: string | null },
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
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
    await fetch(syncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (syncError) {
    console.error('Extension profile sync failed:', syncError);
  }
}

export async function updateUserPassword(password: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase Auth is not configured. Check extension/.env values.');
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
