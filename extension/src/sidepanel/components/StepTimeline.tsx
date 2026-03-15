import { MessageSquare, Check } from 'lucide-react';
import RichText from './RichText';

type StepTimelineProps = {
  steps: string[];
  isBulk?: boolean;
  onQuoteStep?: (stepBody: string, stepIndex: number) => void;
};

function parseStepContent(step: string) {
  const cleaned = step.trim();
  const colonIndex = cleaned.indexOf(':');
  if (colonIndex > 0 && colonIndex < 72) {
    const title = cleaned.slice(0, colonIndex).trim();
    const body = cleaned.slice(colonIndex + 1).trim();
    if (body.length > 0) return { title, body };
  }
  return { title: '', body: cleaned };
}

export default function StepTimeline({ steps, isBulk, onQuoteStep }: StepTimelineProps) {
  return (
    <div className="relative space-y-6 pl-4 pr-1 pb-4">
      <div className="absolute left-6 top-6 bottom-8 w-[2px] bg-slate-100 dark:bg-slate-800" />
      <div 
        className="absolute left-6 top-6 bottom-8 w-[2px] bg-gradient-to-b from-indigo-500 via-indigo-400 to-transparent dark:from-indigo-500 dark:via-indigo-400 dark:to-transparent transition-all duration-700" 
      />

      {steps.map((step, index) => {
        const parsed = parseStepContent(step);
        const isLast = index === steps.length - 1;
        const isCompleted = !isBulk && !isLast;
        const isCurrent = !isBulk && isLast;

        const badgeClass = isCurrent
          ? 'border-indigo-500 bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] dark:shadow-none scale-110'
          : isCompleted
            ? 'border-emerald-400 bg-emerald-500 text-white shadow-md shadow-emerald-100 dark:border-emerald-600 dark:shadow-none'
            : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500';

        return (
          <div
            key={`${index}-${step.slice(0, 24)}`}
            className="relative pl-10 animate-in fade-in slide-in-from-left-2 duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`absolute left-0 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-all duration-500 ${badgeClass}`}>
              {isCompleted ? (
                <Check size={14} strokeWidth={3} />
              ) : (
                <span className="text-[13px] font-black">{index + 1}</span>
              )}
            </div>

            <article className={`relative rounded-3xl border p-5 transition-all duration-500 ${
              isCurrent 
                ? 'border-indigo-100 bg-white shadow-[0_20px_40px_-12px_rgba(79,70,229,0.1)] dark:border-indigo-500/30 dark:bg-slate-900/60 dark:shadow-none' 
                : 'border-slate-100 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-900/20'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                  isCurrent ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                }`}>{isBulk ? `Question ${index + 1}` : `Step ${index + 1}`}</span>
                {!isBulk && (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    isCurrent ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}>
                    {isCurrent ? 'Current' : 'Completed'}
                  </span>
                )}
                {parsed.title && (
                   <h3 className={`text-xs font-black tracking-tight ${isCurrent ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{parsed.title}</h3>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => onQuoteStep?.(parsed.body, index)}
                  className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition-all hover:scale-110 active:scale-95 ${isCurrent ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
                  title="Ask about this step"
                >
                  <MessageSquare size={12} />
                  <span>Ask</span>
                </button>
              </div>
              
              <div className={`text-[14.5px] font-medium leading-relaxed transition-colors duration-500 ${
                isCurrent ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
              }`}>
                <RichText content={parsed.body} />
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
