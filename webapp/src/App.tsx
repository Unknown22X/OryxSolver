import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { OryxPostHogProvider } from './lib/posthog';
import { AnalyticsProvider } from './lib/analytics';
import { identifyUser, resetAnalytics } from './lib/analyticsClient';
import type { User } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import AdminRoute from './components/AdminRoute';
import { clearPendingLegalConsent, readPendingLegalConsent } from './lib/legalConsent';

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
const PaymentsComingSoonPage = lazy(() => import('./pages/PaymentsComingSoonPage'));
const ModesPage = lazy(() => import('./pages/ModesPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));

// A simple loading fallback for Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-[0.2em]" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <span>Loading...</span>
    </div>
  </div>
);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

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
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          identifyUser(session.user.id, { email: session.user.email });
        } else {
          resetAnalytics();
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        identifyUser(session.user.id, { email: session.user.email });
      } else {
        resetAnalytics();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

        const { error } = await supabase.auth.updateUser({ data: pending });
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

  return (
    <OryxPostHogProvider>
      <Sentry.ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center">Something went wrong.</div>}>
        <Router>
          <AnalyticsProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={user ? <Navigate to="/chat" /> : <LandingPage />} />
                <Route path="/login" element={user ? <Navigate to="/chat" /> : <AuthPage mode="signin" />} />
                <Route path="/signup" element={user ? <Navigate to="/chat" /> : <AuthPage mode="signup" />} />
                <Route path="/onboarding" element={<Navigate to="/how-it-works" replace />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/payments-coming-soon" element={<PaymentsComingSoonPage />} />
                <Route path="/modes" element={<ModesPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/dashboard" element={user ? <UserDashboard user={user} /> : <Navigate to="/login" />} />
                <Route path="/chat" element={user ? <ChatPage user={user} /> : <Navigate to="/login" />} />
                <Route
                  path="/admin"
                  element={user ? (
                    <AdminRoute user={user}>
                      <AdminDashboard user={user} />
                    </AdminRoute>
                  ) : <Navigate to="/login" />}
                />
                <Route path="/history" element={user ? <HistoryPage user={user} /> : <Navigate to="/login" />} />
                <Route path="/settings" element={user ? <SettingsPage user={user} /> : <Navigate to="/login" />} />
                <Route path="/profile" element={user ? <ProfilePage user={user} /> : <Navigate to="/login" />} />
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
