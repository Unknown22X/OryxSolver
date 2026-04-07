import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Camera,
  CheckCircle2,
  ExternalLink,
  Layers,
  Shield,
  Star,
} from 'lucide-react';
import MarketingLayout from '../components/MarketingLayout';
import { trackEvent } from '../lib/analyticsClient';
import { LANDING_FEATURES, LANDING_REVIEWS } from '../content/landingFeatures';



const HERO_SUPPORT_ITEMS = [
  'landing.questions_free',
  'landing.start_in_chrome',
  'landing.billing_staged',
] as const;

const FEATURE_PRESENTATIONS = [
  {
    Icon: Camera,
    iconWrap: 'from-orange-500 to-amber-400 shadow-[0_18px_40px_-20px_rgba(249,115,22,0.5)]',
    arrow: 'text-orange-500 dark:text-orange-300',
  },
  {
    Icon: Brain,
    iconWrap: 'from-violet-500 to-fuchsia-400 shadow-[0_18px_40px_-20px_rgba(139,92,246,0.5)]',
    arrow: 'text-violet-500 dark:text-violet-300',
  },
  {
    Icon: Layers,
    iconWrap: 'from-sky-500 to-blue-400 shadow-[0_18px_40px_-20px_rgba(59,130,246,0.45)]',
    arrow: 'text-sky-500 dark:text-sky-300',
  },
  {
    Icon: Shield,
    iconWrap: 'from-emerald-500 to-teal-400 shadow-[0_18px_40px_-20px_rgba(16,185,129,0.45)]',
    arrow: 'text-emerald-500 dark:text-emerald-300',
  },
] as const;

const REVIEW_ACCENTS = [
  'from-rose-400 via-fuchsia-500 to-pink-600 shadow-[0_18px_40px_-20px_rgba(190,24,93,0.35)]',
  'from-violet-400 via-indigo-500 to-blue-600 shadow-[0_18px_40px_-20px_rgba(79,70,229,0.35)]',
  'from-emerald-300 via-teal-400 to-emerald-600 shadow-[0_18px_40px_-20px_rgba(5,150,105,0.35)]',
] as const;

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const extensionUrl = String(import.meta.env.VITE_CHROME_EXTENSION_URL ?? '').trim();


  const handleCreateAccountClick = (location: string) => {
    trackEvent('cta_click', { location, action: 'signup' });
    navigate('/signup');
  };

  const handleInstallClick = (location: string) => {
    trackEvent('cta_click', { location, action: 'install_extension' });
    if (extensionUrl) {
      window.open(extensionUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate('/how-it-works');
  };

  return (
    <MarketingLayout className="oryx-shell-bg overflow-x-hidden text-[color:var(--text-primary)]" headerVariant="glass" footerVariant="dark">
      <section className="marketing-section landing-hero-section">
        <div className="marketing-container">
          <div className="mx-auto max-w-5xl text-center">


            <h1
              className={`landing-hero-title ${isRtl ? 'landing-hero-title-ar' : 'landing-hero-title-en'} marketing-heading marketing-title-xl mx-auto mt-8 max-w-[11ch] text-[color:var(--text-primary)] sm:max-w-[12ch]`}
            >
              {t('landing.hero_heading_1')}
              <span className="block gradient-text-animated">{t('landing.hero_heading_2')}</span>
            </h1>

            <p className="marketing-copy mx-auto mt-6 max-w-3xl text-base sm:text-lg">
              {t('landing.hero_sub')}
            </p>

            <p className="mx-auto mt-6 max-w-2xl text-sm font-semibold text-[color:var(--text-muted)] sm:text-base">
              {t('landing.run_desc')}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => handleInstallClick('hero_install')}
                className="marketing-secondary-btn inline-flex w-full items-center justify-center gap-3 px-7 py-4 text-base sm:w-auto"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-black/5">
                  <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
                    <path fill="#EA4335" d="M24 4c7.4 0 13.8 4 17.3 9.9H24c-3.7 0-7.1 2-8.9 5.2L9.4 9.3A20.1 20.1 0 0 1 24 4Z" />
                    <path fill="#FBBC04" d="M9.4 9.3 18 24c1.9 3.2 5.3 5.2 9 5.2h11.4A20 20 0 0 1 24 44 20 20 0 0 1 6.7 14.1Z" />
                    <path fill="#34A853" d="M41.3 13.9A19.9 19.9 0 0 1 24 44c7.4 0 13.8-4 17.3-9.9L32.7 19A10.3 10.3 0 0 1 34 24c0 1.8-.4 3.6-1.2 5.2h8.6A20 20 0 0 0 41.3 13.9Z" />
                    <circle cx="24" cy="24" r="7.6" fill="#4285F4" />
                  </svg>
                </span>
                <span>{t('landing.install_extension')}</span>
                {extensionUrl ? <ExternalLink size={16} /> : <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />}
              </button>

              <button
                onClick={() => handleCreateAccountClick('hero_signup')}
                className="gradient-btn inline-flex w-full items-center justify-center gap-3 rounded-full px-7 py-4 text-base sm:w-auto"
              >
                {t('landing.create_free_account')}
                <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
              </button>
            </div>


          </div>

          <div className="mx-auto mt-12 max-w-4xl">
            <div className="marketing-panel-strong block w-full overflow-hidden p-5 text-left sm:p-6">
              <div className="flex justify-center">
                <div className="marketing-badge min-w-[220px] text-center">
                  <span>{t('landing.how_it_works')}</span>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-[30px] border border-[color:var(--brand-border-strong)] bg-[#050b16] p-2 sm:p-3">
                <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.14),transparent_45%),linear-gradient(180deg,#0b1220,#090f1b)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <video
                    className="landing-demo-video block aspect-[16/10] w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  >
                    <source src="/betademo.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>

              <div className="mx-auto mt-6 max-w-2xl text-center">
                <h2 className="marketing-heading marketing-title-md mx-auto max-w-[14ch] text-[color:var(--text-primary)]">
                  {t('landing.run_one_question')}
                </h2>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
            {HERO_SUPPORT_ITEMS.map((item) => (
              <div key={item} className="marketing-panel px-4 py-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-[color:var(--text-primary)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--state-success)]" />
                  <span>{t(item)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="marketing-section marketing-anchor-target">
        <div className="marketing-container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="marketing-eyebrow">{t('landing.features_eyebrow')}</p>
            <h2 className="marketing-heading marketing-title-lg mx-auto mt-4 max-w-[11ch] text-[color:var(--text-primary)]">
              {t('landing.features_title')}
            </h2>
            <p className="marketing-copy mx-auto mt-4 max-w-2xl text-base sm:text-lg">{t('landing.features_desc')}</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {LANDING_FEATURES.map((feature, index) => {
              const presentation = FEATURE_PRESENTATIONS[index % FEATURE_PRESENTATIONS.length];
              const Icon = presentation.Icon;

              return (
                <div
                  key={feature.id}
                  className="marketing-panel group rounded-[30px] p-8 transition duration-200 hover:-translate-y-1 hover:border-[color:var(--brand-border-strong)]"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br ${presentation.iconWrap}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black tracking-[-0.02em] text-[color:var(--text-primary)]">
                    {t(`landing.features.${feature.id}.title`)}
                  </h3>
                  <p className="marketing-copy mt-3 max-w-xl text-base">
                    {t(`landing.features.${feature.id}.description`)}
                  </p>
                  <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${presentation.arrow}`}>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 dark:border-amber-300/15 dark:bg-amber-400/8 dark:text-amber-200">
              <Star className="h-3.5 w-3.5 fill-current" />
              {t('landing.reviews_eyebrow')}
            </div>
            <h2 className="marketing-heading marketing-title-lg mx-auto mt-6 max-w-[14ch] text-[color:var(--text-primary)]">
              {t('landing.reviews_titlePrefix')} <span className="gradient-text-animated">{t('landing.reviews_titleHighlight')}</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {LANDING_REVIEWS.map((review, index) => {
              const reviewAccent = REVIEW_ACCENTS[index % REVIEW_ACCENTS.length];

              return (
                <div key={review.id} className="marketing-panel rounded-[30px] p-7">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star key={`${review.id}-${starIndex}`} className="h-4 w-4 fill-current stroke-0" />
                    ))}
                  </div>
                  <p className="mt-5 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                    "{review.quote}"
                  </p>
                  <div className="mt-8 flex items-center gap-4">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-base font-black text-white ${reviewAccent}`}>
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-base font-black text-[color:var(--text-primary)]">{t(`landing.reviews.${review.id}.name`)}</p>
                      <p className="text-sm font-medium text-[color:var(--text-muted)]">{t(`landing.reviews.${review.id}.role`)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      <section className="marketing-section pt-0">
        <div className="marketing-container">
          <div className="marketing-panel-strong mx-auto max-w-4xl p-10 text-center sm:p-14">
            <p className="marketing-eyebrow">{t('landing.ready_to_start')}</p>
            <h2 className="marketing-heading marketing-title-lg mx-auto mt-4 max-w-2xl text-[color:var(--text-primary)]">
              {t('landing.run_one_question')}
            </h2>
            <p className="marketing-copy mx-auto mt-4 max-w-2xl text-base sm:text-lg">
              {t('landing.run_desc')}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={() => handleCreateAccountClick('final_signup')}
                className="gradient-btn inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-base"
              >
                {t('landing.create_free_account')}
                <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
