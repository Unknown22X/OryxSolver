import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type ServiceDependency = 'network' | 'backend' | 'auth' | 'db' | 'ai';
export type DependencyCondition = 'healthy' | 'degraded' | 'outage' | 'maintenance';
export type ServiceOverall = 'healthy' | 'degraded' | 'outage' | 'maintenance';

export type DependencyHealth = {
  status: DependencyCondition;
  message: string;
  updatedAt: string;
  code?: string;
  retryAfterSec?: number;
  failureCount?: number;
  breakerState?: 'closed' | 'open';
  breakerOpenUntil?: string | null;
  source?: string;
};

export type ServiceHealthSnapshot = {
  overall: ServiceOverall;
  readOnly: boolean;
  retryAfterSec?: number;
  message: string;
  updatedAt: string;
  dependencies: Record<ServiceDependency, DependencyHealth>;
  statusLinks: {
    supabase: string;
    gemini: string;
  };
};

const SERVICE_HEALTH_CONFIG_KEY = 'service_health_snapshot';
const DEPENDENCIES: ServiceDependency[] = ['network', 'backend', 'auth', 'db', 'ai'];
const DEFAULT_STATUS_LINKS = {
  supabase: 'https://status.supabase.com',
  gemini: 'https://ai.google.dev/gemini-api/docs/rate-limits',
};

function nowIso() {
  return new Date().toISOString();
}

function createDependencyHealth(message = 'Operational'): DependencyHealth {
  return {
    status: 'healthy',
    message,
    updatedAt: nowIso(),
    failureCount: 0,
    breakerState: 'closed',
    breakerOpenUntil: null,
  };
}

export function createDefaultServiceHealthSnapshot(): ServiceHealthSnapshot {
  return {
    overall: 'healthy',
    readOnly: false,
    message: 'All services are operational.',
    updatedAt: nowIso(),
    dependencies: {
      network: createDependencyHealth(),
      backend: createDependencyHealth(),
      auth: createDependencyHealth(),
      db: createDependencyHealth(),
      ai: createDependencyHealth(),
    },
    statusLinks: DEFAULT_STATUS_LINKS,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDependencyHealth(value: unknown): DependencyHealth {
  if (!isRecord(value)) return createDependencyHealth();
  return {
    status:
      value.status === 'maintenance' || value.status === 'outage' || value.status === 'degraded'
        ? value.status
        : 'healthy',
    message: typeof value.message === 'string' && value.message.trim() ? value.message : 'Operational',
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : nowIso(),
    code: typeof value.code === 'string' ? value.code : undefined,
    retryAfterSec: typeof value.retryAfterSec === 'number' ? value.retryAfterSec : undefined,
    failureCount: typeof value.failureCount === 'number' ? value.failureCount : 0,
    breakerState: value.breakerState === 'open' ? 'open' : 'closed',
    breakerOpenUntil: typeof value.breakerOpenUntil === 'string' ? value.breakerOpenUntil : null,
    source: typeof value.source === 'string' ? value.source : undefined,
  };
}

export function parseServiceHealthSnapshot(value: unknown): ServiceHealthSnapshot {
  const fallback = createDefaultServiceHealthSnapshot();
  if (!isRecord(value)) return fallback;
  const dependencies = isRecord(value.dependencies) ? value.dependencies : {};

  return {
    overall:
      value.overall === 'maintenance' || value.overall === 'outage' || value.overall === 'degraded'
        ? value.overall
        : 'healthy',
    readOnly: Boolean(value.readOnly),
    retryAfterSec: typeof value.retryAfterSec === 'number' ? value.retryAfterSec : undefined,
    message: typeof value.message === 'string' && value.message.trim() ? value.message : fallback.message,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.trim() ? value.updatedAt : nowIso(),
    dependencies: {
      network: parseDependencyHealth(dependencies.network),
      backend: parseDependencyHealth(dependencies.backend),
      auth: parseDependencyHealth(dependencies.auth),
      db: parseDependencyHealth(dependencies.db),
      ai: parseDependencyHealth(dependencies.ai),
    },
    statusLinks: {
      supabase:
        isRecord(value.statusLinks) && typeof value.statusLinks.supabase === 'string'
          ? value.statusLinks.supabase
          : DEFAULT_STATUS_LINKS.supabase,
      gemini:
        isRecord(value.statusLinks) && typeof value.statusLinks.gemini === 'string'
          ? value.statusLinks.gemini
          : DEFAULT_STATUS_LINKS.gemini,
    },
  };
}

export async function loadServiceHealthSnapshot(
  supabaseAdmin: SupabaseClient,
): Promise<ServiceHealthSnapshot> {
  const { data } = await supabaseAdmin
    .from('app_config')
    .select('value')
    .eq('key', SERVICE_HEALTH_CONFIG_KEY)
    .maybeSingle();

  return parseServiceHealthSnapshot(data?.value);
}

export async function saveServiceHealthSnapshot(
  supabaseAdmin: SupabaseClient,
  snapshot: ServiceHealthSnapshot,
) {
  await supabaseAdmin.from('app_config').upsert(
    {
      key: SERVICE_HEALTH_CONFIG_KEY,
      value: snapshot,
      is_public: false,
      updated_at: nowIso(),
      updated_by: null,
    },
    { onConflict: 'key' },
  );
}

function toOverall(dependencies: Record<ServiceDependency, DependencyHealth>): {
  overall: ServiceOverall;
  readOnly: boolean;
  message: string;
  retryAfterSec?: number;
} {
  const statuses = DEPENDENCIES.map((dependency) => dependencies[dependency].status);
  const retryAfterSec = DEPENDENCIES.reduce<number | undefined>((maxValue, dependency) => {
    const current = dependencies[dependency].retryAfterSec;
    if (typeof current !== 'number') return maxValue;
    return typeof maxValue === 'number' ? Math.max(maxValue, current) : current;
  }, undefined);

  if (statuses.includes('maintenance')) {
    return {
      overall: 'maintenance',
      readOnly: true,
      message: 'The platform is in maintenance mode.',
      retryAfterSec,
    };
  }

  if (statuses.includes('outage')) {
    const affected = DEPENDENCIES.filter((dependency) => dependencies[dependency].status === 'outage');
    return {
      overall: 'outage',
      readOnly: true,
      message: `Service outage affecting ${affected.join(', ')}.`,
      retryAfterSec,
    };
  }

  if (statuses.includes('degraded')) {
    const affected = DEPENDENCIES.filter((dependency) => dependencies[dependency].status === 'degraded');
    return {
      overall: 'degraded',
      readOnly: true,
      message: `Service degradation affecting ${affected.join(', ')}.`,
      retryAfterSec,
    };
  }

  return {
    overall: 'healthy',
    readOnly: false,
    message: 'All services are operational.',
    retryAfterSec,
  };
}

export async function recordDependencyState(
  supabaseAdmin: SupabaseClient,
  input: {
    dependency: ServiceDependency;
    status: DependencyCondition;
    message: string;
    code?: string;
    retryAfterSec?: number;
    source?: string;
  },
) {
  const snapshot = await loadServiceHealthSnapshot(supabaseAdmin);
  const previous = snapshot.dependencies[input.dependency] ?? createDependencyHealth();
  const nextFailureCount = input.status === 'healthy' ? 0 : (previous.failureCount ?? 0) + 1;
  const breakerOpen = input.status !== 'healthy' && nextFailureCount >= 3;
  const breakerSeconds = Math.min(60 * 2 ** Math.max(nextFailureCount - 3, 0), 300);
  const breakerOpenUntil = breakerOpen ? new Date(Date.now() + breakerSeconds * 1000).toISOString() : null;

  snapshot.dependencies[input.dependency] = {
    status: input.status,
    message: input.message,
    updatedAt: nowIso(),
    code: input.code,
    retryAfterSec: input.retryAfterSec,
    failureCount: nextFailureCount,
    breakerState: breakerOpen ? 'open' : 'closed',
    breakerOpenUntil,
    source: input.source,
  };

  if (input.status === 'healthy') {
    snapshot.dependencies[input.dependency].breakerState = 'closed';
    snapshot.dependencies[input.dependency].breakerOpenUntil = null;
  }

  const overall = toOverall(snapshot.dependencies);
  snapshot.overall = overall.overall;
  snapshot.readOnly = overall.readOnly;
  snapshot.retryAfterSec = overall.retryAfterSec;
  snapshot.message = overall.message;
  snapshot.updatedAt = nowIso();
  snapshot.statusLinks = DEFAULT_STATUS_LINKS;

  await saveServiceHealthSnapshot(supabaseAdmin, snapshot);
  return snapshot;
}

export async function clearRecordedDependencyBreakers(supabaseAdmin: SupabaseClient) {
  const snapshot = await loadServiceHealthSnapshot(supabaseAdmin);
  for (const dependency of DEPENDENCIES) {
    snapshot.dependencies[dependency] = {
      ...snapshot.dependencies[dependency],
      status: 'healthy',
      message: 'Operational',
      updatedAt: nowIso(),
      code: undefined,
      retryAfterSec: undefined,
      failureCount: 0,
      breakerState: 'closed',
      breakerOpenUntil: null,
      source: undefined,
    };
  }
  const overall = toOverall(snapshot.dependencies);
  snapshot.overall = overall.overall;
  snapshot.readOnly = overall.readOnly;
  snapshot.retryAfterSec = overall.retryAfterSec;
  snapshot.message = overall.message;
  snapshot.updatedAt = nowIso();
  snapshot.statusLinks = DEFAULT_STATUS_LINKS;
  await saveServiceHealthSnapshot(supabaseAdmin, snapshot);
  return snapshot;
}

export function serviceHealthSnapshotResponse(
  snapshot: ServiceHealthSnapshot,
  extras?: Record<string, unknown>,
) {
  return {
    api_version: 'v1',
    ok: true,
    ...extras,
    health: snapshot,
  };
}
