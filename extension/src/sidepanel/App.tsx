import { useState } from 'react';
import MessageComposer from './components/MessageComposer';
import { captureCroppedAreaToFile } from './services/cameraCapture';
import SidePanelHeader from './components/SidePanelHeader';
import ResponsePanel from './components/ResponsePanel';
import { parseExplanationSteps } from './utils/parseExplanationSteps';
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/chrome-extension';
import { ShieldCheck } from 'lucide-react';
import type { AiResponse, SendPayload } from './types';

export default function SidePanel() {
  const [credits] = useState({ used: 12, total: 50 });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<AiResponse | null>(null);
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

  const handleSend = async ({ text, images }: SendPayload) => {
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

      <SidePanelHeader
        logoUrl={logoUrl}
        appName="OryxSolver"
        usedCredits={credits.used}
        totalCredits={credits.total}
      />
      <SignedOut>
        <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
          <div className="pointer-events-none absolute -top-14 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-6 h-40 w-40 rounded-full bg-violet-300/20 blur-3xl" />

          <div className="relative flex min-h-[320px] w-full max-w-sm flex-col rounded-2xl border border-white/65 bg-white/78 px-6 py-8 text-center shadow-md backdrop-blur-lg">
            <div className="pointer-events-none absolute -top-5 right-5 h-10 w-10 rounded-full bg-indigo-200/55 blur-md" />
            <div className="pointer-events-none absolute top-10 left-6 h-7 w-7 rounded-full bg-violet-200/60 blur-sm" />

            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 via-indigo-50 to-violet-100 shadow-inner">
                <ShieldCheck size={40} className="text-indigo-600" />
              </div>
              <p className="text-xl font-semibold text-slate-900">Sign in to continue</p>
              <p className="mt-2 max-w-[260px] text-sm text-slate-700">
                Log in to use OryxSolver and keep your progress synced.
              </p>
            </div>

            <div className="mt-auto space-y-3">
              <SignInButton mode="modal">
                <button className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </div>
        </main>
      </SignedOut>
      <SignedIn>
      <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/60 bg-white/62 px-6 shadow-sm backdrop-blur-lg">
        <span className="text-lg font-extrabold tracking-tight">See Last Questions</span>
      </div>

      <main className="flex-1 space-y-6 overflow-y-auto bg-transparent p-4">
        <ResponsePanel response={latestResponse} steps={explanationSteps} />
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
      </SignedIn>
    </div>
  );
}
