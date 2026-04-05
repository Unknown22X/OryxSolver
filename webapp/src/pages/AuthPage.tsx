import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { fetchPublicAppConfig, FALLBACK_PUBLIC_CONFIG } from '../lib/appConfig';
import {
  buildLegalConsentMetadata,
  clearPendingLegalConsent,
  storePendingLegalConsent,
} from '../lib/legalConsent';
import { getFriendlyAuthErrorMessage, readAuthFlowError } from '../lib/authErrors';
import { toPublicErrorMessage } from '../lib/supabaseAuth';

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [termsVersion, setTermsVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.terms_version);
  const [privacyVersion, setPrivacyVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.privacy_version);
  const [otp, setOtp] = useState('');
  const [signupStep, setSignupStep] = useState<'form' | 'confirm'>('form');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const navigate = useNavigate();
  
  const isConfirmingSignup = mode === 'signup' && signupStep === 'confirm';
  const googleNeedsConsent = mode === 'signup' && (!acceptedTerms || !acceptedPrivacy);
  
  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('redirect');
    const fallback =
      mode === 'signup'
        ? `${window.location.origin}/onboarding`
        : `${window.location.origin}/chat`;

    if (!raw) return fallback;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.protocol === 'chrome-extension:') {
        return url.host === 'mjkabenjbimongaimgpdkjobmfdeelno' ? url.toString() : fallback;
      }
      if (url.origin === window.location.origin) {
        return url.toString();
      }
      return fallback;
    } catch {
      return fallback;
    }
  }, [location.search, mode]);

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

  useEffect(() => {
    const authFlowError = readAuthFlowError(location.search, location.hash);
    if (!authFlowError) return;
    setMessage({ text: getFriendlyAuthErrorMessage(authFlowError), type: 'error' });
  }, [location.hash, location.search]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        if (!email) {
          setMessage({ text: t('auth.error_email_required', { defaultValue: 'Please enter your email address.' }), type: 'error' });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({ text: t('auth.reset_link_sent', { defaultValue: 'Password reset link sent! Check your email.' }), type: 'success' });
        setLoading(false);
        return;
      }

      if (mode === 'signup' && !isConfirmingSignup && (!acceptedTerms || !acceptedPrivacy)) {
        setMessage({ text: t('auth.error_agree_terms', { defaultValue: 'You must agree to the Terms and Privacy Policy before creating an account.' }), type: 'error' });
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, 
          password,
          options: {
            emailRedirectTo: redirectTarget,
            data: buildLegalConsentMetadata({
              termsVersion,
              privacyVersion,
            }),
          }
        });
        const isExistingUserSignup =
          (!error && !data.session && Array.isArray(data.user?.identities) && data.user.identities.length === 0) ||
          (error ? /already registered|already exists|user already registered/i.test(error.message) : false);

        if (isExistingUserSignup) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInError) {
            navigate('/chat');
            return;
          }
          setMessage({ text: t('auth.error_account_exists', { defaultValue: 'Account already exists. Use Sign In or reset your password.' }), type: 'error' });
          return;
        }

        if (error) throw error;

        if (data.user) {
          setSignupStep('confirm');
        }
        setMessage({ text: t('auth.signup_success', { defaultValue: 'Check your email for the confirmation code or link to finish signup.' }), type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(redirectTarget);
      }
    } catch (err) {
      const messageText = toPublicErrorMessage(err, t('auth.auth_failed', { defaultValue: 'Authentication failed' }));
      setMessage({ text: messageText, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (googleNeedsConsent) {
      setMessage({ text: t('auth.error_google_terms', { defaultValue: 'Agree to the Terms and Privacy Policy before continuing with Google.' }), type: 'error' });
      return;
    }
    const stored = storePendingLegalConsent(
      buildLegalConsentMetadata({
        termsVersion,
        privacyVersion,
      }),
    );
    if (!stored) {
      setMessage({ text: t('auth.error_google_start', { defaultValue: 'Unable to start Google sign-in. Please refresh and try again.' }), type: 'error' });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTarget
      }
    });
    if (error) {
      clearPendingLegalConsent();
      setMessage({ text: toPublicErrorMessage(error, 'Google sign-in could not be started. Please try again.'), type: 'error' });
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setMessage({ text: t('auth.error_otp_required', { defaultValue: 'Enter the confirmation code from your email.' }), type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: 'signup',
      });
      if (error) throw error;
      setMessage({ text: t('auth.otp_success', { defaultValue: 'Email confirmed. You can sign in now.' }), type: 'success' });
      setSignupStep('form');
      setOtp('');
      window.location.assign(redirectTarget);
    } catch (err) {
      const messageText = toPublicErrorMessage(err, 'Verification failed. Please request a new confirmation email.');
      setMessage({ text: messageText, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectTarget,
        },
      });
      if (error) throw error;
      setMessage({ text: t('auth.resend_success', { defaultValue: 'We sent a new confirmation email.' }), type: 'success' });
    } catch (err) {
      const messageText = toPublicErrorMessage(err, 'We could not resend the confirmation email right now.');
      setMessage({ text: messageText, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="oryx-shell-bg relative flex min-h-screen items-center justify-center overflow-auto px-6 py-12 text-slate-900 dark:text-white custom-scrollbar">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.08)_0%,transparent_52%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15)_0%,transparent_50%)]" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-500/8 blur-[100px] dark:bg-blue-600/10" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-600/10" />
      </div>

      <div className="w-full max-w-[400px] relative z-10 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Main Card */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#0f1115] dark:shadow-none transition-all duration-500">
          
          <div className="p-10 pb-8">
            {/* Header Content */}
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex mx-auto mb-6 h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900 transition-all hover:scale-105 active:scale-95">
                <Sparkles size={24} className="text-white dark:text-slate-900" />
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {isForgotPassword ? t('auth.reset_heading') : mode === 'signin' ? t('auth.welcome_back') : t('auth.sign_up_heading')}
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {isForgotPassword 
                  ? t('auth.reset_desc', { defaultValue: "Enter your email address to receive a recovery link." }) 
                  : t('auth.welcome_desc', { defaultValue: "Welcome! Please fill in the details to get started." })}
              </p>
            </div>

            {/* Error Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2 ${
                message.type === 'error' ? 'bg-rose-50/80 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' : 'bg-emerald-50/80 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
              }`}>
                {message.text}
              </div>
            )}

            {/* Google Social Button */}
            {!isConfirmingSignup && !isForgotPassword && (
              <div className="mb-6">
                {mode === 'signup' && (
                  <div className="mb-4 oryx-surface-soft rounded-2xl p-3 text-xs font-medium text-slate-600 dark:text-slate-400 text-center border border-slate-100 dark:border-slate-800">
                    <p>{t('auth.google_terms_notice', { defaultValue: 'Accept the Terms below before continuing with Google.' })}</p>
                  </div>
                )}
                <button 
                  onClick={handleGoogleLogin}
                  disabled={googleNeedsConsent || loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google" />
                  <span>{t('auth.continue_with_google', { defaultValue: 'Continue with Google' })}</span>
                </button>
              </div>
            )}

            {/* Divider */}
            {!isConfirmingSignup && !isForgotPassword && (
              <div className="my-6 flex items-center gap-4 text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('auth.or')}</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuth} className="space-y-5">
              
              {!isConfirmingSignup && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 ml-1 dark:text-slate-300">{t('auth.email_label', { defaultValue: 'Email address' })}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.email_placeholder')}
                      className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      required
                    />
                  </div>
                </div>
              )}

              {!isConfirmingSignup && !isForgotPassword && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1 mr-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.password_label', { defaultValue: 'Password' })}</label>
                    <button 
                      type="button" 
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                    >
                      {t('auth.forgot_password')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.password_placeholder')}
                      className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-11 pr-12 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      required={!isForgotPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Legal Checkboxes for Sign Up */}
              {mode === 'signup' && !isConfirmingSignup && !isForgotPassword && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
                  <label className="flex items-start gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 bg-transparent"
                    />
                    <span>
                      {t('auth.agree_terms_1', { defaultValue: 'I agree to the ' })}
                      <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('auth.terms_of_service', { defaultValue: 'Terms of Service' })}</Link> ({termsVersion}).
                    </span>
                  </label>
                  <label className="flex items-start gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 bg-transparent"
                    />
                    <span>
                      {t('auth.agree_terms_1', { defaultValue: 'I agree to the ' })}
                      <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('auth.privacy_policy', { defaultValue: 'Privacy Policy' })}</Link> ({privacyVersion}).
                    </span>
                  </label>
                </div>
              )}

              {/* OTP Confirmation Step */}
              {isConfirmingSignup && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 ml-1 dark:text-slate-300">{t('auth.confirm_code_label', { defaultValue: 'Confirmation Code' })}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder={t('auth.confirm_code_placeholder', { defaultValue: '6-digit code' })}
                      className="w-full rounded-xl border border-slate-200 bg-transparent py-3 px-4 text-sm font-semibold tracking-wider outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={loading}
                      className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {t('auth.verify_btn', { defaultValue: 'Verify' })}
                    </button>
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {t('auth.resend_btn', { defaultValue: 'Resend' })}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupStep('form');
                      setOtp('');
                      setMessage(null);
                    }}
                    className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-slate-700 transition dark:text-slate-400 dark:hover:text-slate-300 pt-2"
                  >
                    {t('auth.change_email_btn', { defaultValue: 'Change email or password' })}
                  </button>
                </div>
              )}

              {/* Main Submit Button */}
              {!isConfirmingSignup && (
                <button
                  type="submit"
                  disabled={loading || (mode === 'signup' && (!acceptedTerms || !acceptedPrivacy) && !isForgotPassword)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition-all hover:scale-[1.01] hover:bg-slate-800 active:scale-[0.99] disabled:scale-100 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:shadow-white/5"
                >
                  <span>{loading ? t('common.processing') : isForgotPassword ? t('auth.send_reset') : mode === 'signin' ? t('auth.sign_in') : t('auth.sign_up')}</span>
                  {!loading && !isForgotPassword && <ArrowRight size={18} className="" />}
                </button>
              )}

            </form>
          </div>

          {/* Bottom Banner */}
          {!isConfirmingSignup && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-5 text-center dark:border-slate-800/50 dark:bg-slate-800/20">
              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:text-white"
                >
                  {t('auth.back_to_login')}
                </button>
              ) : (
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  {mode === 'signin' ? t('auth.no_account') + ' ' : t('auth.have_account') + ' '}
                  <Link 
                    to={mode === 'signin' ? '/signup' : '/login'} 
                    className="text-slate-800 hover:text-indigo-600 transition-colors dark:text-white dark:hover:text-indigo-400 ml-1"
                  >
                    {mode === 'signin' ? t('auth.sign_up') : t('auth.sign_in')}
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
