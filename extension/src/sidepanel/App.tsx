import { useState } from 'react';
import { Settings, Sparkles, CreditCard, Crown } from 'lucide-react';
import MessageComposer from './components/MessageComposer';
import { captureCroppedAreaToFile } from './services/cameraCapture';
import AnswerHeroCard from './components/AnswerHeroCard';
import StepTimeline from './components/StepTimeline';

type AiResponse = {
  answer: string;
  explanation: string;
};

function parseExplanationSteps(explanation: string): string[] {
  const lines = explanation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return lines;

  const cleaned = lines.map((line) =>
    line.replace(/^(\d+[\).\s-]+|[-*]\s+)/, '').trim(),
  );

  const unique = cleaned.filter((line, idx) => line && cleaned.indexOf(line) === idx);
  return unique.length > 0 ? unique : cleaned;
}

export default function SidePanel() {
  const [credits] = useState({ used: 12, total: 50 });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<AiResponse | null>(null);
  const creditPercentage = (credits.used / credits.total) * 100;
  const isUsageWarning = credits.used >= 40;
  const isUsageCritical = credits.used >= 48;
  const remainingCredits = Math.max(credits.total - credits.used, 0);
  const explanationSteps = latestResponse ? parseExplanationSteps(latestResponse.explanation) : [];
  const logoUrl = chrome.runtime.getURL('public/icons/128.png');
  const solveApiUrl = 'https://my-api-endpoint.com/solve';

  const handleCaptureScreen = async (): Promise<File | null> => {
    setSendError(null);

    try {
      return await captureCroppedAreaToFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Screen capture failed';
      setSendError(message);
      return null;
    }
  };

  const handleSend = async ({ text, images }: { text: string; images: File[] }) => {
    if (!text.trim() && images.length === 0) return;

    setIsSending(true);
    setSendError(null);

    try {
      const form = new FormData();
      form.append('question', text);
      images.forEach((image) => form.append('images', image));
      // Backward compatibility for backends expecting a single `image` field.
      if (images[0]) form.append('image', images[0]);

      const res = await fetch(solveApiUrl, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const answer =
        typeof data?.answer === 'string' && data.answer.trim()
          ? data.answer.trim()
          : typeof data?.result === 'string' && data.result.trim()
            ? data.result.trim()
            : 'Answer available in explanation';

      const explanation =
        typeof data?.explanation === 'string' && data.explanation.trim()
          ? data.explanation.trim()
          : Array.isArray(data?.steps)
            ? data.steps.map((step: unknown) => String(step)).join('\n')
            : JSON.stringify(data, null, 2);

      setLatestResponse({ answer, explanation });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      setSendError(message);
      console.error('Error sending to AI:', message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,#e5e9ef_0%,#d9dee6_54%,#e6eaf0_100%)] font-sans text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_38%,rgba(255,255,255,0.34),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(15,23,42,0.09)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.007] [background-image:radial-gradient(#0f172a_0.65px,transparent_0.65px)] [background-size:3px_3px]" />

      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-6 border-b border-white/60 bg-white/68 px-6 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-lg p-2">
            <img src={logoUrl} alt="OryxSolver logo" className="h-4 w-4 rounded" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">OryxSolver</h1>
        </div>

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
                {credits.used}/{credits.total}
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
        </div>
      </header>

      <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/60 bg-white/62 px-6 shadow-sm backdrop-blur-lg">
        <span className="text-lg font-extrabold tracking-tight">See Last Questions</span>
      </div>

      <main className="flex-1 space-y-6 overflow-y-auto bg-transparent p-4">
        {latestResponse ? (
          <article className="mt-4 space-y-3">
            <AnswerHeroCard answer={latestResponse.answer} />
            <div className="rounded-2xl border border-white/65 bg-white/78 p-4 shadow-md backdrop-blur-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Why this is correct
              </p>
              {explanationSteps.length > 1 ? (
                <StepTimeline steps={explanationSteps} />
              ) : (
                <p className="text-sm leading-6 text-slate-800">{latestResponse.explanation}</p>
              )}
            </div>
          </article>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/65 bg-white/74 p-6 text-center shadow-md backdrop-blur-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
              <Sparkles size={58} className="text-indigo-600" />
            </div>
            <p className="text-base font-semibold text-slate-800">Start solving with OryxSolver</p>
            <p className="mx-auto mt-2 max-w-[260px] text-sm text-slate-700">
              Pick a question on your page and get a step-by-step explanation in seconds.
            </p>
            <button className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700">
              Solve your first question
            </button>
          </div>
        )}
      </main>

      {sendError && (
        <p className="px-4 pb-2 text-xs font-medium text-rose-700">
          {sendError}
        </p>
      )}
      {isSending && (
        <p className="px-4 pb-2 text-xs font-medium text-slate-700">
          Sending...
        </p>
      )}

      <MessageComposer onSend={handleSend} onCaptureScreen={handleCaptureScreen} />

    </div>
  );
}
