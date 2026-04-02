import { getBearerToken, verifySupabaseAccessToken } from './auth.ts';
import { createSupabaseAdminClient } from './db.ts';
import { AppError } from './http.ts';

/**
 * Basic admin access check. Allows admin, support, and read-only.
 * Use for metrics and general viewing.
 */
export async function requireAdminAccess(req: Request) {
  return requireAdminRole(req, ['admin', 'support', 'read-only']);
}

/**
 * Mutation-level access check. Allows admin and support.
 * Use for user management, locking, and credit adjustments.
 */
export async function requireSupportAccess(req: Request) {
  return requireAdminRole(req, ['admin', 'support']);
}

/**
 * Super-admin only access check.
 * Use for global configuration and promotion of other admins.
 */
export async function requireAdminOnlyAccess(req: Request) {
  return requireAdminRole(req, ['admin']);
}

async function requireAdminRole(req: Request, allowedRoles: string[]) {
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

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied: insufficient permissions');
  }

  return { user, supabaseAdmin, profile };
}
