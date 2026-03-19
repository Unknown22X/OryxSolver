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
  { icon: '\u{1F9EE}', label: 'Solve 3x^2 - 12x + 9 = 0', prompt: 'Solve for x: 3x^2 - 12x + 9 = 0', mode: 'standard' as StyleMode },
  { icon: '\u{1F33F}', label: 'Explain photosynthesis', prompt: 'Explain the process of photosynthesis step by step', mode: 'step_by_step' as StyleMode },
  { icon: '\u{1F30D}', label: 'ELI5: Gravity', prompt: "Explain gravity like I'm 5 years old", mode: 'eli5' as StyleMode },
  { icon: '\u{1F570}\u{FE0F}', label: 'Gen Alpha: French Revolution', prompt: 'Explain the French Revolution in Gen Alpha terms', mode: 'gen_alpha' as StyleMode },
  { icon: '\u{1F9EC}', label: 'Quiz me on Biology', prompt: 'Give me 5 practice quiz questions on cell biology', mode: 'exam' as StyleMode },
  { icon: '\u{1F4DA}', label: 'Summarize Pride and Prejudice', prompt: 'Summarize the main themes of Pride and Prejudice', mode: 'standard' as StyleMode },
];

export default function HeroView({
  logoUrl, onSend, onCaptureScreen, styleMode, onStyleModeChange, isSending, usage, onOpenUpgrade
}: HeroViewProps) {
  const isPro = usage?.subscriptionTier !== 'free';
  const remainingQuestions = usage?.monthlyQuestionsLimit === -1 ? -1 : Math.max((usage?.monthlyQuestionsLimit || 0) - (usage?.monthlyQuestionsUsed || 0), 0);
  const questionUsagePercent = usage?.monthlyQuestionsLimit > 0 ? (usage.monthlyQuestionsUsed / usage.monthlyQuestionsLimit) * 100 : 0;
  const disabledModes: StyleMode[] = usage?.subscriptionTier === 'free' ? ['gen_alpha', 'step_by_step'] : [];

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto custom-scrollbar pb-4 pt-4">
      <div className="mb-4 flex flex-col items-center px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/90 p-2 shadow-[0_18px_50px_-20px_rgba(99,102,241,0.55)] ring-1 ring-indigo-100 backdrop-blur-xl dark:bg-white/10 dark:ring-white/20 dark:shadow-2xl">
          <img src={logoUrl} alt="Oryx" className="h-full w-full object-contain" />
        </div>

        <h2 className="mb-2 text-[32px] font-black leading-[1] tracking-tighter text-slate-900 drop-shadow-sm dark:text-white">
          Snap<span className="text-[#818cf8]">.</span> Solve<span className="text-[#818cf8]">.</span> Learn<span className="text-[#818cf8]">.</span>
        </h2>

        <p className="max-w-[280px] text-[13px] font-bold leading-snug text-slate-500 dark:text-slate-200">
          Screenshot any problem on your screen and get instant solutions with AI.
        </p>
      </div>

      {!isPro && (
        <div className="mb-6 w-full max-w-[340px] px-4">
          <div className="oryx-shell-panel rounded-[24px] border p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plan allowance</p>
                <p className="text-xl font-black leading-none text-slate-900 dark:text-white">
                  {remainingQuestions === -1 ? 'High limit' : remainingQuestions}{' '}
                  <span className="text-sm font-bold text-slate-700 dark:text-white">left</span>
                </p>
              </div>
              <button
                onClick={onOpenUpgrade}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Upgrade
              </button>
            </div>

            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000"
                style={{ width: `${100 - questionUsagePercent}%` }}
              />
            </div>

            <p className="text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Monthly questions and extra credits are tracked separately.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex w-full flex-col items-center gap-4 px-6">
        <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">
          Try something like
        </p>

        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={() => onSend({ text: EXAMPLE_PROMPTS[0].prompt, images: [], styleMode: EXAMPLE_PROMPTS[0].mode })}
            className="group flex w-full max-w-[320px] items-center gap-3 rounded-2xl border px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
            style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
          >
            <span className="text-xl">{EXAMPLE_PROMPTS[0].icon}</span>
            <span className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
              {EXAMPLE_PROMPTS[0].label}
            </span>
          </button>

          <div className="flex w-full max-w-[320px] gap-3">
            <button
              onClick={() => onSend({ text: EXAMPLE_PROMPTS[1].prompt, images: [], styleMode: EXAMPLE_PROMPTS[1].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[1].icon}</span>
              <span className="truncate text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {EXAMPLE_PROMPTS[1].label}
              </span>
            </button>
            <button
              onClick={() => onSend({ text: EXAMPLE_PROMPTS[2].prompt, images: [], styleMode: EXAMPLE_PROMPTS[2].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[2].icon}</span>
              <span className="truncate text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {EXAMPLE_PROMPTS[2].label}
              </span>
            </button>
          </div>

          {[EXAMPLE_PROMPTS[3], EXAMPLE_PROMPTS[4], EXAMPLE_PROMPTS[5]].map((item) => (
            <button
              key={item.label}
              onClick={() => onSend({ text: item.prompt, images: [], styleMode: item.mode })}
              className="group flex w-full max-w-[280px] items-center gap-3 rounded-2xl border px-5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto w-full px-4">
        <MessageComposer
          onSend={onSend}
          onCaptureScreen={onCaptureScreen}
          styleMode={styleMode}
          onStyleModeChange={onStyleModeChange}
          isHero={true}
          isSending={isSending}
          disabledModes={disabledModes}
        />
      </div>
    </div>
  );
}
