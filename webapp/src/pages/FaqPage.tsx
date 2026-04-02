import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketingLayout from '../components/MarketingLayout';
import { ArrowRight } from 'lucide-react';

export default function FaqPage() {
  const { t } = useTranslation();

  const FAQ_SECTIONS = [
    {
      id: 'general',
      title: t('faq_page.cat_general', { defaultValue: 'General' }),
      items: [
        {
          question: t('faq_page.cat_general_q1', { defaultValue: 'What is OryxSolver?' }),
          answer: t('faq_page.cat_general_a1', { defaultValue: 'OryxSolver is an AI-powered study assistant that helps you solve complex problems and understand core concepts through multiple learning modes.' }),
        },
        {
          question: t('faq_page.cat_general_q2', { defaultValue: 'Is OryxSolver free to use?' }),
          answer: t('faq_page.cat_general_a2', { defaultValue: 'Yes, we offer a free plan with 15 questions per month. No credit card required to start.' }),
        },
        {
          question: t('faq_page.cat_general_q3', { defaultValue: 'Who is OryxSolver for?' }),
          answer: t('faq_page.cat_general_a3', { defaultValue: 'It is designed for students, educators, and lifelong learners who want to bridge the gap between "just getting the answer" and truly understanding the material.' }),
        },
        {
          question: t('faq_page.cat_general_q4', { defaultValue: 'Does it work on mobile?' }),
          answer: t('faq_page.cat_general_a4', { defaultValue: 'The web app is fully responsive and works on mobile browsers. The Chrome Extension is currently for desktop Chrome and Edge.' }),
        },
      ],
    },
    {
      id: 'extension',
      title: t('faq_page.cat_extension', { defaultValue: 'Chrome Extension' }),
      items: [
        {
          question: t('faq_page.cat_extension_q1', { defaultValue: 'How do I install the extension?' }),
          answer: t('faq_page.cat_extension_a1', { defaultValue: 'You can install it from the Chrome Web Store. Once installed, pin it to your toolbar for easy access.' }),
        },
        {
          question: t('faq_page.cat_extension_q2', { defaultValue: 'Does it work on every website?' }),
          answer: t('faq_page.cat_extension_a2', { defaultValue: 'It works on most educational platforms and any website where you can select text or take a screenshot.' }),
        },
        {
          question: t('faq_page.cat_extension_q3', { defaultValue: 'Do my solves sync between the extension and web app?' }),
          answer: t('faq_page.cat_extension_a3', { defaultValue: 'Yes, all your captures and solves are synced to your account and accessible from the dashboard history.' }),
        },
      ],
    },
    {
      id: 'modes',
      title: t('faq_page.cat_modes', { defaultValue: 'Answer Modes' }),
      items: [
        {
          question: t('faq_page.cat_modes_q1', { defaultValue: 'What are the 5 answer modes?' }),
          answer: t('faq_page.cat_modes_a1', { defaultValue: 'Standard, Exam, ELI5 (Explain Like I\'m 5), Step-by-Step, and Gen Alpha. Each mode tailors the tone and depth of the explanation.' }),
        },
        {
          question: t('faq_page.cat_modes_q2', { defaultValue: 'Can I switch modes mid-thread?' }),
          answer: t('faq_page.cat_modes_a2', { defaultValue: 'Currently, the mode is set at the start of a thread to maintain consistency, but you can always start a new solve with a different mode.' }),
        },
        {
          question: t('faq_page.cat_modes_q3', { defaultValue: 'Which mode should I use for exams?' }),
          answer: t('faq_page.cat_modes_a3', { defaultValue: 'The "Exam" mode provides concise, direct answers and key formulas, perfect for quick review or timed practice.' }),
        },
      ],
    },
    {
      id: 'billing',
      title: t('faq_page.cat_billing', { defaultValue: 'Billing' }),
      items: [
        {
          question: t('faq_page.cat_billing_q1', { defaultValue: 'How does payment work?' }),
          answer: t('faq_page.cat_billing_a1', { defaultValue: 'We use secure payment processors. Billing is currently being staged and will be live soon for Pro and Premium plans.' }),
        },
        {
          question: t('faq_page.cat_billing_q2', { defaultValue: 'Can I cancel anytime?' }),
          answer: t('faq_page.cat_billing_a2', { defaultValue: 'Yes, subscriptions can be cancelled at any time from your settings page with no hidden fees.' }),
        },
        {
          question: t('faq_page.cat_billing_q3', { defaultValue: 'What are one-time credits?' }),
          answer: t('faq_page.cat_billing_a3', { defaultValue: 'One-time credits are extra questions you can purchase if you hit your monthly limit, and they never expire.' }),
        },
        {
          question: t('faq_page.cat_billing_q4', { defaultValue: 'What happens when my question quota runs out?' }),
          answer: t('faq_page.cat_billing_a4', { defaultValue: 'You\'ll be notified and can either wait for the next month or upgrade to a higher plan for more questions.' }),
        },
      ],
    },
  ];

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [activeGroup, setActiveGroup] = useState(FAQ_SECTIONS[0].id);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      setActiveGroup(id);
    }
  };

  return (
    <MarketingLayout className="oryx-shell-bg overflow-x-hidden text-slate-900 dark:text-white" footerVariant="dark">
      <div className="relative pt-32 pb-20 px-4 sm:px-6">
        {}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[32rem]" style={{ background: 'var(--marketing-glow)' }} />
          <div className="absolute left-[10%] top-[18%] h-56 w-56 rounded-full bg-sky-400/10 blur-[110px] dark:bg-teal-300/8" />
          <div className="absolute right-[8%] top-[24%] h-72 w-72 rounded-full bg-blue-500/10 blur-[120px] dark:bg-sky-400/10" />
        </div>

        <div className="relative mx-auto max-w-[1000px]">
          {}
          <div className="text-center px-6 md:px-14 pt-24 pb-16">
            <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 30%,rgba(45,212,191,0.07),transparent 70%)' }} />
            <div className="inline-flex items-center gap-2 px-4 py-[5px] rounded-full mb-8"
              style={{ border: '1px solid rgba(45,212,191,0.22)', background: 'rgba(45,212,191,0.06)' }}>
              <span className="w-[5px] h-[5px] rounded-full bg-teal animate-pulse" />
              <span className="text-teal text-[11.5px] font-medium">{t('faq_page.badge', { defaultValue: 'FAQ' })}</span>
            </div>
            <h1 className="font-syne text-[48px] md:text-[54px] font-extrabold tracking-[-0.04em] leading-[1.1] text-slate-900 dark:text-[#f0f2f8] max-w-[560px] mx-auto mb-5">
              {t('faq_page.title_main', { defaultValue: 'Questions' })} <span className="gradient-text-animated">{t('faq_page.title_gradient', { defaultValue: 'answered.' })}</span>
            </h1>
            <p className="text-[17px] text-slate-500 dark:text-white/45 max-w-[400px] mx-auto">
              {t('faq_page.subtitle', { defaultValue: 'Everything students ask before signing up. If something\'s missing, email us.' })}
            </p>
          </div>

          {}
          <section className="px-6 md:px-14 pb-24">
            <div className="grid md:grid-cols-[220px_1fr] gap-12">
              {}
              <div className="hidden md:block">
                <div className="sticky top-24">
                  <div className="font-syne text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-white/28 mb-4">{t('faq_page.jump_to', { defaultValue: 'Jump to' })}</div>
                  {FAQ_SECTIONS.map(g => (
                    <button key={g.id} onClick={() => scrollToSection(g.id)}
                      className="flex items-center px-3 py-2 rounded-lg mb-1 text-[13px] no-underline transition-all border-l-2 w-full text-left"
                      style={activeGroup === g.id ? {
                        color: '#2dd4bf',
                        borderLeftColor: '#2dd4bf',
                        background: 'rgba(45,212,191,0.09)',
                      } : {
                        color: 'rgba(221,225,236,0.5)',
                        borderLeftColor: 'transparent',
                      }}>
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>

              {}
              <div className="flex flex-col gap-12">
                {FAQ_SECTIONS.map(g => (
                  <div key={g.id} id={g.id}>
                    <h2 className="font-syne text-[18px] font-bold text-slate-900 dark:text-[#f0f2f8] mb-5 pb-4 border-b border-slate-200/80 dark:border-white/10">
                      {g.title}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {g.items.map((item, i) => {
                        const itemId = `${g.id}-${i}`;
                        const isOpen = !!openItems[itemId];
                        return (
                          <div key={itemId}
                            className="border rounded-[12px] overflow-hidden transition-all border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-[#161927] hover:border-slate-300 dark:hover:border-white/15"
                            style={{ borderColor: isOpen ? 'rgba(45,212,191,0.22)' : undefined }}>
                            <button onClick={() => toggleItem(itemId)}
                              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors cursor-pointer border-0 bg-transparent">
                              <span className="font-syne text-[14px] font-semibold text-slate-700 dark:text-slate-300">
                                {item.question}
                              </span>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke={isOpen ? '#2dd4bf' : 'rgba(221,225,236,0.35)'}
                                strokeWidth="2" strokeLinecap="round"
                                style={{ transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s, stroke .2s', flexShrink: 0 }}>
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                              </svg>
                            </button>
                            {isOpen && (
                              <div className="px-5 pb-5 text-[13.5px] text-slate-500 dark:text-slate-400 leading-[1.75] border-t border-slate-100 dark:border-white/5 pt-4">
                                {item.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-7 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#111422]">
                  <div>
                    <h3 className="font-syne text-[16px] font-bold text-slate-800 dark:text-[#e8eaf0] mb-2">
                      {t('faq_page.support_title', { defaultValue: 'Still have a question?' })}
                    </h3>
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
                      {t('faq_page.support_desc', { defaultValue: 'We read every email. Usually reply within a few hours.' })}
                    </p>
                  </div>
                  <a href="mailto:support@oryxsolver.com"
                    className="flex items-center gap-2 px-5 py-[11px] rounded-[10px] text-[13px] font-bold font-syne text-slate-950 dark:text-[#030b0f] whitespace-nowrap no-underline hover:opacity-88 transition-all flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {t('faq_page.email_support', { defaultValue: 'Email support' })}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        {}
        <div className="mx-auto max-w-4xl mt-12 rounded-[40px] border border-slate-200/80 bg-white/85 p-10 text-center shadow-[0_40px_100px_-40px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#08111d]/82 sm:p-16">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-6">{t('faq_page.ready_badge', { defaultValue: 'READY?' })}</p>
          <h2 className="marketing-heading text-4xl sm:text-5xl font-extrabold text-slate-950 dark:text-white mb-6">
            {t('faq_page.ready_title', { defaultValue: "Try it — it's free." })}
          </h2>
          <p className="mx-auto max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300 mb-10">
            {t('faq_page.ready_desc', { defaultValue: '15 questions every month. No credit card. Solve your first question in under 2 minutes.' })}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/signup"
              className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-10 py-5 text-base shadow-xl shadow-sky-500/20 transition hover:scale-[1.01] sm:w-auto">
              {t('faq_page.create_account', { defaultValue: 'Create free account' })}
            </Link>
            <Link to="/pricing"
              className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-10 py-5 text-base font-bold text-slate-950 hover:bg-slate-50 sm:w-auto dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              {t('faq_page.see_pricing', { defaultValue: 'See pricing' })} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
