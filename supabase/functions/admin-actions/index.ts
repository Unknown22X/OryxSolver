import '@supabase/functions-js/edge-runtime.d.ts';
import { requireAdminAccess, requireSupportAccess, requireAdminOnlyAccess } from '../_shared/admin.ts';
import { AppError, handleOptions, jsonError, jsonOk } from '../_shared/http.ts';
import { clearRecordedDependencyBreakers, loadServiceHealthSnapshot } from '../_shared/serviceHealth.ts';

function normalizeAdminSubscriptionTier(value: unknown): 'free' | 'pro' | 'premium' {
  return value === 'premium' ? 'premium' : value === 'pro' ? 'pro' : 'free';
}

function resolveAdminSubscriptionStatus(
  tier: 'free' | 'pro' | 'premium',
  previousStatus?: string | null,
): 'active' | 'inactive' | 'trialing' {
  if (tier === 'free') return 'inactive';
  if (previousStatus === 'trialing') return 'trialing';
  return 'active';
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const url = new URL(req.url);
  const action = url.pathname.split('/').filter(Boolean).pop();
  console.log(`[Admin Actions] req: ${req.method} ${url.pathname} -> action: ${action}`);

  try {
    if (req.method === 'GET') {
      const { supabaseAdmin } = await requireAdminAccess(req);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      if (action === 'search-users') {
        const query = url.searchParams.get('q') || '';
        let dbQuery = supabaseAdmin
          .from('profiles')
          .select(`
            id, auth_user_id, email, role, display_name, is_locked, created_at,
            credit_wallets(granted_credits, used_credits),
            subscriptions(tier, status)
          `, { count: 'exact' });

        if (query) {
          dbQuery = dbQuery.or(`email.ilike.%${query}%,display_name.ilike.%${query}%`);
        }

        const { data: usersRaw, count, error } = await dbQuery
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new AppError(500, 'USER_SEARCH_FAILED', error.message);

        const users = (usersRaw ?? []) as Array<Record<string, unknown>>;

        // profiles -> subscriptions implicit join can be broken depending on schema evolution.
        // Fetch subscriptions explicitly by auth uid and attach as `subscriptions: [{ tier, status }]`.
        const authUids = users
          .map((u) => u.auth_user_id)
          .filter(isUuid)
          .map((uid) => uid.trim());

        const subscriptionMap = new Map<string, { tier: string | null; status: string }>();
        if (authUids.length > 0) {
          const { data: subs, error: subsErr } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id, tier, status')
            .in('user_id', authUids);

          if (subsErr) throw new AppError(500, 'SUBSCRIPTION_LOOKUP_FAILED', subsErr.message);

          (subs ?? []).forEach((row: any) => {
            if (row?.user_id) {
              subscriptionMap.set(String(row.user_id), {
                tier: row.tier ?? null,
                status: row.status ?? 'inactive',
              });
            }
          });
        }

        const usersWithSubs = users.map((u) => {
          const authUid = isUuid(u.auth_user_id) ? u.auth_user_id.trim() : '';
          const sub = authUid ? subscriptionMap.get(authUid) : undefined;
          return {
            ...u,
            subscriptions: sub ? [{ tier: sub.tier, status: sub.status }] : [],
          };
        });

        return jsonOk({ users: usersWithSubs, total: count, page, limit });
      }

      if (action === 'history') {
        const { data: history, count, error } = await supabaseAdmin
          .from('solve_runs')
          .select('*, profiles(email, display_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new AppError(500, 'HISTORY_FETCH_FAILED', error.message);
        return jsonOk({ history, total: count, page, limit });
      }

      if (action === 'config') {
        const { data: config, error } = await supabaseAdmin
          .from('app_config')
          .select('*')
          .neq('key', 'admin_metrics_cache') // exclude internal cache row
          .order('key');

        if (error) throw new AppError(500, 'CONFIG_FETCH_FAILED', error.message);
        return jsonOk({ config });
      }

      if (action === 'audit-logs') {
        const { data: logs, count, error } = await supabaseAdmin
          .from('admin_audit_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new AppError(500, 'AUDIT_LOG_FETCH_FAILED', error.message);
        return jsonOk({ logs, total: count, page, limit });
      }

      if (action === 'errors') {
        const { data: errors, count, error } = await supabaseAdmin
          .from('solve_runs')
          .select('*, profiles(email, display_name)', { count: 'exact' })
          .eq('status', 'error')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new AppError(500, 'ERRORS_FETCH_FAILED', error.message);
        return jsonOk({ errors, total: count, page, limit });
      }

      if (action === 'service-health') {
        const snapshot = await loadServiceHealthSnapshot(supabaseAdmin);
        return jsonOk({ health: snapshot });
      }

      if (action === 'feedback') {
        const { data: feedback, count, error } = await supabaseAdmin
          .from('feedback')
          .select('*, profiles(email, display_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw new AppError(500, 'FEEDBACK_FETCH_FAILED', error.message);
        return jsonOk({ feedback, total: count, page, limit });
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();
      console.log(`[Admin Actions] POST ${action}`, JSON.stringify(body, null, 2));

      if (action === 'update-user') {
        const { supabaseAdmin, user: adminUser, profile: adminProfile } = await requireSupportAccess(req);
        const { targetUserId, updates, reason } = body;

        if (!targetUserId || !updates) throw new AppError(400, 'INVALID_REQUEST', 'Missing targetUserId or updates');
        if (!reason) throw new AppError(400, 'REASON_REQUIRED', 'A justification is required for this action.');

        // Get snapshot for audit
        const { data: profileBefore } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('auth_user_id', targetUserId)
          .single();

        if (!profileBefore) throw new AppError(404, 'USER_NOT_FOUND', 'Target user profile not found.');

        // 1. Handle Profile Updates (role, is_locked)
        const profileUpdates: any = {};
        if (updates.role !== undefined) profileUpdates.role = updates.role;
        if (updates.is_locked !== undefined) profileUpdates.is_locked = updates.is_locked;

        if (Object.keys(profileUpdates).length > 0) {
          // Security check: Only admins can change roles
          if (profileUpdates.role && adminProfile.role !== 'admin') {
            throw new AppError(403, 'FORBIDDEN', 'Only admins can change user roles');
          }
          // Security check: Support cannot lock/unlock an admin
          if (profileBefore.role === 'admin' && adminProfile.role !== 'admin') {
            throw new AppError(403, 'FORBIDDEN', 'Support cannot modify admin accounts.');
          }

          const { error: pErr } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('auth_user_id', targetUserId);

          if (pErr) throw new AppError(500, 'PROFILE_UPDATE_FAILED', pErr.message);
        }

        // 2. Handle Subscription Updates (tier)
        if (updates.subscription_tier !== undefined) {
          const nextTier = normalizeAdminSubscriptionTier(updates.subscription_tier);
          const { data: subBefore } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', targetUserId)
            .maybeSingle();
          const nextStatus = resolveAdminSubscriptionStatus(nextTier, subBefore?.status);

          const { error: sErr } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: targetUserId,
              tier: nextTier,
              status: nextStatus,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

          if (sErr) throw new AppError(500, 'SUBSCRIPTION_UPDATE_FAILED', sErr.message);

          // Audit Sub Change
          await supabaseAdmin.from('admin_audit_logs').insert({
            admin_uid: adminUser.id,
            admin_role: adminProfile.role,
            action_type: 'PLAN_CHANGE',
            target_user_id: targetUserId,
            payload_before: subBefore || {},
            payload_after: { tier: nextTier, status: nextStatus },
            reason
          });
        }

        // Final Audit for Profile parts
        if (Object.keys(profileUpdates).length > 0) {
          await supabaseAdmin.from('admin_audit_logs').insert({
            admin_uid: adminUser.id,
            admin_role: adminProfile.role,
            action_type: profileUpdates.role ? 'ROLE_CHANGE' : 'USER_UPDATE',
            target_user_id: targetUserId,
            payload_before: profileBefore,
            payload_after: profileUpdates,
            reason
          });
        }

        return jsonOk({ success: true });
      }

      if (action === 'adjust-credits') {
        const { supabaseAdmin, user: adminUser, profile: adminProfile } = await requireSupportAccess(req);
        const { targetUserId, delta, reason } = body;

        if (!targetUserId || typeof delta !== 'number') throw new AppError(400, 'INVALID_REQUEST', 'Missing targetUserId or delta');
        if (!reason) throw new AppError(400, 'REASON_REQUIRED', 'A justification is required for credit adjustments.');

        // Safety bound for support role
        if (adminProfile.role !== 'admin' && Math.abs(delta) > 500) {
          throw new AppError(403, 'LIMIT_EXCEEDED', 'Support can only adjust up to 500 credits. Contact admin for larger overrides.');
        }

        // Get wallet snapshot
        const { data: walletBefore } = await supabaseAdmin
          .from('credit_wallets')
          .select('*')
          .eq('user_id', targetUserId)
          .single();

        if (!walletBefore) throw new AppError(404, 'WALLET_NOT_FOUND', 'User wallet not found');

        // Update wallet
        const { data: walletAfter, error: walletError } = await supabaseAdmin
          .from('credit_wallets')
          .update({ 
            granted_credits: walletBefore.granted_credits + delta 
          })
          .eq('user_id', targetUserId)
          .select()
          .single();

        if (walletError) throw new AppError(500, 'CREDIT_ADJUST_FAILED', walletError.message);

        // Record in ledger
        await supabaseAdmin.from('credit_ledger').insert({
          user_id: targetUserId,
          delta: delta,
          balance_after: walletAfter.granted_credits - walletAfter.used_credits,
          reason,
          source: 'admin',
          metadata: { admin_id: adminUser.id, admin_role: adminProfile.role }
        });

        // Audit Log
        await supabaseAdmin.from('admin_audit_logs').insert({
          admin_uid: adminUser.id,
          admin_role: adminProfile.role,
          action_type: 'CREDIT_ADJUST',
          target_user_id: targetUserId,
          payload_before: walletBefore,
          payload_after: walletAfter,
          reason
        });

        return jsonOk({ wallet: walletAfter });
      }

      if (action === 'update-config') {
         const { supabaseAdmin, user: adminUser, profile: adminProfile } = await requireAdminOnlyAccess(req);
         const { configUpdates, createNotification } = body;
         
         if (!configUpdates || !Array.isArray(configUpdates)) throw new AppError(400, 'INVALID_REQUEST', 'configUpdates must be an array');

         for (const update of configUpdates) {
            const { data: before } = await supabaseAdmin.from('app_config').select('*').eq('key', update.key).maybeSingle();
            
            const { error } = await supabaseAdmin.from('app_config').upsert({
                key: update.key,
                value: update.value,
                updated_at: new Date().toISOString(),
                updated_by: adminUser.id
            }, { onConflict: 'key' });

            if (error) throw new AppError(500, 'CONFIG_UPDATE_FAILED', `Failed to update ${update.key}: ${error.message}`);

            // Audit
            await supabaseAdmin.from('admin_audit_logs').insert({
                admin_uid: adminUser.id,
                admin_role: adminProfile.role,
                action_type: 'CONFIG_UPDATE',
                payload_before: before || {},
                payload_after: update,
                reason: `Updated config key: ${update.key}`
            });

            // If it's the banner and createNotification is true, also create a global notification
            if (update.key === 'announcement_banner' && createNotification && update.value?.active) {
                await supabaseAdmin.from('notifications').insert({
                    type: update.value.type || 'info',
                    title: 'New Announcement',
                    message: update.value.message,
                    created_at: new Date().toISOString()
                });
            }
         }

         return jsonOk({ success: true });
      }

      if (action === 'send-notification') {
        const { supabaseAdmin, user: adminUser, profile: adminProfile } = await requireSupportAccess(req);
        const { targetUserId, title, message, type, link } = body;

        if (!title || !message) throw new AppError(400, 'INVALID_REQUEST', 'Title and message are required');

        const { error } = await supabaseAdmin.from('notifications').insert({
            user_id: targetUserId || null, // null = global
            title,
            message,
            type: type || 'info',
            link: link || null,
            created_at: new Date().toISOString()
        });

        if (error) throw new AppError(500, 'NOTIFICATION_SEND_FAILED', error.message);

        // Audit
        await supabaseAdmin.from('admin_audit_logs').insert({
            admin_uid: adminUser.id,
            admin_role: adminProfile.role,
            action_type: 'USER_UPDATE',
            target_user_id: targetUserId || null,
            payload_after: { notification: { title, type } },
            reason: `Sent ${targetUserId ? 'direct' : 'global'} notification: ${title}`
        });

        return jsonOk({ success: true });
      }

      if (action === 'service-health') {
        const { supabaseAdmin } = await requireAdminOnlyAccess(req);
        const operation = String(body?.operation ?? '').trim();
        if (operation !== 'clear_breakers') {
          throw new AppError(400, 'INVALID_OPERATION', 'Unsupported service health operation');
        }
        const snapshot = await clearRecordedDependencyBreakers(supabaseAdmin);
        return jsonOk({ success: true, health: snapshot });
      }
    }

    throw new AppError(404, 'NOT_FOUND', 'Action not found');
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(err.status, err.code, err.message, err.details);
    }
    const message = err instanceof Error ? err.message : 'Admin action failed';
    return jsonError(500, 'ADMIN_ACTION_FAILED', message);
  }
});
