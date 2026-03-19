const trimSlash = (value: string) => value.replace(/\/$/, '');

export function getFunctionsBaseUrl(): string {
  const explicit =
    import.meta.env.VITE_FUNCTIONS_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_FUNCTIONS_URL ||
    '';
  if (explicit) return trimSlash(explicit);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) return '';
  return `${trimSlash(supabaseUrl)}/functions/v1`;
}

export function getFunctionUrl(path: string): string {
  const base = getFunctionsBaseUrl();
  const clean = path.replace(/^\/+/, '');
  return base ? `${base}/${clean}` : `/${clean}`;
}
