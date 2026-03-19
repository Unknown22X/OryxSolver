import { useEffect, useState } from 'react';
import { FALLBACK_PUBLIC_CONFIG, fetchPublicAppConfig, type PublicAppConfig } from '../lib/appConfig';

export function usePublicAppConfig() {
  const [config, setConfig] = useState<PublicAppConfig>(FALLBACK_PUBLIC_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const nextConfig = await fetchPublicAppConfig();
        if (!active) return;
        setConfig(nextConfig);
      } catch (error) {
        console.error('Failed to load public app config:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  return { config, loading };
}
