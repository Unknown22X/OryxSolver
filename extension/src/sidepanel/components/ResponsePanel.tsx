import { Sparkles, Lightbulb, ListOrdered } from 'lucide-react';
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

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[*`]/g, '').trim().toLowerCase();
}

function getResponsePresentation(answer: string, steps: string[], explanation: string) {
  const cleanAnswer = answer.trim();
  const combined = `${cleanAnswer}\n${explanation}`.toLowerCase();
  const looksLikeChoice =
    /^(option\s+)?[a-d](?:[).:]\s*|\s*$)/i.test(cleanAnswer) ||
    /^choice\s+[a-d]\b/i.test(cleanAnswer);
  const shortSingleBlock = cleanAnswer.length > 0 && cleanAnswer.length <= 90 && !cleanAnswer.includes('\n');

  if (steps.length > 0) {
    return {
      title: looksLikeChoice ? 'Selected answer' : 'Answer',
      subtitle: looksLikeChoice ? 'Chosen result' : 'Main result',
      explanationLabel: 'Why this works',
    };
  }

  if (/(example|practice|quiz|flash[\s-]?card)/i.test(combined)) {
    return {
      title: 'Example',
      subtitle: 'Practice-style response',
      explanationLabel: 'How to use it',
    };
  }

  if (shortSingleBlock) {
    return {
      title: 'Quick answer',
      subtitle: 'Direct response',
      explanationLabel: 'More context',
    };
  }

  return {
    title: 'Response',
    subtitle: 'Main response',
    explanationLabel: 'More context',
  };
}

export default function ResponsePanel({ response, onQuoteStep }: ResponsePanelProps) {
  const isBulk = response?.answer === 'Answer Key';
  const parsedSteps =
    response && (response.steps?.length ?? 0) === 0
      ? parseExplanationSteps(response.explanation, isBulk)
      : [];
  const steps: string[] = response
    ? ((response.steps?.length ?? 0) > 0 ? response.steps! : parsedSteps)
    : [];
  const answerText = response?.answer?.trim() ?? '';
  const explanationText = response?.explanation?.trim() ?? '';
  const normalizedSteps = normalizeComparableText(steps.map((step) => step.trim()).filter(Boolean).join('\n'));
  const showExplanation =
    explanationText.length > 0 &&
    normalizeComparableText(explanationText) !== normalizeComparableText(answerText) &&
    normalizeComparableText(explanationText) !== normalizedSteps;
  const presentation = getResponsePresentation(answerText, steps, explanationText);

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
        <AnswerHeroCard answer={response.answer} title={presentation.title} subtitle={presentation.subtitle} />
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-[32px] border border-white/70 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/40" style={{ animationDelay: '100ms' }}>
        {steps.length > 0 ? (
          <section className="rounded-[28px] border border-slate-200/70 bg-white/70 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/30">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <ListOrdered size={16} className="text-indigo-500 dark:text-indigo-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isBulk ? 'Answer key' : 'Steps'}
              </p>
            </div>
            <StepTimeline steps={steps} isBulk={isBulk} onQuoteStep={onQuoteStep} />
          </section>
        ) : explanationText ? (
          <section className="rounded-[28px] border border-slate-200/70 bg-white/70 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/30">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Lightbulb size={16} className="text-indigo-500 dark:text-indigo-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Explanation</p>
            </div>
            <RichText content={response.explanation} className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200" />
          </section>
        ) : null}

        {showExplanation && (
          <section className="rounded-[28px] border border-indigo-100/80 bg-indigo-50/60 p-5 dark:border-indigo-500/20 dark:bg-indigo-950/20">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-indigo-500 dark:text-indigo-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">{presentation.explanationLabel}</p>
            </div>
            <RichText content={response.explanation} className="text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200" />
          </section>
        )}
      </div>
    </article>
  );
}
