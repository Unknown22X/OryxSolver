import MessageComposer from './MessageComposer';
import type { StyleMode, UsageSnapshot } from '../types';

type HeroViewProps = {
  logoUrl: string;
  onSend: (payload: { text: string; images: File[]; styleMode: StyleMode }) => void;
  onCaptureScreen: () => Promise<File | null>;
  styleMode: StyleMode;
  onStyleModeChange: (mode: StyleMode) => void;
  isSending: boolean;
  usage: UsageSnapshot;
  onOpenUpgrade: () => void;
};

const EXAMPLE_PROMPTS = [
  { label: '📐 Solve 3x² - 12x + 9 = 0', prompt: 'Solve for x: 3x² - 12x + 9 = 0', mode: 'standard' as StyleMode },
  { label: '🧬 Explain photosynthesis', prompt: 'Explain the process of photosynthesis step by step', mode: 'step_by_step' as StyleMode },
  { label: '🧒 ELI5: Gravity', prompt: 'Explain gravity like I\'m 5 years old', mode: 'eli5' as StyleMode },
  { label: '💬 Gen Alpha: French Revolution', prompt: 'Explain the French Revolution in Gen Alpha terms', mode: 'gen_alpha' as StyleMode },
  { label: '📝 Quiz me on Biology', prompt: 'Give me 5 practice quiz questions on cell biology', mode: 'exam' as StyleMode },
  { label: '📖 Summarize Pride & Prejudice', prompt: 'Summarize the main themes of Pride and Prejudice', mode: 'standard' as StyleMode },
];

export default function HeroView({
  logoUrl, onSend, onCaptureScreen, styleMode, onStyleModeChange, isSending, usage, onOpenUpgrade
}: HeroViewProps) {

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-4 pt-8">
      <div className="px-6 text-center flex flex-1 flex-col items-center justify-center">
        {/* ─── Logo ─── */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-elevated ring-1 ring-slate-100 transition-transform duration-500 hover:rotate-6 hover:scale-110 dark:bg-slate-800 dark:shadow-none dark:ring-slate-700">
          <img src={logoUrl} alt="OryxSolver" className="h-12 w-12 object-cover" />
        </div>

        {/* ─── Headline & Upgrade ─── */}
        <div className="mb-12 space-y-4 relative">
          {!usage.subscriptionTier || usage.subscriptionTier === 'free' ? (
            <button
              onClick={onOpenUpgrade}
              className="absolute -top-16 right-0 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 shadow-sm transition-all hover:scale-105 hover:shadow-md dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/40 dark:text-amber-400"
            >
              🌟 Upgrade to Pro
            </button>
          ) : null}
          <h2 className="text-[48px] font-black tracking-tighter text-slate-900 dark:text-slate-50 leading-[0.9]">
            Snap<span className="text-indigo-600">.</span> Solve<span className="text-indigo-600">.</span> Learn<span className="text-indigo-600">.</span>
          </h2>
          <p className="mx-auto max-w-[360px] text-[15px] font-bold text-slate-500/80 dark:text-slate-400 leading-relaxed">
            Screenshot any problem on your screen and get instant, step-by-step solutions with AI.
          </p>
        </div>

        {/* ─── Trust Ticker ─── */}
        <div className="mb-10 flex items-center justify-center gap-8 rounded-full bg-slate-100/50 border border-slate-200/30 px-6 py-4 backdrop-blur-md dark:bg-white/[0.03] dark:border-white/[0.05]">
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[18px] font-black tracking-tighter text-slate-900 dark:text-white leading-none">2,400+</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Solved Today</p>
          </div>
          <div className="h-8 w-px bg-slate-200/60 dark:bg-slate-800" />
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-[18px] font-black tracking-tighter text-slate-900 dark:text-white leading-none">99.8%</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Accuracy</p>
          </div>
        </div>

        {/* ─── Try These ─── */}
        <div className="mb-12 w-full">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Try something like</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {EXAMPLE_PROMPTS.map((item) => (
              <button
                key={item.label}
                onClick={() => onSend({ text: item.prompt, images: [], styleMode: item.mode })}
                className="group rounded-xl border border-slate-200 bg-white px-4 py-2.5 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500 dark:hover:shadow-none"
              >
                <span className="text-[13px] font-bold text-slate-700 group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-400 transition-colors">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ─── Composer ─── */}
      <div className="w-full px-6 mt-8">
        <MessageComposer
          onSend={onSend}
          onCaptureScreen={onCaptureScreen}
          styleMode={styleMode}
          onStyleModeChange={onStyleModeChange}
          isHero={true}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
