import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Globe, MousePointerClick } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';
import { MascotIcon } from '../components/MascotIcon';

export default function HowItWorksPage() {
  const { t } = useTranslation();

  const steps = [
    {
      num: '01',
      title: t('how_it_works.stepper_1_title', { defaultValue: 'Install the Extension' }),
      description: t('how_it_works.stepper_1_desc', { defaultValue: 'Add OryxSolver to Chrome and pin it so capture is one click away when a question is already on the page.' }),
      icon: <MascotIcon name="engineer" size={72} />,
      notes: [
        t('how_it_works.stepper_1_n1', { defaultValue: 'Open the Chrome Web Store' }),
        t('how_it_works.stepper_1_n2', { defaultValue: 'Click Add to Chrome' }),
        t('how_it_works.stepper_1_n3', { defaultValue: 'Pin it for instant access' }),
      ],
      mediaLabel: t('how_it_works.stepper_1_media', { defaultValue: 'Extension setup demo' }),
      videoUrl: '/addtochrme.mp4',
    },
    {
      num: '02',
      title: t('how_it_works.stepper_2_title', { defaultValue: 'Capture the Question' }),
      description: t('how_it_works.stepper_2_desc', { defaultValue: 'Grab the visible problem, upload a screenshot, or paste the text without rebuilding the task in another app.' }),
      icon: <MascotIcon name="scan_homework" size={72} />,
      notes: [
        t('how_it_works.stepper_2_n1', { defaultValue: 'Screenshot or upload' }),
        t('how_it_works.stepper_2_n2', { defaultValue: 'Paste raw question text' }),
        t('how_it_works.stepper_2_n3', { defaultValue: 'Start from where the work already is' }),
      ],
      mediaLabel: t('how_it_works.stepper_2_media', { defaultValue: 'Capture flow GIF' }),
    },
    {
      num: '03',
      title: t('how_it_works.stepper_3_title', { defaultValue: 'Choose the Mode' }),
      description: t('how_it_works.stepper_3_desc', { defaultValue: 'Pick the explanation style once at the start so the thread stays consistent as you keep asking follow-ups.' }),
      icon: <MascotIcon name="thinking" size={72} />,
      notes: [
        t('how_it_works.stepper_3_n1', { defaultValue: 'Standard for balance' }),
        t('how_it_works.stepper_3_n2', { defaultValue: 'Exam for formal structure' }),
        t('how_it_works.stepper_3_n3', { defaultValue: 'ELI5 for simpler language' }),
      ],
      mediaLabel: t('how_it_works.stepper_3_media', { defaultValue: 'Mode selection demo' }),
    },
    {
      num: '04',
      title: t('how_it_works.stepper_4_title', { defaultValue: 'Keep Learning in One Thread' }),
      description: t('how_it_works.stepper_4_desc', { defaultValue: 'Get the answer, review the steps, then keep follow-ups attached to the same solve instead of starting over.' }),
      icon: <MascotIcon name="sparkle" size={72} />,
      notes: [
        t('how_it_works.stepper_4_n1', { defaultValue: 'Clear final answer first' }),
        t('how_it_works.stepper_4_n2', { defaultValue: 'Steps after that' }),
        t('how_it_works.stepper_4_n3', { defaultValue: 'Follow-ups keep context' }),
      ],
      mediaLabel: t('how_it_works.stepper_4_media', { defaultValue: 'Threaded follow-up demo' }),
    },
  ];

  return (
    <MarketingLayout className="oryx-shell-bg">
      <main>
        <section className="marketing-section">
          <div className="marketing-container text-center">
            <div className="marketing-badge">
              <MascotIcon name="sparkle" size={16} />
              <span>{t('how_it_works.title_badge', { defaultValue: 'How it works' })}</span>
            </div>
            <h1 className="marketing-heading marketing-title-xl mt-8 text-[color:var(--text-primary)]">
              {t('how_it_works.title_main', { defaultValue: 'Simple steps from' })}
              <span className="block gradient-text-animated">{t('how_it_works.title_gradient', { defaultValue: 'question to clarity.' })}</span>
            </h1>
            <p className="marketing-copy mx-auto mt-6 max-w-3xl text-lg sm:text-xl">
              {t('how_it_works.title_desc', { defaultValue: 'OryxSolver is built to be fast, accurate, and intuitive. The workflow below is the clearest version of how the product should feel.' })}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base">
                {t('how_it_works.start_free', { defaultValue: 'Start free' })}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/pricing" className="marketing-secondary-btn inline-flex rounded-full px-7 py-4 text-base">
                {t('how_it_works.view_pricing', { defaultValue: 'View pricing' })}
              </Link>
            </div>
          </div>
        </section>

        <section className="marketing-section pt-0">
          <div className="marketing-container space-y-8">
            {steps.map((step, index) => (
              <div key={step.num} className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="marketing-panel-strong p-5">
                    <div className="marketing-panel flex min-h-[320px] items-center justify-center overflow-hidden p-6 text-center">
                      {step.videoUrl ? (
                        <div className="w-full">
                          <video autoPlay muted loop playsInline className="h-full w-full rounded-[24px] object-cover" poster="/demo-poster.svg">
                            <source src={step.videoUrl} type="video/mp4" />
                          </video>
                          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{step.mediaLabel}</p>
                        </div>
                      ) : (
                        <div>
                          <div className="marketing-loader-pulse">{step.icon}</div>
                          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{step.mediaLabel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                  <div className="marketing-icon-tile">{step.num}</div>
                  <h2 className="marketing-heading marketing-title-md mt-6 text-[color:var(--text-primary)]">{step.title}</h2>
                  <p className="marketing-copy mt-5 text-lg">{step.description}</p>
                  <ul className="mt-8 space-y-4">
                    {step.notes.map((note) => (
                      <li key={note} className="flex items-start gap-3 text-base font-semibold text-[color:var(--text-secondary)]">
                        <CheckCircle2 className="mt-1 h-5 w-5 text-[color:var(--state-success)]" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-container grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="marketing-eyebrow">{t('how_it_works.where_badge', { defaultValue: 'Where it fits' })}</p>
              <h2 className="marketing-heading marketing-title-lg mt-4 text-[color:var(--text-primary)]">
                {t('how_it_works.where_title', { defaultValue: 'Use the workflow where it helps, not everywhere.' })}
              </h2>
              <p className="marketing-copy mt-4 text-lg">
                {t('how_it_works.where_desc', { defaultValue: 'The extension is for speed when the problem is already in front of you. The web app is for reviewing, checking usage, managing your account, and continuing threads with more space.' })}
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="marketing-panel p-5">
                  <div className="marketing-icon-tile"><Globe className="h-5 w-5" /></div>
                  <p className="mt-4 text-lg font-black text-[color:var(--text-primary)]">{t('how_it_works.webapp_title', { defaultValue: 'Web app' })}</p>
                  <p className="marketing-copy mt-2 text-sm">{t('how_it_works.webapp_desc', { defaultValue: 'Review history, plan usage, settings, and longer threads.' })}</p>
                </div>
                <div className="marketing-panel p-5">
                  <div className="marketing-icon-tile"><MousePointerClick className="h-5 w-5" /></div>
                  <p className="mt-4 text-lg font-black text-[color:var(--text-primary)]">{t('how_it_works.extension_title', { defaultValue: 'Extension' })}</p>
                  <p className="marketing-copy mt-2 text-sm">{t('how_it_works.extension_desc', { defaultValue: 'Capture quickly when the question is already on the page.' })}</p>
                </div>
              </div>
            </div>

            <div className="marketing-panel-strong p-5">
              <div className="marketing-panel p-6">
                <div className="flex items-center gap-4">
                  <MascotIcon name="scan_homework" size={56} />
                  <div>
                    <p className="marketing-eyebrow">{t('how_it_works.placeholder_badge', { defaultValue: 'Placeholder preview' })}</p>
                    <p className="mt-2 text-xl font-black text-[color:var(--text-primary)]">{t('how_it_works.placeholder_title', { defaultValue: 'Future visual walkthrough slot' })}</p>
                  </div>
                </div>
                <p className="marketing-copy mt-6 text-base">
                  {t('how_it_works.placeholder_desc', { defaultValue: 'Keep this slot for polished product walkthrough media once the final capture and solve demos are ready.' })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section pt-0">
          <div className="marketing-container">
            <div className="marketing-panel-strong mx-auto max-w-4xl p-10 text-center sm:p-14">
              <p className="marketing-eyebrow">{t('how_it_works.next_badge', { defaultValue: 'Next step' })}</p>
              <h2 className="marketing-heading marketing-title-lg mt-4 text-[color:var(--text-primary)]">
                {t('how_it_works.next_title', { defaultValue: 'Solve your homework faster.' })}
                <span className="block gradient-text-animated">{t('how_it_works.next_gradient', { defaultValue: 'Learn better.' })}</span>
              </h2>
              <p className="marketing-copy mx-auto mt-4 max-w-2xl text-base">
                {t('how_it_works.next_desc', { defaultValue: 'Start with the free plan, try one real assignment question, and decide whether the flow actually saves you time.' })}
              </p>
              <div className="mt-8 flex justify-center">
                <Link to="/signup" className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base">
                  {t('how_it_works.start_free', { defaultValue: 'Start free' })}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
