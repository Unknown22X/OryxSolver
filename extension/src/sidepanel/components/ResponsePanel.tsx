import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import AnswerHeroCard from './AnswerHeroCard';
import StepTimeline from './StepTimeline';
import RichText from './RichText';
import type { AiResponse } from '../types';

type ResponsePanelProps = {
  response: AiResponse | null;
  steps: string[];
};

export default function ResponsePanel({ response, steps }: ResponsePanelProps) {
  const [showRawReasoning, setShowRawReasoning] = useState(false);

  if (!response) {
    return (
      <div className="mt-8 relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-10 text-center shadow-xl backdrop-blur-2xl transition-all hover:shadow-2xl hover:scale-[1.01]">
        {/* Decorative Orbs */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" />
        
        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-indigo-500/10 via-indigo-500/20 to-violet-500/10 p-5 shadow-inner ring-1 ring-white/50">
            <Sparkles size={48} className="text-indigo-600 drop-shadow-[0_0_15px_rgba(79,70,229,0.3)] animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Start Solving</h2>
          <p className="mx-auto mt-3 max-w-[240px] text-sm font-medium leading-relaxed text-slate-500/90">
            Pick any question on your screen and get an instant, step-by-step solution.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl">
              Solve First Question
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="mt-4 space-y-4">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <AnswerHeroCard answer={response.answer} />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-white/70 bg-white/82 p-4 shadow-md backdrop-blur-lg duration-300 dark:border-slate-700 dark:bg-slate-900/92" style={{ animationDelay: '100ms' }}>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
          Why this is correct
        </p>
        {steps.length > 1 ? (
          <StepTimeline steps={steps} />
        ) : (
          <div className="rounded-xl border border-indigo-100 bg-white/95 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-950/70">
            <RichText content={response.explanation} />
          </div>
        )}

        {response.explanation && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowRawReasoning((v) => !v)}
              className="text-xs font-semibold text-indigo-700 transition hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
            >
              {showRawReasoning ? 'Hide full reasoning text' : 'Show full reasoning text'}
            </button>
            {showRawReasoning && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {response.explanation}
              </pre>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
