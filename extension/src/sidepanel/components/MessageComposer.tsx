import { useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, Send, X, Sparkles, HelpCircle } from 'lucide-react';
import type { AiSuggestion, StyleMode } from '../types';

type MessageComposerProps = {
  onSend?: (payload: { text: string; images: File[]; styleMode: StyleMode }) => void;
  onCaptureScreen?: () => Promise<File | null>;
  styleMode?: StyleMode;
  onStyleModeChange?: (mode: StyleMode) => void;
  suggestions?: AiSuggestion[];
  isHero?: boolean;
};

const STYLE_MODE_OPTIONS: Array<{ value: StyleMode; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'exam', label: 'Exam' },
  { value: 'eli5', label: 'ELI5' },
  { value: 'step_by_step', label: 'Step-by-step' },
  { value: 'gen_alpha', label: 'Gen Alpha' },
];

const DEFAULT_IMAGE_PROMPT_BY_MODE: Record<StyleMode, string> = {
  standard: 'Solve this question from the attached image.',
  exam: 'Solve this exam question from the attached image.',
  eli5: 'Solve this question from the attached image and explain simply.',
  step_by_step: 'Solve this question from the attached image step by step.',
  gen_alpha: 'Solve this question from the attached image in light Gen Alpha style.',
};

const DRAFT_STORAGE_KEY = 'oryx_sidepanel_draft_text';

export default function MessageComposer({
  onSend,
  onCaptureScreen,
  styleMode = 'standard',
  onStyleModeChange,
  suggestions = [],
  isHero = false,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_TEXTAREA_HEIGHT = 160;
  const activeModeIndex = Math.max(
    0,
    STYLE_MODE_OPTIONS.findIndex((option) => option.value === styleMode),
  );

  const autosizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    void (async () => {
      try {
        const stored = await chrome.storage.local.get(DRAFT_STORAGE_KEY);
        const draft = stored?.[DRAFT_STORAGE_KEY];
        if (typeof draft === 'string') {
          setText(draft);
        }
      } catch {
        // Draft restore is non-critical; silently ignore storage errors
      }
    })();
  }, []);

  useEffect(() => {
    void chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: text }).catch(() => {
      // Draft save is non-critical; silently ignore storage errors
    });
    autosizeTextarea();
  }, [text]);

  const handleImagePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    setAttachments((prev) => [...prev, file]);
    event.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setCaptureHint(null);
  };

  const handleSend = () => {
    const rawText = text.trim();
    const effectiveText =
      rawText.length > 0
        ? rawText
        : attachments.length > 0
          ? DEFAULT_IMAGE_PROMPT_BY_MODE[styleMode]
          : '';

    if (!effectiveText && attachments.length === 0) return;
    onSend?.({ text: effectiveText, images: attachments, styleMode });
    setText('')
    setAttachments([]);
    setCaptureHint(null);
    void chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {
      
    });
    requestAnimationFrame(() => autosizeTextarea());
  }

  const handleCameraCapture = async () => {
    if (!onCaptureScreen) return;
    setIsCapturing(true);
    setCaptureHint('Draw a box on the page to capture. Press Esc to cancel.');
    try {
      const capturedImage = await onCaptureScreen();
      if (capturedImage) {
        setAttachments((prev) => [...prev, capturedImage]);
        setCaptureHint('Capture added.');
      } else {
        setCaptureHint('No capture returned. Refresh page and try again.');
      }
    } catch {
      setCaptureHint('Capture failed. Refresh page and try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <footer className={`${isHero ? 'w-full px-0' : 'mx-4 mb-6'} relative z-10 transition-all duration-500`}>
      {/* Suggestions Section - completely decoupled and floating above */}
      {suggestions.length > 0 && (
        <div className={`mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ${isHero ? 'flex flex-col items-center' : ''}`}>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Sparkles size={11} className="text-indigo-500" />
            <p className={`font-black tracking-wider text-indigo-500 ${isHero ? 'text-[10px]' : 'text-[9px] uppercase'}`}>Try asking:</p>
          </div>
          <div className={`flex flex-wrap gap-2 ${isHero ? 'justify-center' : ''}`}>
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                onClick={() => {
                  setText(suggestion.prompt);
                  if (suggestion.styleMode) onStyleModeChange?.(suggestion.styleMode);
                }}
                className={`rounded-full border bg-white px-3 py-1.5 text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-200/40 active:translate-y-0 dark:bg-slate-800 dark:text-slate-300 dark:hover:shadow-none ${
                  isHero 
                    ? 'border-indigo-100 text-[12px] font-bold dark:border-slate-700 shadow-md' 
                    : 'border-indigo-100/70 text-[11px] font-semibold dark:border-slate-700/60'
                }`}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`relative flex flex-col overflow-hidden transition-all duration-500 ${
        isHero 
          ? 'rounded-[32px] p-2 bg-white/80 dark:bg-slate-800/80 ring-2 ring-indigo-500/10 shadow-[0_20px_50px_rgba(79,70,229,0.15)]' 
          : 'rounded-[24px] p-1.5 bg-white shadow-2xl shadow-indigo-100/30 dark:bg-slate-800/90 dark:shadow-none'
      } border border-slate-200/60 ring-1 ring-slate-100 backdrop-blur-3xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 dark:border-slate-700 dark:ring-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/50 duration-300`}>
        
        {/* Top Row: Integrated Modes Segmented Control */}
        <div className="flex items-center justify-between px-1.5 pt-1.5 pb-2">
          <div className="relative flex items-center gap-1 rounded-[14px] bg-slate-100/80 p-1 dark:bg-slate-900/80">
            <div
              className="absolute bottom-1 top-1 rounded-[10px] bg-white shadow-sm ring-1 ring-slate-200/50 transition-transform duration-200 ease-out dark:bg-slate-700 dark:ring-slate-600"
              style={{
                width: `calc(${100 / STYLE_MODE_OPTIONS.length}% - 4px)`,
                transform: `translateX(calc(${activeModeIndex} * 100% + ${activeModeIndex} * 4px))`,
              }}
            />
            {STYLE_MODE_OPTIONS.map((option) => {
              const isActive = option.value === styleMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStyleModeChange?.(option.value)}
                  className={`relative z-10 rounded-[10px] px-3 py-1.5 text-[10px] font-bold transition-all duration-200 ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => window.open('https://example.com/modes', '_blank')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700"
            title="Learn about modes"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2">
            {attachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className="group relative flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100/50 px-3 py-1.5 animate-in zoom-in-95 duration-200 dark:bg-indigo-900/20 dark:border-indigo-800/30">
                <Paperclip size={12} className="text-indigo-500" />
                <span className="max-w-[120px] truncate text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="rounded-full bg-white/50 p-0.5 text-indigo-400 shadow-sm hover:text-rose-500 transition-colors dark:bg-slate-800"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Row: Tools (Left) & Textarea (Right) distinctly separated */}
        <div className="flex items-end gap-2 p-1">
          {/* Tool actions on the left with distinct colored background */}
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleImagePick}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-100/80 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              title="Upload"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              onClick={handleCameraCapture}
              disabled={isCapturing}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-100/80 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:opacity-30 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              title="Screenshot"
            >
              <Camera size={16} />
            </button>
          </div>

          {/* Clean Text Area Bubble */}
          <div className="flex flex-1 items-end rounded-[16px] border border-slate-200/50 bg-white px-3 py-2 shadow-inner transition-all duration-200 ease-out focus-within:border-indigo-400 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.18)] dark:border-slate-600/60 dark:bg-slate-900/80 dark:focus-within:border-indigo-400 dark:focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.22)]">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask any homework question or upload a screenshot..."
              rows={1}
              className="flex-1 max-h-32 min-h-[40px] resize-none bg-transparent py-2 text-[15px] font-bold leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() && attachments.length === 0}
              className="group ml-2 mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-indigo-600 text-white shadow-md shadow-indigo-200 transition-all hover:scale-105 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-300/40 active:scale-95 disabled:scale-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            >
              <Send size={15} className="ml-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>

      {captureHint && (
        <p className="mt-3 text-center text-[11px] font-bold text-indigo-500 animate-pulse">{captureHint}</p>
      )}
      {isHero && text.trim().length === 0 && attachments.length === 0 && (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/65 px-3 py-2.5 text-left dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
            Try asking
          </p>
          <div className="mt-1.5 space-y-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
            <button
              type="button"
              onClick={() => setText('Solve 2x + 5 = 17')}
              className="block w-full rounded-md px-1.5 py-1 text-left transition hover:bg-indigo-50 dark:hover:bg-slate-800"
            >
              • Solve 2x + 5 = 17
            </button>
            <button
              type="button"
              onClick={() => setText("Explain Newton's second law")}
              className="block w-full rounded-md px-1.5 py-1 text-left transition hover:bg-indigo-50 dark:hover:bg-slate-800"
            >
              • Explain Newton&apos;s second law
            </button>
            <button
              type="button"
              onClick={() => setText('Find derivative of x^2')}
              className="block w-full rounded-md px-1.5 py-1 text-left transition hover:bg-indigo-50 dark:hover:bg-slate-800"
            >
              • Find derivative of x^2
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
