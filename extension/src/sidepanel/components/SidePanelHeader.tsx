import { SignedIn, SignedOut,  UserButton } from '@clerk/chrome-extension';
import { Settings, CreditCard, Crown } from 'lucide-react';

type SidePanelHeaderProps = {
  logoUrl: string;
  appName: string;
  usedCredits: number;
  totalCredits: number;
};

export default function SidePanelHeader({
  logoUrl,
  appName,
  usedCredits,
  totalCredits,
}: SidePanelHeaderProps) {
  const sidepanelUrl = window.location.href;
  const creditPercentage = (usedCredits / totalCredits) * 100;
  const isUsageWarning = usedCredits >= 40;
  const isUsageCritical = usedCredits >= 48;
  const remainingCredits = Math.max(totalCredits - usedCredits, 0);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-6 border-b border-white/60 bg-white/68 px-6 shadow-sm backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="rounded-lg p-2">
          <img src={logoUrl} alt={`${appName} logo`} className="h-4 w-4 rounded" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{appName}</h1>
      </div>

      <SignedIn>
        <div className="flex items-center gap-4">
          <div className="relative cursor-help">
            <div
              className={`flex items-center gap-2 rounded-full border px-4 py-2 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 ${
                isUsageWarning
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-300 bg-slate-100'
              } ${isUsageWarning ? 'animate-pulse [animation-duration:2.4s]' : ''}`}
            >
              <CreditCard
                size={13}
                className={isUsageWarning ? 'text-amber-700' : 'text-slate-600'}
              />
              <span
                className={`text-xs font-semibold ${
                  isUsageWarning ? 'text-amber-800' : 'text-slate-700'
                }`}
              >
                {usedCredits}/{totalCredits}
              </span>
            </div>
            <div className="absolute bottom-0 left-4 right-4 h-px overflow-hidden rounded-full bg-slate-400">
              <div
                className="h-full bg-slate-600 transition-all duration-500"
                style={{ width: `${creditPercentage}%` }}
              />
            </div>
            {isUsageCritical && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Almost out ({remainingCredits} left)
              </span>
            )}
          </div>

          <button className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-gradient-to-r from-violet-100 to-indigo-100 px-4 py-2 text-xs font-semibold text-violet-800 shadow-md shadow-violet-200/60 transition hover:-translate-y-0.5 hover:border-violet-400 hover:from-violet-200 hover:to-indigo-200 hover:shadow-lg">
            <Crown size={14} className="text-violet-600" />
            Upgrade to Pro
          </button>

          <button className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-500">
            <Settings size={20} />
          </button>
          <UserButton afterSignOutUrl={sidepanelUrl} />
        </div>
      </SignedIn>

      <SignedOut>
        <button  onClick={() => window.open('https://www.example.com', '_blank')} className="inline-flex items-center gap-2 rounded-full border border-indigo-300 bg-gradient-to-br from-indigo-100 to-violet-100 px-4 py-2 text-xs font-semibold text-indigo-800 shadow-md shadow-indigo-200/60 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:from-indigo-200 hover:to-violet-200 hover:shadow-lg" >
          Learn more about OryxSolver
        </button>
      </SignedOut>
    </header>
  );
}
