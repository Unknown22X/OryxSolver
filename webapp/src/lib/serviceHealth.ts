import { getFunctionUrl } from './functions';

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

type ResilientFetchOptions = {
  dependency: Exclude<ServiceDependency, 'network'>;
  timeoutMs?: number;
  retries?: number;
  safeToRetry?: boolean;
};

type ResilientError = Error & {
  code?: string;
  status?: number;
  retryAfterSec?: number;
  dependency?: ServiceDependency;
};

const STORAGE_KEY = 'oryx_service_health_snapshot';
const DEPENDENCIES: ServiceDependency[] = ['network', 'backend', 'auth', 'db', 'ai'];
const listeners = new Set<Listener>();
const circuitState = new Map<ServiceDependency, { failures: number; openUntil: number | null }>();

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
    message: 'All services are operational.',
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

function readStoredSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServiceHealthSnapshot) : null;
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
  const dependencyStates = DEPENDENCIES.map((dependency) => snapshot.dependencies[dependency].status);
  let overall: ServiceOverall = 'healthy';
  let readOnly = false;

  if (dependencyStates.includes('maintenance')) {
    overall = 'maintenance';
    readOnly = true;
  } else if (dependencyStates.includes('outage')) {
    overall = 'outage';
    readOnly = true;
  } else if (dependencyStates.includes('degraded')) {
    overall = 'degraded';
    readOnly = true;
  }

  return {
    ...snapshot,
    overall,
    readOnly,
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

function getCircuitInfo(dependency: ServiceDependency) {
  const current = circuitState.get(dependency) ?? { failures: 0, openUntil: null };
  if (!circuitState.has(dependency)) circuitState.set(dependency, current);
  return current;
}

export function markSuccess(dependency: ServiceDependency, message = 'Operational') {
  circuitState.set(dependency, { failures: 0, openUntil: null });
  updateSnapshot((snapshot) => ({
    ...snapshot,
    message: 'All services are operational.',
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

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function dependencyFromErrorCode(code?: string): Exclude<ServiceDependency, 'network'> {
  if (!code) return 'backend';
  if (code.startsWith('AI_')) return 'ai';
  if (code.includes('AUTH')) return 'auth';
  if (code.includes('SUPABASE') || code.includes('HISTORY') || code.includes('SYNC_PROFILE')) return 'db';
  return 'backend';
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

export function mergeRemoteServiceHealth(partial: Partial<ServiceHealthSnapshot> & { dependencies?: Partial<Record<ServiceDependency, Partial<DependencyHealth>>> }) {
  updateSnapshot((snapshot) => ({
    ...snapshot,
    ...partial,
    dependencies: {
      ...snapshot.dependencies,
      ...Object.fromEntries(
        DEPENDENCIES.map((dependency) => [
          dependency,
          {
            ...snapshot.dependencies[dependency],
            ...(partial.dependencies?.[dependency] ?? {}),
          },
        ]),
      ),
    },
  }));
}

export async function fetchPublicServiceHealth() {
  const response = await fetch(getFunctionUrl('health-public'), { method: 'GET' });
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

export function markOffline() {
  markFailure('network', 'outage', 'You appear to be offline.', 'NETWORK_OFFLINE');
}

export function markOnline() {
  markSuccess('network', 'Network connection restored.');
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
  const message = resilientError?.message || 'Service is temporarily unavailable.';
  const status = resilientError?.status ?? 0;
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
