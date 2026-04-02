import { fetchEdge } from './edge';
import type { ConfigRow } from './appConfig';

export const ADMIN_CONFIG_KEYS = [
  'legal_versions',
  'terms_content',
  'privacy_content',
  'product_features',
  'support_contact',
  'enabled_models',
  'system_limits',
  'ai_system_prompt',
] as const;

type AdminConfigKey = (typeof ADMIN_CONFIG_KEYS)[number];

type AdminConfigUpdate = {
  key: AdminConfigKey;
  value: unknown;
  isPublic?: boolean;
};

export async function fetchAdminConfig(): Promise<ConfigRow[]> {
  const response = await fetchEdge<{ config: ConfigRow[] }>('/admin-actions/config', { method: 'GET' });
  return response.config;
}

export async function saveAdminConfig(updates: AdminConfigUpdate[]): Promise<void> {
  await fetchEdge('/admin-actions/update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configUpdates: updates }),
  });
}
