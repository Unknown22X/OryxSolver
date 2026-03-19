import { supabase } from './supabaseClient';

export type ExtensionLegalVersions = {
  termsVersion: string;
  privacyVersion: string;
};

export type ExtensionPublicConfig = ExtensionLegalVersions & {
  supportEmail: string;
};

const FALLBACK_LEGAL_VERSIONS: ExtensionLegalVersions = {
  termsVersion: '2026-03-18',
  privacyVersion: '2026-03-18',
};

const FALLBACK_SUPPORT_EMAIL = 'support@oryxsolver.com';

export async function fetchExtensionLegalVersions(): Promise<ExtensionLegalVersions> {
  if (!supabase) return FALLBACK_LEGAL_VERSIONS;

  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('is_public', true)
    .eq('key', 'legal_versions')
    .maybeSingle();

  if (error || !data?.value) {
    if (error) console.error('Failed to load legal versions for extension:', error);
    return FALLBACK_LEGAL_VERSIONS;
  }

  const value = data.value as Record<string, unknown>;
  return {
    termsVersion: String(value.terms_version ?? FALLBACK_LEGAL_VERSIONS.termsVersion),
    privacyVersion: String(value.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacyVersion),
  };
}

export async function fetchExtensionPublicConfig(): Promise<ExtensionPublicConfig> {
  if (!supabase) {
    return {
      ...FALLBACK_LEGAL_VERSIONS,
      supportEmail: FALLBACK_SUPPORT_EMAIL,
    };
  }

  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .eq('is_public', true)
    .in('key', ['legal_versions', 'support_contact']);

  if (error || !data) {
    if (error) console.error('Failed to load extension public config:', error);
    return {
      ...FALLBACK_LEGAL_VERSIONS,
      supportEmail: FALLBACK_SUPPORT_EMAIL,
    };
  }

  const legalVersionsRow = data.find((row) => row.key === 'legal_versions');
  const supportContactRow = data.find((row) => row.key === 'support_contact');
  const legalValue = (legalVersionsRow?.value ?? {}) as Record<string, unknown>;
  const supportValue = (supportContactRow?.value ?? {}) as Record<string, unknown>;
  const supportEmail = String(supportValue.email ?? FALLBACK_SUPPORT_EMAIL).trim().toLowerCase();

  return {
    termsVersion: String(legalValue.terms_version ?? FALLBACK_LEGAL_VERSIONS.termsVersion),
    privacyVersion: String(legalValue.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacyVersion),
    supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : FALLBACK_SUPPORT_EMAIL,
  };
}
