import type { SupabaseLookupUser } from './auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type ExistingProfile = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  role: string | null;
};

type AccessProfile = {
  id: string;
  role: string | null;
};

type Subscription = {
  tier: string | null;
  status: string | null;
};

export async function getUserSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { tier: 'free', status: 'inactive' };
  }

  return { tier: data.tier, status: data.status };
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

  const displayName = user.displayName ?? existingProfile?.display_name ?? null;
  const photoUrl = user.photoUrl ?? existingProfile?.photo_url ?? null;
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
    .select('id, role')
    .eq('auth_user_id', authUid)
    .maybeSingle<AccessProfile>();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  return data ?? null;
}
