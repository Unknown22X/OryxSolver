import { useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, Send, X, Sparkles, HelpCircle, ScanText } from 'lucide-react';
import type { AiSuggestion, StyleMode } from '../types';
import { MSG_EXTRACT_PAGE_CONTEXT } from '../../shared/messageTypes';
import { analytics } from '../services/analyticsService';

type MessageComposerProps = {
  onSend?: (payload: { text: string; images: File[]; styleMode: StyleMode }) => void;
  onCaptureScreen?: () => Promise<File | null>;
  styleMode?: StyleMode;
  onStyleModeChange?: (mode: StyleMode) => void;
  suggestions?: AiSuggestion[];
  isHero?: boolean;
  isSending?: boolean;
  hasContext?: boolean;
  quotedStep?: { text: string; index: number } | null;
  onClearQuote?: () => void;
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

const FALLBACK_SUGGESTIONS: AiSuggestion[] = [
  { label: 'Explain simpler', prompt: 'Explain this much simpler, like I\'m 5', styleMode: 'eli5' },
  { label: 'Gen Alpha terms', prompt: 'Explain this using Gen Alpha slang', styleMode: 'gen_alpha' },
  { label: 'Give an example', prompt: 'Give me a real-world example of this', styleMode: 'standard' },
  { label: 'Step-by-step', prompt: 'Break this down step-by-step', styleMode: 'step_by_step' },
  { label: 'Quiz me', prompt: 'Give me a quick practice question about this', styleMode: 'exam' },
];

export default function MessageComposer({
  onSend,
  onCaptureScreen,
  styleMode = 'standard',
  onStyleModeChange,
  suggestions = [],
  isHero = false,
  isSending = false,
  hasContext = false,
  quotedStep = null,
  onClearQuote,
}: MessageComposerProps) {
  const rawModeGuideUrl = String(import.meta.env.VITE_MODE_GUIDE ?? '').trim();
  const modeGuideUrl = rawModeGuideUrl
    ? (rawModeGuideUrl.startsWith('http') ? rawModeGuideUrl : `https://${rawModeGuideUrl}`)
    : '';
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<number | null>(null);
  const MAX_TEXTAREA_HEIGHT = 160;

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

  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownTimerRef.current = window.setTimeout(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [cooldownRemaining]);

  const handleImagePick = () => {
    if (isSending) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    setAttachments((prev) => [...prev, file]);
    event.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    if (isSending) return;
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setCaptureHint(null);
  };

  const handleSend = (overridePayload?: { text: string, images?: File[], styleMode?: StyleMode }) => {
    if (isSending || cooldownRemaining > 0) return;
    
    const rawText = overridePayload?.text ?? text.trim();
    const effectiveAttachments = overridePayload?.images ?? attachments;
    const effectiveStyle = overridePayload?.styleMode ?? styleMode;

    const effectiveText =
      rawText.length > 0
        ? rawText
        : effectiveAttachments.length > 0
          ? DEFAULT_IMAGE_PROMPT_BY_MODE[effectiveStyle]
          : '';

    // Fix: Block sends that lack any real context (no image and no custom text)
    const isGenericPrompt = Object.values(DEFAULT_IMAGE_PROMPT_BY_MODE).includes(effectiveText);
    if (!effectiveText || (isGenericPrompt && effectiveAttachments.length === 0)) {
      setCaptureHint('Missing Context: Please provide a specific question or upload a screenshot first.');
      return;
    }

    onSend?.({ text: effectiveText, images: effectiveAttachments, styleMode: effectiveStyle });
    
    // Clear inputs if not an override (suggestion) or if it's a follow-up
    if (!overridePayload) {
      setText('');
      setAttachments([]);
    }
    
    setCaptureHint(null);
    setCooldownRemaining(2); // 2 second cooldown

    void chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {});
    requestAnimationFrame(() => autosizeTextarea());
  }

  const handleCameraCapture = async () => {
    if (!onCaptureScreen || isSending) return;
    setIsCapturing(true);
    setCaptureHint('Draw a box on the page to capture. Press Esc to cancel.');
    analytics.track('screen_capture_started');
    try {
      const capturedImage = await onCaptureScreen();
      if (capturedImage) {
        setAttachments((prev) => [...prev, capturedImage]);
        setCaptureHint('Capture added.');
        analytics.track('screen_capture_completed');
      } else {
        setCaptureHint('No capture returned. Refresh page and try again.');
      }
    } catch {
      setCaptureHint('Capture failed. Refresh page and try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleExtractPageContext = async () => {
    if (isSending) return;
    setIsCapturing(true);
    setCaptureHint('Scanning page for questions...');
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG_EXTRACT_PAGE_CONTEXT });
      if (response && response.ok && response.text) {
        setText((prev) => prev ? `${prev}\n\n${response.text}` : response.text);
        setCaptureHint('Question text added from page.');
        analytics.track('screen_capture_completed', { type: 'text_extraction' });
      } else {
        setCaptureHint('No text found. Try highlighting the question manually.');
      }
    } catch {
      setCaptureHint('Failed to scan page. Refresh and try again.');
    } finally {
      setIsCapturing(false);
      setTimeout(() => setCaptureHint(null), 4000);
    }
  };

  const displaySuggestions = suggestions.length > 0 ? suggestions : FALLBACK_SUGGESTIONS;
  const showSuggestions = displaySuggestions.length > 0 && (attachments.length > 0 || hasContext || text.trim().length > 0);

  return (
    <footer className={`${isHero ? 'w-full px-0' : 'w-full'} relative z-10 transition-all duration-500`}>
      {/* Suggestions Section - completely decoupled and floating above */}
      {/* Suggestions Section - only show if there is actually context (solution or attachment) */}
      {showSuggestions && (
        <div className={`mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ${isHero ? 'flex flex-col items-center' : ''}`}>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Sparkles size={11} className="text-indigo-500" />
            <p className={`font-black tracking-wider text-indigo-500 ${isHero ? 'text-[10px]' : 'text-[9px] uppercase'}`}>Try asking:</p>
          </div>
          <div className={`flex flex-wrap gap-2 ${isHero ? 'justify-center' : ''} ${isSending || cooldownRemaining > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            {displaySuggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                onClick={() => {
                  setText((prev) => prev ? `${prev} ${suggestion.prompt}` : suggestion.prompt);
                  if (suggestion.styleMode && onStyleModeChange) {
                    onStyleModeChange(suggestion.styleMode as StyleMode);
                  }
                  requestAnimationFrame(() => {
                    const textarea = document.querySelector('textarea');
                    if (textarea) {
                      textarea.style.height = 'auto';
                      textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
                    }
                  });
                }}
                className={`rounded-full border px-3 py-1.5 transition-all hover:scale-105 active:scale-95 ${
                  isHero 
                    ? 'border-indigo-200/50 bg-indigo-50/30 text-[13px] font-black text-indigo-700 shadow-lg shadow-indigo-100/50 dark:border-indigo-500/30 dark:bg-indigo-900/40 dark:text-indigo-200 dark:shadow-none animate-glow' 
                    : 'border-slate-200 bg-white text-[11px] font-bold text-slate-600 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {quotedStep && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 animate-in slide-in-from-bottom-2 duration-300 dark:border-indigo-500/20 dark:bg-indigo-900/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-black text-white shadow-lg shadow-indigo-200">
              {quotedStep.index + 1}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Asking about step {quotedStep.index + 1}</p>
              <p className="truncate text-xs font-bold text-slate-600 dark:text-slate-300">"{quotedStep.text}"</p>
            </div>
          </div>
          <button
            onClick={onClearQuote}
            className="rounded-full border border-indigo-100 bg-white p-1.5 text-indigo-400 shadow-sm transition-all hover:border-rose-200 hover:text-rose-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={`relative flex flex-col overflow-hidden transition-all duration-700 ${
        isHero 
          ? 'rounded-[32px] p-2 bg-slate-100/80 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/5 backdrop-blur-3xl focus-within:ring-2 focus-within:ring-indigo-500/30' 
          : 'rounded-none border-t border-slate-200/60 bg-white/95 backdrop-blur-3xl p-1.5 dark:bg-slate-900/95 dark:border-slate-800'
      } duration-300 ${(isSending || cooldownRemaining > 0) ? 'opacity-70 pointer-events-none cursor-not-allowed' : ''}`}>
        
        {/* Top Row: Integrated Modes Segmented Control */}
        <div className="flex flex-col gap-1.5 px-1.5 pt-1.5 pb-1">
          <div className={`flex flex-wrap items-center gap-1 rounded-[12px] p-1 ${isHero ? 'bg-black/5 dark:bg-white/5' : 'bg-slate-100/50 dark:bg-slate-900/40'}`}>
            {STYLE_MODE_OPTIONS.map((option) => {
              const isActive = option.value === styleMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStyleModeChange?.(option.value)}
                  className={`flex-1 min-w-[max-content] rounded-[8px] px-1.5 py-1 text-[9px] font-bold transition-all duration-200 ${
                    isActive
                      ? isHero ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/20 dark:bg-slate-700 dark:text-indigo-300 dark:ring-slate-600' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/20 dark:bg-slate-700 dark:text-indigo-300 dark:ring-slate-600'
                      : isHero ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {modeGuideUrl && (
            <div className={`flex items-center justify-end px-1 ${isHero ? 'text-slate-400' : 'text-slate-400'}`}>
              <button
                type="button"
                onClick={() => window.open(modeGuideUrl, '_blank')}
                className="flex items-center gap-1 text-[9px] font-bold hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <HelpCircle size={11} />
                <span>Modes guide</span>
              </button>
            </div>
          )}
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2">
            {attachments.map((file, index) => (
              <div key={`${file.name}-${index}`} className={`group relative flex items-center gap-2 rounded-xl px-3 py-1.5 animate-in zoom-in-95 duration-200 ${isHero ? 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10' : 'bg-indigo-50 border border-indigo-100/50 dark:bg-indigo-900/20 dark:border-indigo-800/30'}`}>
                <Paperclip size={12} className="text-indigo-500" />
                <span className={`max-w-[120px] truncate text-[10px] font-bold ${isHero ? 'text-slate-700 dark:text-slate-300' : 'text-indigo-700 dark:text-indigo-300'}`}>{file.name}</span>
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
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ${isHero ? 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Upload"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              onClick={handleCameraCapture}
              disabled={isCapturing || isSending}
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${isHero ? 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Screenshot"
            >
              <Camera size={16} />
            </button>
            <button
              type="button"
              onClick={handleExtractPageContext}
              disabled={isCapturing || isSending}
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${isHero ? 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Scan Page Text"
            >
              <ScanText size={16} />
            </button>
          </div>

          {/* Clean Text Area Bubble */}
          <div className={`flex flex-1 items-end rounded-[16px] px-3 py-2 shadow-inner transition-all duration-200 ease-out focus-within:border-indigo-400 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.18)] ${isHero ? 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 focus-within:bg-black/10 dark:focus-within:bg-white/10' : 'bg-white border border-slate-200/50 dark:border-slate-600/60 dark:bg-slate-900/80 dark:focus-within:border-indigo-400 dark:focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.22)]'}`}>
            <textarea
              id="composer-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isSending ? "Oryx is thinking..." : "Ask any homework question or upload a screenshot..."}
              rows={1}
              className={`flex-1 max-h-32 min-h-[40px] resize-none bg-transparent py-2 text-[15px] font-bold leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-400 outline-none disabled:opacity-50 ${isHero ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}
            />


            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isSending || cooldownRemaining > 0 || (!text.trim() && attachments.length === 0)}
              className="group ml-2 mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 hover:from-indigo-500 hover:to-blue-500 active:scale-95 disabled:scale-100 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-none dark:disabled:from-slate-700 dark:disabled:to-slate-700 dark:disabled:text-slate-500"
            >
              {isSending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : cooldownRemaining > 0 ? (
                <span className="text-[10px] font-black">{cooldownRemaining}s</span>
              ) : (
                <Send size={15} className="ml-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {captureHint && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-amber-50/80 px-4 py-2 text-center animate-in slide-in-from-top-1 dark:bg-amber-900/20">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{captureHint}</p>
        </div>
      )}

    </footer>
  );
}
