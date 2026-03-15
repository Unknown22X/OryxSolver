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
  onSend, onCaptureScreen, styleMode, onStyleModeChange, isSending, usage, onOpenUpgrade
}: HeroViewProps) {

  return (
    <div className="flex h-full w-full flex-col items-center justify-between pb-4 pt-8">
      <div className="w-full flex flex-col items-center gap-6 px-6">
        <p className="text-[14px] font-black uppercase tracking-[0.3em] text-slate-400/80 dark:text-slate-500">
          Try something like
        </p>

        <div className="flex flex-col items-center gap-3 w-full">
          {/* First row: large single item */}
          <button
            onClick={() => onSend({ text: EXAMPLE_PROMPTS[0].prompt, images: [], styleMode: EXAMPLE_PROMPTS[0].mode })}
            className="group flex w-full max-w-[320px] items-center gap-3 rounded-2xl border border-slate-200 bg-white/50 px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/50 active:scale-95 dark:border-white/5 dark:bg-white/5 dark:hover:border-indigo-500 dark:hover:bg-white/10 dark:hover:shadow-none"
          >
            <span className="text-xl">{EXAMPLE_PROMPTS[0].icon}</span>
            <span className="text-[15px] font-bold text-slate-700 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-300">
              {EXAMPLE_PROMPTS[0].label}
            </span>
          </button>

          {/* Second row: two items */}
          <div className="flex w-full max-w-[320px] gap-3">
            {[EXAMPLE_PROMPTS[1], EXAMPLE_PROMPTS[2]].map((item) => (
              <button
                key={item.label}
                onClick={() => onSend({ text: item.prompt, images: [], styleMode: item.mode })}
                className="group flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white/50 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/50 active:scale-95 dark:border-white/5 dark:bg-white/5 dark:hover:border-indigo-500 dark:hover:bg-white/10 dark:hover:shadow-none"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="truncate text-[13px] font-bold text-slate-700 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-300">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Subsequent rows: vertical stack */}
          {[EXAMPLE_PROMPTS[3], EXAMPLE_PROMPTS[4], EXAMPLE_PROMPTS[5]].map((item) => (
            <button
              key={item.label}
              onClick={() => onSend({ text: item.prompt, images: [], styleMode: item.mode })}
              className="group flex w-full max-w-[280px] items-center gap-3 rounded-2xl border border-slate-200 bg-white/50 px-5 py-3 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/50 active:scale-95 dark:border-white/5 dark:bg-white/5 dark:hover:border-indigo-500 dark:hover:bg-white/10 dark:hover:shadow-none"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[14px] font-bold text-slate-700 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full px-4">
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
