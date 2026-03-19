const DEFAULT_ALLOWED_HOSTS = [
  'lemonsqueezy.com',
  'www.lemonsqueezy.com',
  'checkout.lemonsqueezy.com',
  'oryxsolver.com',
  'www.oryxsolver.com',
  'localhost',
  '127.0.0.1',
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
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
      return null;
    }
    if (!matchesAllowedHost(parsed.hostname, allowedHosts)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
