import type { FirebaseLookupUser } from './auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type ExistingProfile = {
  display_name: string | null;
  photo_url: string | null;
};

type AccessProfile = {
  id: string;
  firebase_uid: string;
  role: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  all_credits: number | null;
  used_credits: number | null;
  monthly_images_used: number | null;
  monthly_images_period: string | null;
};

export async function upsertProfileFromFirebaseUser(
  supabase: SupabaseClient,
  user: FirebaseLookupUser,
) {
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('display_name, photo_url')
    .eq('firebase_uid', user.localId)
    .maybeSingle<ExistingProfile>();

  if (existingProfileError) {
    throw new Error(`Profile read failed: ${existingProfileError.message}`);
  }

  const displayName = user.displayName ?? existingProfile?.display_name ?? null;
  const photoUrl = user.photoUrl ?? existingProfile?.photo_url ?? null;

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      firebase_uid: user.localId,
      email: user.email ?? null,
      email_verified: user.emailVerified ?? false,
      role: user.emailVerified ? 'authenticated' : 'pending',
      display_name: displayName,
      photo_url: photoUrl,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'firebase_uid' },
  );

  if (upsertError) {
    throw new Error(`Profile upsert failed: ${upsertError.message}`);
  }
}

export async function getProfileForSolve(
  supabase: SupabaseClient,
  firebaseUid: string,
): Promise<AccessProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, firebase_uid, role, subscription_tier, subscription_status, all_credits, used_credits, monthly_images_used, monthly_images_period')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle<AccessProfile>();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  return data ?? null;
}

export async function consumeCreditForFreeTier(
  supabase: SupabaseClient,
  profileId: string,
  currentCreditsUsed: number,
) {
  const nextCredits = currentCreditsUsed + 1;
  const { error } = await supabase
    .from('profiles')
    .update({
      used_credits: nextCredits,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Credit update failed: ${error.message}`);
  }

  return nextCredits;
}

export function currentMonthStartIsoDate(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString().slice(0, 10);
}

export async function consumeMonthlyImageQuotaForFreeTier(
  supabase: SupabaseClient,
  profileId: string,
  currentMonthlyUsed: number,
  monthlyPeriod: string | null,
  imagesUsedNow: number,
) {
  const monthStart = currentMonthStartIsoDate();
  const normalizedCurrent = monthlyPeriod === monthStart ? currentMonthlyUsed : 0;
  const nextMonthlyUsed = normalizedCurrent + imagesUsedNow;

  const { error } = await supabase
    .from('profiles')
    .update({
      monthly_images_used: nextMonthlyUsed,
      monthly_images_period: monthStart,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Monthly image quota update failed: ${error.message}`);
  }

  return { monthStart, nextMonthlyUsed };
}
