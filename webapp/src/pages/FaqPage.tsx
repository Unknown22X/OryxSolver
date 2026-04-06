import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mail, Plus } from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';

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
          answer: t('faq_page.cat_general_a3', { defaultValue: 'It is designed for students, educators, and lifelong learners who want to bridge the gap between just getting the answer and truly understanding the material.' }),
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
      ],
    },
  ];

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  return (
    <MarketingLayout className="oryx-shell-bg" footerVariant="dark">
      <div className="marketing-section">
        <div className="marketing-container">
          <div className="mx-auto max-w-3xl text-center">
            <div className="marketing-badge">
              <span>{t('faq_page.badge', { defaultValue: 'FAQ' })}</span>
            </div>
            <h1 className="marketing-heading marketing-title-xl mt-8 text-[color:var(--text-primary)]">
              {t('faq_page.title_main', { defaultValue: 'Questions' })} <span className="gradient-text-animated">{t('faq_page.title_gradient', { defaultValue: 'answered.' })}</span>
            </h1>
            <p className="marketing-copy mx-auto mt-6 max-w-xl text-lg">
              {t('faq_page.subtitle', { defaultValue: 'Everything students ask before signing up. If something is missing, email us.' })}
            </p>
          </div>

          <section className="mt-14 grid gap-8 lg:grid-cols-[0.32fr_0.68fr]">
            <aside className="marketing-panel h-max p-5">
              <p className="marketing-eyebrow">{t('faq_page.jump_to', { defaultValue: 'Jump to' })}</p>
              <div className="mt-4 flex flex-col gap-2">
                {FAQ_SECTIONS.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="rounded-[18px] border border-[color:var(--brand-border)] bg-[color:var(--brand-surface-strong)] px-4 py-3 text-sm font-bold text-[color:var(--text-secondary)]">
                    {section.title}
                  </a>
                ))}
              </div>
            </aside>

            <div className="space-y-8">
              {FAQ_SECTIONS.map((section) => (
                <div key={section.id} id={section.id} className="marketing-anchor-target">
                  <h2 className="marketing-heading marketing-title-md text-[color:var(--text-primary)]">{section.title}</h2>
                  <div className="mt-5 space-y-3">
                    {section.items.map((item, index) => {
                      const itemId = `${section.id}-${index}`;
                      const isOpen = Boolean(openItems[itemId]);
                      return (
                        <div key={itemId} className="marketing-panel overflow-hidden">
                          <button
                            onClick={() => setOpenItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))}
                            className="flex w-full items-center justify-between gap-3 px-5 py-5 text-left"
                          >
                            <span className="text-base font-bold text-[color:var(--text-primary)]">{item.question}</span>
                            <Plus className={`h-4 w-4 text-[color:var(--brand-accent)] transition ${isOpen ? 'rotate-45' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="border-t border-[color:var(--brand-border)] px-5 pb-5 pt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
                              {item.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="marketing-panel-strong flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xl font-black text-[color:var(--text-primary)]">{t('faq_page.support_title', { defaultValue: 'Still have a question?' })}</h3>
                  <p className="marketing-copy mt-2 text-sm">{t('faq_page.support_desc', { defaultValue: 'We read every email. Usually reply within a few hours.' })}</p>
                </div>
                <a href="mailto:support@oryxsolver.com" className="gradient-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm">
                  <Mail className="h-4 w-4" />
                  {t('faq_page.email_support', { defaultValue: 'Email support' })}
                </a>
              </div>
            </div>
          </section>

          <div className="marketing-panel-strong mx-auto mt-16 max-w-4xl p-10 text-center sm:p-16">
            <p className="marketing-eyebrow mb-6">{t('faq_page.ready_badge', { defaultValue: 'READY?' })}</p>
            <h2 className="marketing-heading marketing-title-lg text-[color:var(--text-primary)]">
              {t('faq_page.ready_title', { defaultValue: "Try it - it's free." })}
            </h2>
            <p className="marketing-copy mx-auto mt-6 max-w-2xl text-base">
              {t('faq_page.ready_desc', { defaultValue: '15 questions every month. No credit card. Solve your first question in under 2 minutes.' })}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/signup" className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-10 py-5 text-base sm:w-auto">
                {t('faq_page.create_account', { defaultValue: 'Create free account' })}
              </Link>
              <Link to="/pricing" className="marketing-secondary-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-10 py-5 text-base sm:w-auto">
                {t('faq_page.see_pricing', { defaultValue: 'See pricing' })} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
