import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type CreditWalletRow = {
  user_id: string;
  granted_credits: number | null;
  used_credits: number | null;
};

export async function getCreditWallet(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditWalletRow | null> {
  const { data, error } = await supabase
    .from('credit_wallets')
    .select('user_id, granted_credits, used_credits')
    .eq('user_id', userId)
    .maybeSingle<CreditWalletRow>();

  if (error) {
    throw new Error(`Credit wallet lookup failed: ${error.message}`);
  }

  return data ?? null;
}

export async function getPaygoCreditsRemaining(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const wallet = await getCreditWallet(supabase, userId);
  if (!wallet) return 0;

  const granted = Math.max(wallet.granted_credits ?? 0, 0);
  const used = Math.max(wallet.used_credits ?? 0, 0);
  return Math.max(granted - used, 0);
}

export async function consumePaygoCredit(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const { data, error } = await supabase.rpc('consume_paygo_credit', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: 'solve',
    p_source: 'solve',
    p_metadata: metadata,
  });

  if (error) {
    throw new Error(`Paygo credit consume failed: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}

export async function grantPaygoCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  reason: string,
  source: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const { data, error } = await supabase.rpc('grant_paygo_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_source: source,
    p_metadata: metadata,
  });

  if (error) {
    throw new Error(`Paygo credit grant failed: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}
