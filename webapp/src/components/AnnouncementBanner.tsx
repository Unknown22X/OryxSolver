import { useEffect, useRef, useState } from 'react';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';
import * as Sentry from '@sentry/react';
import { fetchPublicAppConfig, type PublicAppConfig } from '../lib/appConfig';
import { trackEvent } from '../lib/analyticsClient';

function hashString(value: string): string {
  // Small stable hash for localStorage keys (avoids long keys / same-length collisions).
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
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
  const [isVisible, setIsVisible] = useState(true);
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
  const dismissKey =
    banner?.active && banner.message
      ? `oryx_announcement_dismissed_${hashString(`${banner.type}:${banner.message}`)}`
      : null;
  const bannerKey = banner?.active && banner.message ? `${banner.type}:${banner.message}` : null;

  useEffect(() => {
    if (!dismissKey) return;
    try {
      const dismissed = localStorage.getItem(dismissKey);
      setIsVisible(!dismissed);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'announcement_banner', action: 'read_dismiss_state' },
      });
      setIsVisible(true);
    }
  }, [dismissKey]);

  useEffect(() => {
    if (!banner || !banner.active || !bannerKey || !isVisible) return;
    if (trackedBannerKeysRef.current.has(bannerKey)) return;

    trackedBannerKeysRef.current.add(bannerKey);
    trackEvent('announcement_banner_shown', {
      banner_type: banner.type,
      banner_message: banner.message,
    });
  }, [banner, bannerKey, isVisible]);

  if (!banner?.active || !isVisible) return null;

  const style = BANNER_STYLES[banner.type] || BANNER_STYLES.info;

  return (
    <div className={`relative z-[60] w-full ${style.bg} px-4 py-2 text-white shadow-lg animate-in slide-in-from-top duration-500`}>
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5">
        <div className="flex-shrink-0 opacity-80">
          {style.icon}
        </div>
        <p className="text-center text-xs font-bold leading-tight tracking-tight sm:text-sm">
          {banner.message}
        </p>
      </div>
      <button
        onClick={() => {
          trackEvent('announcement_banner_dismissed', {
            banner_type: banner.type,
            banner_message: banner.message,
          });
          Sentry.addBreadcrumb({
            category: 'ui.announcement_banner',
            message: 'Announcement banner dismissed',
            level: 'info',
            data: {
              bannerType: banner.type,
              bannerMessage: banner.message,
            },
          });
          try {
            if (dismissKey) localStorage.setItem(dismissKey, 'true');
          } catch (error) {
            Sentry.captureException(error, {
              tags: { component: 'announcement_banner', action: 'write_dismiss_state' },
            });
          }
          setIsVisible(false);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-80 transition-colors hover:bg-white/20 hover:opacity-100"
        aria-label="Close banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}
