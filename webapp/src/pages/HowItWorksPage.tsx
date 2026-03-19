import { Link } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FolderKanban,
  Globe,
  Lightbulb,
  MessageSquare,
  Monitor,
  MousePointerClick,
  Scan,
  Smartphone,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

const STEPS = [
  {
    num: '01',
    title: 'Open the question where it already lives',
    description: 'Use the extension when the problem is already on the page, or jump into the web app when you want a larger workspace.',
    icon: <Monitor className="h-7 w-7" />,
    notes: ['Chrome extension for faster capture', 'Web app for review, history, and settings'],
  },
  {
    num: '02',
    title: 'Capture or paste the problem',
    description: 'You can upload an image, paste text, or grab the visible question instead of copying everything into another tool.',
    icon: <Camera className="h-7 w-7" />,
    notes: ['Screenshots and uploads', 'Text pasted directly', 'Designed to reduce setup friction'],
  },
  {
    num: '03',
    title: 'Choose the explanation style once',
    description: 'Pick the response mode before you begin so the thread stays consistent instead of changing tone every follow-up.',
    icon: <Lightbulb className="h-7 w-7" />,
    notes: ['Standard for balance', 'Exam for formal structure', 'ELI5 for simpler language'],
  },
  {
    num: '04',
    title: 'Keep follow-ups inside the same thread',
    description: 'The goal is a final answer, ordered steps, and follow-up questions that stay attached to the original solve.',
    icon: <Zap className="h-7 w-7" />,
    notes: ['Clear final answer first', 'Steps after that', 'Follow-ups keep context'],
  },
];

const PRODUCT_AREAS = [
  {
    icon: <Scan className="h-5 w-5" />,
    title: 'Capture flow',
    description: 'Current product area: starting from screenshots, uploaded images, or copied question text.',
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: 'Threaded solving',
    description: 'Current product area: one main question and follow-up questions inside the same conversation.',
  },
  {
    icon: <Wand2 className="h-5 w-5" />,
    title: 'Math rendering',
    description: 'Current product area: cleaner formatted math and more readable answer structure.',
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: 'Shared account data',
    description: 'Current product area: profile, usage, and history syncing between the extension and web app.',
  },
  {
    icon: <FolderKanban className="h-5 w-5" />,
    title: 'Feature placeholders',
    description: 'Reserved space for future visuals, walkthrough GIFs, and richer product previews without changing the layout again.',
  },
  {
    icon: <MousePointerClick className="h-5 w-5" />,
    title: 'Billing status',
    description: 'Current product area: pricing is visible, but payment actions still route to the coming-soon flow.',
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="relative overflow-hidden pb-20 pt-32">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem]" style={{ background: 'var(--marketing-glow)' }} />

        <section className="relative px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Sparkles className="h-4 w-4 text-sky-600 dark:text-teal-300" />
              How it works
            </div>
            <h1 className="marketing-heading mt-8 text-[3.3rem] font-extrabold text-slate-950 dark:text-white sm:text-[4.1rem] md:text-[5.1rem] md:leading-[0.98]">
              From question
              <span className="block gradient-text-animated">to cleaner understanding.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-xl font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              OryxSolver is meant to remove friction, not add a theatrical AI layer on top. The workflow below is the real product shape today.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]"
              >
                Start free
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/86 px-7 py-4 text-base font-bold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-2">
              {STEPS.map((step) => (
                <div key={step.num} className="oryx-marketing-panel rounded-[32px] p-7">
                  <div className="flex items-start gap-5">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px]" style={{ background: 'var(--brand-gradient-soft)', color: 'var(--mode-standard)' }}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{step.num}</span>
                        <div className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
                      </div>
                      <h2 className="marketing-heading mt-4 text-3xl font-bold text-slate-950 dark:text-white">
                        {step.title}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                        {step.description}
                      </p>
                      <ul className="mt-6 space-y-3">
                        {step.notes.map((note) => (
                          <li key={note} className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 dark:text-emerald-300" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/70 bg-white/60 px-4 py-20 sm:px-6 dark:border-white/5 dark:bg-black/10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Product areas</p>
              <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                Honest now, expandable later.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                This section is intentionally straightforward. Some areas are already active in the product, and some are shaped as placeholders so richer visuals can be added later without redesigning the page.
              </p>
            </div>

            <div className="oryx-marketing-grid md:grid-cols-2 xl:grid-cols-3">
              {PRODUCT_AREAS.map((item) => (
                <div key={item.title} className="oryx-marketing-card rounded-[30px] p-8">
                  <div className="oryx-marketing-icon h-12 w-12">
                    {item.icon}
                  </div>
                  <h3 className="marketing-heading mt-6 text-2xl font-bold text-slate-950 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Where it fits</p>
              <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
                Use the workflow where it helps, not everywhere.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                The extension is for speed when the problem is already in front of you. The web app is for reviewing, checking usage, managing your account, and continuing threads with more space.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/86 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="oryx-marketing-icon h-11 w-11">
                    <Globe className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">Web app</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Review history, plan usage, settings, and longer threads.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200/80 bg-white/86 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="oryx-marketing-icon h-11 w-11">
                    <MousePointerClick className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">Extension</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Capture quickly when the question is already on the page.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82">
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-3">
                  <div className="oryx-marketing-icon h-11 w-11">
                    <Scan className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Placeholder preview</p>
                    <p className="text-lg font-black text-slate-950 dark:text-white">Future visual walkthrough slot</p>
                  </div>
                </div>
                <div className="mt-5 flex h-56 items-center justify-center rounded-[24px] border border-dashed border-slate-300/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-center">
                    <FolderKanban className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">Image, GIF, or guided demo can live here later.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-[36px] border border-slate-200/80 bg-white/88 p-10 text-center shadow-[0_30px_90px_-44px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Next step</p>
            <h2 className="marketing-heading mt-4 text-4xl font-extrabold text-slate-950 dark:text-white">
              Use the workflow first. Judge it after.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              Start with the free plan, try one real assignment question, and decide whether the flow actually saves you time.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="gradient-btn inline-flex items-center gap-2 rounded-full px-7 py-4 text-base shadow-xl shadow-sky-500/15 transition hover:scale-[1.01]"
              >
                Start free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
