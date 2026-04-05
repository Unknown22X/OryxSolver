const DEFAULT_ALLOWED_HOSTS = [
  'lemonsqueezy.com',
  'www.lemonsqueezy.com',
  'checkout.lemonsqueezy.com',
];

function matchesAllowedHost(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
}

export function sanitizeExternalUrl(
  rawUrl: string,
  allowedHosts: string[] = DEFAULT_ALLOWED_HOSTS,
): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (!matchesAllowedHost(parsed.hostname, allowedHosts)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
