import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Calculator, CheckCircle2, Shield, Zap } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';

export default function ModesPage() {
  const { t } = useTranslation();

  const modes = [
    {
      name: t('modes_page.mode_standard_name'),
      icon: <CheckCircle2 className="h-8 w-8" />,
      summary: t('modes_page.mode_standard_summary'),
      bestFor: t('modes_page.mode_standard_best').split(','),
      tone: t('modes_page.mode_standard_tone'),
      depth: t('modes_page.mode_standard_depth'),
      availability: [t('modes_page.plan_free'), t('modes_page.plan_pro'), t('modes_page.plan_premium')],
      example: t('modes_page.mode_standard_example'),
    },
    {
      name: t('modes_page.mode_exam_name'),
      icon: <Shield className="h-8 w-8" />,
      summary: t('modes_page.mode_exam_summary'),
      bestFor: t('modes_page.mode_exam_best').split(','),
      tone: t('modes_page.mode_exam_tone'),
      depth: t('modes_page.mode_exam_depth'),
      availability: [t('modes_page.plan_free'), t('modes_page.plan_pro'), t('modes_page.plan_premium')],
      example: t('modes_page.mode_exam_example'),
    },
    {
      name: t('modes_page.mode_eli5_name'),
      icon: <Calculator className="h-8 w-8" />,
      summary: t('modes_page.mode_eli5_summary'),
      bestFor: t('modes_page.mode_eli5_best').split(','),
      tone: t('modes_page.mode_eli5_tone'),
      depth: t('modes_page.mode_eli5_depth'),
      availability: [t('modes_page.plan_free'), t('modes_page.plan_pro'), t('modes_page.plan_premium')],
      example: t('modes_page.mode_eli5_example'),
    },
    {
      name: t('modes_page.mode_steps_name'),
      icon: <BookOpen className="h-8 w-8" />,
      summary: t('modes_page.mode_steps_summary'),
      bestFor: t('modes_page.mode_steps_best').split(','),
      tone: t('modes_page.mode_steps_tone'),
      depth: t('modes_page.mode_steps_depth'),
      availability: [t('modes_page.plan_pro'), t('modes_page.plan_premium')],
      example: t('modes_page.mode_steps_example'),
    },
    {
      name: t('modes_page.mode_alpha_name'),
      icon: <Zap className="h-8 w-8" />,
      summary: t('modes_page.mode_alpha_summary'),
      bestFor: t('modes_page.mode_alpha_best').split(','),
      tone: t('modes_page.mode_alpha_tone'),
      depth: t('modes_page.mode_alpha_depth'),
      availability: [t('modes_page.plan_pro'), t('modes_page.plan_premium')],
      example: t('modes_page.mode_alpha_example'),
    },
  ];

  const guide = [
    {
      icon: <Zap className="h-5 w-5" />,
      title: t('modes_page.guide_1_title'),
      copy: t('modes_page.guide_1_copy'),
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: t('modes_page.guide_2_title'),
      copy: t('modes_page.guide_2_copy'),
    },
    {
      icon: <Calculator className="h-5 w-5" />,
      title: t('modes_page.guide_3_title'),
      copy: t('modes_page.guide_3_copy'),
    },
  ];

  return (
    <MarketingLayout className="oryx-shell-bg">
      <main className="marketing-section">
        <div className="marketing-container">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="marketing-badge">
              <BookOpen className="h-4 w-4" />
              <span>{t('modes_page.badge')}</span>
            </div>
            <h1 className="marketing-heading marketing-title-xl mt-8 text-[color:var(--text-primary)]">
              {t('modes_page.title_main')}
            </h1>
            <p className="marketing-copy mx-auto mt-6 max-w-2xl text-lg">
              {t('modes_page.subtitle')}
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
                      <p className="marketing-eyebrow">{t('modes_page.best_for')}</p>
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
                        {t('modes_page.tone')} {mode.tone}
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--state-success)]" />
                        {t('modes_page.depth')} {mode.depth}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="marketing-eyebrow">{t('modes_page.example_output')}</p>
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
                {t('modes_page.guide_headline')}
              </h2>
              <p className="marketing-copy mx-auto mt-3 max-w-2xl">
                {t('modes_page.guide_sub')}
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
              {t('modes_page.try_headline')}
            </h2>
            <p className="marketing-copy mx-auto mt-4 max-w-xl">
              {t('modes_page.try_sub')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="gradient-btn rounded-full px-8 py-4 font-black">
                {t('modes_page.start_free')}
              </Link>
              <Link to="/pricing" className="marketing-secondary-btn rounded-full px-8 py-4 font-black">
                {t('modes_page.view_pricing')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
