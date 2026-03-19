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

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const weekStartDate = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    const weekStart = weekStartDate.toISOString();
    const monthStart = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).toISOString();

    const { count: totalSolves = 0 } = await supabaseAdmin
      .from('solve_runs')
      .select('id', { count: 'exact', head: true });

    const { count: todaySolves = 0 } = await supabaseAdmin
      .from('solve_runs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart);

    const { count: weekSolves = 0 } = await supabaseAdmin
      .from('solve_runs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart);

    const { data: weeklyRuns } = await supabaseAdmin
      .from('solve_runs')
      .select('auth_user_id, created_at')
      .gte('created_at', weekStart);

    const activeUsers = new Set((weeklyRuns ?? []).map((run) => run.auth_user_id)).size;

    const { count: totalUsers = 0 } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

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

    const freeUsers = Math.max(totalUsers - proUsers - premiumUsers, 0);

    const { data: analyticsEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('event_name, created_at')
      .gte('created_at', monthStart);

    const captureStarted = (analyticsEvents ?? []).filter((e) => e.event_name === 'screen_capture_started').length;
    const captureCompleted = (analyticsEvents ?? []).filter((e) => e.event_name === 'screen_capture_completed').length;
    const captureRate = captureStarted > 0 ? Math.round((captureCompleted / captureStarted) * 100) : 0;

    const upgradeOpened = (analyticsEvents ?? []).filter((e) => e.event_name === 'upgrade_modal_opened').length;
    const upgradeClicked = (analyticsEvents ?? []).filter((e) => e.event_name === 'upgrade_link_clicked' || e.event_name === 'upgrade_click').length;
    const conversionRate = upgradeOpened > 0 ? Math.round((upgradeClicked / upgradeOpened) * 100) : 0;

    const { data: recentEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('id, event_name, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    const { data: recentFeedback } = await supabaseAdmin
      .from('feedback')
      .select('id, user_id, conversation_id, rating, comment, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStartDate.getTime() + i * 24 * 60 * 60 * 1000);
      dailyMap.set(isoDate(day), 0);
    }
    for (const run of weeklyRuns ?? []) {
      const dayKey = isoDate(new Date(run.created_at));
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);
    }

    const dailyStats = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

    return jsonOk({
      api_version: 'v1',
      ok: true,
      stats: {
        totalSolves,
        activeUsers,
        captureRate,
        conversionRate,
        totalUsers,
        proUsers,
        premiumUsers,
        freeUsers,
        todaySolves,
        weekSolves,
      },
      recentEvents: recentEvents ?? [],
      recentFeedback: recentFeedback ?? [],
      dailyStats,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Admin metrics failed';
    return jsonError(500, 'ADMIN_METRICS_FAILED', message);
  }
});
