import { Link, useLocation } from 'react-router-dom';

export default function ExtensionAuthPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') ?? `chrome-extension://mjkabenjbimongaimgpdkjobmfdeelno/src/sidepanel/index.html`;
  const safeRedirect = encodeURIComponent(redirect);

  return (
    <div className="oryx-shell-bg relative flex min-h-screen items-center justify-center overflow-hidden px-6 text-slate-900 dark:text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.08)_0%,transparent_52%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15)_0%,transparent_50%)]" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-500/8 blur-[100px] dark:bg-blue-600/10" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-600/10" />
      </div>

      <div className="w-full max-w-xl relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="oryx-surface-panel-strong relative overflow-hidden rounded-[36px] p-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-[24%]">
            <img src="/app_icons/logo.png" alt="Oryx" className="oryx-logo-clean h-full w-full object-contain" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-400">Extension sign-in</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Finish sign in on the web</h1>
          <p className="mt-4 text-base font-medium text-slate-500 dark:text-slate-400">
            Use the web login flow, then return to the extension automatically once authentication completes.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to={`/login?redirect=${safeRedirect}`}
              className="gradient-btn inline-flex items-center justify-center rounded-2xl px-6 py-4 text-sm font-bold"
            >
              Sign in
            </Link>
            <Link
              to={`/signup?redirect=${safeRedirect}`}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-sm font-bold text-slate-800 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Create account
            </Link>
          </div>

          <p className="mt-6 text-xs font-semibold text-slate-400">
            You will return to the extension when the login finishes.
          </p>
        </div>
      </div>
    </div>
  );
}
