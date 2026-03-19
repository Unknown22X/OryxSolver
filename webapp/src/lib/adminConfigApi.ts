import { fetchEdge } from './edge';
import type { ConfigRow } from './appConfig';

export const ADMIN_CONFIG_KEYS = [
  'legal_versions',
  'terms_content',
  'privacy_content',
  'product_features',
  'support_contact',
] as const;

type AdminConfigKey = (typeof ADMIN_CONFIG_KEYS)[number];

type AdminConfigResponse = {
  api_version: 'v1';
  ok: true;
  rows: ConfigRow[];
};

type AdminConfigUpdate = {
  key: AdminConfigKey;
  value: unknown;
  isPublic?: boolean;
};

export async function fetchAdminConfig(): Promise<ConfigRow[]> {
  const response = await fetchEdge<AdminConfigResponse>('/admin-config', { method: 'GET' });
  return response.rows;
}

export async function saveAdminConfig(updates: AdminConfigUpdate[]): Promise<void> {
  await fetchEdge('/admin-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
}
