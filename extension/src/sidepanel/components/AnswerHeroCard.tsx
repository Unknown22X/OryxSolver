import { Sparkles } from 'lucide-react';
import RichText from './RichText';

type AnswerHeroCardProps = {
  answer: string;
};

export default function AnswerHeroCard({ answer }: AnswerHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/40 shadow-2xl shadow-indigo-100 ring-1 ring-indigo-500/20 active:scale-[0.99] transition-transform">
      {/* Decorative Orbs & Gradients */}
      <div className="absolute -top-10 -left-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
      <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />
      
      <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-7 py-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 shadow-inner">
            <Sparkles size={10} className="text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/80">
            Verified Solution
          </p>
        </div>
        
        <div className="relative inline-block">
          <RichText
            content={answer}
            className="text-[32px] font-black tracking-tight leading-[1.1] text-white drop-shadow-md [&_.katex]:text-white [&_p]:mb-0 [&_a]:text-white"
          />
          {/* Subtle underline glow */}
          <div className="mt-2 h-1.5 w-12 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  );
}
