import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY } from './index';
import type { SupportedLanguage } from './index';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n: i18nInstance } = useTranslation();
  const current = i18nInstance.language as SupportedLanguage;
  const isAr = current === 'ar';

  const toggle = () => {
    const next: SupportedLanguage = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
        isAr
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300'
          : 'border-slate-200 bg-transparent text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
      } ${className}`}
      title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label={isAr ? 'Switch to English' : 'Switch to Arabic'}
    >
      {isAr ? 'EN' : 'عربي'}
    </button>
  );
}
