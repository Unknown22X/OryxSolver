import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, AlertTriangle, PartyPopper, X } from 'lucide-react';

type BannerType = 'info' | 'warning' | 'success';

interface BannerProps {
  message: string;
  type?: BannerType;
  id?: string; // Used to track dismissal in localStorage
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
    <div className={`mx-3 mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-500 ${style.container}`}>
      <div className="mt-0.5 shrink-0">
        {style.icon}
      </div>
      <div className="flex-1 text-[13px] font-medium leading-relaxed">
        {message}
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
