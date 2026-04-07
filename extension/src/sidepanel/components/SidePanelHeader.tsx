import { useTranslation } from 'react-i18next';
import { CreditCard, ArrowRight, Sun, Moon, Menu } from 'lucide-react';
import { MascotIcon } from './MascotIcon';
import { getPlanUsageMetric } from '../utils/usagePresentation';

type SidePanelHeaderProps = {
  appName: string;
  monthlyUsed: number;
  monthlyLimit: number;
  isSignedIn: boolean;
  userEmail?: string | null;
  userPhotoUrl?: string | null;
  isPro?: boolean;
  planLabel?: string;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onToggleHistory?: () => void;
  onOpenSettings?: () => void;
  showCredits?: boolean;
  paygoRemaining?: number;
  onOpenUpgrade?: () => void;
  webAppBaseUrl?: string;
};

export default function SidePanelHeader({
  appName,
  monthlyUsed,
  monthlyLimit,
  isSignedIn,
  userEmail,
  userPhotoUrl,
  isPro,
  planLabel,
  isDarkMode,
  onToggleDarkMode,
  onToggleHistory,
  onOpenSettings,
  showCredits = false,
  paygoRemaining = 0,
  onOpenUpgrade,
  webAppBaseUrl = 'https://oryxsolver.com',
}: SidePanelHeaderProps) {
  const { t } = useTranslation();
  const planMetric = getPlanUsageMetric(
    monthlyUsed,
    monthlyLimit,
    (percent) => t('common.percent_used', { percent, defaultValue: `${percent}% used` }),
  );
  const isUsageWarning = monthlyLimit > 0 && planMetric.percentUsed >= 80 && paygoRemaining <= 0;
  const avatarInitial = (userEmail?.trim().charAt(0) || 'U').toUpperCase();

  return (
    <header className="oryx-shell-header sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b px-4">
      <div className="flex items-center gap-3">
        {isSignedIn && (
          <button
            onClick={onToggleHistory}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] bg-white shadow-xl shadow-indigo-100 ring-1 ring-slate-100 transition-transform duration-300 hover:scale-105 dark:bg-slate-800 dark:shadow-none dark:ring-slate-700">
          <MascotIcon 
            name="logo" 
            size="100%" 
            className="p-1 rounded-lg" 
          />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">{appName}</h1>
          {isSignedIn && isPro && (
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {planLabel ?? t('header.pro_account')}
            </p>
          )}
        </div>
      </div>

      {isSignedIn ? (
        <div className="flex items-center gap-3">

          {!isPro && onOpenUpgrade && (
            <button
              onClick={onOpenUpgrade}
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 hover:shadow-lg active:scale-95"
            >
              {t('header.upgrade')}
            </button>
          )}

          {showCredits && (
            <div 
              className={`group relative flex items-center gap-2 rounded-2xl border px-3 py-1.5 transition-all hover:scale-105 ${
                isUsageWarning ? 'border-red-200 bg-red-50/80 shadow-inner dark:bg-red-900/20 dark:border-red-700/50' : 'shadow-inner'
              }`}
              style={!isUsageWarning ? { backgroundColor: 'var(--oryx-panel-soft)', borderColor: 'var(--oryx-border-soft)' } : undefined}
              title={planMetric.isUnlimited ? t('header.high_limit') : planMetric.percentLabel}
            >
              <CreditCard size={12} className={isUsageWarning ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'} />
              <span className={`text-[11px] font-black tracking-tight ${isUsageWarning ? 'text-red-800' : 'text-blue-800 dark:text-blue-300'}`}>
                {planMetric.isUnlimited ? t('header.high_limit') : planMetric.percentLabel}
              </span>
              <div className="absolute bottom-0 left-3 right-3 h-[2px] overflow-hidden rounded-full bg-slate-200/50">
                <div 
                  className={`h-full transition-all duration-700 ${isUsageWarning ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: planMetric.progressWidth }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="flex h-8 w-8 items-center justify-center rounded-xl border text-slate-500 shadow-sm transition-all hover:scale-110 hover:border-indigo-300 hover:bg-slate-50 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-700"
            style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            title={isDarkMode ? t('header.light_mode') : t('header.dark_mode')}
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 dark:bg-slate-700" />

          <button
            type="button"
            onClick={onOpenSettings}
            className="group relative flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white bg-white shadow-md transition-all hover:rotate-3 hover:scale-110 hover:shadow-lg active:scale-95"
          >
            {userPhotoUrl ? (
              <img src={userPhotoUrl} alt="Profile" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 text-sm font-bold text-slate-700 shadow-inner">
                {avatarInitial}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => window.open(webAppBaseUrl, '_blank')}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-200 transition-all hover:scale-105 active:scale-95 hover:bg-slate-800"
        >
          {t('header.explore')}
          <ArrowRight size={14} />
        </button>
      )}
    </header>
  );
}
