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

type Listener = (snapshot: ServiceHealthSnapshot) => void;
type ResilientError = Error & {
  code?: string;
  status?: number;
  retryAfterSec?: number;
  dependency?: ServiceDependency;
};
type ResilientFetchOptions = {
  dependency: Exclude<ServiceDependency, 'network'>;
  timeoutMs?: number;
  retries?: number;
  safeToRetry?: boolean;
};

const STORAGE_KEY = 'oryx_extension_service_health_snapshot';
const HEALTHY_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UNHEALTHY_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;
const DEPENDENCIES: ServiceDependency[] = ['network', 'backend', 'auth', 'db', 'ai'];
const listeners = new Set<Listener>();
const circuitState = new Map<ServiceDependency, { failures: number; openUntil: number | null }>();
const HEALTHY_MESSAGE = 'All services are operational.';
let healthEndpointDisabledUntil = 0;
const explicitHealthEndpointUrl = String(import.meta.env.VITE_HEALTH_PUBLIC_API_URL ?? '').trim();

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

function createDefaultSnapshot(): ServiceHealthSnapshot {
  return {
    overall: 'healthy',
    readOnly: false,
    message: HEALTHY_MESSAGE,
    updatedAt: nowIso(),
    dependencies: {
      network: createDependencyHealth(),
      backend: createDependencyHealth(),
      auth: createDependencyHealth(),
      db: createDependencyHealth(),
      ai: createDependencyHealth(),
    },
    statusLinks: {
      supabase: 'https://status.supabase.com',
      gemini: 'https://ai.google.dev/gemini-api/docs/rate-limits',
    },
  };
}

function clearStoredSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore persistence failures.
  }
}

function hasUnhealthyDependency(snapshot: ServiceHealthSnapshot) {
  return DEPENDENCIES.some((dependency) => snapshot.dependencies[dependency]?.status !== 'healthy');
}

function isSnapshotExpired(snapshot: ServiceHealthSnapshot) {
  const updatedAtMs = new Date(snapshot.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return true;
  const ageMs = Date.now() - updatedAtMs;
  if (ageMs < 0) return false;
  const maxAgeMs =
    snapshot.overall === 'healthy' && !hasUnhealthyDependency(snapshot)
      ? HEALTHY_SNAPSHOT_MAX_AGE_MS
      : UNHEALTHY_SNAPSHOT_MAX_AGE_MS;
  return ageMs > maxAgeMs;
}

function readStoredSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = sanitizeSnapshotMessages(JSON.parse(raw) as ServiceHealthSnapshot);
    if (isSnapshotExpired(parsed)) {
      clearStoredSnapshot();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let currentSnapshot: ServiceHealthSnapshot = readStoredSnapshot() ?? createDefaultSnapshot();

function saveSnapshot(snapshot: ServiceHealthSnapshot) {
  currentSnapshot = snapshot;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence failures.
  }
  for (const listener of listeners) listener(snapshot);
}

function recomputeSnapshot(snapshot: ServiceHealthSnapshot): ServiceHealthSnapshot {
  const retryAfterSec = DEPENDENCIES.reduce<number | undefined>((maxValue, dependency) => {
    const current = snapshot.dependencies[dependency].retryAfterSec;
    if (typeof current !== 'number') return maxValue;
    return typeof maxValue === 'number' ? Math.max(maxValue, current) : current;
  }, undefined);

  const summarizeIncident = (status: Exclude<DependencyCondition, 'healthy'>, label: string) => {
    const affected = DEPENDENCIES.filter((dependency) => snapshot.dependencies[dependency].status === status);
    const firstMessage = affected
      .map((dependency) => snapshot.dependencies[dependency].message?.trim())
      .find((message) => Boolean(message) && message !== 'Operational');

    if (affected.length === 1 && firstMessage) return firstMessage;
    if (affected.length > 0) return `${label} affecting ${affected.join(', ')}.`;
    return '';
  };

  let overall: ServiceOverall = 'healthy';
  let readOnly = false;
  let message = HEALTHY_MESSAGE;

  if (DEPENDENCIES.some((dependency) => snapshot.dependencies[dependency].status === 'maintenance')) {
    overall = 'maintenance';
    readOnly = true;
    message = summarizeIncident('maintenance', 'Maintenance mode') || 'The platform is in maintenance mode.';
  } else if (DEPENDENCIES.some((dependency) => snapshot.dependencies[dependency].status === 'outage')) {
    overall = 'outage';
    readOnly = true;
    message = summarizeIncident('outage', 'Service outage');
  } else if (DEPENDENCIES.some((dependency) => snapshot.dependencies[dependency].status === 'degraded')) {
    overall = 'degraded';
    // Degraded should warn users but not force the whole app into read-only mode.
    // Circuit breakers still pause specific failing dependencies when needed.
    readOnly = false;
    message = summarizeIncident('degraded', 'Service degradation');
  }

  return {
    ...snapshot,
    overall,
    readOnly,
    message,
    retryAfterSec,
    updatedAt: nowIso(),
  };
}

function updateSnapshot(mutator: (snapshot: ServiceHealthSnapshot) => ServiceHealthSnapshot) {
  saveSnapshot(recomputeSnapshot(mutator({ ...currentSnapshot, dependencies: { ...currentSnapshot.dependencies } })));
}

function getRetryAfterSec(headers?: Headers | null) {
  const header = headers?.get('Retry-After');
  if (!header) return undefined;
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function getCircuitInfo(dependency: ServiceDependency) {
  const current = circuitState.get(dependency) ?? { failures: 0, openUntil: null };
  if (!circuitState.has(dependency)) circuitState.set(dependency, current);
  return current;
}

export function markSuccess(dependency: ServiceDependency, message = 'Operational') {
  circuitState.set(dependency, { failures: 0, openUntil: null });
  updateSnapshot((snapshot) => ({
    ...snapshot,
    dependencies: {
      ...snapshot.dependencies,
      [dependency]: {
        ...snapshot.dependencies[dependency],
        status: 'healthy',
        message,
        updatedAt: nowIso(),
        code: undefined,
        retryAfterSec: undefined,
        failureCount: 0,
        breakerState: 'closed',
        breakerOpenUntil: null,
      },
    },
  }));
}

function markFailure(
  dependency: ServiceDependency,
  status: DependencyCondition,
  message: string,
  code?: string,
  retryAfterSec?: number,
) {
  const circuit = getCircuitInfo(dependency);
  const failures = circuit.failures + 1;
  const shouldOpen = failures >= 3;
  const openForMs = shouldOpen ? Math.min(60000 * 2 ** Math.max(failures - 3, 0), 300000) : 0;
  const openUntil = shouldOpen ? Date.now() + openForMs : null;
  circuitState.set(dependency, { failures, openUntil });
  updateSnapshot((snapshot) => ({
    ...snapshot,
    message,
    retryAfterSec,
    dependencies: {
      ...snapshot.dependencies,
      [dependency]: {
        ...snapshot.dependencies[dependency],
        status,
        message,
        updatedAt: nowIso(),
        code,
        retryAfterSec,
        failureCount: failures,
        breakerState: shouldOpen ? 'open' : 'closed',
        breakerOpenUntil: openUntil ? new Date(openUntil).toISOString() : null,
      },
    },
  }));
}

function createResilientError(message: string, extras: Partial<ResilientError>): ResilientError {
  const error = new Error(message) as ResilientError;
  Object.assign(error, extras);
  return error;
}

function dependencyFromErrorCode(code?: string): Exclude<ServiceDependency, 'network'> {
  if (!code) return 'backend';
  if (code.startsWith('AI_')) return 'ai';
  if (code.includes('AUTH')) return 'auth';
  if (code.includes('SUPABASE') || code.includes('HISTORY') || code.includes('SYNC_PROFILE')) return 'db';
  return 'backend';
}

function sanitizeHealthMessage(message: string, dependency: ServiceDependency) {
  const normalized = message.toLowerCase();
  const isSupabase = normalized.includes('supabase.co');
  const isFetch = normalized.includes('failed to fetch') || normalized.includes('networkerror');
  if (dependency === 'network') return 'You appear to be offline.';
  if (isSupabase || isFetch) return 'Service is temporarily unavailable. Please try again.';
  return message;
}

function sanitizeSnapshotMessages(snapshot: ServiceHealthSnapshot): ServiceHealthSnapshot {
  const sanitizedDependencies = Object.fromEntries(
    DEPENDENCIES.map((dependency) => [
      dependency,
      {
        ...snapshot.dependencies[dependency],
        message: sanitizeHealthMessage(
          snapshot.dependencies[dependency].message || 'Service is temporarily unavailable. Please try again.',
          dependency,
        ),
      },
    ]),
  ) as ServiceHealthSnapshot['dependencies'];

  return {
    ...snapshot,
    message: sanitizeHealthMessage(snapshot.message || 'Service is temporarily unavailable. Please try again.', 'backend'),
    dependencies: sanitizedDependencies,
  };
}

export function subscribeServiceHealth(listener: Listener) {
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getServiceHealthSnapshot() {
  return currentSnapshot;
}

export function setServiceHealthSnapshot(snapshot: ServiceHealthSnapshot) {
  saveSnapshot(recomputeSnapshot(snapshot));
}

export function resetServiceHealthSnapshot() {
  clearStoredSnapshot();
  saveSnapshot(createDefaultSnapshot());
}

export function markOnline() {
  markSuccess('network', 'Network connection restored.');
}

export function markOffline() {
  markFailure('network', 'outage', 'You appear to be offline.', 'NETWORK_OFFLINE');
}

export function applyServiceHealthError(error: unknown, fallbackDependency: Exclude<ServiceDependency, 'network'> = 'backend') {
  const resilientError = error as ResilientError;
  const code = resilientError?.code;
  const dependency = resilientError?.dependency ?? dependencyFromErrorCode(code) ?? fallbackDependency;
  if (code === 'NETWORK_OFFLINE') {
    markOffline();
    return;
  }
  const retryAfterSec = resilientError?.retryAfterSec;
  const rawMessage = resilientError?.message || 'Service is temporarily unavailable.';
  const message = sanitizeHealthMessage(rawMessage, dependency);
  const status = resilientError?.status ?? 0;

  // Don't report user-level auth errors as service-wide health issues.
  // These are handled by the UI (Login screen) rather than a global notice banner.
  if (status === 401 || status === 403 || message.includes('No active auth session')) {
    console.info(`[health] Ignoring user-level error for ${dependency}:`, message);
    return;
  }

  const condition: DependencyCondition =
    code === 'RATE_LIMITED'
      ? 'degraded'
      : status === 429
        ? 'degraded'
        : status >= 500 || code === 'BACKEND_UNREACHABLE' || code === 'SUPABASE_UNAVAILABLE'
          ? 'outage'
          : 'degraded';

  markFailure(dependency, condition, message, code, retryAfterSec);
}

export function canPerformDependencyAction(
  dependency: Exclude<ServiceDependency, 'network'>,
  snapshot = currentSnapshot,
) {
  if (snapshot.dependencies.network.status === 'outage') return false;
  const dependencyState = snapshot.dependencies[dependency];
  if (!dependencyState) return true;
  if (dependencyState.breakerState === 'open' && dependencyState.breakerOpenUntil) {
    return Date.now() >= new Date(dependencyState.breakerOpenUntil).getTime();
  }
  return dependencyState.status === 'healthy';
}

export function getDependencyRetryCountdown(
  dependency: Exclude<ServiceDependency, 'network'>,
  snapshot = currentSnapshot,
) {
  const dependencyState = snapshot.dependencies[dependency];
  if (!dependencyState?.breakerOpenUntil) return 0;
  return Math.max(0, Math.ceil((new Date(dependencyState.breakerOpenUntil).getTime() - Date.now()) / 1000));
}

export async function fetchPublicServiceHealth() {
  // Only poll public health when explicitly configured for this environment.
  // Deriving it from the generic API base causes 404 noise in environments
  // where /health-public is not deployed.
  const url = explicitHealthEndpointUrl || '';
  if (!url) {
    return { health: currentSnapshot };
  }
  if (healthEndpointDisabledUntil > Date.now()) {
    return { health: currentSnapshot };
  }

  const response = await fetch(url, { method: 'GET' });
  if (response.status === 404) {
    // Endpoint not deployed in this environment; avoid repeated failed calls.
    healthEndpointDisabledUntil = Date.now() + 30 * 60 * 1000;
    console.warn(`[service-health] ${url} returned 404. Health polling paused for 30 minutes.`);
    return { health: currentSnapshot };
  }

  if (!response.ok) {
    throw createResilientError(`Health request failed: ${response.status}`, {
      code: response.status >= 500 ? 'BACKEND_UNREACHABLE' : 'SERVICE_DEGRADED',
      status: response.status,
      dependency: 'backend',
      retryAfterSec: getRetryAfterSec(response.headers),
    });
  }
  const data = (await response.json()) as { health?: ServiceHealthSnapshot };
  if (data.health) setServiceHealthSnapshot(data.health);
  return data;
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions,
) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    markOffline();
    throw createResilientError('You appear to be offline.', {
      code: 'NETWORK_OFFLINE',
      dependency: 'network',
    });
  }

  const dependency = options.dependency;
  const method = (init.method ?? 'GET').toUpperCase();
  const safeToRetry = options.safeToRetry ?? (method === 'GET' || method === 'HEAD');
  const retries = safeToRetry ? options.retries ?? 2 : 0;
  const timeoutMs = options.timeoutMs ?? 10000;
  const circuit = getCircuitInfo(dependency);

  if (circuit.openUntil && Date.now() < circuit.openUntil) {
    const retryAfterSec = Math.ceil((circuit.openUntil - Date.now()) / 1000);
    throw createResilientError('Service temporarily paused while waiting for recovery.', {
      code: 'SERVICE_DEGRADED',
      dependency,
      retryAfterSec,
    });
  }

  let lastError: ResilientError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
      window.clearTimeout(timeoutId);
      const retryAfterSec = getRetryAfterSec(response.headers);

      if (response.ok) {
        markSuccess(dependency);
        return response;
      }

      const bodyText = await response.clone().text().catch(() => '');
      let code: string | undefined;
      let message = `Request failed with status ${response.status}`;
      let bodyRetryAfter = retryAfterSec;

      try {
        const parsed = JSON.parse(bodyText) as {
          error?: string;
          code?: string;
          retryAfter?: number;
          details?: { retryAfter?: number };
        };
        code = typeof parsed.code === 'string' ? parsed.code : undefined;
        message = parsed.error || message;
        if (typeof parsed.retryAfter === 'number') bodyRetryAfter = parsed.retryAfter;
        if (typeof parsed.details?.retryAfter === 'number') bodyRetryAfter = parsed.details.retryAfter;
      } catch {
        if (bodyText.trim()) message = bodyText;
      }

      const error = createResilientError(message, {
        code,
        status: response.status,
        retryAfterSec: bodyRetryAfter,
        dependency: dependencyFromErrorCode(code) ?? dependency,
      });

      if (safeToRetry && attempt < retries && shouldRetryStatus(response.status)) {
        lastError = error;
        await wait(400 * 2 ** attempt + Math.floor(Math.random() * 250));
        continue;
      }

      applyServiceHealthError(error, dependency);
      throw error;
    } catch (error) {
      window.clearTimeout(timeoutId);
      const resilientError =
        error instanceof DOMException && error.name === 'AbortError'
          ? createResilientError('Request timed out.', {
              code: dependency === 'ai' ? 'AI_TIMEOUT' : 'BACKEND_UNREACHABLE',
              dependency,
              status: 504,
            })
          : createResilientError((error as Error).message || 'Request failed.', {
              ...(error as Partial<ResilientError>),
              dependency: (error as Partial<ResilientError>).dependency ?? dependency,
            });

      if (safeToRetry && attempt < retries && (resilientError.status ? shouldRetryStatus(resilientError.status) : true)) {
        lastError = resilientError;
        await wait(400 * 2 ** attempt + Math.floor(Math.random() * 250));
        continue;
      }

      applyServiceHealthError(resilientError, dependency);
      throw resilientError;
    }
  }

  if (lastError) {
    applyServiceHealthError(lastError, dependency);
    throw lastError;
  }

  throw createResilientError('Request failed.', { dependency });
}
