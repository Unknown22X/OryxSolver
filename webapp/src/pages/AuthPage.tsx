import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';
import { fetchPublicAppConfig, FALLBACK_PUBLIC_CONFIG } from '../lib/appConfig';
import {
  buildLegalConsentMetadata,
  clearPendingLegalConsent,
  storePendingLegalConsent,
} from '../lib/legalConsent';

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [termsVersion, setTermsVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.terms_version);
  const [privacyVersion, setPrivacyVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.privacy_version);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const navigate = useNavigate();
  const googleNeedsConsent = mode === 'signup' && (!acceptedTerms || !acceptedPrivacy);

  useEffect(() => {
    let active = true;
    async function loadLegalVersions() {
      try {
        const config = await fetchPublicAppConfig();
        if (!active) return;
        setTermsVersion(config.legalVersions.terms_version);
        setPrivacyVersion(config.legalVersions.privacy_version);
      } catch (error) {
        console.error('Failed to load legal versions for signup:', error);
      }
    }
    void loadLegalVersions();
    return () => {
      active = false;
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup' && (!acceptedTerms || !acceptedPrivacy)) {
      setMessage({ text: 'You must agree to the Terms and Privacy Policy before creating an account.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/how-it-works`,
            data: buildLegalConsentMetadata({
              termsVersion,
              privacyVersion,
            }),
          }
        });
        if (error) throw error;
        setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/chat');
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Authentication failed';
      setMessage({ text: messageText, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleNeedsConsent) {
      setMessage({ text: 'Agree to the Terms and Privacy Policy before continuing with Google.', type: 'error' });
      return;
    }
    const stored = storePendingLegalConsent(
      buildLegalConsentMetadata({
        termsVersion,
        privacyVersion,
      }),
    );
    if (!stored) {
      setMessage({ text: 'Unable to start Google sign-in. Please refresh and try again.', type: 'error' });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat`
      }
    });
    if (error) {
      clearPendingLegalConsent();
      setMessage({ text: error.message, type: 'error' });
    }
  };

  return (
    <div className="oryx-shell-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-slate-900 dark:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.08)_0%,transparent_52%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15)_0%,transparent_50%)]" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-500/8 blur-[100px] dark:bg-blue-600/10" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-600/10" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group transition-all hover:scale-105 active:scale-95">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)] group-hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all">
              <Sparkles size={26} className="text-white" />
            </div>
            <span className="text-3xl font-black tracking-tighter italic text-slate-900 dark:text-white">Oryx<span className="text-indigo-500 not-italic">.</span></span>
          </Link>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="font-bold text-slate-500 dark:text-slate-400">
            {mode === 'signin' ? "Don't have an account? " : "Already part of Oryx? "}
            <Link to={mode === 'signin' ? '/signup' : '/login'} className="text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-4 transition-all">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Link>
          </p>
        </div>

        <div className="oryx-surface-panel-strong relative overflow-hidden rounded-[40px] p-10 group">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          
          <form onSubmit={handleAuth} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="oryx-input-surface w-full rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-500/50 focus:outline-none dark:text-white dark:placeholder:text-slate-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="oryx-input-surface w-full rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-500/50 focus:outline-none dark:text-white dark:placeholder:text-slate-600"
                  required
                />
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2 ${
                message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {message.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full gradient-btn py-4 rounded-2xl flex items-center justify-center gap-2 group disabled:opacity-50 disabled:scale-100"
            >
              <span>{loading ? 'Processing...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}</span>
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>

            {mode === 'signup' && (
              <div className="oryx-surface-soft space-y-3 rounded-2xl p-4">
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 bg-transparent"
                  />
                  <span>
                    I agree to the <Link to="/terms" className="text-indigo-500 underline">Terms of Service</Link> (version {termsVersion}).
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 bg-transparent"
                  />
                  <span>
                    I agree to the <Link to="/privacy" className="text-indigo-500 underline">Privacy Policy</Link> (version {privacyVersion}).
                  </span>
                </label>
              </div>
            )}
          </form>

          <div className="my-8 flex items-center gap-4 text-slate-500 dark:text-slate-600">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
            <span className="text-[10px] font-black uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
          </div>

          {mode === 'signup' && (
            <div className="oryx-surface-soft mb-4 rounded-2xl p-4 text-xs font-medium text-slate-600 dark:text-slate-300">
              <p>
                Google sign-in can create a new account if one does not already exist. Accept the Terms and Privacy Policy above before continuing.
              </p>
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            className="oryx-surface-soft flex w-full items-center justify-center gap-3 rounded-2xl py-4 font-bold text-slate-900 transition-all hover:border-indigo-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
            disabled={googleNeedsConsent}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="" />
            <span>{mode === 'signin' ? 'Sign in with Google' : 'Continue with Google'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
