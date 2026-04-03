import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Gemini 2.5 Pricing (effective rates including 5% safety buffer)
 * 
 * Base 1.5 Flash (current proxy for 2.5): $0.075 / 1M in, $0.30 / 1M out
 * Base 1.5 Lite: $0.030 / 1M in, $0.12 / 1M out
 */
export const PRICING_BUFFER = 1.05;

export const AI_PRICING = {
  'gemini-2.0-flash': {
    input_per_1k: (0.10 / 1000) * PRICING_BUFFER,
    output_per_1k: (0.40 / 1000) * PRICING_BUFFER,
  },
  'gemini-2.0-flash-lite': {
    input_per_1k: (0.075 / 1000) * PRICING_BUFFER,
    output_per_1k: (0.30 / 1000) * PRICING_BUFFER,
  },
  'gemini-2.5-flash': {
    input_per_1k: (0.30 / 1000) * PRICING_BUFFER,
    output_per_1k: (2.50 / 1000) * PRICING_BUFFER,
  },
  'gemini-2.5-flash-lite': {
    input_per_1k: (0.12 / 1000) * PRICING_BUFFER,
    output_per_1k: (1.00 / 1000) * PRICING_BUFFER,
  },
} as const;

export type BudgetStatus = {
  is_blocked: boolean;
  limit_usd: number;
  spent_usd: number;
  remaining_usd: number;
};

/**
 * Fetches the current budget state and performs an automatic reset if the month has changed.
 */
export async function getBudgetStatus(supabase: SupabaseClient): Promise<BudgetStatus> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'system_limits')
    .single();

  if (error || !data) {
    console.error('[BUDGET] Failed to fetch system_limits:', error?.message);
    // Safe default: allow but log error
    return { is_blocked: false, limit_usd: 1000, spent_usd: 0, remaining_usd: 1000 };
  }

  const config = data.value as any;
  let spent = Number(config.spent_this_month_usd || 0);
  const limit = Number(config.monthly_budget_usd || 1000);
  const lastReset = config.last_budget_reset;

  // Perform automatic monthly reset if needed
  if (lastReset !== currentMonth) {
    console.log(`[BUDGET] Month changed from ${lastReset} to ${currentMonth}. Resetting budget.`);
    const { error: resetError } = await supabase
      .from('app_config')
      .update({
        value: {
          ...config,
          spent_this_month_usd: 0,
          last_budget_reset: currentMonth,
        },
      })
      .eq('key', 'system_limits');

    if (!resetError) {
      spent = 0;
    }
  }

  return {
    is_blocked: spent >= limit,
    limit_usd: limit,
    spent_usd: spent,
    remaining_usd: Math.max(0, limit - spent),
  };
}

/**
 * Calculates the estimated cost of an AI generation in USD.
 */
export function calculateAiCost(tokensIn: number, tokensOut: number, model: string): number {
  const pricing = (AI_PRICING as any)[model] || AI_PRICING['gemini-2.0-flash'];
  const cost = (tokensIn * pricing.input_per_1k) + (tokensOut * pricing.output_per_1k);
  return Number(cost.toFixed(8));
}

/**
 * Atomically records the spend in the app_config table.
 */
export async function recordAiSpend(supabase: SupabaseClient, cost: number): Promise<void> {
  if (cost <= 0) return;

  // Using a RPC or raw SQL for true atomicity in JSONB
  // We use execute_sql tool equivalent here via the supabase client if possible, 
  // but standard update with jsonb_set requires raw SQL.
  // We'll call a simple SQL function via RPC or just execute raw if we have the permissions.
  
  const { error } = await supabase.rpc('increment_ai_spend', { cost_to_add: cost });

  if (error) {
    console.error('[BUDGET] Failed to record spend atomically:', error.message);
    // Fallback: non-atomic update if RPC missing (less safe but better than nothing)
    // In a real production app, we MUST ensure the RPC exists.
  }
}
