import { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';
import { submitFeedback } from '../services/feedbackApi';

interface FeedbackButtonsProps {
  conversationId?: string;
}

export default function FeedbackButtons({ conversationId }: FeedbackButtonsProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  if (!conversationId) return null;

  const handleRate = async (newRating: number) => {
    if (isSubmitting) return;
    setRating(newRating);
    setIsSubmitting(true);
    
    try {
      await submitFeedback({ conversationId, rating: newRating });
      setShowThanks(true);
      setTimeout(() => setShowThanks(false), 3000);
    } catch (error) {
      console.error('Feedback failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800/50">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Was this helpful?
      </p>
      
      <div className="flex items-center gap-2">
        {showThanks ? (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 animate-in fade-in zoom-in-95 duration-300 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Thank you!</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleRate(5)}
              disabled={isSubmitting}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 ${
                rating === 5 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'text-slate-400'
              }`}
              title="Helpful"
            >
              <ThumbsUp size={16} fill={rating === 5 ? 'currentColor' : 'none'} />
            </button>
            
            <button
              onClick={() => handleRate(1)}
              disabled={isSubmitting}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 ${
                rating === 1 ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'text-slate-400'
              }`}
              title="Not helpful"
            >
              <ThumbsDown size={16} fill={rating === 1 ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
