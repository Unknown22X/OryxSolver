import { createClient } from 'npm:@supabase/supabase-js@2';

export function createSupabaseAdminClient() {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ??
    Deno.env.get('PROJECT_URL') ??
    '';
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SERVICE_ROLE_KEY') ??
    '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server environment is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export function createSupabaseUserClient(accessToken: string) {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') ??
    Deno.env.get('PROJECT_URL') ??
    '';
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('ANON_KEY') ??
    Deno.env.get('VITE_SUPABASE_ANON_KEY') ??
    '';

  if (!supabaseUrl || !anonKey) {
    throw new Error('User-scoped Supabase environment is not configured');
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
