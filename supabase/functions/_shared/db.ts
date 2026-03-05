import { createClient } from 'npm:@supabase/supabase-js@2';

export function createSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server environment is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
