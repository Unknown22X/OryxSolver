import { getBearerToken, verifySupabaseAccessToken } from './auth.ts';
import { createSupabaseAdminClient } from './db.ts';
import { AppError } from './http.ts';

export async function requireAdminAccess(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    throw new AppError(401, 'MISSING_AUTH_HEADER', 'Missing or invalid Authorization header');
  }

  const user = await verifySupabaseAccessToken(token);
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, auth_user_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'PROFILE_LOOKUP_FAILED', error.message);
  }

  if (!profile || profile.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }

  return { user, supabaseAdmin };
}
