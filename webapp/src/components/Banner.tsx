import { useState, useEffect } from 'react';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';

type BannerType = 'info' | 'warning' | 'success';

interface BannerProps {
  message: string;
  type?: BannerType;
  id?: string;
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
  const storageKey = `oryx_banner_dismissed_${id}_${message.length}`;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
  };

  if (!isVisible || !message) return null;

  const style = STYLES[type] || STYLES.info;

  return (
    <div className={`relative flex w-full items-center justify-center border-b px-4 py-3 sm:px-6 lg:px-8 transition-all animate-in fade-in slide-in-from-top-full duration-500 ${style.container}`}>
      <div className="flex max-w-7xl items-center gap-3">
        <div className="shrink-0">
          {style.icon}
        </div>
        <p className="text-sm font-medium leading-none">
          {message}
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
