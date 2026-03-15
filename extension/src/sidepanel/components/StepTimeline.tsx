import { MessageSquare } from 'lucide-react';
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
    <div className="relative space-y-8 pl-4 pr-1 pb-2">
      {/* Vertical Timeline Line */}
      <div className="absolute left-6 top-5 bottom-8 w-[2px] bg-indigo-50 dark:bg-slate-800" />
      <div 
        className="absolute left-6 top-5 w-[2px] bg-indigo-500 dark:bg-indigo-400" 
        style={{ height: 'calc(100% - 40px)' }}
      />

      {steps.map((step, index) => {
        const parsed = parseStepContent(step);
        const isCurrent = index === steps.length - 1; // Highlight the last step slightly differently

        return (
          <div
            key={`${index}-${step.slice(0, 24)}`}
            className="relative pl-10"
          >
            {/* Step Number Badge */}
            <div className={`absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-xl border-2 ${isCurrent ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'border-emerald-400 bg-emerald-500 text-white shadow-md shadow-emerald-100 dark:border-emerald-600 dark:shadow-none'}`}>
              <span className="text-[13px] font-black">{index + 1}</span>
            </div>

            <article className={`relative rounded-2xl border p-5 ${isCurrent ? 'border-indigo-100 bg-white shadow-xl shadow-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900/40 dark:shadow-none' : 'border-emerald-100/50 bg-white/80 dark:border-emerald-900/20 dark:bg-emerald-900/5'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-indigo-500 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isBulk ? `Question ${index + 1}` : `Step ${index + 1}`}</span>
                {parsed.title && (
                   <h3 className={`text-xs font-bold tracking-tight ${isCurrent ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}>{parsed.title}</h3>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => onQuoteStep?.(parsed.body, index)}
                  className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${isCurrent ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 dark:bg-slate-800/50'}`}
                  title="Ask about this step"
                >
                  <MessageSquare size={12} />
                  <span>Ask</span>
                </button>
              </div>

              <div className={`text-sm font-medium leading-relaxed transition-colors duration-500 ${isCurrent ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                <RichText content={parsed.body} />
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
