import { Wrench, ShieldAlert } from 'lucide-react';

export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50/98 p-8 text-center backdrop-blur-lg dark:bg-zinc-950/98">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-indigo-600 shadow-2xl shadow-indigo-500/20">
          <Wrench size={40} className="text-white" />
        </div>
      </div>
      
      <h2 className="mb-4 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        System Maintenance
      </h2>
      
      <p className="max-w-md text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
        We're currently upgrading the Oryx Solver platform to bring you new features and improved performance. We'll be back online in just a moment.
      </p>
      
      <div className="mt-10 flex items-center gap-3 rounded-full bg-slate-200/50 px-6 py-3 dark:bg-zinc-800/50">
        <ShieldAlert size={20} className="text-indigo-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
          Scheduled Service Interruption
        </span>
      </div>
      
      <button 
        onClick={() => window.location.reload()}
        className="mt-16 rounded-full border border-indigo-200 bg-white px-8 py-3 text-sm font-bold text-indigo-600 shadow-sm transition-all hover:bg-indigo-50 dark:border-indigo-500/20 dark:bg-zinc-900 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
      >
        Check status
      </button>
      
      <p className="mt-8 text-[11px] font-medium text-slate-400 dark:text-zinc-600">
        © 2026 Oryx Solver. All rights reserved.
      </p>
    </div>
  );
}
