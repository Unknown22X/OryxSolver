import { Link } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Shield,
  Lightbulb,
  Calculator,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Zap,
  FileText,
} from 'lucide-react';

export default function ModesPage() {
  const { t } = useTranslation();

  const MODES = [
    {
      name: t('modes_page.mode_standard_name', { defaultValue: 'Standard' }),
      icon: <Zap className="w-5 h-5" />,
      accent: 'from-amber-500/20 to-orange-500/20 text-amber-200',
      summary: t('modes_page.mode_standard_summary', { defaultValue: 'Balanced clarity and speed for most questions.' }),
      bestFor: t('modes_page.mode_standard_best', { defaultValue: 'Homework checks,Quick understanding,Daily study' }).split(','),
      tone: t('modes_page.mode_standard_tone', { defaultValue: 'Neutral, concise' }),
      depth: t('modes_page.mode_standard_depth', { defaultValue: 'Balanced' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_standard_example', { defaultValue: 'Q: What is photosynthesis?\nA: Plants use sunlight, water, and CO? to make sugar for energy and release oxygen.' }),
    },
    {
      name: t('modes_page.mode_exam_name', { defaultValue: 'Exam' }),
      icon: <FileText className="w-5 h-5" />,
      accent: 'from-blue-500/20 to-cyan-500/20 text-blue-200',
      summary: t('modes_page.mode_exam_summary', { defaultValue: 'Formal, structured answers with clear steps.' }),
      bestFor: t('modes_page.mode_exam_best', { defaultValue: 'Test prep,Formal solutions,Structured responses' }).split(','),
      tone: t('modes_page.mode_exam_tone', { defaultValue: 'Formal and structured' }),
      depth: t('modes_page.mode_exam_depth', { defaultValue: 'High' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_exam_example', { defaultValue: 'Q: Find d/dx of x^3 + 2x^2 - 5x + 1.\nA: 3x^2 + 4x - 5 using the power rule.' }),
    },
    {
      name: t('modes_page.mode_eli5_name', { defaultValue: 'ELI5' }),
      icon: <Lightbulb className="w-5 h-5" />,
      accent: 'from-purple-500/20 to-pink-500/20 text-purple-200',
      summary: t('modes_page.mode_eli5_summary', { defaultValue: 'Simple explanations with minimal jargon.' }),
      bestFor: t('modes_page.mode_eli5_best', { defaultValue: 'First-time learning,Younger students,Quick intuition' }).split(','),
      tone: t('modes_page.mode_eli5_tone', { defaultValue: 'Simple and friendly' }),
      depth: t('modes_page.mode_eli5_depth', { defaultValue: 'Low to medium' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_eli5_example', { defaultValue: 'Q: What is gravity?\nA: It is the force that pulls things toward Earth, like an invisible tug.' }),
    },
    {
      name: t('modes_page.mode_steps_name', { defaultValue: 'Step-by-step' }),
      icon: <Calculator className="w-5 h-5" />,
      accent: 'from-emerald-500/20 to-teal-500/20 text-emerald-200',
      summary: t('modes_page.mode_steps_summary', { defaultValue: 'Detailed reasoning for math and STEM problems.' }),
      bestFor: t('modes_page.mode_steps_best', { defaultValue: 'Math,Physics,Chemistry' }).split(','),
      tone: t('modes_page.mode_steps_tone', { defaultValue: 'Clear and instructional' }),
      depth: t('modes_page.mode_steps_depth', { defaultValue: 'Very high' }),
      availability: [t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_steps_example', { defaultValue: 'Q: Solve 2(x + 3) = 14.\nStep 1: Divide by 2 ? x + 3 = 7.\nStep 2: Subtract 3 ? x = 4.' }),
    },
    {
      name: t('modes_page.mode_alpha_name', { defaultValue: 'Gen Alpha' }),
      icon: <MessageSquare className="w-5 h-5" />,
      accent: 'from-pink-500/20 to-rose-500/20 text-pink-200',
      summary: t('modes_page.mode_alpha_summary', { defaultValue: 'Short, casual explanations with a modern tone.' }),
      bestFor: t('modes_page.mode_alpha_best', { defaultValue: 'Quick checks,Casual language,Short answers' }).split(','),
      tone: t('modes_page.mode_alpha_tone', { defaultValue: 'Casual and modern' }),
      depth: t('modes_page.mode_alpha_depth', { defaultValue: 'Medium' }),
      availability: [t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_alpha_example', { defaultValue: 'Q: What is mitosis?\nA: It is how a cell copies itself and splits into two identical cells.' }),
    },
  ];

  const MODE_GUIDE = [
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: t('modes_page.guide_1_title', { defaultValue: 'Want a quick, reliable answer? Start with Standard.' }),
      copy: t('modes_page.guide_1_copy', { defaultValue: 'It is the best default when you are unsure which mode to use.' }),
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: t('modes_page.guide_2_title', { defaultValue: 'Studying for a test? Choose Exam.' }),
      copy: t('modes_page.guide_2_copy', { defaultValue: 'It is structured like a clean solution you can review later.' }),
    },
    {
      icon: <Calculator className="w-5 h-5" />,
      title: t('modes_page.guide_3_title', { defaultValue: 'Need the full reasoning? Go Step-by-step.' }),
      copy: t('modes_page.guide_3_copy', { defaultValue: 'Ideal for STEM problems that need clear working.' }),
    },
  ];

  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-slate-200 text-indigo-500 text-xs font-semibold uppercase tracking-widest mb-6 dark:bg-white/5 dark:border-white/10 dark:text-indigo-300">
            <BookOpen className="w-4 h-4" />
            {t('modes_page.badge', { defaultValue: 'Learning Modes' })}
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-950 dark:text-white">
            {t('modes_page.title_main', { defaultValue: 'Pick the explanation style that fits your goal' })}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold max-w-2xl mx-auto">
            {t('modes_page.subtitle', { defaultValue: 'Modes change tone and depth without changing accuracy. You can switch modes any time per question.' })}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {MODES.map((mode) => (
            <div
              key={mode.name}
              className="rounded-[28px] oryx-surface-panel overflow-hidden"
            >
              <div className={`p-6 bg-gradient-to-br ${mode.accent}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center">
                      {mode.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-950 dark:text-white">{mode.name}</h2>
                      <p className="text-sm text-slate-700/80 dark:text-white/70 font-semibold">{mode.summary}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-700/60 dark:text-white/60">
                    {mode.availability.map((plan) => (
                      <span key={plan} className="px-2 py-1 rounded-full bg-white/50 dark:bg-white/10">
                        {plan}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">{t('modes_page.best_for', { defaultValue: 'Best for' })}</p>
                    <div className="flex flex-wrap gap-2">
                      {mode.bestFor.map((item) => (
                        <span key={item} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold dark:bg-white/5 dark:text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {t('modes_page.tone', { defaultValue: 'Tone:' })} {mode.tone}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {t('modes_page.depth', { defaultValue: 'Depth:' })} {mode.depth}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 sm:hidden">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {t('modes_page.availability', { defaultValue: 'Availability:' })} {mode.availability.join(', ')}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">{t('modes_page.example_output', { defaultValue: 'Example output' })}</p>
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 font-mono text-sm text-slate-700 whitespace-pre-wrap dark:bg-slate-900/60 dark:border-white/5 dark:text-slate-200">
                    {mode.example}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black mb-3 text-slate-950 dark:text-white">{t('modes_page.guide_headline', { defaultValue: 'Not sure which mode to choose?' })}</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t('modes_page.guide_sub', { defaultValue: 'Use these quick rules to pick the best option in seconds.' })}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {MODE_GUIDE.map((item) => (
              <div key={item.title} className="p-5 rounded-2xl oryx-surface-panel">
                <div className="w-10 h-10 rounded-xl bg-white/70 dark:bg-white/10 flex items-center justify-center text-indigo-300 mb-3">
                  {item.icon}
                </div>
                <h3 className="font-bold mb-2 text-slate-950 dark:text-white">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-16 text-center">
          <h2 className="text-3xl font-black mb-6 text-slate-950 dark:text-white">{t('modes_page.try_headline', { defaultValue: 'Try a mode in seconds' })}</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
            {t('modes_page.try_sub', { defaultValue: 'Free gives you Standard, Exam, and ELI5. Pro and Premium unlock Step-by-step and Gen Alpha.' })}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="gradient-btn px-8 py-4 rounded-2xl font-black">
              {t('modes_page.start_free', { defaultValue: 'Start Free' })}
            </Link>
            <Link to="/pricing" className="px-8 py-4 rounded-2xl border border-slate-200 bg-white/70 text-slate-950 font-black hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              {t('modes_page.view_pricing', { defaultValue: 'View Pricing' })}
            </Link>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
