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
  { icon: '📐', label: 'Solve 3x² - 12x + 9 = 0', prompt: 'Solve for x: 3x^2 - 12x + 9 = 0', mode: 'standard' as StyleMode },
  { icon: '🧬', label: 'Explain photosynthesis', prompt: 'Explain the process of photosynthesis step by step', mode: 'step_by_step' as StyleMode },
  { icon: '🤔', label: 'ELI5: Gravity', prompt: 'Explain gravity like I\'m 5 years old', mode: 'eli5' as StyleMode },
  { icon: '💬', label: 'Gen Alpha: French Revolution', prompt: 'Explain the French Revolution in Gen Alpha terms', mode: 'gen_alpha' as StyleMode },
  { icon: '📄', label: 'Quiz me on Biology', prompt: 'Give me 5 practice quiz questions on cell biology', mode: 'exam' as StyleMode },
  { icon: '📖', label: 'Summarize Pride & Prejudice', prompt: 'Summarize the main themes of Pride and Prejudice', mode: 'standard' as StyleMode },
];

export default function HeroView({
  logoUrl, onSend, onCaptureScreen, styleMode, onStyleModeChange, isSending, usage, onOpenUpgrade
}: HeroViewProps) {

  const isPro = usage?.subscriptionTier === 'pro';
  const remainingCredits = Math.max((usage?.totalCredits || 50) - (usage?.usedCredits || 0), 0);
  const creditUsagePercent = usage?.totalCredits > 0 ? (usage.usedCredits / usage.totalCredits) * 100 : 0;

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto custom-scrollbar pb-4 pt-4">
      {/* Brand Section */}
      <div className="flex flex-col items-center text-center px-6 mb-4">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/10 p-2 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl">
          <img src={logoUrl} alt="Oryx" className="h-full w-full object-contain" />
        </div>
        
        <h2 className="text-[32px] font-black tracking-tighter text-white leading-[1] mb-2 drop-shadow-sm">
          Snap<span className="text-[#818cf8]">.</span> Solve<span className="text-[#818cf8]">.</span> Learn<span className="text-[#818cf8]">.</span>
        </h2>
        
        <p className="max-w-[280px] text-[13px] font-bold text-white leading-snug drop-shadow-sm">
          Screenshot any problem on your screen and get instant solutions with AI.
        </p>
      </div>

      {/* Usage Card (Only if not Pro) */}
      {!isPro && (
        <div className="w-full max-w-[340px] px-4 mb-6">
          <div className="rounded-[24px] border border-white/10 bg-[#161927] p-5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Monthly Usage</p>
                <p className="text-xl font-black text-white leading-none">
                  {remainingCredits} <span className="text-sm font-bold text-white">left</span>
                </p>
              </div>
              <button
                onClick={onOpenUpgrade}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Go Pro
              </button>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 mb-4">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000" 
                style={{ width: `${100 - creditUsagePercent}%` }}
              />
              </div>


            <p className="text-center text-[10px] font-bold text-slate-400">
              Upgrade to Pro for unlimited solutions and priority AI.
            </p>
          </div>
        </div>
      )}


      {/* Example Prompts Section */}
      <div className="w-full flex flex-col items-center gap-4 px-6 mb-6">
        <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">
          Try something like
        </p>

        <div className="flex flex-col items-center gap-3 w-full">
          {/* Vertical Stack exactly like image */}
          <button
            onClick={() => onSend({ text: EXAMPLE_PROMPTS[0].prompt, images: [], styleMode: EXAMPLE_PROMPTS[0].mode })}
            className="group flex w-full max-w-[320px] items-center gap-3 rounded-2xl border border-white/10 bg-[#161927] px-5 py-4 transition-all hover:border-blue-500/50 hover:bg-[#1c2033] active:scale-95"
          >
            <span className="text-xl">{EXAMPLE_PROMPTS[0].icon}</span>
            <span className="text-[15px] font-bold text-white group-hover:text-indigo-300">
              {EXAMPLE_PROMPTS[0].label}
            </span>
          </button>

          <div className="flex w-full max-w-[320px] gap-3">
            <button
              onClick={() => onSend({ text: EXAMPLE_PROMPTS[1].prompt, images: [], styleMode: EXAMPLE_PROMPTS[1].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-[#161927] px-4 py-3.5 transition-all hover:border-blue-500/50 hover:bg-[#1c2033] active:scale-95"
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[1].icon}</span>
              <span className="truncate text-[13px] font-bold text-white group-hover:text-indigo-300">
                {EXAMPLE_PROMPTS[1].label}
              </span>
            </button>
            <button
              onClick={() => onSend({ text: EXAMPLE_PROMPTS[2].prompt, images: [], styleMode: EXAMPLE_PROMPTS[2].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-[#161927] px-4 py-3.5 transition-all hover:border-blue-500/50 hover:bg-[#1c2033] active:scale-95"
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[2].icon}</span>
              <span className="truncate text-[13px] font-bold text-white group-hover:text-indigo-300">
                {EXAMPLE_PROMPTS[2].label}
              </span>
            </button>
          </div>

          {[EXAMPLE_PROMPTS[3], EXAMPLE_PROMPTS[4], EXAMPLE_PROMPTS[5]].map((item) => (
            <button
              key={item.label}
              onClick={() => onSend({ text: item.prompt, images: [], styleMode: item.mode })}
              className="group flex w-full max-w-[280px] items-center gap-3 rounded-2xl border border-white/10 bg-[#161927] px-5 py-3 transition-all hover:border-blue-500/50 hover:bg-[#1c2033] active:scale-95"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[14px] font-bold text-white group-hover:text-indigo-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Message Composer (Bottom Fixed-like) */}
      <div className="w-full px-4 mt-auto">
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
