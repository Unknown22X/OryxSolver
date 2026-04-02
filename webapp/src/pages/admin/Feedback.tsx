import { useEffect, useState, useCallback } from 'react';
import { fetchEdge } from '../../lib/edge';
import { MessageSquare, Star, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, User2, Clock } from 'lucide-react';
import type { FeedbackEntry, AdminRole } from '../../types/admin';

export default function FeedbackSection({ adminRole: _adminRole }: { adminRole: AdminRole }) {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEdge<{ feedback: FeedbackEntry[]; total: number }>(
        `/admin-actions/feedback?page=${p}&limit=20`
      );
      setFeedback(data.feedback || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.max(Math.ceil(total / 20), 1);
  const ratingEntries = feedback.filter(f => f.rating != null);
  const avgRating = ratingEntries.length > 0
    ? (ratingEntries.reduce((sum, f) => sum + f.rating!, 0) / ratingEntries.length).toFixed(1)
    : '—';

  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    star: r,
    count: feedback.filter(f => f.rating === r).length,
    pct: feedback.length > 0 ? (feedback.filter(f => f.rating === r).length / feedback.length) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">User Feedback</h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">
            {total.toLocaleString()} total entries
          </p>
        </div>
        <button onClick={() => load(page)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-60 transition-all shadow-sm active:scale-95">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
          <AlertCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Avg rating */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-3">Avg Rating</p>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-black text-slate-900 dark:text-white">{loading ? '—' : avgRating}</p>
            <div className="flex gap-0.5 mb-1.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={14} className={!loading && parseFloat(avgRating) >= i ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-zinc-700'} />
              ))}
            </div>
          </div>
        </div>

        {/* Distribution */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-3">Rating Distribution</p>
          <div className="space-y-2">
            {ratingCounts.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12 shrink-0">
                  <span className="text-xs font-black text-slate-700 dark:text-zinc-300">{star}</span>
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: loading ? '0%' : `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-[11px] font-bold text-slate-400 dark:text-zinc-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
          <MessageSquare size={14} className="text-slate-500 dark:text-zinc-500" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white">All Feedback</h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800/40">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-1/3" />
                <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-2/3" />
              </div>
            ))
          ) : feedback.length === 0 ? (
            <div className="p-16 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">No feedback yet</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1">User ratings will appear here</p>
            </div>
          ) : feedback.map(entry => (
            <div key={entry.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-base ${
                  !entry.rating ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400' :
                  entry.rating >= 4 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' :
                  entry.rating === 3 ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500' :
                  'bg-red-50 dark:bg-red-500/10 text-red-500'
                }`}>
                  {entry.rating ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {entry.rating && (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={11} className={entry.rating! >= i ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-zinc-700'} />
                        ))}
                      </div>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-600 font-medium">
                      <User2 size={10} />
                      {entry.profiles?.email || entry.profiles?.display_name || 'Anonymous'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-600 ml-auto shrink-0">
                      <Clock size={10} />
                      {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {entry.comment ? (
                    <p className="text-sm text-slate-700 dark:text-zinc-300 font-medium leading-relaxed">"{entry.comment}"</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-600 italic">No comment</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {total > 20 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-900/30">
            <span className="text-xs text-slate-400 dark:text-zinc-600 font-semibold">
              Page <span className="font-black text-slate-700 dark:text-zinc-300">{page}</span> of <span className="font-black text-slate-700 dark:text-zinc-300">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
