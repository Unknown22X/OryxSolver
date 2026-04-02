import '@supabase/functions-js/edge-runtime.d.ts';
import { requireAdminAccess } from '../_shared/admin.ts';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';
import { AppError, handleOptions, jsonError, jsonOk } from '../_shared/http.ts';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const CACHE_KEY = 'admin_metrics_cache';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const clientIp = getClientIp(req);
  const rateLimit = await checkRateLimit('/admin-metrics', clientIp);
  if (!rateLimit.allowed) {
    return jsonError(429, 'RATE_LIMITED', 'Too many requests');
  }

  try {
    const { supabaseAdmin } = await requireAdminAccess(req);

    // Check Cache
    const { data: cacheRow } = await supabaseAdmin
      .from('app_config')
      .select('value, updated_at')
      .eq('key', CACHE_KEY)
      .maybeSingle();

    const now = new Date();
    if (cacheRow && cacheRow.value && cacheRow.updated_at) {
      const updatedAt = new Date(cacheRow.updated_at);
      if (now.getTime() - updatedAt.getTime() < CACHE_TTL_MS) {
        return jsonOk({
          api_version: 'v1',
          ok: true,
          ...cacheRow.value,
          cached: true,
          cached_at: cacheRow.updated_at,
        });
      }
    }

    // Recalculate Stats
    const todayStart = startOfDay(now).toISOString();
    const weekStart = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).toISOString();
    const monthStart = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).toISOString();

    // 1. User Metrics
    const { count: totalUsers = 0 } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const { count: newUsers7d = 0 } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart);

    const { count: newUsers30d = 0 } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart);

    // Active Users (Action in period)
    const { data: active7dRaw } = await supabaseAdmin
      .from('solve_runs')
      .select('auth_user_id')
      .gte('created_at', weekStart);
    const activeUsers7d = new Set((active7dRaw ?? []).map(r => r.auth_user_id)).size;

    const { data: active30dRaw } = await supabaseAdmin
      .from('solve_runs')
      .select('auth_user_id')
      .gte('created_at', monthStart);
    const activeUsers30d = new Set((active30dRaw ?? []).map(r => r.auth_user_id)).size;

    const { data: activeTodayRaw } = await supabaseAdmin
      .from('solve_runs')
      .select('auth_user_id')
      .gte('created_at', todayStart);
    const activeUsersToday = new Set((activeTodayRaw ?? []).map(r => r.auth_user_id)).size;

    // 2. Subscription breakdown
    const { count: proUsers = 0 } = await supabaseAdmin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tier', 'pro')
      .in('status', ['active', 'trialing']);

    const { count: premiumUsers = 0 } = await supabaseAdmin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tier', 'premium')
      .in('status', ['active', 'trialing']);

    // 3. Credit Metrics (Credit Ledger)
    const { data: creditsTodayRows } = await supabaseAdmin
      .from('credit_ledger')
      .select('delta, metadata')
      .lt('delta', 0)
      .gte('created_at', todayStart);

    const { data: creditsMonthRows } = await supabaseAdmin
      .from('credit_ledger')
      .select('delta, metadata')
      .lt('delta', 0)
      .gte('created_at', monthStart);

    const summarizeCredits = (rows: any[]) => {
      let free = 0;
      let paid = 0;
      for (const row of rows ?? []) {
        const amount = Math.abs(row.delta);
        if (row.metadata?.is_free === true) free += amount;
        else paid += amount;
      }
      return { free, paid, total: free + paid };
    };

    const creditsToday = summarizeCredits(creditsTodayRows ?? []);
    const creditsMonth = summarizeCredits(creditsMonthRows ?? []);

    // Global Remaining Free Credit Pool
    const { data: globalWallets } = await supabaseAdmin
      .from('credit_wallets')
      .select('granted_credits, used_credits');
    
    let totalRemainingCredits = 0;
    for (const w of globalWallets ?? []) {
        totalRemainingCredits += Math.max(0, (w.granted_credits || 0) - (w.used_credits || 0));
    }

    // 4. System Health (Error Rates)
    const { data: solveRunsToday } = await supabaseAdmin
      .from('solve_runs')
      .select('status')
      .gte('created_at', todayStart);

    const totalRuns = solveRunsToday?.length ?? 0;
    const failedRuns = solveRunsToday?.filter(r => r.status === 'error').length ?? 0;
    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

    // 4b. Extraction Quality
    const extractionHealth = 100;

    // 4c. Cost Estimates
    const estCostToday = 0;

    // 5. Activity/Feedback (Uncached latest)

    // 6. Daily Chart Data
    const { data: dailyRunsRaw } = await supabaseAdmin
      .from('solve_runs')
      .select('created_at')
      .gte('created_at', weekStart);

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dailyMap.set(isoDate(d), 0);
    }
    for (const run of dailyRunsRaw ?? []) {
        const key = isoDate(new Date(run.created_at));
        if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
    }
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a,b) => a.date.localeCompare(b.date));

    // --- REAL-TIME TRENDS & AGGREGATIONS (Direct compute to avoid RPC dependency) ---
    
    // 1. Solves per Day (Last 7 Days)
    const solvesTrend = dailyStats; // Already computed above
    
    // 2. New Users per Day (Last 7 Days)
    const { data: newUsersRaw } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', weekStart);

    const usersMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        usersMap.set(isoDate(d), 0);
    }
    for (const u of newUsersRaw ?? []) {
        const key = isoDate(new Date(u.created_at));
        if (usersMap.has(key)) usersMap.set(key, (usersMap.get(key) ?? 0) + 1);
    }
    const usersTrend = Array.from(usersMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a,b) => a.date.localeCompare(b.date));

    // 3. Model Usage Breakdown (Last 30 Days)
    const { data: runsForModels } = await supabaseAdmin
      .from('solve_runs')
      .select('model')
      .gte('created_at', monthStart);
    
    const countMap = new Map<string, number>();
    let totalModelRuns = 0;
    for (const r of runsForModels ?? []) {
       if (!r.model) continue;
       const modelName = r.model.includes('/') ? r.model.split('/').pop() : r.model;
       countMap.set(modelName, (countMap.get(modelName) || 0) + 1);
       totalModelRuns++;
    }
    const modelUsage = Array.from(countMap.entries()).map(([model, count]) => ({
       model,
       count,
       percentage: totalModelRuns > 0 ? Math.round((count / totalModelRuns) * 100) : 0
    })).sort((a,b) => b.count - a.count);

    // 4. Conversion Rate (Paid vs Total)
    const { data: subStats } = await supabaseAdmin
      .from('subscriptions')
      .select('tier', { count: 'exact' });
    
    const totalSubs = subStats?.length || 0;
    const paidSubs = subStats?.filter(s => s.tier !== 'free').length || 0;
    const conversionRate = totalSubs > 0 ? Math.round((paidSubs / totalSubs) * 1000) / 10 : 0;

    // 5. System Health (Error Logs)
    const { data: errorLogs } = await supabaseAdmin
      .from('solve_runs')
      .select('created_at, error_code, model')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(10);

    const stats = {
      totalUsers, // Renamed from userCount
      newUsers7d,
      newUsers30d,
      activeUsersToday,
      activeUsers7d,
      activeUsers30d,
      proUsers,
      premiumUsers,
      creditsToday, // Already summarized
      creditsMonth, // Already summarized
      errorRate: Math.round(errorRate * 10) / 10, // Kept original calculation
      failedCount: failedRuns, // Renamed from failedToday
      totalToday: totalRuns, // Renamed from totalSolvesToday
      extractionHealth,
      conversionRate,
      totalRemainingCredits,
      trends: {
        solvesPerDay: solvesTrend || [],
        usersPerDay: usersTrend || []
      },
      modelUsage: modelUsage || [],
      errorLogs: errorLogs || [],
      dailyStats, // Kept from original
    };

    // Update Cache
    await supabaseAdmin
      .from('app_config')
      .upsert({ 
        key: CACHE_KEY, 
        value: { stats, timestamp: Date.now() },
        is_public: false 
      }, { onConflict: 'key' }); // Added onConflict to match original upsert behavior

    return jsonOk({ stats });
  } catch (err: any) {
    console.error(err);
    // Reverted to original error handling structure for consistency,
    // but incorporated the new error message structure.
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Admin metrics failed';
    return jsonError(err.status || 500, err.code || 'ADMIN_METRICS_FAILED', message);
  }
});
