import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { 
  Sparkles, Search, Trash2, ChevronRight, Loader2, 
  Clock, Bot, MessageSquare, BookOpen, Calculator, Zap,
  History
} from 'lucide-react';
import { deleteHistory, fetchHistoryList } from '../lib/historyApi';
import type { User } from '@supabase/supabase-js';

interface HistoryEntry {
  id: string;
  subject: string;
  question: string;
  answer?: string;
  style_mode: string;
  created_at: string;
  conversation_id?: string | null;
}

export default function HistoryPage({ user }: { user: User }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHistoryList({ limit: 100 });
      setHistory(data.entries as HistoryEntry[]);
    } catch (err: any) {
      console.error('Error loading history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleDelete = async (entry: HistoryEntry) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) return;
    
    setDeletingId(entry.id);
    try {
      if (entry.conversation_id) {
        await deleteHistory({ conversationId: entry.conversation_id });
        setHistory(prev => prev.filter(e => e.conversation_id !== entry.conversation_id));
      } else {
        await deleteHistory({ conversationId: entry.id });
        setHistory(prev => prev.filter(e => e.id !== entry.id));
      }
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredHistory = history.filter(entry => 
    entry.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.question?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grouping history by relative time
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryEntry[]> = {};
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    filteredHistory.forEach(entry => {
      const date = new Date(entry.created_at).toDateString();
      let label = date;
      if (date === todayStr) {
        label = 'Today';
      } else if (date === yesterdayStr) {
        label = 'Yesterday';
      } else {
        const d = new Date(entry.created_at);
        label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }
      
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });
    
    const sortedLabels = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      return new Date(groups[b][0].created_at).getTime() - new Date(groups[a][0].created_at).getTime();
    });

    const result: Record<string, HistoryEntry[]> = {};
    sortedLabels.forEach(label => {
      result[label] = groups[label];
    });
    
    return result;
  }, [filteredHistory]);

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
           <button onClick={loadHistory} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-600/20">Retry Loading</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="history" user={user}>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">Academic History</h1>
            <p className="text-slate-500 font-bold">Review and organize your previous academic research</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
               <History size={14} />
               {history.length} Saved Solves
             </div>
          </div>
        </div>

        <div className="relative mb-12 group">
          <div className="absolute inset-0 bg-indigo-500/5 blur-2xl group-focus-within:bg-indigo-500/10 transition-colors pointer-events-none" />
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search solves by subject, keyword, or concept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-16 pr-6 py-6 rounded-[32px] border-2 bg-white/40 dark:bg-white/[0.01] backdrop-blur-xl font-black text-lg outline-none transition-all placeholder-slate-400 focus:border-indigo-500/40 shadow-2xl shadow-black/[0.02]"
            style={{ borderColor: 'var(--border-color)' }}
          />
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-24 bg-slate-50 dark:bg-white/[0.01] rounded-[48px] border-2 border-dashed border-slate-200 dark:border-white/5">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-8 shadow-inner shadow-black/5">
              <Sparkles size={48} className="text-slate-300 dark:text-slate-700" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
              {searchQuery ? 'No results found' : 'The journey starts here'}
            </h3>
            <p className="text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
              {searchQuery ? `We couldn't find any results for "${searchQuery}". Maybe try a different keyword?` : 'Begin solving academic questions to build your personalized research history.'}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => navigate('/chat')}
                className="mt-10 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-600/30 hover:scale-105 transition-transform"
              >
                Open Oryx Solver
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(groupedHistory).map(([label, entries]) => (
              <div key={label} className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                    {label}
                  </h3>
                  <div className="h-[1px] w-full bg-slate-200 dark:bg-white/10" />
                </div>
                
                <div className="grid gap-4">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="group p-6 rounded-[36px] border bg-white/40 dark:bg-white/[0.01] backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-white/5 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-black/5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex flex-col md:flex-row items-stretch gap-6">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/chat?conversationId=${entry.conversation_id || entry.id}`)}
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/10 shadow-sm transition-transform group-hover:scale-105">
                              {getModeIcon(entry.style_mode)}
                              {entry.style_mode.replace('_', ' ')}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                              <Clock size={14} className="opacity-50" />
                              {new Date(entry.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </div>
                          </div>
                          
                          <h4 className="text-xl font-black text-slate-900 dark:text-white mb-3 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {entry.subject || entry.question}
                          </h4>
                          {entry.answer && (
                            <p className="text-sm text-slate-500 font-bold line-clamp-2 leading-relaxed opacity-70 italic group-hover:opacity-100 transition-opacity">
                              "{entry.answer}"
                            </p>
                          )}
                        </div>
      
                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry);
                            }}
                            disabled={deletingId === entry.id}
                            className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-300 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete solve"
                          >
                            {deletingId === entry.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                          <button
                            onClick={() => navigate(`/chat?conversationId=${entry.conversation_id || entry.id}`)}
                            className="w-14 h-14 flex items-center justify-center rounded-[24px] bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl shadow-transparent group-hover:shadow-indigo-600/20"
                          >
                            <ChevronRight size={28} />
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
