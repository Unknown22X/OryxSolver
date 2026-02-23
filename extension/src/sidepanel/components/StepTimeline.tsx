type StepTimelineProps = {
  steps: string[];
};

export default function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={`${index}-${step.slice(0, 24)}`} className="relative pl-10">
          {index < steps.length - 1 && (
            <span
              className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-slate-200"
              aria-hidden="true"
            />
          )}
          <span className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-indigo-600">
            {index + 1}
          </span>
          <p className="pt-1 text-sm leading-6 text-slate-800">{step}</p>
        </li>
      ))}
    </ol>
  );
}
