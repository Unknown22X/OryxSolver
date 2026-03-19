const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

export function hasValidInternalToken(req: Request): boolean {
  const expected = Deno.env.get('INTERNAL_EDGE_TOKEN') ?? '';
  const provided = req.headers.get('x-internal-token') ?? '';
  return Boolean(expected) && timingSafeEqual(provided, expected);
}
