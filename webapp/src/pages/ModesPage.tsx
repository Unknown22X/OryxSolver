import { Link } from 'react-router-dom';
import MarketingLayout from '../components/MarketingLayout';
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

const MODES = [
  {
    name: 'Standard',
    icon: <Zap className="w-5 h-5" />,
    accent: 'from-amber-500/20 to-orange-500/20 text-amber-200',
    summary: 'Balanced clarity and speed for most questions.',
    bestFor: ['Homework checks', 'Quick understanding', 'Daily study'],
    tone: 'Neutral, concise',
    depth: 'Balanced',
    availability: ['Free', 'Pro', 'Premium'],
    example:
      'Q: What is photosynthesis?\nA: Plants use sunlight, water, and CO? to make sugar for energy and release oxygen.',
  },
  {
    name: 'Exam',
    icon: <FileText className="w-5 h-5" />,
    accent: 'from-blue-500/20 to-cyan-500/20 text-blue-200',
    summary: 'Formal, structured answers with clear steps.',
    bestFor: ['Test prep', 'Formal solutions', 'Structured responses'],
    tone: 'Formal and structured',
    depth: 'High',
    availability: ['Free', 'Pro', 'Premium'],
    example:
      'Q: Find d/dx of x^3 + 2x^2 - 5x + 1.\nA: 3x^2 + 4x - 5 using the power rule.',
  },
  {
    name: 'ELI5',
    icon: <Lightbulb className="w-5 h-5" />,
    accent: 'from-purple-500/20 to-pink-500/20 text-purple-200',
    summary: 'Simple explanations with minimal jargon.',
    bestFor: ['First-time learning', 'Younger students', 'Quick intuition'],
    tone: 'Simple and friendly',
    depth: 'Low to medium',
    availability: ['Free', 'Pro', 'Premium'],
    example:
      'Q: What is gravity?\nA: It is the force that pulls things toward Earth, like an invisible tug.',
  },
  {
    name: 'Step-by-step',
    icon: <Calculator className="w-5 h-5" />,
    accent: 'from-emerald-500/20 to-teal-500/20 text-emerald-200',
    summary: 'Detailed reasoning for math and STEM problems.',
    bestFor: ['Math', 'Physics', 'Chemistry'],
    tone: 'Clear and instructional',
    depth: 'Very high',
    availability: ['Pro', 'Premium'],
    example:
      'Q: Solve 2(x + 3) = 14.\nStep 1: Divide by 2 ? x + 3 = 7.\nStep 2: Subtract 3 ? x = 4.',
  },
  {
    name: 'Gen Alpha',
    icon: <MessageSquare className="w-5 h-5" />,
    accent: 'from-pink-500/20 to-rose-500/20 text-pink-200',
    summary: 'Short, casual explanations with a modern tone.',
    bestFor: ['Quick checks', 'Casual language', 'Short answers'],
    tone: 'Casual and modern',
    depth: 'Medium',
    availability: ['Pro', 'Premium'],
    example:
      'Q: What is mitosis?\nA: It is how a cell copies itself and splits into two identical cells.',
  },
];

const MODE_GUIDE = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Want a quick, reliable answer? Start with Standard.',
    copy: 'It is the best default when you are unsure which mode to use.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Studying for a test? Choose Exam.',
    copy: 'It is structured like a clean solution you can review later.',
  },
  {
    icon: <Calculator className="w-5 h-5" />,
    title: 'Need the full reasoning? Go Step-by-step.',
    copy: 'Ideal for STEM problems that need clear working.',
  },
];

export default function ModesPage() {
  return (
    <MarketingLayout className="oryx-shell-bg text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="solid">
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-slate-200 text-indigo-500 text-xs font-semibold uppercase tracking-widest mb-6 dark:bg-white/5 dark:border-white/10 dark:text-indigo-300">
            <BookOpen className="w-4 h-4" />
            Learning Modes
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-950 dark:text-white">
            Pick the explanation style that fits your goal
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-semibold max-w-2xl mx-auto">
            Modes change tone and depth without changing accuracy. You can switch modes any time per question.
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
                    <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Best for</p>
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
                      Tone: {mode.tone}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Depth: {mode.depth}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 sm:hidden">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Availability: {mode.availability.join(', ')}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Example output</p>
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
            <h2 className="text-3xl font-black mb-3 text-slate-950 dark:text-white">Not sure which mode to choose?</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Use these quick rules to pick the best option in seconds.
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
          <h2 className="text-3xl font-black mb-6 text-slate-950 dark:text-white">Try a mode in seconds</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
            Free gives you Standard, Exam, and ELI5. Pro and Premium unlock Step-by-step and Gen Alpha.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="gradient-btn px-8 py-4 rounded-2xl font-black">
              Start Free
            </Link>
            <Link to="/pricing" className="px-8 py-4 rounded-2xl border border-slate-200 bg-white/70 text-slate-950 font-black hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              View Pricing
            </Link>
          </div>
        </div>
      </main>
    </MarketingLayout>
  );
}
