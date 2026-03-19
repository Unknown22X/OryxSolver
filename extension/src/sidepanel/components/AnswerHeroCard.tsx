import { Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import RichText from './RichText';

type AnswerHeroCardProps = {
  answer: string;
  title: string;
  subtitle: string;
};

export default function AnswerHeroCard({ answer, title, subtitle }: AnswerHeroCardProps) {
  const [copied, setCopied] = useState(false);
  const isLongAnswer = answer.trim().length > 80;

  const handleCopy = () => {
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/40 shadow-2xl shadow-indigo-100 ring-1 ring-indigo-500/15 transition-transform active:scale-[0.99]">
      <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl" />

      <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 px-8 py-7">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/14 text-white shadow-lg shadow-black/10 ring-1 ring-white/20">
            <Sparkles size={16} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100 drop-shadow-sm">
              {title}
            </p>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{subtitle}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
             <button
               onClick={handleCopy}
               className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md hover:bg-white/20 transition-all active:scale-95 border border-white/10"
               title={copied ? "Copied to clipboard!" : "Copy answer to clipboard"}
             >
               {copied ? (
                 <>
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-white">Copied</span>
                 </>
               ) : (
                 <>
                   <Copy size={12} className="text-white/80" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Copy</span>
                 </>
               )}
             </button>
          </div>
        </div>

        <div className="relative">
          <RichText
            content={answer}
            className={`${isLongAnswer ? 'text-[21px] leading-[1.35]' : 'text-[29px] leading-[1.18]'} font-black tracking-tight text-white break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)] [&_.katex]:text-white [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_p]:mb-0 [&_a]:text-white`}
          />
          <div className="absolute -left-4 -top-2 flex gap-1 opacity-20">
             <div className="h-1 w-1 rounded-full bg-white" />
             <div className="h-1 w-1 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
