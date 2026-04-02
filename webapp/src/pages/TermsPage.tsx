import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketingLayout from '../components/MarketingLayout';
import { fetchPublicAppConfig, FALLBACK_PUBLIC_CONFIG, type LegalDocument, type LegalVersions } from '../lib/appConfig';

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  const [terms, setTerms] = useState<LegalDocument>(FALLBACK_PUBLIC_CONFIG.terms);
  const [versions, setVersions] = useState<LegalVersions>(FALLBACK_PUBLIC_CONFIG.legalVersions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTerms() {
      try {
        const config = await fetchPublicAppConfig(i18n.language);
        if (!active) return;
        setTerms(config.terms);
        setVersions(config.legalVersions);
      } catch (error) {
        console.error('Failed to load terms content:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTerms();
    return () => {
      active = false;
    };
  }, [i18n.language]);

  return (
    <MarketingLayout headerVariant="glass" footerVariant="dark">
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-32 text-slate-900 dark:text-slate-100">
        <div className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white">{t('terms_page.breadcrumb_home')}</Link> / <span>{t('terms_page.breadcrumb_terms')}</span>
        </div>

        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{terms.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">{terms.intro}</p>
        <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t('terms_page.effective_date', { date: versions.effective_date })} | {t('terms_page.terms_version', { version: versions.terms_version })}
        </p>

        {loading && (
          <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {t('terms_page.loading')}
          </p>
        )}

        <div className="mt-10 space-y-6">
          {terms.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <h2 className="text-xl font-black">{section.heading}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">{t('terms_page.privacy_policy')}</Link>
        </div>
      </main>
    </MarketingLayout>
  );
}
