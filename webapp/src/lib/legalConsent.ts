export const PENDING_LEGAL_CONSENT_KEY = 'oryx_pending_legal_consent';

export type LegalConsentMetadata = {
  accepted_terms: true;
  accepted_privacy: true;
  accepted_legal_at: string;
  accepted_terms_version: string;
  accepted_privacy_version: string;
};

type LegalConsentVersionInput = {
  termsVersion: string;
  privacyVersion: string;
};

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function normalizeTimestamp(value: unknown): string | null {
  if (!isNonEmptyString(value, 64)) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function buildLegalConsentMetadata({
  termsVersion,
  privacyVersion,
}: LegalConsentVersionInput): LegalConsentMetadata {
  return {
    accepted_terms: true,
    accepted_privacy: true,
    accepted_legal_at: new Date().toISOString(),
    accepted_terms_version: termsVersion.trim(),
    accepted_privacy_version: privacyVersion.trim(),
  };
}

export function sanitizeLegalConsentMetadata(input: unknown): LegalConsentMetadata | null {
  if (!input || typeof input !== 'object') return null;

  const record = input as Record<string, unknown>;
  if (record.accepted_terms !== true || record.accepted_privacy !== true) return null;

  const acceptedAt = normalizeTimestamp(record.accepted_legal_at);
  const termsVersion = isNonEmptyString(record.accepted_terms_version, 64)
    ? record.accepted_terms_version.trim()
    : null;
  const privacyVersion = isNonEmptyString(record.accepted_privacy_version, 64)
    ? record.accepted_privacy_version.trim()
    : null;

  if (!acceptedAt || !termsVersion || !privacyVersion) return null;

  return {
    accepted_terms: true,
    accepted_privacy: true,
    accepted_legal_at: acceptedAt,
    accepted_terms_version: termsVersion,
    accepted_privacy_version: privacyVersion,
  };
}

export function readPendingLegalConsent(): LegalConsentMetadata | null {
  const raw = localStorage.getItem(PENDING_LEGAL_CONSENT_KEY);
  if (!raw) return null;

  try {
    return sanitizeLegalConsentMetadata(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function storePendingLegalConsent(input: unknown): boolean {
  const sanitized = sanitizeLegalConsentMetadata(input);
  if (!sanitized) {
    localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
    return false;
  }

  localStorage.setItem(PENDING_LEGAL_CONSENT_KEY, JSON.stringify(sanitized));
  return true;
}

export function clearPendingLegalConsent(): void {
  localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
}
