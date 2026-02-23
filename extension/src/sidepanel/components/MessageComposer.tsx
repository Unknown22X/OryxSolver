import { useRef, useState } from 'react';
import { Camera, Paperclip, Send, X } from 'lucide-react';

type MessageComposerProps = {
  onSend?: (payload: { text: string; images: File[] }) => void;
  onCaptureScreen?: () => Promise<File | null>;
};

export default function MessageComposer({ onSend, onCaptureScreen }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureHint, setCaptureHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!text.trim() && attachments.length === 0) return;
    onSend?.({ text: text.trim(), images: attachments });
    setText('')
    setAttachments([]);
    setCaptureHint(null);
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
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a follow-up..."
          className="w-full rounded-2xl border border-slate-400/90 bg-white/92 py-2 pl-20 pr-12 text-sm text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-300/90 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
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
