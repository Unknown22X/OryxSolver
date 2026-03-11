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
      
      <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-8 py-7">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-400 text-indigo-900 shadow-lg shadow-emerald-500/40 ring-2 ring-white/20">
            <span className="text-sm font-black">✓</span>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100 drop-shadow-sm">
            Final Answer
          </p>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Verified</span>
          </div>
        </div>
        
        <div className="relative">
          <RichText
            content={answer}
            className="text-[36px] font-black tracking-tighter leading-[1.05] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)] [&_.katex]:text-white [&_p]:mb-0 [&_a]:text-white"
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
