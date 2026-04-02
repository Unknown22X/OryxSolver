import type { SupabaseLookupUser } from './auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { AppError } from './http.ts';

type ExistingProfile = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  role: string | null;
};

type AccessProfile = {
  id: string;
  role: string | null;
  is_locked: boolean;
};

type Subscription = {
  tier: string | null;
  status: string | null;
  current_period_end?: string | null;
};

export async function getUserSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { tier: 'free', status: 'inactive' };
  }

  return { tier: data.tier, status: data.status, current_period_end: data.current_period_end };
}

export async function upsertProfileFromAuthUser(
  supabase: SupabaseClient,
  user: SupabaseLookupUser,
) {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id, display_name, photo_url, role')
    .eq('auth_user_id', user.id)
    .maybeSingle<ExistingProfile>();

  if (existingProfileError) {
    throw new Error(`Profile read failed: ${existingProfileError.message}`);
  }

  // Prefer auth metadata when provided so profile edits in the webapp/extension sync correctly.
  // If the auth field is an empty string, treat it as an explicit clear to null.
  const displayNameFromAuth =
    typeof user.displayName === 'string' ? user.displayName.trim() : undefined;
  const photoUrlFromAuth =
    typeof user.photoUrl === 'string' ? user.photoUrl.trim() : undefined;

  const displayName =
    displayNameFromAuth === undefined
      ? (existingProfile?.display_name ?? null)
      : (displayNameFromAuth.length > 0 ? displayNameFromAuth : null);
  const photoUrl =
    photoUrlFromAuth === undefined
      ? (existingProfile?.photo_url ?? null)
      : (photoUrlFromAuth.length > 0 ? photoUrlFromAuth : null);
  const nextRole =
    existingProfile?.role === 'admin'
      ? 'admin'
      : existingProfile?.role === 'authenticated'
        ? 'authenticated'
        : user.emailVerified
          ? 'authenticated'
          : 'pending';

  const upsertPayload = {
    auth_user_id: user.id,
    email: user.email ?? null,
    email_verified: user.emailVerified ?? false,
    role: nextRole,
    display_name: displayName,
    photo_url: photoUrl,
    last_seen_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(upsertPayload, {
    onConflict: 'auth_user_id',
  });

  if (upsertError) {
    throw new Error(`Profile upsert failed: ${upsertError.message}`);
  }
}

export async function getProfileForSolve(
  supabase: SupabaseClient,
  authUid: string,
): Promise<AccessProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, is_locked')
    .eq('auth_user_id', authUid)
    .maybeSingle<AccessProfile>();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  if (data?.is_locked) {
    throw new AppError(403, 'ACCOUNT_LOCKED', 'Your account has been locked by an administrator.');
  }

  return data ?? null;
}
