import { useTranslation } from 'react-i18next';
import MessageComposer from './MessageComposer';
import type { StyleMode, UsageSnapshot } from '../types';
import { getPlanUsageMetric } from '../utils/usagePresentation';

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
  { icon: '\u{1F9EE}', labelKey: 'composer.examples.math_label', promptKey: 'composer.examples.math_prompt', mode: 'standard' as StyleMode },
  { icon: '\u{1F33F}', labelKey: 'composer.examples.science_label', promptKey: 'composer.examples.science_prompt', mode: 'step_by_step' as StyleMode },
  { icon: '\u{1F30D}', labelKey: 'composer.examples.eli5_label', promptKey: 'composer.examples.eli5_prompt', mode: 'eli5' as StyleMode },
  { icon: '\u{1F570}\u{FE0F}', labelKey: 'composer.examples.history_label', promptKey: 'composer.examples.history_prompt', mode: 'gen_alpha' as StyleMode },
  { icon: '\u{1F9EC}', labelKey: 'composer.examples.quiz_label', promptKey: 'composer.examples.quiz_prompt', mode: 'exam' as StyleMode },
  { icon: '\u{1F4DA}', labelKey: 'composer.examples.english_label', promptKey: 'composer.examples.english_prompt', mode: 'standard' as StyleMode },
];

export default function HeroView({
  logoUrl, onSend, onCaptureScreen, styleMode, onStyleModeChange, isSending, usage, onOpenUpgrade
}: HeroViewProps) {
  const { t } = useTranslation();
  const isPro = usage?.subscriptionTier !== 'free';
  const planMetric = getPlanUsageMetric(
    usage?.monthlyQuestionsUsed ?? 0,
    usage?.monthlyQuestionsLimit ?? 0,
    (percent) => t('common.percent_used', { percent, defaultValue: `${percent}% used` }),
  );
  const disabledModes: StyleMode[] = usage?.subscriptionTier === 'free' ? ['gen_alpha', 'step_by_step'] : [];

  return (
    <div className="flex h-full w-full flex-col items-center overflow-y-auto custom-scrollbar pb-4 pt-4">
      <div className="mb-4 flex flex-col items-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24.3%] bg-[#4338ca] transition-all animate-float isolate">
          <img src={logoUrl} alt="Oryx" className="oryx-logo-clean h-full w-full" />
        </div>

        <h2 className="mb-2 text-[32px] font-black leading-[1] tracking-tighter text-slate-900 drop-shadow-sm dark:text-white">
          {t('hero.snap_solve_learn')}
        </h2>

        <p className="max-w-[280px] text-[13px] font-bold leading-snug text-slate-500 dark:text-slate-200">
          {t('hero.subtitle')}
        </p>
      </div>

      {!isPro && (
        <div className="mb-6 w-full max-w-[340px] px-4">
          <div className="oryx-shell-panel rounded-[24px] border p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('hero.plan_allowance')}</p>
                <p className="text-xl font-black leading-none text-slate-900 dark:text-white">
                  {planMetric.isUnlimited ? t('header.high_limit') : planMetric.percentLabel}
                </p>
              </div>
              <button
                onClick={onOpenUpgrade}
                className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              >
                {t('header.upgrade')}
              </button>
            </div>

            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000"
                style={{ width: planMetric.progressWidth }}
              />
            </div>

            <p className="text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {t('hero.plan_usage_caption')}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex w-full flex-col items-center gap-4 px-6">
        <p className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">
          {t('response.suggestions')}
        </p>

        <div className="flex w-full flex-col items-center gap-3">
          <button
            onClick={() => onSend({ text: t(EXAMPLE_PROMPTS[0].promptKey), images: [], styleMode: EXAMPLE_PROMPTS[0].mode })}
            className="group flex w-full max-w-[320px] items-center gap-3 rounded-2xl border px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
            style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
          >
            <span className="text-xl">{EXAMPLE_PROMPTS[0].icon}</span>
            <span className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
              {t(EXAMPLE_PROMPTS[0].labelKey)}
            </span>
          </button>

          <div className="flex w-full max-w-[320px] gap-3">
            <button
              onClick={() => onSend({ text: t(EXAMPLE_PROMPTS[1].promptKey), images: [], styleMode: EXAMPLE_PROMPTS[1].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[1].icon}</span>
              <span className="truncate text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {t(EXAMPLE_PROMPTS[1].labelKey)}
              </span>
            </button>
            <button
              onClick={() => onSend({ text: t(EXAMPLE_PROMPTS[2].promptKey), images: [], styleMode: EXAMPLE_PROMPTS[2].mode })}
              className="group flex flex-1 items-center gap-2 rounded-2xl border px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{EXAMPLE_PROMPTS[2].icon}</span>
              <span className="truncate text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {t(EXAMPLE_PROMPTS[2].labelKey)}
              </span>
            </button>
          </div>

          {[EXAMPLE_PROMPTS[3], EXAMPLE_PROMPTS[4], EXAMPLE_PROMPTS[5]].map((item) => (
            <button
              key={item.labelKey}
              onClick={() => onSend({ text: t(item.promptKey), images: [], styleMode: item.mode })}
              className="group flex w-full max-w-[280px] items-center gap-3 rounded-2xl border px-5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 active:scale-95 dark:shadow-none dark:hover:border-blue-500/50"
              style={{ backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto w-full px-4">
        <MessageComposer
          onSend={onSend}
          onCaptureScreen={onCaptureScreen}
          styleMode={styleMode}
          onStyleModeChange={onStyleModeChange}
          isHero={true}
          isSending={isSending}
          disabledModes={disabledModes}
        />
      </div>
    </div>
  );
}
