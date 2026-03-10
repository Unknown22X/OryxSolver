import { createClient } from 'npm:@supabase/supabase-js@2';

export type SupabaseLookupUser = {
  id: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoUrl?: string;
};

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseLookupUser> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY secret');
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(error?.message || 'Invalid Supabase token');
  }

  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
    emailVerified: !!data.user.email_confirmed_at,
    displayName:
      typeof metadata.display_name === 'string'
        ? metadata.display_name
        : typeof metadata.full_name === 'string'
          ? metadata.full_name
          : undefined,
    photoUrl:
      typeof metadata.photo_url === 'string'
        ? metadata.photo_url
        : typeof metadata.avatar_url === 'string'
          ? metadata.avatar_url
          : undefined,
  };
}
