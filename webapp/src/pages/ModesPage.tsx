import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Calculator, CheckCircle2, Shield, Zap } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';

export default function ModesPage() {
  const { t } = useTranslation();

  const modes = [
    {
      name: t('modes_page.mode_standard_name', { defaultValue: 'Standard' }),
      icon: <CheckCircle2 className="h-8 w-8" />,
      summary: t('modes_page.mode_standard_summary', { defaultValue: 'Balanced clarity and speed for most questions.' }),
      bestFor: t('modes_page.mode_standard_best', { defaultValue: 'Homework checks,Quick understanding,Daily study' }).split(','),
      tone: t('modes_page.mode_standard_tone', { defaultValue: 'Neutral, concise' }),
      depth: t('modes_page.mode_standard_depth', { defaultValue: 'Balanced' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_standard_example', { defaultValue: 'Q: What is photosynthesis?\nA: Plants use sunlight, water, and CO2 to make sugar for energy and release oxygen.' }),
    },
    {
      name: t('modes_page.mode_exam_name', { defaultValue: 'Exam' }),
      icon: <Shield className="h-8 w-8" />,
      summary: t('modes_page.mode_exam_summary', { defaultValue: 'Formal, structured answers with clear steps.' }),
      bestFor: t('modes_page.mode_exam_best', { defaultValue: 'Test prep,Formal solutions,Structured responses' }).split(','),
      tone: t('modes_page.mode_exam_tone', { defaultValue: 'Formal and structured' }),
      depth: t('modes_page.mode_exam_depth', { defaultValue: 'High' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_exam_example', { defaultValue: 'Q: Find d/dx of x^3 + 2x^2 - 5x + 1.\nA: 3x^2 + 4x - 5 using the power rule.' }),
    },
    {
      name: t('modes_page.mode_eli5_name', { defaultValue: 'ELI5' }),
      icon: <Calculator className="h-8 w-8" />,
      summary: t('modes_page.mode_eli5_summary', { defaultValue: 'Simple explanations with minimal jargon.' }),
      bestFor: t('modes_page.mode_eli5_best', { defaultValue: 'First-time learning,Younger students,Quick intuition' }).split(','),
      tone: t('modes_page.mode_eli5_tone', { defaultValue: 'Simple and friendly' }),
      depth: t('modes_page.mode_eli5_depth', { defaultValue: 'Low to medium' }),
      availability: [t('modes_page.plan_free', { defaultValue: 'Free' }), t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_eli5_example', { defaultValue: 'Q: What is gravity?\nA: It is the force that pulls things toward Earth, like an invisible tug.' }),
    },
    {
      name: t('modes_page.mode_steps_name', { defaultValue: 'Step-by-step' }),
      icon: <BookOpen className="h-8 w-8" />,
      summary: t('modes_page.mode_steps_summary', { defaultValue: 'Detailed reasoning for math and STEM problems.' }),
      bestFor: t('modes_page.mode_steps_best', { defaultValue: 'Math,Physics,Chemistry' }).split(','),
      tone: t('modes_page.mode_steps_tone', { defaultValue: 'Clear and instructional' }),
      depth: t('modes_page.mode_steps_depth', { defaultValue: 'Very high' }),
      availability: [t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_steps_example', { defaultValue: 'Q: Solve 2(x + 3) = 14.\nStep 1: Divide by 2 -> x + 3 = 7.\nStep 2: Subtract 3 -> x = 4.' }),
    },
    {
      name: t('modes_page.mode_alpha_name', { defaultValue: 'Gen Alpha' }),
      icon: <Zap className="h-8 w-8" />,
      summary: t('modes_page.mode_alpha_summary', { defaultValue: 'Short, casual explanations with a modern tone.' }),
      bestFor: t('modes_page.mode_alpha_best', { defaultValue: 'Quick checks,Casual language,Short answers' }).split(','),
      tone: t('modes_page.mode_alpha_tone', { defaultValue: 'Casual and modern' }),
      depth: t('modes_page.mode_alpha_depth', { defaultValue: 'Medium' }),
      availability: [t('modes_page.plan_pro', { defaultValue: 'Pro' }), t('modes_page.plan_premium', { defaultValue: 'Premium' })],
      example: t('modes_page.mode_alpha_example', { defaultValue: 'Q: What is mitosis?\nA: It is how a cell copies itself and splits into two identical cells.' }),
    },
  ];

  const guide = [
    {
      icon: <Zap className="h-5 w-5" />,
      title: t('modes_page.guide_1_title', { defaultValue: 'Want a quick, reliable answer? Start with Standard.' }),
      copy: t('modes_page.guide_1_copy', { defaultValue: 'It is the best default when you are unsure which mode to use.' }),
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: t('modes_page.guide_2_title', { defaultValue: 'Studying for a test? Choose Exam.' }),
      copy: t('modes_page.guide_2_copy', { defaultValue: 'It is structured like a clean solution you can review later.' }),
    },
    {
      icon: <Calculator className="h-5 w-5" />,
      title: t('modes_page.guide_3_title', { defaultValue: 'Need the full reasoning? Go Step-by-step.' }),
      copy: t('modes_page.guide_3_copy', { defaultValue: 'Ideal for STEM problems that need clear working.' }),
    },
  ];

  return (
    <MarketingLayout className="oryx-shell-bg">
      <main className="marketing-section">
        <div className="marketing-container">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="marketing-badge">
              <BookOpen className="h-4 w-4" />
              <span>{t('modes_page.badge', { defaultValue: 'Learning Modes' })}</span>
            </div>
            <h1 className="marketing-heading marketing-title-xl mt-8 text-[color:var(--text-primary)]">
              {t('modes_page.title_main', { defaultValue: 'Pick the explanation style that fits your goal' })}
            </h1>
            <p className="marketing-copy mx-auto mt-6 max-w-2xl text-lg">
              {t('modes_page.subtitle', { defaultValue: 'Modes change tone and depth without changing accuracy. You can switch modes any time per question.' })}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {modes.map((mode) => (
              <div key={mode.name} className="marketing-panel overflow-hidden">
                <div className="border-b border-[color:var(--brand-border)] bg-[color:var(--brand-gradient-soft)] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="marketing-icon-tile">{mode.icon}</div>
                      <div>
                        <h2 className="text-2xl font-black text-[color:var(--text-primary)]">{mode.name}</h2>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--text-secondary)]">{mode.summary}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mode.availability.map((plan) => (
                        <span key={plan} className="rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                          {plan}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="marketing-eyebrow">{t('modes_page.best_for', { defaultValue: 'Best for' })}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mode.bestFor.map((item) => (
                          <span key={item} className="rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-[color:var(--text-secondary)]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--state-success)]" />
                        {t('modes_page.tone', { defaultValue: 'Tone:' })} {mode.tone}
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--state-success)]" />
                        {t('modes_page.depth', { defaultValue: 'Depth:' })} {mode.depth}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="marketing-eyebrow">{t('modes_page.example_output', { defaultValue: 'Example output' })}</p>
                    <div className="mt-3 rounded-[20px] border border-[color:var(--brand-border)] bg-[color:var(--brand-panel-dark)] px-4 py-4 font-mono text-sm whitespace-pre-wrap text-white">
                      {mode.example}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="mt-16">
            <div className="text-center">
              <h2 className="marketing-heading marketing-title-md text-[color:var(--text-primary)]">
                {t('modes_page.guide_headline', { defaultValue: 'Not sure which mode to choose?' })}
              </h2>
              <p className="marketing-copy mx-auto mt-3 max-w-2xl">
                {t('modes_page.guide_sub', { defaultValue: 'Use these quick rules to pick the best option in seconds.' })}
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {guide.map((item) => (
                <div key={item.title} className="marketing-panel p-5">
                  <div className="marketing-icon-tile h-10 w-10 rounded-[14px]">{item.icon}</div>
                  <h3 className="mt-4 text-lg font-black text-[color:var(--text-primary)]">{item.title}</h3>
                  <p className="marketing-copy mt-2 text-sm">{item.copy}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="marketing-panel-strong mt-16 p-10 text-center">
            <h2 className="marketing-heading marketing-title-md text-[color:var(--text-primary)]">
              {t('modes_page.try_headline', { defaultValue: 'Try a mode in seconds' })}
            </h2>
            <p className="marketing-copy mx-auto mt-4 max-w-xl">
              {t('modes_page.try_sub', { defaultValue: 'Free gives you Standard, Exam, and ELI5. Pro and Premium unlock Step-by-step and Gen Alpha.' })}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="gradient-btn rounded-full px-8 py-4 font-black">
                {t('modes_page.start_free', { defaultValue: 'Start Free' })}
              </Link>
              <Link to="/pricing" className="marketing-secondary-btn rounded-full px-8 py-4 font-black">
                {t('modes_page.view_pricing', { defaultValue: 'View Pricing' })}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
