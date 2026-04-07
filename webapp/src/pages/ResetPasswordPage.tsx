import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { MascotIcon } from '../components/MascotIcon';
import { useTranslation } from 'react-i18next';
import { toPublicErrorMessage } from '../lib/supabaseAuth';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const navigate = useNavigate();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setMessage({ text: t('auth.error_password_length'), type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: t('auth.error_passwords_match'), type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setMessage({ text: t('auth.password_updated_success'), type: 'success' });
      setTimeout(() => {
        navigate('/chat');
      }, 1500);
    } catch (err) {
      const errorMessage = toPublicErrorMessage(err, t('auth.error_update_password'));
      setMessage({ text: errorMessage, type: 'error' });
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
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#0f1115] dark:shadow-none transition-all duration-500">
          <div className="p-10 pb-8">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex mx-auto mb-6 h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900 transition-all hover:scale-105 active:scale-95">
                <MascotIcon name="sparkle" size={24} className="text-white dark:text-slate-900" />
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {t('auth.set_new_password')}
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {t('auth.enter_new_password')}
              </p>
            </div>

            {message && (
              <div className={`mb-6 p-4 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2 ${
                message.type === 'error' ? 'bg-rose-50/80 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' : 'bg-emerald-50/80 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 dark:text-slate-300">{t('auth.new_password_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.new_password_placeholder')}
                    className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-11 pr-12 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    required
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 dark:text-slate-300">{t('auth.confirm_password_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirm_password_placeholder')}
                    className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-11 pr-12 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition-all hover:scale-[1.01] hover:bg-slate-800 active:scale-[0.99] disabled:scale-100 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:shadow-white/5"
              >
                <span>{loading ? t('auth.updating') : t('auth.update_password_btn')}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
