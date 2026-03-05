type AnswerHeroCardProps = {
  answer: string;
};

export default function AnswerHeroCard({ answer }: AnswerHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-300/70 shadow-md">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.34),transparent_42%)]" />
      <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-indigo-100/95">
          Final Answer
        </p>
        <p className="mt-1 text-[30px] font-bold leading-tight text-white">{answer}</p>
      </div>
    </div>
  );
}
