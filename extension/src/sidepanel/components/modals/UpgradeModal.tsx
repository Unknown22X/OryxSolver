import { X, ChevronRight, Sparkles } from 'lucide-react';
import type { UpgradeMoment } from '../../types';

type UpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  upgradeMoment: UpgradeMoment;
  upgradeUrl: string;
};

const FEATURES = [
  { label: 'Higher Monthly Limits', tone: 'bg-indigo-500' },
  { label: 'Priority AI Processing', tone: 'bg-amber-500' },
  { label: 'Advanced Vision AI', tone: 'bg-emerald-500' },
  { label: 'Math and STEM Excellence', tone: 'bg-violet-500' },
  { label: 'Zero Wait Times', tone: 'bg-sky-500' },
];

export default function UpgradeModal({
  isOpen,
  onClose,
  upgradeMoment,
  upgradeUrl,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="oryx-modal-overlay">
      <div className="oryx-modal-backdrop" onClick={onClose} />
      
      <div className="oryx-modal-panel max-w-[380px] border-white/10 dark:bg-[#0a0c1b] overflow-hidden">
        {/* Vibrant Purple Header Section */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-[#6366f1]" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-md transition-all hover:bg-black/20"
        >
          <X size={18} />
        </button>

        <div className="relative pt-12 pb-8 px-8 flex flex-col items-center">
          {/* Logo / Icon Container */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-2xl ring-4 ring-white/20">
            <Sparkles size={40} className="text-[#6366f1]" />
          </div>

          <div className="text-center w-full">
            <h2 className="text-[28px] font-black tracking-tight text-white mb-2">
              {upgradeMoment.title || 'Payments are coming soon'}
            </h2>
            <p className="text-indigo-100/90 text-[14px] font-bold px-4 leading-snug mb-8">
              {upgradeMoment.message || 'Upgrade and billing actions currently open the web app holding page while checkout is being finished.'}
            </p>
            
            {/* Current Usage Bar */}
            {upgradeMoment.percent > 0 && upgradeMoment.level !== 'paywall' && (
              <div className="mb-8 px-2 w-full max-w-[300px] mx-auto">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200/60 mb-2">
                  <span>Current Usage</span>
                  <span>{Math.round(upgradeMoment.percent)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div 
                    className="h-full bg-white transition-all duration-1000" 
                    style={{ width: `${upgradeMoment.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Feature List Card */}
            <div className="mt-4 space-y-4 text-left bg-[#161927] p-7 rounded-[32px] border border-white/5 w-full">
              {FEATURES.map((feature) => (
                <div key={feature.label} className="flex items-center gap-4">
                  <span className={`h-2.5 w-2.5 rounded-full ${feature.tone} shadow-sm`} />
                  <span className="text-[14px] font-black text-slate-200">{feature.label}</span>
                </div>
              ))}
            </div>

            {/* Action Area */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={() => window.open(upgradeUrl, '_blank', 'noopener,noreferrer')}
                disabled={!upgradeUrl}
                className="group flex w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-4 text-[15px] font-black text-white shadow-xl shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100"
              >
                <span>Open billing page</span>
                <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
              </button>
              
              <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Billing is not live yet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
