import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';

type BannerType = 'info' | 'warning' | 'success';

interface BannerProps {
  message: string;
  type?: BannerType;
  id?: string; // Used to track dismissal in localStorage
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

function isDismissed(dismissKey: string): boolean {
  try {
    return Boolean(localStorage.getItem(dismissKey));
  } catch {
    return false;
  }
}

function persistDismissed(dismissKey: string) {
  try {
    localStorage.setItem(dismissKey, 'true');
  } catch {
    // ignore
  }
}

const STYLES = {
  info: {
    container: 'bg-indigo-50 border-indigo-100/50 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300',
    icon: <Info size={14} className="text-indigo-500" />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-100/50 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300',
    icon: <AlertTriangle size={14} className="text-amber-500" />,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300',
    icon: <PartyPopper size={14} className="text-emerald-500" />,
  },
};

export default function Banner({ message, type = 'info', id = 'default' }: BannerProps) {
  const { t } = useTranslation();
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
    <div className={`mx-3 mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-500 ${style.container}`}>
      <div className="mt-0.5 shrink-0">
        {style.icon}
      </div>
      <div className="flex-1 text-[13px] font-medium leading-relaxed">
        {normalizedMessage}
      </div>
      <button 
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10 transition-all"
        title={t('banner.dismiss')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
