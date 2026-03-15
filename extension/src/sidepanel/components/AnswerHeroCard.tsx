import { Check, Sparkles } from 'lucide-react';
import RichText from './RichText';

type AnswerHeroCardProps = {
  answer: string;
};

export default function AnswerHeroCard({ answer }: AnswerHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/20 shadow-2xl shadow-indigo-500/10 ring-1 ring-white/10 active:scale-[0.99] transition-all duration-500 group animate-glow">
      {/* Animated Background Elements */}
      <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-indigo-500/30 blur-3xl animate-pulse" />
      <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl animate-pulse delay-1000" />
      
      <div className="relative bg-slate-900 px-8 py-9 dark:bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-white/20 transition-transform group-hover:scale-110">
            <Check size={20} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <p className="text-[12px] font-black uppercase tracking-[0.4em] text-emerald-400 drop-shadow-sm">
              Final Answer
            </p>
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified Solution</span>
               <Sparkles size={10} className="text-indigo-400" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Checked</span>
          </div>
        </div>

        <div className="relative">
          <RichText
            content={answer}
            className="text-[44px] font-black tracking-tighter leading-[1] text-white break-words drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] [&_.katex]:text-white [&_p]:mb-0 [&_a]:text-white"
          />
          <div className="absolute -left-6 -top-4 flex gap-1.5 opacity-30">
             <div className="h-1.5 w-1.5 rounded-full bg-white" />
             <div className="h-1.5 w-1.5 rounded-full bg-white" />
             <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
