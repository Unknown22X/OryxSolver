import MarketingLayout from '../components/MarketingLayout';
import {
  HelpCircle,
  ShieldCheck,
  CreditCard,
  Zap,
  BookOpen,
  Sparkles,
  BadgeCheck,
  Trash2,
  Monitor,
  Image,
} from 'lucide-react';

const FAQ_SECTIONS = [
  {
    title: 'Plans and Billing',
    description: 'Understand plans, refunds, and upgrades.',
    items: [
      {
        icon: <CreditCard className="w-4 h-4" />,
        question: 'What plans do you offer?',
        answer:
          'We offer Free, Pro, and Premium. Free includes limited monthly usage, Pro increases limits, and Premium offers high limits with spam protection.',
      },
      {
        icon: <BadgeCheck className="w-4 h-4" />,
        question: 'Do you offer refunds?',
        answer:
          'Billing is not live in-app yet. Refund and cancellation details will be shown here once checkout is enabled.',
      },
      {
        icon: <Zap className="w-4 h-4" />,
        question: 'Can I buy pay-as-you-go credits?',
        answer:
          'Not yet. The product model keeps extra credits separate from monthly plan questions, but purchases are still behind a coming-soon page.',
      },
      {
        icon: <Sparkles className="w-4 h-4" />,
        question: 'Do free users get a starter bonus?',
        answer:
          'Free accounts currently start with the free monthly plan allowance. Any future starter bonus will be shown clearly in-product instead of implied.',
      },
    ],
  },
  {
    title: 'Usage and Modes',
    description: 'How limits work and which modes you get.',
    items: [
      {
        icon: <BookOpen className="w-4 h-4" />,
        question: 'Which modes are available on Free?',
        answer:
          'Free includes Standard, Exam, and ELI5. Step-by-step and Gen Alpha are available on Pro and Premium.',
      },
      {
        icon: <Sparkles className="w-4 h-4" />,
        question: 'How do usage limits work?',
        answer:
          'Top-level questions use your monthly plan allowance. Follow-up questions stay inside the same thread. Image uploads and bulk solves have separate monthly limits, and extra pay-as-you-go credits are tracked separately.',
      },
      {
        icon: <Image className="w-4 h-4" />,
        question: 'Do image solves count toward my limit?',
        answer:
          'Yes. Image solves count toward both your monthly questions and image limits.',
      },
      {
        icon: <Zap className="w-4 h-4" />,
        question: 'What happens when I hit my limit?',
        answer:
          'Right now, upgrade actions open a payment-coming-soon page. The app still tracks when you reach your current plan allowance so the future billing flow has a clean handoff.',
      },
    ],
  },
  {
    title: 'Privacy and Security',
    description: 'How we keep your data safe.',
    items: [
      {
        icon: <ShieldCheck className="w-4 h-4" />,
        question: 'Is my data private?',
        answer:
          'We keep your data private and only use it to deliver the service, improve product performance, and maintain security.',
      },
      {
        icon: <Trash2 className="w-4 h-4" />,
        question: 'Can I delete my data?',
        answer:
          'Yes. Contact support and we will delete your account data upon request.',
      },
      {
        icon: <Monitor className="w-4 h-4" />,
        question: 'Does OryxSolver work on any website?',
        answer:
          'The extension works on most educational websites, including Microsoft Forms and Google Classroom.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <MarketingLayout>
      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-semibold uppercase tracking-widest mb-4">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">Frequently Asked Questions</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Quick answers about plans, usage, refunds, and privacy.
          </p>
        </section>

        <div className="space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl border p-6 sm:p-8"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              <div className="mb-6">
                <h2 className="text-2xl font-black mb-2">{section.title}</h2>
                <p className="text-sm text-slate-500">{section.description}</p>
              </div>

              <div className="space-y-3">
                {section.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-2xl border px-4 py-3"
                    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
                  >
                    <summary className="flex items-center justify-between cursor-pointer font-bold">
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                          {item.icon}
                        </span>
                        {item.question}
                      </span>
                      <span className="text-slate-400 group-open:rotate-90 transition-transform">+</span>
                    </summary>
                    <p className="mt-3 text-sm text-slate-500">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </MarketingLayout>
  );
}
