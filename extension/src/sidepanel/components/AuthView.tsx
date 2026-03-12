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
  onSetView: (view: AuthViewType) => void;
  onSetMethod: (method: AuthMethod) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
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
  onSetView,
  onSetMethod,
  onSignIn,
  onSignUp,
  onVerifyOtp,
  onResendOtp,
}: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[40px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl transition-all duration-500 dark:bg-slate-900/80 dark:border-slate-800">
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

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => window.open('https://oryxsolver.com/auth', '_blank')}
                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors dark:text-slate-400 dark:hover:text-indigo-300"
                >
                  {view === 'sign-in' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
