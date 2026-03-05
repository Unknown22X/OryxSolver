import { useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, Send, X } from 'lucide-react';
import type { AiSuggestion, StyleMode } from '../types';

type MessageComposerProps = {
  onSend?: (payload: { text: string; images: File[]; styleMode: StyleMode }) => void;
  onCaptureScreen?: () => Promise<File | null>;
  styleMode?: StyleMode;
  onStyleModeChange?: (mode: StyleMode) => void;
  suggestions?: AiSuggestion[];
  onOpenModesGuide?: () => void;
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
  onOpenModesGuide,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
      }
    })();
  }, []);

  useEffect(() => {
    void chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: text }).catch(() => {
    });
    autosizeTextarea();
  }, [text]);

  const handleImagePick = () => {
    fileInputRef.current?.click();
  }; // handels image pick button click

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;
    setAttachments((prev) => [...prev, file]);
    event.currentTarget.value = '';
  }; // handels if the file change

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setCaptureHint(null);
  };

  // const handleSend = () => {
  //   if (!text.trim() && !selectedImage) return;
  //   onSend?.({ text: text.trim(), image: selectedImage });
  //   setText('');
  //   clearSelectedImage();
  // }; // just the read name bruh , handels what happen when the user sends the msg , clean the img and the text

  const handleSend  = () => {
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
    <footer className="mx-4 mb-4 rounded-2xl border border-white/65 bg-white/62 p-4 shadow-lg backdrop-blur-xl" >
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Mode</p>
          <button
            type="button"
            onClick={onOpenModesGuide}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
            title="What do these modes mean?"
            aria-label="Open mode guide"
          >
            ?
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_MODE_OPTIONS.map((option) => {
            const isActive = option.value === styleMode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onStyleModeChange?.(option.value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                    : 'border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">AI Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                onClick={() => {
                  setText(suggestion.prompt);
                  if (suggestion.styleMode) {
                    onStyleModeChange?.(suggestion.styleMode);
                  }
                }}
                className="rounded-full border border-indigo-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative flex items-center">
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
          className="absolute left-2 rounded-xl p-2 text-slate-500 transition hover:bg-white/70 hover:text-slate-700"
          aria-label="Upload image"
          title="Upload image"
        >
          <Paperclip size={16} />
        </button>
        <button
          type="button"
          onClick={handleCameraCapture}
          className="absolute left-12 rounded-xl p-2 text-slate-500 transition hover:bg-white/70 hover:text-slate-700 disabled:opacity-60"
          aria-label="Capture screen"
          title="Capture screen"
          disabled={isCapturing}
        >
          <Camera size={16} />
        </button>
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
          placeholder="Ask a follow-up..."
          rows={1}
          className="w-full resize-none overflow-y-hidden rounded-2xl border border-slate-400/90 bg-white/92 py-2 pl-20 pr-12 text-sm text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300/90 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="button"
          onClick={handleSend}
          className="absolute right-2 rounded-xl bg-indigo-600 p-2 text-white shadow-xl shadow-indigo-400/60 ring-1 ring-indigo-500/30 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 active:translate-y-0"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
      {attachments.length > 0 && (
        <div className="mt-2 space-y-2">
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-white/65 bg-white/78 px-3 py-2 backdrop-blur-sm">
              <p className="max-w-[240px] truncate text-xs font-medium text-slate-700">{file.name}</p>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Remove selected image"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {captureHint && (
        <p className="mt-2 text-center text-[11px] font-medium text-slate-600">{captureHint}</p>
      )}
      <p className="mt-2 text-center text-[10px] text-slate-500">OryxSolver can make mistakes. Verify important info.</p>
    </footer>
  );
}
