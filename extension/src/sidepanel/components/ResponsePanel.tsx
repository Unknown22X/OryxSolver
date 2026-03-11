import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import AnswerHeroCard from './AnswerHeroCard';
import StepTimeline from './StepTimeline';
import RichText from './RichText';
import { parseExplanationSteps } from '../utils/parseExplanationSteps';
import type { AiResponse } from '../types';

type ResponsePanelProps = {
  response: AiResponse | null;
  onQuoteStep?: (step: string, index: number) => void;
  onOpenUpgrade?: () => void;
  isPro?: boolean;
  isLatest?: boolean;
  onSuggestionClick?: (s: any) => void;
};

export default function ResponsePanel({ response, onQuoteStep }: ResponsePanelProps) {
  const [showRawReasoning, setShowRawReasoning] = useState(false);
  const steps = response ? parseExplanationSteps(response.explanation) : [];

  if (!response) {
    return (
      <div className="mt-8 relative overflow-hidden rounded-[2.5rem] border border-white/40 bg-white/60 p-10 text-center shadow-xl backdrop-blur-2xl transition-all hover:shadow-2xl">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="relative z-10">
          <Sparkles size={48} className="mx-auto text-indigo-600 mb-6" />
          <h2 className="text-2xl font-bold text-slate-900">Start Solving</h2>
          <p className="mt-3 text-sm text-slate-500">Pick any question on your screen to get an instant solution.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="mt-4 space-y-4">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <AnswerHeroCard answer={response.answer} />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 rounded-[32px] border border-white/70 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:bg-slate-800/40 dark:border-slate-700/50" style={{ animationDelay: '100ms' }}>
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step-by-step reasoning</p>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 dark:bg-emerald-900/20">
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Verified Solution</span>
          </div>
        </div>
        
        {steps.length > 0 ? (
          <StepTimeline steps={steps} onQuoteStep={onQuoteStep} />
        ) : (
          <div className="rounded-2xl border border-indigo-50 bg-white/60 p-4 shadow-inner dark:border-slate-800 dark:bg-slate-900/40">
             <RichText content={response.explanation} className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200" />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowRawReasoning((v) => !v)}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition dark:text-indigo-400"
          >
            {showRawReasoning ? 'Hide reasoning' : 'Show reasoning log'}
          </button>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
             <Sparkles size={12} className="text-indigo-300" />
             <span>AI Accuracy Checked</span>
          </div>
        </div>

        {showRawReasoning && (
          <div className="mt-4 rounded-2xl bg-slate-900 p-4 animate-in slide-in-from-top-2">
            <pre className="text-[11px] font-mono text-indigo-200 whitespace-pre-wrap">{response.explanation}</pre>
          </div>
        )}
      </div>
    </article>
  );
}
