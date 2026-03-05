export type FirebaseLookupUser = {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoUrl?: string;
};

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[];
  error?: { message?: string };
};

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseLookupUser> {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY');
  if (!apiKey) {
    throw new Error('Missing FIREBASE_WEB_API_KEY secret');
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = (await res.json()) as FirebaseLookupResponse;
  if (!res.ok || !data.users || data.users.length === 0) {
    throw new Error(data.error?.message || 'Invalid Firebase token');
  }

  return data.users[0];
}
