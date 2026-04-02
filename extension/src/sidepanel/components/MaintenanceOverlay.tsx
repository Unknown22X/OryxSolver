import { useTranslation } from 'react-i18next';
import { Wrench, ShieldAlert } from 'lucide-react';

export default function MaintenanceOverlay() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50/95 p-8 text-center backdrop-blur-md dark:bg-zinc-950/95">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 shadow-xl shadow-indigo-500/20">
          <Wrench size={32} className="text-white" />
        </div>
      </div>
      
      <h2 className="mb-3 text-[22px] font-black tracking-tight text-slate-900 dark:text-white">
        {t('maintenance.title')}
      </h2>
      
      <p className="max-w-[280px] text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
        {t('maintenance.message')}
      </p>
      
      <div className="mt-8 flex items-center gap-2 rounded-full bg-slate-200/50 px-4 py-2 dark:bg-zinc-800/50">
        <ShieldAlert size={14} className="text-indigo-500" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
          {t('maintenance.message')}
        </span>
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        className="mt-12 text-[12px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Check again
      </button>
    </div>
  );
}
