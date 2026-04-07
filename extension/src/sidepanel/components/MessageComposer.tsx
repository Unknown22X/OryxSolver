import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Paperclip, Send, X, Sparkles, HelpCircle, ScanText } from 'lucide-react';
import type { AiSuggestion, StyleMode } from '../types';
import { MSG_EXTRACT_PAGE_CONTEXT } from '../../shared/messageTypes';
import { performQA } from '../../shared/mathCleanup';
import { analytics } from '../services/analyticsService';

type MessageComposerProps = {
  onSend?: (payload: { text: string; images: File[]; styleMode: StyleMode }) => Promise<unknown> | unknown;
  onCaptureScreen?: () => Promise<File | null>;
  styleMode?: StyleMode;
  onStyleModeChange?: (mode: StyleMode) => void;
  suggestions?: AiSuggestion[];
  isHero?: boolean;
  isSending?: boolean;
  hasContext?: boolean;
  quotedStep?: { text: string; index: number } | null;
  onClearQuote?: () => void;
  disabledModes?: StyleMode[];
  modeLocked?: boolean;
  serviceUnavailable?: boolean;
  serviceUnavailableMessage?: string | null;
};

const DRAFT_STORAGE_KEY = 'oryx_sidepanel_draft_text';

const STYLE_MODE_OPTIONS: Array<{ value: StyleMode; labelKey: string }> = [
  { value: 'standard', labelKey: 'composer.modes.standard' },
  { value: 'exam', labelKey: 'composer.modes.exam' },
  { value: 'eli5', labelKey: 'composer.modes.eli5' },
  { value: 'step_by_step', labelKey: 'composer.modes.step_by_step' },
  { value: 'gen_alpha', labelKey: 'composer.modes.gen_alpha' },
];

const FALLBACK_SUGGESTIONS_KEYS = [
  { labelKey: 'composer.suggestions.simpler_label', promptKey: 'composer.suggestions.simpler_prompt', styleMode: 'eli5' as StyleMode },
  { labelKey: 'composer.suggestions.alpha_label', promptKey: 'composer.suggestions.alpha_prompt', styleMode: 'gen_alpha' as StyleMode },
  { labelKey: 'composer.suggestions.example_label', promptKey: 'composer.suggestions.example_prompt', styleMode: 'standard' as StyleMode },
  { labelKey: 'composer.suggestions.steps_label', promptKey: 'composer.suggestions.steps_prompt', styleMode: 'step_by_step' as StyleMode },
  { labelKey: 'composer.suggestions.quiz_label', promptKey: 'composer.suggestions.quiz_prompt', styleMode: 'exam' as StyleMode },
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
  disabledModes = [],
  modeLocked = false,
  serviceUnavailable = false,
  serviceUnavailableMessage = null,
}: MessageComposerProps) {
  const { t } = useTranslation();
  const modeGuideUrl = 'https://oryxsolver.com/modes';
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<number | null>(null);
  const captureHintTimerRef = useRef<number | null>(null);

  const getTranslatedImagePrompt = (mode: StyleMode) => t(`composer.image_prompts.${mode}`);
  
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (captureHintTimerRef.current) clearTimeout(captureHintTimerRef.current);
    };
  }, []);

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
    if (isSending || serviceUnavailable) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    setAttachments((prev) => [...prev, file]);
    event.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    if (isSending || serviceUnavailable) return;
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setCaptureHint(null);
  };

  const handleSend = async (overridePayload?: { text: string, images?: File[], styleMode?: StyleMode }) => {
    if (isSending || cooldownRemaining > 0 || serviceUnavailable) return;
    
    const rawText = overridePayload?.text ?? text.trim();
    const effectiveAttachments = overridePayload?.images ?? attachments;
    const effectiveStyle = overridePayload?.styleMode ?? styleMode;

    const effectiveText =
      rawText.length > 0
        ? rawText
        : effectiveAttachments.length > 0
          ? getTranslatedImagePrompt(effectiveStyle)
          : '';

    // Fix: Block sends that lack any real context (no image and no custom text)
    const isGenericPrompt = STYLE_MODE_OPTIONS.some(opt => getTranslatedImagePrompt(opt.value) === effectiveText);
    if (!effectiveText || (isGenericPrompt && effectiveAttachments.length === 0)) {
      setCaptureHint('Missing Context: Please provide a specific question or upload a screenshot first.');
      return;
    }

    const result = await onSend?.({ text: effectiveText, images: effectiveAttachments, styleMode: effectiveStyle });
    
    // Clear inputs if not an override (suggestion) or if it's a follow-up
    if (!overridePayload && result) {
      setText('');
      setAttachments([]);
    }
    
    setCaptureHint(null);
    setCooldownRemaining(2); // 2 second cooldown

    void chrome.storage.local.remove(DRAFT_STORAGE_KEY).catch(() => {});
    requestAnimationFrame(() => autosizeTextarea());
  }

  const handleCameraCapture = async () => {
    if (!onCaptureScreen || isSending || serviceUnavailable) return;
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
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Capture failed. Refresh page and try again.';
      setCaptureHint(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleExtractPageContext = async () => {
    if (isSending || serviceUnavailable) return;

    if (captureHintTimerRef.current) {
      clearTimeout(captureHintTimerRef.current);
      captureHintTimerRef.current = null;
    }

    setIsCapturing(true);
    setCaptureHint('Scanning page for questions...');
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG_EXTRACT_PAGE_CONTEXT });
      if (response && response.ok && response.text) {
        setText((prev) => prev ? `${prev}\n\n${response.text}` : response.text);
        
        const qaResult = performQA(response.text);
        if (!qaResult.isValid && qaResult.warnings.length > 0) {
          setCaptureHint(qaResult.suggestion || `Extracted, but seems messy: ${qaResult.warnings[0]}`);
        } else {
          setCaptureHint('Question text added from page.');
        }
        
        analytics.track('screen_capture_completed', { 
          type: 'text_extraction', 
          warnings: qaResult.warnings.length,
          isValid: qaResult.isValid
        });
      } else {
        setCaptureHint('No text found. Try highlighting the question manually.');
      }
    } catch {
      setCaptureHint('Failed to scan page. Refresh and try again.');
    } finally {
      setIsCapturing(false);
      captureHintTimerRef.current = window.setTimeout(() => {
        setCaptureHint(null);
        captureHintTimerRef.current = null;
      }, 5000);
    }
  };

  const dynamicFallbackSuggestions: AiSuggestion[] = FALLBACK_SUGGESTIONS_KEYS.map(s => ({
    label: t(s.labelKey),
    prompt: t(s.promptKey),
    styleMode: s.styleMode
  }));

  const displaySuggestions = suggestions.length > 0 ? suggestions : dynamicFallbackSuggestions;
  const showSuggestions = displaySuggestions.length > 0 && (attachments.length > 0 || hasContext || text.trim().length > 0);

  return (
    <footer className={`${isHero ? 'w-full px-0' : 'w-full'} relative z-10 transition-all duration-500`}>
      {/* Suggestions Section - completely decoupled and floating above */}
      {/* Suggestions Section - only show if there is actually context (solution or attachment) */}
      {showSuggestions && (
        <div className={`mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ${isHero ? 'flex flex-col items-center' : ''}`}>
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <Sparkles size={11} className="text-indigo-500" />
            <p className={`font-black tracking-wider text-indigo-500 ${isHero ? 'text-[10px]' : 'text-[9px] uppercase'}`}>{t('response.suggestions')}</p>
          </div>
          <div className={`flex flex-wrap gap-2 ${isHero ? 'justify-center' : ''} ${isSending || cooldownRemaining > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            {displaySuggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                onClick={() => {
                  setText((prev) => prev ? `${prev} ${suggestion.prompt}` : suggestion.prompt);
                  if (!modeLocked && suggestion.styleMode && onStyleModeChange) {
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
          ? 'oryx-shell-panel-strong rounded-[32px] border p-2 ring-1 ring-slate-200/80 backdrop-blur-3xl focus-within:ring-2 focus-within:ring-indigo-500/30 dark:ring-white/8' 
          : 'border-t p-1.5 backdrop-blur-3xl'
      } duration-300 ${(isSending || cooldownRemaining > 0 || serviceUnavailable) ? 'opacity-70 pointer-events-none cursor-not-allowed' : ''}`}
      style={!isHero ? { backgroundColor: 'var(--oryx-panel-strong)', borderColor: 'var(--oryx-border-soft)' } : undefined}>
        {serviceUnavailableMessage ? (
          <div className="mx-2 mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            {serviceUnavailableMessage}
          </div>
        ) : null}
        
        {/* Top Row: Integrated Modes Segmented Control */}
        <div className="flex flex-col gap-1.5 px-1.5 pt-1.5 pb-1">
          {modeLocked ? (
            <div className={`flex items-center justify-between rounded-[12px] px-3 py-2 ${isHero ? 'bg-slate-100 dark:bg-[#020617]/70' : 'bg-slate-100/50 dark:bg-slate-900/40'}`} style={!isHero ? { backgroundColor: 'var(--oryx-panel-soft)' } : undefined}>
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Thread mode</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300">
                {STYLE_MODE_OPTIONS.find((option) => option.value === styleMode)?.labelKey ? t(STYLE_MODE_OPTIONS.find((option) => option.value === styleMode)!.labelKey) : styleMode}
              </span>
            </div>
          ) : (
            <div className={`flex flex-wrap items-center gap-1 rounded-[12px] p-1 ${isHero ? 'bg-slate-100 dark:bg-[#020617]/70' : 'bg-slate-100/50 dark:bg-slate-900/40'}`} style={!isHero ? { backgroundColor: 'var(--oryx-panel-soft)' } : undefined}>
              {STYLE_MODE_OPTIONS.map((option) => {
                const isActive = option.value === styleMode;
                const isDisabled = disabledModes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      onStyleModeChange?.(option.value);
                    }}
                    disabled={isDisabled}
                    className={`flex-1 min-w-[max-content] rounded-[8px] px-1.5 py-1 text-[9px] font-bold transition-all duration-200 ${
                      isActive
                        ? isHero ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/20 dark:bg-slate-700 dark:text-indigo-300 dark:ring-slate-600' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/20 dark:bg-slate-700 dark:text-indigo-300 dark:ring-slate-600'
                        : isHero ? 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed hover:text-slate-500' : ''}`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          )}
          {modeGuideUrl && (
            <div className={`flex items-center justify-end px-1 ${isHero ? 'text-slate-400' : 'text-slate-400'}`}>
              <button
                type="button"
                onClick={() => window.open(modeGuideUrl, '_blank')}
                className="flex items-center gap-1 text-[9px] font-bold hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <HelpCircle size={11} />
                <span>{t('composer.modes_guide')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className={`group relative flex items-center gap-2 rounded-xl px-3 py-1.5 animate-in zoom-in-95 duration-200 ${isHero ? 'border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#111827]/80' : 'border dark:bg-indigo-900/20 dark:border-indigo-800/30'}`}
                style={!isHero ? { backgroundColor: 'var(--oryx-panel-soft)', borderColor: 'var(--oryx-border-soft)' } : undefined}
              >
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
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ${isHero ? 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400 hover:text-indigo-600 dark:hover:bg-[#172033] dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Upload screenshot or document"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              onClick={handleCameraCapture}
              disabled={isCapturing || isSending}
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${isHero ? 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400 hover:text-indigo-600 dark:hover:bg-[#172033] dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Select area to solve (Capture)"
            >
              <Camera size={16} />
            </button>
            <button
              type="button"
              onClick={handleExtractPageContext}
              disabled={isCapturing || isSending}
              className={`flex h-9 w-9 items-center justify-center rounded-[12px] transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${isHero ? 'bg-slate-100 text-slate-500 dark:bg-[#111827] dark:text-slate-400 hover:text-indigo-600 dark:hover:bg-[#172033] dark:hover:text-white' : 'bg-slate-100/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}
              title="Auto-detect question text"
            >
              <ScanText size={16} />
            </button>
          </div>

          {/* Clean Text Area Bubble */}
          <div className={`flex flex-1 items-end rounded-[16px] px-3 py-2 shadow-inner transition-all duration-200 ease-out focus-within:border-indigo-400 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.18)] ${isHero ? 'border border-slate-200 bg-slate-50 focus-within:bg-white dark:border-white/10 dark:bg-[#111827]/90 dark:focus-within:bg-[#172033]' : 'border dark:border-slate-600/60 dark:bg-slate-900/80 dark:focus-within:border-indigo-400 dark:focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.22)]'}`} style={!isHero ? { backgroundColor: 'var(--oryx-panel)', borderColor: 'var(--oryx-border-soft)' } : undefined}>
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
              placeholder={isSending ? t('common.processing') : t('hero.type_question')}
              rows={1}
              className={`flex-1 max-h-32 min-h-[40px] resize-none bg-transparent py-2 text-[15px] font-bold leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-400 outline-none disabled:opacity-50 ${isHero ? 'text-slate-900 dark:text-slate-100' : 'text-slate-900 dark:text-slate-100'}`}
            />


            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isSending || cooldownRemaining > 0 || (!text.trim() && attachments.length === 0)}
              title="Solve Problem (Enter)"
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

      {captureHint ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-center animate-in slide-in-from-top-1 dark:bg-amber-900/20" style={{ backgroundColor: 'rgba(251, 191, 36, 0.14)' }}>
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{captureHint}</p>
        </div>
      ) : null}
      </footer>
  );
}
