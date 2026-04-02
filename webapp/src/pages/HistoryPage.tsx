import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import {
  Sparkles, Search, Trash2, ChevronRight, Loader2, 
  Clock, Bot, MessageSquare, BookOpen, Calculator, Zap,
  History
} from 'lucide-react';
import { deleteHistory, fetchHistoryList, readCachedHistoryList } from '../lib/historyApi';
import { groupHistoryEntries, type ThreadedHistoryEntry } from '../lib/historyThreads';
import type { User } from '@supabase/supabase-js';
import { useServiceHealth } from '../hooks/useServiceHealth';

export default function HistoryPage({ user }: { user: User }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [history, setHistory] = useState<ThreadedHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { health } = useServiceHealth();
  const historyReadOnly = health.readOnly && (health.dependencies.db.status !== 'healthy' || health.dependencies.network.status === 'outage');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHistoryList({ limit: 100 });
      setHistory(groupHistoryEntries(data.entries));
    } catch (err: any) {
      console.error('Error loading history:', err);
      const cached = readCachedHistoryList();
      if (cached?.entries?.length) {
        setHistory(groupHistoryEntries(cached.entries));
        setError('Cloud history is temporarily unavailable. Showing cached history.');
      } else {
        setError(err instanceof Error ? err.message : t('history.error_load'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleDelete = async (entry: ThreadedHistoryEntry) => {
    if (historyReadOnly) return;
    if (!confirm(t('history.confirm_delete'))) return;
    
    setDeletingId(entry.id);
    try {
      if (entry.conversation_id) {
        await deleteHistory({ conversationId: entry.conversation_id });
        setHistory(prev => prev.filter(e => e.threadId !== entry.threadId));
      } else {
        await deleteHistory({ conversationId: entry.id });
        setHistory(prev => prev.filter(e => e.threadId !== entry.threadId));
      }
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const normalizedQuery = searchQuery.toLowerCase();
  const filteredHistory = history.filter((entry) => {
    const mode = entry.style_mode?.toLowerCase() ?? '';
    const rootQuestion = entry.rootQuestion?.toLowerCase() ?? '';
    const question = entry.question?.toLowerCase() ?? '';
    return mode.includes(normalizedQuery) || rootQuestion.includes(normalizedQuery) || question.includes(normalizedQuery);
  });

  // Grouping history by relative time
  const groupedHistory = useMemo(() => {
    const groups: Record<string, ThreadedHistoryEntry[]> = {};
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    filteredHistory.forEach(entry => {
      const date = new Date(entry.created_at).toDateString();
      let label = date;
      if (date === todayStr) {
        label = t('history.today');
      } else if (date === yesterdayStr) {
        label = t('history.yesterday');
      } else {
        const d = new Date(entry.created_at);
        label = d.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
      }
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });
    
    const sortedLabels = Object.keys(groups).sort((a, b) => {
      const today = t('history.today');
      const yesterday = t('history.yesterday');
      if (a === today) return -1;
      if (b === today) return 1;
      if (a === yesterday) return -1;
      if (b === yesterday) return 1;
      return new Date(groups[b][0].created_at).getTime() - new Date(groups[a][0].created_at).getTime();
    });

    const result: Record<string, ThreadedHistoryEntry[]> = {};
    sortedLabels.forEach(label => {
      result[label] = groups[label];
    });
    
    return result;
  }, [filteredHistory, i18n.language, t]);

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'exam': return <BookOpen size={14} />;
      case 'eli5': return <Bot size={14} />;
      case 'step_by_step': return <Calculator size={14} />;
      case 'gen_alpha': return <MessageSquare size={14} />;
      default: return <Zap size={14} />;
    }
  };

  if (loading) {
    return (
      <AppLayout currentPage="history" user={user}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout currentPage="history" user={user}>
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
           <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
             <Trash2 className="text-red-500" size={32} />
           </div>
           <p className="text-red-500 font-bold mb-6">{error}</p>
           <button onClick={loadHistory} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-600/20">{t('history.retry_loading')}</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="history" user={user}>
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-5 lg:px-6 lg:py-5" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">{t('history.title')}</h1>
            <p className="text-sm font-bold text-slate-500">{t('history.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
               <History size={14} />
                              {history.length} {t('history.saved_solves')}
             </div>
             {historyReadOnly && (
               <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-200 flex items-center gap-2">
                 Read-only cache
               </div>
             )}
          </div>
        </div>

        <div className="group relative mb-6">
          <div className="absolute inset-0 bg-indigo-500/5 blur-2xl group-focus-within:bg-indigo-500/10 transition-colors pointer-events-none" />
          <Search className={`absolute ${isRtl ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors`} size={20} />
          <input
            type="text"
            placeholder={t('history.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-[22px] border-2 bg-white/40 py-3 ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm font-bold outline-none transition-all placeholder-slate-400 shadow-xl shadow-black/[0.02] backdrop-blur-xl focus:border-indigo-500/40 dark:bg-white/[0.01] sm:rounded-[26px] sm:py-3.5 ${isRtl ? 'sm:pr-14 sm:pl-5' : 'sm:pl-14 sm:pr-5'}`}
            style={{ borderColor: 'var(--border-color)' }}
          />
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-24 bg-slate-50 dark:bg-white/[0.01] rounded-[48px] border-2 border-dashed border-slate-200 dark:border-white/5">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-8 shadow-inner shadow-black/5">
              <Sparkles size={48} className="text-slate-300 dark:text-slate-700" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
              {searchQuery ? t('history.no_results') : t('history.empty_state_title')}
            </h3>
            <p className="text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
              {searchQuery ? t('history.no_results_desc', { query: searchQuery }) : t('history.empty_state_desc')}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => navigate('/chat')}
                className="mt-10 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-600/30 hover:scale-105 transition-transform"
              >
                {t('history.open_solver')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {Object.entries(groupedHistory).map(([label, entries]) => (
              <div key={label} className="space-y-4">
                <div className="flex items-center gap-3 px-1 sm:gap-4 sm:px-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                    {label}
                  </h3>
                  <div className="h-[1px] w-full bg-slate-200 dark:bg-white/10" />
                </div>
                
                <div className="grid gap-3.5">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group rounded-[22px] border bg-white/40 p-4 backdrop-blur-sm transition-all hover:border-indigo-500/30 hover:bg-white hover:shadow-xl hover:shadow-black/5 dark:bg-white/[0.01] dark:hover:bg-white/5 sm:rounded-[24px] sm:p-4.5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/chat?conversationId=${entry.threadId}`)}
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-2 rounded-full border border-indigo-500/10 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 shadow-sm transition-transform group-hover:scale-105 sm:px-3.5">
                              {getModeIcon(entry.style_mode ?? 'standard')}
                              {t(`history.mode_${entry.style_mode ?? 'standard'}`)}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                              <Clock size={14} className="opacity-50" />
                              {new Date(entry.created_at).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                          </div>
                          
                          <h4 className="mb-2.5 line-clamp-2 text-[15px] font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 sm:text-base">
                            {entry.rootQuestion || entry.question}
                          </h4>
                          {entry.answer && (
                            <p className="text-[13px] text-slate-500 font-semibold line-clamp-2 leading-relaxed opacity-70 italic group-hover:opacity-100 transition-opacity">
                              "{entry.answer}"
                            </p>
                          )}
                        </div>
      
                        <div className="flex w-full items-center justify-end gap-3 md:w-auto md:shrink-0 md:self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry);
                            }}
                            disabled={deletingId === entry.id || historyReadOnly}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-slate-400 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500 md:h-12 md:w-12 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                            title={t('history.delete_solve')}
                          >
                            {deletingId === entry.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => navigate(`/chat?conversationId=${entry.threadId}`)}
                            className="flex h-12 min-w-[3.5rem] flex-1 items-center justify-center rounded-[20px] bg-slate-100 text-slate-400 shadow-xl shadow-transparent transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-indigo-600/20 dark:bg-white/5 md:h-14 md:w-14 md:flex-none md:rounded-[24px]"
                          >
                            <ChevronRight size={28} className={isRtl ? 'rotate-180' : ''} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
