import { X, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import type { UpgradeMoment } from '../../types';

type UpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  upgradeMoment: UpgradeMoment;
  upgradeUrl: string;
};

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
            <h2 className="text-2xl font-black tracking-tight text-white mb-8">
              {upgradeMoment.title || 'Upgrade to Pro'}
            </h2>
            
            <div className="mt-12 space-y-4 text-left">
              {[
                'Unlimited step-by-step solutions',
                'Higher image upload limits',
                'Priority AI processing',
                'Advanced subject coverage (STEM)',
                'No wait times'
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <button
                onClick={() => window.open(upgradeUrl, '_blank')}
                className="oryx-btn-primary"
              >
                <span>Upgrade Now</span>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <p className="mt-4 oryx-caption">Starts at just $4.99/mo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
