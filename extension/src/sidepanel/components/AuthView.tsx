import { useState } from 'react';
import { Mail, Lock, Key, ArrowRight } from 'lucide-react';
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
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  termsVersion: string;
  privacyVersion: string;
  onSetAcceptedTerms: (value: boolean) => void;
  onSetAcceptedPrivacy: (value: boolean) => void;
  onSetView: (view: AuthViewType) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  webAppBaseUrl?: string;
};

export default function AuthView({
  view,
  method,
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
  acceptedTerms,
  acceptedPrivacy,
  termsVersion,
  privacyVersion,
  onSetAcceptedTerms,
  onSetAcceptedPrivacy,
  onSetView,
  onSignIn,
  onSignUp,
  onVerifyOtp,
  onResendOtp,
  webAppBaseUrl = 'https://oryxsolver.com',
}: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="oryx-shell-panel-strong relative w-full max-w-sm overflow-hidden rounded-[40px] border transition-all duration-500">
        {/* Top Branding */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-white shadow-xl shadow-indigo-100 ring-1 ring-slate-100 transition-transform hover:scale-105 duration-300 dark:bg-slate-800 dark:shadow-none dark:ring-slate-700">
            <img src={logoUrl} alt="OryxSolver" className="h-full w-full object-cover p-3 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {view === 'sign-in' ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {view === 'sign-in' 
              ? 'Sign in to access your solving history.' 
              : 'Join OryxSolver and solve anything instantly.'}
          </p>
        </div>

        {/* Auth Form Section */}
        <div className="px-8 pb-10">
          {/* Method Switcher */}
          <div className="mb-6 flex rounded-2xl bg-slate-100/50 p-1.5 ring-1 ring-slate-200/50 dark:bg-slate-800/40 dark:ring-slate-700">
            <button
              type="button"
              onClick={() => onSetMethod('password')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                method === 'password'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => onSetMethod('code')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                method === 'code'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Email Code
            </button>
          </div>

          <div className="space-y-4">
            {/* Email Input */}
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => onSetEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            {/* Password Input */}
            {method === 'password' && (
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onSetPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-10 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            )}

            {/* OTP Input */}
            <div className={`group relative transition-all duration-300 ${isOtpRequested ? 'block' : 'hidden'}`}>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Key size={18} />
              </div>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => onSetOtpCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full rounded-2xl border border-slate-200 bg-white/60 py-3 pl-11 pr-4 text-sm font-semibold tracking-wider outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>

            {message && (
              <p className="px-1 text-center text-xs font-bold text-rose-500 animate-in fade-in slide-in-from-top-1">
                {message}
              </p>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              {!isOtpRequested ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={view === 'sign-in' ? onSignIn : onSignUp}
                  title={view === 'sign-in' ? 'Click to Sign In' : 'Click to Create Account'}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 dark:shadow-none"
                >
                  <span>{isBusy ? 'Processing...' : (view === 'sign-in' ? 'Sign In' : 'Create Account')}</span>
                  {!isBusy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={onVerifyOtp}
                    title="Verify identity with code"
                    className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {isBusy ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || resendCooldown > 0}
                    onClick={onResendOtp}
                    className="w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition disabled:text-slate-400 dark:text-indigo-400"
                  >
                    {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </>
              )}

              {view === 'sign-up' && !isOtpRequested && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => onSetAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span>I agree to the Terms ({termsVersion}).</span>
                  </label>
                  <label className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => onSetAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span>I agree to the Privacy Policy ({privacyVersion}).</span>
                  </label>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => window.open(`${webAppBaseUrl}/terms`, '_blank')}
                      className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Terms
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`${webAppBaseUrl}/privacy`, '_blank')}
                      className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      Privacy
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => onSetView(view === 'sign-in' ? 'sign-up' : 'sign-in')}
                  className="block w-full text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors dark:text-indigo-400"
                >
                  {view === 'sign-in' ? "Need an account? Create one" : "Already have an account? Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`${webAppBaseUrl}/${view === 'sign-up' ? 'signup' : 'login'}`, '_blank')}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors dark:text-indigo-400"
                >
                  Continue with Google on the web app
                </button>
                <p className="text-[10px] font-medium text-slate-400">
                  Google auth is handled on the web app for now. After that, use the same account here.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(webAppBaseUrl, '_blank')}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Open web portal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
