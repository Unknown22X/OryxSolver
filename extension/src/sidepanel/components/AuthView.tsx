import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import type { AuthView as AuthViewType, AuthMethod } from '../types';

type AuthViewProps = {
  view: AuthViewType;
  method: AuthMethod;
  email: string;
  password: string;
  otpCode: string;
  isOtpRequested: boolean;
  isBusy: boolean;
  message: string | null;
  resendCooldown: number;
  logoUrl: string;
  onSetEmail: (val: string) => void;
  onSetPassword: (val: string) => void;
  onSetOtpCode: (val: string) => void;
  onSetMethod: (method: AuthMethod) => void;
  onSetView: (view: AuthViewType) => void;
  onSignIn: () => void;
  onSignInWithGoogle: () => void;
  onSignUp: () => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  onResetPassword: () => void;
};

export default function AuthView({
  view,
  email,
  password,
  otpCode,
  isOtpRequested,
  isBusy,
  message,
  resendCooldown,
  logoUrl,
  onSetEmail,
  onSetPassword,
  onSetOtpCode,
  onSetMethod,
  onSetView,
  onSignIn,
  onSignInWithGoogle,
  onSignUp,
  onVerifyOtp,
  onResendOtp,
  onResetPassword,
}: AuthViewProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const isReset = view === 'forgot-password';

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-auto p-4 animate-in fade-in zoom-in-95 duration-500 custom-scrollbar">
      <div className="w-full max-w-[360px] flex flex-col gap-4">
        
        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#0f1115] dark:shadow-none transition-all duration-500">
          
          <div className="p-8 pb-6">
            {/* Logo */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            </div>

            {/* Header Texts */}
            <h1 className="text-center text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {isReset ? t('auth.reset_password') : view === 'sign-in' ? t('auth.welcome_back') : t('auth.create_account')}
            </h1>
            <p className="mt-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isReset
                ? t('auth.reset_desc')
                : t('auth.welcome_desc')}
            </p>

            {/* Error Message */}
            {message && (
              <div className="mt-6 rounded-xl bg-rose-50 p-3 text-center text-xs font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
                {message}
              </div>
            )}

            {/* Social Auth (Hidden in Reset & OTP mode) */}
            {!isReset && !isOtpRequested && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={isBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="16" alt="Google" />
                  {t('auth.continue_with_google')}
                </button>
              </div>
            )}

            {/* Divider */}
            {!isReset && !isOtpRequested && (
              <div className="my-6 flex items-center gap-4 text-slate-400">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            )}

            {/* Padding compensation when divider is hidden */}
            {(isReset || isOtpRequested) && <div className="mt-8" />}

            {/* Forms */}
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); }}>
              
              {!isOtpRequested && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">{t('auth.email_address')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => onSetEmail(e.target.value)}
                    placeholder={t('auth.email_placeholder')}
                    className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 px-3.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  />
                </div>
              )}

              {!isReset && !isOtpRequested && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1 mr-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('auth.password')}</label>
                    <button 
                      type="button" 
                      onClick={() => onSetView('forgot-password')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                    >
                      {t('auth.forgot_password')}
                    </button>
                  </div>
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => onSetPassword(e.target.value)}
                      placeholder={t('auth.password_placeholder')}
                      className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 px-3.5 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    />
                    {password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest">{showPassword ? t('auth.hide') : t('auth.show')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isOtpRequested && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">{t('auth.verification_code')}</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => onSetOtpCode(e.target.value)}
                    placeholder={t('auth.code_placeholder')}
                    className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 px-3.5 text-sm font-semibold tracking-wider outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-3 relative z-10">
                {!isOtpRequested ? (
                  <button
                    type="button"
                    disabled={isBusy || (!email && !isReset) || (!email && !password && !isReset)}
                    onClick={isReset ? onResetPassword : (view === 'sign-in' ? onSignIn : onSignUp)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition-all hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:shadow-white/5"
                  >
                    <span>{isBusy ? t('common.processing') : isReset ? t('auth.send_reset_link') : t('common.continue')}</span>
                    {!isBusy && !isReset && <ArrowRight size={16} className="" />}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onVerifyOtp}
                      className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition-all hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {isBusy ? t('auth.verifying') : t('auth.verify_continue')}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || resendCooldown > 0}
                      onClick={onResendOtp}
                      className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition disabled:text-slate-400 dark:text-slate-400 dark:hover:text-white"
                    >
                      {resendCooldown > 0 ? t('auth.resend_available', { count: resendCooldown }) : t('auth.resend_code')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetView('sign-in')}
                      className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-700 transition dark:text-slate-400 dark:hover:text-slate-300"
                    >
                      {t('auth.change_email')}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>

          {/* Bottom Banner (Already have an account? Sign in) */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800/50 dark:bg-slate-800/20">
            <button
              type="button"
              onClick={() => {
                onSetView(isReset ? 'sign-in' : (view === 'sign-in' ? 'sign-up' : 'sign-in'));
                onSetMethod('password'); // reset to default
              }}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:text-white"
            >
              {isReset
                ? t('auth.back_to_signin')
                : view === 'sign-in'
                  ? t('auth.dont_have_account')
                  : t('auth.already_have_account')}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
