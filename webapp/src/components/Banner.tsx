import { useState, useEffect, useMemo } from 'react';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';

type BannerType = 'info' | 'warning' | 'success';

interface BannerProps {
  message: string;
  type?: BannerType;
  id?: string;
}

function normalizeBannerText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hashString(value: string): string {
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
  } catch {
    // ignore
  }

  // Cookie fallback for environments where storage is blocked or non-persistent.
  try {
    document.cookie = `${dismissKey}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  } catch {
    // ignore
  }
}

const STYLES = {
  info: {
    container: 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300',
    icon: <Info size={16} className="text-indigo-500" />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300',
    icon: <AlertTriangle size={16} className="text-amber-500" />,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300',
    icon: <PartyPopper size={16} className="text-emerald-500" />,
  },
};

export default function Banner({ message, type = 'info', id = 'webapp-announcement' }: BannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const normalizedMessage = useMemo(() => normalizeBannerText(message ?? ''), [message]);
  const dismissKey = useMemo(() => {
    const stable = `${id}:${type}:${normalizedMessage}`;
    return `oryx_banner_dismissed_${hashString(stable)}`;
  }, [id, type, normalizedMessage]);

  useEffect(() => {
    if (!normalizedMessage) {
      setIsVisible(false);
      return;
    }
    setIsVisible(!isDismissed(dismissKey));
  }, [dismissKey, normalizedMessage]);

  const handleDismiss = () => {
    persistDismissed(dismissKey);
    setIsVisible(false);
  };

  if (!isVisible || !normalizedMessage) return null;

  const style = STYLES[type] || STYLES.info;

  return (
    <div className={`relative flex w-full items-center justify-center border-b px-4 py-3 sm:px-6 lg:px-8 transition-all animate-in fade-in slide-in-from-top-full duration-500 ${style.container}`}>
      <div className="flex max-w-7xl items-center gap-3">
        <div className="shrink-0">
          {style.icon}
        </div>
        <p className="text-sm font-medium leading-none">
          {normalizedMessage}
        </p>
      </div>
      <button 
        onClick={handleDismiss}
        className="absolute right-4 rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10 transition-all"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
