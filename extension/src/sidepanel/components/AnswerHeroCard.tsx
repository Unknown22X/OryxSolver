import { Check } from 'lucide-react';
import RichText from './RichText';

type AnswerHeroCardProps = {
  answer: string;
};

export default function AnswerHeroCard({ answer }: AnswerHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/40 shadow-2xl shadow-indigo-100 ring-1 ring-indigo-500/20 active:scale-[0.99] transition-transform animate-glow">
      {/* Decorative Orbs & Gradients */}
      <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/20 blur-2xl animate-pulse" />
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl animate-pulse delay-700" />
      
      <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 px-8 py-7">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white/20">
            <Check size={16} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100 drop-shadow-sm">
              Final Answer
            </p>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Verified Solution</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Success</span>
          </div>
        </div>
        
        <div className="relative">
          <RichText
            content={answer}
            className="text-[40px] font-black tracking-tighter leading-[1.05] text-white break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)] [&_.katex]:text-white [&_p]:mb-0 [&_a]:text-white"
          />
          {/* Decorative flourish */}
          <div className="absolute -left-4 -top-2 flex gap-1 opacity-20">
             <div className="h-1 w-1 rounded-full bg-white" />
             <div className="h-1 w-1 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
