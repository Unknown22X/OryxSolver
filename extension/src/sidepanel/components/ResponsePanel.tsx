import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import AnswerHeroCard from './AnswerHeroCard';
import StepTimeline from './StepTimeline';
import type { AiResponse } from '../types';

type ResponsePanelProps = {
  response: AiResponse | null;
  steps: string[];
};

export default function ResponsePanel({ response, steps }: ResponsePanelProps) {
  const [showRawReasoning, setShowRawReasoning] = useState(false);

  if (!response) {
    return (
      <div className="mt-6 rounded-2xl border border-white/65 bg-white/74 p-6 text-center shadow-md backdrop-blur-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
          <Sparkles size={58} className="text-indigo-600" />
        </div>
        <p className="text-base font-semibold text-slate-800">Start solving with OryxSolver</p>
        <p className="mx-auto mt-2 max-w-[260px] text-sm text-slate-700">
          Pick a question on your page and get a step-by-step explanation in seconds.
        </p>
        <button className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700">
          Solve your first question
        </button>
      </div>
    );
  }

  return (
    <article className="mt-4 space-y-4">
      <AnswerHeroCard answer={response.answer} />
      <div className="rounded-2xl border border-white/70 bg-white/82 p-4 shadow-md backdrop-blur-lg">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          Why this is correct
        </p>
        {steps.length > 1 ? (
          <StepTimeline steps={steps} />
        ) : (
          <p className="rounded-xl border border-indigo-100 bg-white/95 px-3 py-2.5 text-sm leading-6 text-slate-800">
            {response.explanation}
          </p>
        )}

        {response.explanation && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowRawReasoning((v) => !v)}
              className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-800"
            >
              {showRawReasoning ? 'Hide full reasoning text' : 'Show full reasoning text'}
            </button>
            {showRawReasoning && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                {response.explanation}
              </pre>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
