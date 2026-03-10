import RichText from './RichText';

type StepTimelineProps = {
  steps: string[];
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

export default function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <div className="relative space-y-8 pl-4 pr-1 pb-2">
      {/* Vertical Timeline Line */}
      <div className="absolute left-6 top-5 bottom-8 w-[2px] bg-gradient-to-b from-indigo-200 via-indigo-200 to-transparent opacity-50 dark:from-indigo-400/70 dark:via-indigo-500/45" />

      {steps.map((step, index) => {
        const parsed = parseStepContent(step);
        return (
          <div
            key={`${index}-${step.slice(0, 24)}`}
            className="relative pl-10 group animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${160 + index * 90}ms` }}
          >
            {/* Step Number Badge */}
            <div className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-indigo-100 bg-white text-[13px] font-black text-indigo-600 shadow-sm transition-all group-hover:scale-110 group-hover:border-indigo-500 group-hover:bg-indigo-600 group-hover:text-white dark:border-slate-500 dark:bg-slate-900 dark:text-indigo-200">
              {index + 1}
            </div>

            <article className="relative rounded-2xl border border-white/60 bg-white/40 p-5 shadow-xl shadow-slate-200/20 backdrop-blur-md transition-all group-hover:-translate-y-1 group-hover:bg-white group-hover:shadow-2xl group-hover:shadow-indigo-100 dark:border-slate-600 dark:bg-slate-900/96 dark:shadow-none dark:group-hover:bg-slate-900">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/70 dark:text-indigo-300/80">Step {index + 1}</span>
                {parsed.title && (
                  <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-500" />
                )}
                {parsed.title && (
                   <h3 className="text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100">{parsed.title}</h3>
                )}
              </div>
              
              <div className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                <RichText content={parsed.body} />
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
