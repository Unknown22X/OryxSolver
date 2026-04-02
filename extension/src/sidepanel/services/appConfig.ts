import { supabase } from './supabaseClient';
import { applyServiceHealthError, markSuccess } from './serviceHealth';

export type ExtensionLegalVersions = {
  termsVersion: string;
  privacyVersion: string;
};

export type ExtensionPublicConfig = ExtensionLegalVersions & {
  supportEmail: string;
  maintenanceMode: boolean;
  banner: {
    active: boolean;
    message: string;
    type: 'info' | 'warning' | 'success';
  } | null;
};

const FALLBACK_LEGAL_VERSIONS: ExtensionLegalVersions = {
  termsVersion: '2026-03-18',
  privacyVersion: '2026-03-18',
};

const FALLBACK_SUPPORT_EMAIL = 'support@oryxsolver.com';
const PUBLIC_CONFIG_CACHE_KEY = 'oryx_extension_public_config_cache';

function readCachedPublicConfig(): ExtensionPublicConfig | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CONFIG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ExtensionPublicConfig) : null;
  } catch {
    return null;
  }
}

function writeCachedPublicConfig(config: ExtensionPublicConfig) {
  try {
    localStorage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore cache failures.
  }
}

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
      maintenanceMode: false,
      banner: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('is_public', true)
      .in('key', ['legal_versions', 'support_contact', 'announcement_banner', 'maintenance_mode']);

    if (error || !data) {
      throw error ?? new Error('Extension public config unavailable');
    }

    const legalVersionsRow = data.find((row) => row.key === 'legal_versions');
    const supportContactRow = data.find((row) => row.key === 'support_contact');
    const bannerRow = data.find((row) => row.key === 'announcement_banner');
    const maintenanceRow = data.find((row) => row.key === 'maintenance_mode');

    const legalValue = (legalVersionsRow?.value ?? {}) as Record<string, unknown>;
    const supportValue = (supportContactRow?.value ?? {}) as Record<string, unknown>;
    const bannerValue = (bannerRow?.value ?? null) as any;
    const maintenanceValue = (maintenanceRow?.value ?? false) as boolean;
    const supportEmail = String(supportValue.email ?? FALLBACK_SUPPORT_EMAIL).trim().toLowerCase();

    const config = {
      termsVersion: String(legalValue.terms_version ?? FALLBACK_LEGAL_VERSIONS.termsVersion),
      privacyVersion: String(legalValue.privacy_version ?? FALLBACK_LEGAL_VERSIONS.privacyVersion),
      supportEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : FALLBACK_SUPPORT_EMAIL,
      maintenanceMode: maintenanceValue,
      banner: bannerValue,
    };
    writeCachedPublicConfig(config);
    markSuccess('db', 'Configuration loaded.');
    return config;
  } catch (error) {
    if (error) console.error('Failed to load extension public config:', error);
    applyServiceHealthError(error, 'db');
    return readCachedPublicConfig() ?? {
      ...FALLBACK_LEGAL_VERSIONS,
      supportEmail: FALLBACK_SUPPORT_EMAIL,
      maintenanceMode: false,
      banner: null,
    };
  }
}
