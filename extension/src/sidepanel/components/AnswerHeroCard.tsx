type AnswerHeroCardProps = {
  answer: string;
};

export default function AnswerHeroCard({ answer }: AnswerHeroCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 shadow-sm">
      <div className="bg-indigo-600 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-100">
          Final Answer
        </p>
        <p className="mt-1 text-2xl font-bold leading-tight text-white">{answer}</p>
      </div>
    </div>
  );
}
