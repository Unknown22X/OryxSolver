import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './lib/supabase';
import { OryxPostHogProvider } from './lib/posthog';
import { AnalyticsProvider } from './lib/analytics';
import { identifyUser, resetAnalytics } from './lib/analyticsClient';
import type { User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import AdminRoute from './components/AdminRoute';
import { clearPendingLegalConsent, readPendingLegalConsent } from './lib/legalConsent';
import { fetchPublicAppConfig, type PublicAppConfig } from './lib/appConfig';
import MaintenanceOverlay from './components/MaintenanceOverlay';
import ServiceStatusBanner from './components/ServiceStatusBanner';
import { hasCompletedOnboarding } from './lib/onboarding';
import { useServiceHealth } from './hooks/useServiceHealth';
import { getSessionWithRetry, updateUserWithRetry } from './lib/supabaseAuth';
import { readAuthFlowError } from './lib/authErrors';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const ModesPage = lazy(() => import('./pages/ModesPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const ExtensionAuthPage = lazy(() => import('./pages/ExtensionAuthPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

const PageLoader = () => (
  <div className="marketing-loader-shell">
    <div className="marketing-loader-card">
      <img
        src="/app_icons/thinking.png"
        alt="Oryx loading"
        className="marketing-loader-mascot"
      />
      <p className="marketing-eyebrow mt-6">OryxSolver</p>
      <h2 className="marketing-heading mt-3 text-3xl text-[color:var(--text-primary)]">
        Thinking through your study flow.
      </h2>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
        Loading your workspace, restoring your session, and getting the next solve ready.
      </p>
      <div className="marketing-loader-track mt-8">
        <div className="marketing-loader-bar" />
      </div>
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const { health, retryCountdowns, refresh: refreshHealth } = useServiceHealth();

  useEffect(() => {
    const stored = localStorage.getItem('oryx_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('oryx_theme', theme);
  }, [theme]);

  useEffect(() => {
    const syncTelemetryUser = (nextUser: User | null) => {
      if (nextUser) {
        identifyUser(nextUser.id, { email: nextUser.email });
        Sentry.setUser({
          id: nextUser.id,
          email: nextUser.email ?? undefined,
        });
        return;
      }

      resetAnalytics();
      Sentry.setUser(null);
    };

    const checkSession = async () => {
      try {
        const { data: { session } } = await getSessionWithRetry({
          fallbackMessage: 'Authentication is temporarily unavailable. Please retry.',
        });
        setUser(session?.user ?? null);
        syncTelemetryUser(session?.user ?? null);
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      syncTelemetryUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await fetchPublicAppConfig();
        setConfig(data);
      } catch (err) {
        console.error('Failed to load app config:', err);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    async function syncPendingLegalConsent() {
      if (!user) return;

      const pending = readPendingLegalConsent();
      if (!pending) {
        clearPendingLegalConsent();
        return;
      }

      try {
        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
        const hasConsent =
          metadata.accepted_terms === true &&
          metadata.accepted_privacy === true &&
          typeof metadata.accepted_terms_version === 'string' &&
          typeof metadata.accepted_privacy_version === 'string';

        if (hasConsent) {
          clearPendingLegalConsent();
          return;
        }

        const { error } = await updateUserWithRetry(
          { data: pending },
          { fallbackMessage: 'We could not sync your account details right now. Please try again.' },
        );
        if (error) throw error;
        clearPendingLegalConsent();
      } catch (error) {
        console.error('Failed to sync pending legal consent:', error);
      }
    }

    void syncPendingLegalConsent();
  }, [user]);

  if (loading) {
    return <PageLoader />;
  }

  const onboardingComplete = hasCompletedOnboarding(user);
  const authedHome = onboardingComplete ? '/chat' : '/onboarding';
  const authFlowError =
    typeof window !== 'undefined' ? readAuthFlowError(window.location.search, window.location.hash) : null;
  const rootAuthRedirect = authFlowError
    ? `/login?auth_error_code=${encodeURIComponent(authFlowError.code)}&auth_error_description=${encodeURIComponent(authFlowError.description)}`
    : null;
  const guardAuthedRoute = (element: ReactNode) =>
    user ? (onboardingComplete ? element : <Navigate to="/onboarding" replace />) : <Navigate to="/login" />;

  return (
    <OryxPostHogProvider>
      {config?.maintenance_mode && <MaintenanceOverlay />}
      {!config?.maintenance_mode && (
        <ServiceStatusBanner
          health={health}
          retryCountdowns={retryCountdowns}
          onRetry={() => void refreshHealth()}
        />
      )}
      <Sentry.ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center">Something went wrong.</div>}>
        <Router>
          <AnalyticsProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={rootAuthRedirect ? <Navigate to={rootAuthRedirect} replace /> : user ? <Navigate to={authedHome} /> : <LandingPage />} />
                <Route path="/login" element={user ? <Navigate to={authedHome} /> : <AuthPage mode="signin" />} />
                <Route path="/signup" element={user ? <Navigate to={authedHome} /> : <AuthPage mode="signup" />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/extension-auth" element={<ExtensionAuthPage />} />
                <Route path="/onboarding" element={user ? (onboardingComplete ? <Navigate to="/chat" replace /> : <OnboardingPage user={user} />) : <Navigate to="/signup" replace />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/payments-coming-soon" element={user ? <Navigate to="/subscription" replace /> : <Navigate to="/login" replace />} />
                <Route path="/modes" element={<ModesPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/dashboard" element={guardAuthedRoute(<UserDashboard user={user!} />)} />
                <Route path="/chat" element={guardAuthedRoute(<ChatPage user={user!} />)} />
                <Route
                  path="/admin"
                  element={user ? (
                    <AdminRoute user={user}>
                      <AdminDashboard user={user} />
                    </AdminRoute>
                  ) : <Navigate to="/login" />}
                />
                <Route path="/history" element={guardAuthedRoute(<HistoryPage user={user!} />)} />
                <Route path="/subscription" element={guardAuthedRoute(<SubscriptionPage user={user!} />)} />
                <Route path="/settings" element={guardAuthedRoute(<SettingsPage user={user!} />)} />
                <Route path="/profile" element={guardAuthedRoute(<ProfilePage user={user!} />)} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </AnalyticsProvider>
        </Router>
      </Sentry.ErrorBoundary>
    </OryxPostHogProvider>
  );
}

export default App;
