type StepTimelineProps = {
  steps: string[];
};

function parseStepContent(step: string) {
  const cleaned = step.replace(/\*\*/g, '').trim();
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
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const parsed = parseStepContent(step);
        return (
          <li key={`${index}-${step.slice(0, 24)}`} className="relative pl-12">
            {index < steps.length - 1 && (
              <span
                className="absolute left-[17px] top-10 h-[calc(100%-18px)] w-px bg-indigo-200/80"
                aria-hidden="true"
              />
            )}
            <div className="absolute left-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-700 shadow-sm">
              {index + 1}
            </div>
            <article className="rounded-xl border border-indigo-100/80 bg-white/92 px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-600">
                Step {index + 1}
              </p>
              {parsed.title ? (
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                  {parsed.title}
                </p>
              ) : null}
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">
                {parsed.body}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
