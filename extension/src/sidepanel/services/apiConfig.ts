function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getApiBaseUrl(): string {
  const explicitBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
  if (explicitBase) return trimSlash(explicitBase);

  const solveUrl = String(import.meta.env.VITE_SOLVE_API_URL ?? '').trim();
  if (!solveUrl) return '';

  const idx = solveUrl.lastIndexOf('/solve');
  return idx > 0 ? solveUrl.slice(0, idx) : trimSlash(solveUrl);
}

export function getApiUrl(path: string, explicitEnvUrl?: string): string {
  const explicit = String(explicitEnvUrl ?? '').trim();
  if (explicit) return explicit;
  const base = getApiBaseUrl();
  if (!base) return '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

