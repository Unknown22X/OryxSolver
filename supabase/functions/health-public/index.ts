import '@supabase/functions-js/edge-runtime.d.ts';
import { createSupabaseAdminClient } from '../_shared/db.ts';
import { handleOptions, jsonError, jsonOk } from '../_shared/http.ts';
import {
  createDefaultServiceHealthSnapshot,
  loadServiceHealthSnapshot,
  recordDependencyState,
  serviceHealthSnapshotResponse,
  type ServiceHealthSnapshot,
} from '../_shared/serviceHealth.ts';

type ConfigRow = {
  key: string;
  value: unknown;
};

function getPublicConfigValue(rows: ConfigRow[], key: string) {
  return rows.find((row) => row.key === key)?.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    let snapshot: ServiceHealthSnapshot;

    try {
      snapshot = await loadServiceHealthSnapshot(supabaseAdmin);
      await supabaseAdmin.from('app_config').select('key').limit(1);
      snapshot = await recordDependencyState(supabaseAdmin, {
        dependency: 'backend',
        status: 'healthy',
        message: 'Backend health checks passed.',
        source: 'health-public',
      });
      snapshot = await recordDependencyState(supabaseAdmin, {
        dependency: 'db',
        status: 'healthy',
        message: 'Database health checks passed.',
        source: 'health-public',
      });
    } catch (dbError) {
      console.error('Health self-check failed:', dbError);
      snapshot = createDefaultServiceHealthSnapshot();
      snapshot.overall = 'outage';
      snapshot.readOnly = true;
      snapshot.message = 'Backend health checks failed.';
      snapshot.dependencies.backend = {
        ...snapshot.dependencies.backend,
        status: 'outage',
        message: 'Backend self-check failed.',
      };
      snapshot.dependencies.db = {
        ...snapshot.dependencies.db,
        status: 'outage',
        message: 'Database self-check failed.',
      };
    }

    const { data: configRows, error: configError } = await supabaseAdmin
      .from('app_config')
      .select('key, value')
      .eq('is_public', true)
      .in('key', ['support_contact', 'announcement_banner', 'maintenance_mode']);

    if (configError) {
      return jsonError(503, 'SUPABASE_UNAVAILABLE', 'Public config is temporarily unavailable.');
    }

    const support = getPublicConfigValue((configRows ?? []) as ConfigRow[], 'support_contact');
    const banner = getPublicConfigValue((configRows ?? []) as ConfigRow[], 'announcement_banner');
    const maintenanceMode = Boolean(getPublicConfigValue((configRows ?? []) as ConfigRow[], 'maintenance_mode'));

    if (maintenanceMode) {
      snapshot.overall = 'maintenance';
      snapshot.readOnly = true;
      snapshot.message = 'The platform is in maintenance mode.';
      snapshot.dependencies.backend = {
        ...snapshot.dependencies.backend,
        status: 'maintenance',
        message: 'Maintenance mode enabled.',
        updatedAt: new Date().toISOString(),
      };
    }

    return jsonOk(
      serviceHealthSnapshotResponse(snapshot, {
        maintenanceMode,
        banner: isRecord(banner) ? banner : null,
        support: isRecord(support) ? support : { email: 'support@oryxsolver.com' },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return jsonError(503, 'BACKEND_UNREACHABLE', message);
  }
});
