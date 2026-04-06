import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketingLayout from '../components/MarketingLayout';
import { MascotIcon } from '../components/MascotIcon';
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  MousePointerClick,
} from 'lucide-react';


export default function HowItWorksPage() {
  const { t } = useTranslation();

  const STEPS = [
    {
      num: '01',
      title: t('how_it_works.stepper_1_title', { defaultValue: 'Install the Extension' }),
      description: t('how_it_works.stepper_1_desc', { defaultValue: 'Add OryxSolver to Chrome and pin it so capture is one click away when a question is already on the page.' }),
      icon: <MascotIcon name="engineer" size={64} />,
      notes: [
        t('how_it_works.stepper_1_n1', { defaultValue: 'Open the Chrome Web Store' }),
        t('how_it_works.stepper_1_n2', { defaultValue: 'Click Add to Chrome' }),
        t('how_it_works.stepper_1_n3', { defaultValue: 'Pin it for instant access' })
      ],
      mediaLabel: t('how_it_works.stepper_1_media', { defaultValue: 'Extension setup demo' }),
      accent: 'from-indigo-500 to-blue-500',
      glow: 'rgba(99,102,241,0.38)',
      wash: 'linear-gradient(135deg, rgba(99,102,241,0.18), transparent 60%)',
    },
    {
      num: '02',
      title: t('how_it_works.stepper_2_title', { defaultValue: 'Capture the Question' }),
      description: t('how_it_works.stepper_2_desc', { defaultValue: 'Grab the visible problem, upload a screenshot, or paste the text without rebuilding the task in another app.' }),
      icon: <MascotIcon name="scan_homework" size={64} />,
      notes: [
        t('how_it_works.stepper_2_n1', { defaultValue: 'Screenshot or upload' }),
        t('how_it_works.stepper_2_n2', { defaultValue: 'Paste raw question text' }),
        t('how_it_works.stepper_2_n3', { defaultValue: 'Start from where the work already is' })
      ],
      mediaLabel: t('how_it_works.stepper_2_media', { defaultValue: 'Capture flow GIF' }),
      accent: 'from-orange-500 to-amber-400',
      glow: 'rgba(249,115,22,0.34)',
      wash: 'linear-gradient(135deg, rgba(249,115,22,0.16), transparent 60%)',
    },
    {
      num: '03',
      title: t('how_it_works.stepper_3_title', { defaultValue: 'Choose the Mode' }),
      description: t('how_it_works.stepper_3_desc', { defaultValue: 'Pick the explanation style once at the start so the thread stays consistent as you keep asking follow-ups.' }),
      icon: <MascotIcon name="thinking" size={64} />,
      notes: [
        t('how_it_works.stepper_3_n1', { defaultValue: 'Standard for balance' }),
        t('how_it_works.stepper_3_n2', { defaultValue: 'Exam for formal structure' }),
        t('how_it_works.stepper_3_n3', { defaultValue: 'ELI5 for simpler language' })
      ],
      mediaLabel: t('how_it_works.stepper_3_media', { defaultValue: 'Mode selection demo' }),
      accent: 'from-violet-500 to-fuchsia-400',
      glow: 'rgba(168,85,247,0.34)',
      wash: 'linear-gradient(135deg, rgba(168,85,247,0.16), transparent 60%)',
    },
    {
      num: '04',
      title: t('how_it_works.stepper_4_title', { defaultValue: 'Keep Learning in One Thread' }),
      description: t('how_it_works.stepper_4_desc', { defaultValue: 'Get the answer, review the steps, then keep follow-ups attached to the same solve instead of starting over.' }),
      icon: <MascotIcon name="sparkle" size={64} />,
      notes: [
        t('how_it_works.stepper_4_n1', { defaultValue: 'Clear final answer first' }),
        t('how_it_works.stepper_4_n2', { defaultValue: 'Steps after that' }),
        t('how_it_works.stepper_4_n3', { defaultValue: 'Follow-ups keep context' })
      ],
      mediaLabel: t('how_it_works.stepper_4_media', { defaultValue: 'Threaded follow-up demo' }),
      accent: 'from-emerald-500 to-teal-400',
      glow: 'rgba(16,185,129,0.34)',
      wash: 'linear-gradient(135deg, rgba(16,185,129,0.16), transparent 60%)',
    },
  ];

  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="relative overflow-hidden pb-20 pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem]" style={{ background: 'var(--marketing-glow)' }} />

        <section className="relative px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <MascotIcon name="sparkle" size={16} />
              {t('how_it_works.title_badge', { defaultValue: 'How it works' })}
            </div>
            <h1 className="marketing-heading mt-8 text-[3.3rem] font-extrabold text-slate-950 dark:text-white sm:text-[4.1rem] md:text-[5.1rem] md:leading-[0.98]">
              {t('how_it_works.title_main', { defaultValue: 'Simple steps from' })}
              <span className="block gradient-text-animated">{t('how_it_works.title_gradient', { defaultValue: 'question to clarity.' })}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-xl font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t('how_it_works.title_desc', { defaultValue: 'OryxSolver is built to be fast, accurate, and intuitive. The workflow below is the clearest version of how the product should feel.' })}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]"
              >
                {t('how_it_works.start_free', { defaultValue: 'Start free' })}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/86 px-7 py-4 text-base font-bold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                {t('how_it_works.view_pricing', { defaultValue: 'View pricing' })}
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="space-y-20">
              {STEPS.map((step, index) => (
                <div key={step.num} className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <div
                      className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#0b1220] sm:p-8"
                      style={{ boxShadow: `0 30px 90px -48px ${step.glow}` }}
                    >
                      <div className="relative flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-white/8 dark:bg-[#0b1020] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        <span className="absolute left-6 top-6 text-6xl font-black tracking-[-0.05em] text-slate-100/30 dark:text-white/5 sm:text-7xl">
                          {step.num}
                        </span>
                        <div className="flex flex-col items-center text-center">
                          <div className="transition-transform hover:scale-110 duration-500">
                            {step.icon}
                          </div>
                          <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                            {step.mediaLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} text-sm font-black text-white`}
                      style={{ boxShadow: `0 20px 40px -24px ${step.glow}` }}
                    >
                      {step.num}
                    </div>
                    <h2 className="mt-6 text-4xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                      {step.title}
                    </h2>
                    <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.description}
                    </p>
                    <ul className="mt-8 space-y-4">
                      {step.notes.map((note) => (
                        <li key={note} className="flex items-start gap-3 text-base font-semibold text-slate-700 dark:text-slate-200">
                          <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500 dark:text-emerald-300" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('how_it_works.where_badge', { defaultValue: 'Where it fits' })}</p>
              <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                {t('how_it_works.where_title', { defaultValue: 'Use the workflow where it helps, not everywhere.' })}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                {t('how_it_works.where_desc', { defaultValue: 'The extension is for speed when the problem is already in front of you. The web app is for reviewing, checking usage, managing your account, and continuing threads with more space.' })}
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/86 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <Globe className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">{t('how_it_works.webapp_title', { defaultValue: 'Web app' })}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t('how_it_works.webapp_desc', { defaultValue: 'Review history, plan usage, settings, and longer threads.' })}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200/80 bg-white/86 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    <MousePointerClick className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">{t('how_it_works.extension_title', { defaultValue: 'Extension' })}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t('how_it_works.extension_desc', { defaultValue: 'Capture quickly when the question is already on the page.' })}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82">
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <MascotIcon name="scan_homework" size={44} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('how_it_works.placeholder_badge', { defaultValue: 'Placeholder preview' })}</p>
                    <p className="text-lg font-black text-slate-950 dark:text-white">{t('how_it_works.placeholder_title', { defaultValue: 'Future visual walkthrough slot' })}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/88 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{t('how_it_works.next_badge', { defaultValue: 'Next step' })}</p>
            <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
              {t('how_it_works.next_title', { defaultValue: 'Solve your homework faster.' })}
              <span className="block gradient-text-animated">{t('how_it_works.next_gradient', { defaultValue: 'Learn better.' })}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              {t('how_it_works.next_desc', { defaultValue: 'Start with the free plan, try one real assignment question, and decide whether the flow actually saves you time.' })}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]"
              >
                {t('how_it_works.start_free', { defaultValue: 'Start free' })}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
