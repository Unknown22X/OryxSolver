import { X, ChevronRight, Sparkles } from 'lucide-react';
import type { UpgradeMoment } from '../../types';

type UpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  upgradeMoment: UpgradeMoment;
  upgradeUrl: string;
};

const FEATURES = [
  { label: 'Unlimited Solutions', tone: 'bg-indigo-500' },
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
      
      <div className="oryx-modal-panel">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-600 to-violet-700" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-md transition-all hover:bg-black/20"
        >
          <X size={16} />
        </button>

        <div className="relative pt-12 pb-10 px-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl shadow-indigo-100 ring-4 ring-white/20">
            <Sparkles size={32} className="text-indigo-600" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">
              {upgradeMoment.title || 'Upgrade to Pro'}
            </h2>
            <p className="text-indigo-100/80 text-[13px] font-medium px-4 mb-8">
              {upgradeMoment.message || 'Unlock unlimited solutions and premium tools to excel in your studies.'}
            </p>
            
            {upgradeMoment.percent > 0 && upgradeMoment.level !== 'paywall' && (
              <div className="mb-10 px-6">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-200/60 mb-2">
                  <span>Current Usage</span>
                  <span>{Math.round(upgradeMoment.percent)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5">
                  <div 
                    className="h-full bg-white transition-all duration-1000" 
                    style={{ width: `${upgradeMoment.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-8 space-y-4 text-left bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-[24px] border border-slate-100 dark:border-white/5 mx-auto max-w-[280px]">
              {FEATURES.map((feature) => (
                <div key={feature.label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${feature.tone}`} />
                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{feature.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <button
                onClick={() => window.open(upgradeUrl, '_blank')}
                className="oryx-btn-primary w-full max-w-[240px] shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                <span>Get Pro Access</span>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Cancel anytime. Secure payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
