import { useEffect, useMemo, useRef, useState } from 'react';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { fetchPublicAppConfig, type PublicAppConfig } from '../lib/appConfig';
import { trackEvent } from '../lib/analyticsClient';

function normalizeBannerText(value: string): string {
  // Normalize for stable dismiss keys even if admin accidentally adds extra whitespace/newlines.
  return value.replace(/\s+/g, ' ').trim();
}

function hashString(value: string): string {
  // Small stable hash for localStorage keys (avoids long keys / same-length collisions).
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function readCookie(name: string): string | null {
  try {
    const parts = document.cookie.split(';');
    for (const raw of parts) {
      const [k, ...rest] = raw.trim().split('=');
      if (k === name) return decodeURIComponent(rest.join('='));
    }
  } catch {
    // ignore
  }
  return null;
}

function isDismissed(dismissKey: string): boolean {
  try {
    return Boolean(localStorage.getItem(dismissKey));
  } catch {
    return readCookie(dismissKey) === '1';
  }
}

function persistDismissed(dismissKey: string) {
  try {
    localStorage.setItem(dismissKey, 'true');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'announcement_banner', action: 'write_dismiss_state' },
    });
  }

  // Cookie fallback for environments where storage is blocked or non-persistent.
  try {
    document.cookie = `${dismissKey}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  } catch {
    // ignore
  }
}

const BANNER_STYLES = {
  info: {
    bg: 'bg-indigo-600',
    icon: <Info size={14} />,
  },
  warning: {
    bg: 'bg-amber-500',
    icon: <AlertTriangle size={14} />,
  },
  success: {
    bg: 'bg-emerald-600',
    icon: <PartyPopper size={14} />,
  },
};

export default function AnnouncementBanner() {
  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const trackedBannerKeysRef = useRef(new Set<string>());

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await fetchPublicAppConfig();
        setConfig(data);
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'announcement_banner', action: 'load_config' },
        });
      }
    }
    loadConfig();
    
    // Refresh config every 2 minutes
    const interval = setInterval(loadConfig, 120000);
    return () => clearInterval(interval);
  }, []);

  const banner = config?.banner;
  const normalizedMessage =
    banner?.active && typeof banner.message === 'string' ? normalizeBannerText(banner.message) : '';
  const bannerType = banner?.type || 'info';
  const bannerKey = banner?.active && normalizedMessage ? `${bannerType}:${normalizedMessage}` : null;
  const dismissKey =
    bannerKey
      ? `oryx_announcement_dismissed_${hashString(bannerKey)}`
      : null;

  useEffect(() => {
    // Reset the local dismiss flag when the banner changes.
    setDismissedThisSession(false);
  }, [bannerKey]);

  const dismissedPersistently = useMemo(() => {
    if (!dismissKey) return false;
    try {
      return isDismissed(dismissKey);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'announcement_banner', action: 'read_dismiss_state' },
      });
      return false;
    }
  }, [dismissKey]);

  useEffect(() => {
    const isVisible = Boolean(banner?.active && bannerKey && !dismissedThisSession && !dismissedPersistently);
    if (!banner || !banner.active || !bannerKey || !isVisible) return;
    if (trackedBannerKeysRef.current.has(bannerKey)) return;

    trackedBannerKeysRef.current.add(bannerKey);
    trackEvent('announcement_banner_shown', {
      banner_type: bannerType,
      banner_message: normalizedMessage,
    });
  }, [banner, bannerKey, bannerType, normalizedMessage, dismissedThisSession, dismissedPersistently]);

  const isVisible = Boolean(banner?.active && bannerKey && !dismissedThisSession && !dismissedPersistently);
  if (!banner?.active || !isVisible) return null;

  const style = BANNER_STYLES[bannerType as keyof typeof BANNER_STYLES] || BANNER_STYLES.info;

  return (
    <div className={`relative z-[60] w-full ${style.bg} px-4 py-2 text-white shadow-lg animate-in slide-in-from-top duration-500`}>
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5">
        <div className="flex-shrink-0 opacity-80">
          {style.icon}
        </div>
        <p className="text-center text-xs font-bold leading-tight tracking-tight sm:text-sm">
          {normalizedMessage}
        </p>
      </div>
      <button
        onClick={() => {
          trackEvent('announcement_banner_dismissed', {
            banner_type: bannerType,
            banner_message: normalizedMessage,
          });
          Sentry.addBreadcrumb({
            category: 'ui.announcement_banner',
            message: 'Announcement banner dismissed',
            level: 'info',
            data: {
              bannerType,
              bannerMessage: normalizedMessage,
            },
          });
          if (dismissKey) persistDismissed(dismissKey);
          setDismissedThisSession(true);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-80 transition-colors hover:bg-white/20 hover:opacity-100"
        aria-label="Close banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}
