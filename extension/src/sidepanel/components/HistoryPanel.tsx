import { useEffect, useState } from 'react';
import { getAccessToken } from '../auth/supabaseAuthClient';
import { fetchHistoryList } from '../services/historyApi';
import type { HistoryEntry } from '../services/contracts';
import { Loader2, MessageSquare, ChevronRight, Settings, Plus, MoreVertical, Trash2, Edit2, Check, X as CloseIcon } from 'lucide-react';

type HistoryPanelProps = {
  onSelect: (conversationId: string) => void;
  onNewSolve: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  onDeleteConversation: (id: string) => Promise<void>;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  historyEnabled: boolean;
  onEnableHistory: () => void;
};

export default function HistoryPanel({ 
  onSelect, 
  onNewSolve, 
  onOpenSettings, 
  onClose,
  onDeleteConversation,
  onRenameConversation,
  historyEnabled,
  onEnableHistory,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!historyEnabled) {
      setEntries([]);
      setLoading(false);
      return;
    }
    async function loadHistory() {
      try {
        const token = await getAccessToken();
        const data = await fetchHistoryList(token, { limit: 100 });

        if (data?.entries) {
          // Group by conversation_id where present
          const conversationsMap = new Map<string, {
            id: string;
            conversation_id: string | null;
            question: string;
            created_at: string;
            latest_at: string;
          }>();

          const standaloneEntries: HistoryEntry[] = [];

          data.entries.forEach((entry) => {
            const convId = (entry.conversation_id as string | null)?.trim();
            
            if (!convId) {
              // If no conversation ID, it's a standalone entry, don't group it
              standaloneEntries.push(entry);
              return;
            }

            const group = conversationsMap.get(convId);
            if (!group) {
              conversationsMap.set(convId, {
                ...entry,
                conversation_id: convId,
                latest_at: entry.created_at, // Since we are sorted DESC, first one is latest
              });
            } else {
              // As we iterate older entries (DESC order), 
              // we update the group's question to the older one
              // to eventually get the "original" question as the representative item.
              group.question = entry.question;
              group.created_at = entry.created_at;
            }
          });

          const groupedList = Array.from(conversationsMap.values());
          const allItems = [...groupedList, ...standaloneEntries]
            .sort((a, b) => {
              const bTime = new Date((b as any).latest_at || b.created_at).getTime();
              const aTime = new Date((a as any).latest_at || a.created_at).getTime();
              return bTime - aTime;
            });
            
          setEntries(allItems as unknown as HistoryEntry[]);
        }
      } catch (e) {
        console.error('Failed to load history', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [historyEnabled]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sidebar */}
      <div className="relative flex h-full w-full max-w-[320px] flex-col bg-white shadow-2xl animate-in slide-in-from-bottom-2 duration-300 dark:bg-slate-900 dark:shadow-none">
      {/* Sidebar Top: Branding & New Solve */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-200/50">
              <MessageSquare size={16} className="text-white fill-white/20" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 italic">Oryx</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
        </div>

        <button
          onClick={() => { onNewSolve(); onClose(); }}
          className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-200/50 transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] dark:bg-indigo-600 dark:shadow-none dark:hover:bg-indigo-500"
        >
          <Plus size={18} />
          New Solve
        </button>
      </div>

      <div className="px-5 mb-2 mt-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Past Solves</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1.5 custom-scrollbar">
        {!historyEnabled ? (
          <div className="flex h-40 flex-col items-center justify-center text-center gap-3 px-4">
            <MessageSquare size={32} className="text-slate-300 dark:text-slate-700" />
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              History is disabled. Enable it to see your past solves here.
            </p>
            <button
              onClick={onEnableHistory}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-sm"
            >
              Enable History
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-indigo-500/50" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center opacity-70">
            <MessageSquare size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 px-4">No past solves yet. Solve your first problem!</p>
          </div>
        ) : (
          entries.map((entry) => {
            const conversationId = String(entry.conversation_id || '');
            const isEditing = editingId === conversationId;
            const isMenuOpen = menuOpenId === conversationId;

            return (
              <div key={entry.id} className="group relative flex w-full items-center gap-1 rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {isEditing ? (
                  <div className="flex w-full items-center gap-2 p-2 px-3">
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-[13.5px] font-bold text-slate-700 outline-none dark:text-slate-200"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (conversationId) {
                            onRenameConversation(conversationId, editValue);
                            setEntries(prev => prev.map(e => String(e.conversation_id || '') === conversationId ? { ...e, question: editValue } : e));
                          }
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          if (conversationId) {
                            onRenameConversation(conversationId, editValue);
                            setEntries(prev => prev.map(e => String(e.conversation_id || '') === conversationId ? { ...e, question: editValue } : e));
                          }
                          setEditingId(null);
                        }}
                        className="rounded-lg p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <CloseIcon size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (!conversationId) return;
                        onSelect(conversationId);
                      }}
                      className="flex-1 flex flex-col gap-1 p-3 text-left"
                    >
                      <p className="line-clamp-1 text-[13.5px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {entry.question || 'Image capture'}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </button>

                    <div className="relative pr-2 flex items-center gap-1">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Delete this conversation?')) {
                            if (conversationId) {
                              await onDeleteConversation(conversationId);
                              setEntries(prev => prev.filter(e => String(e.conversation_id || '') !== conversationId));
                            }
                          }
                        }}
                        className="rounded-lg p-1.5 text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 transition-all dark:hover:bg-rose-900/30"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => setMenuOpenId(isMenuOpen ? null : conversationId)}
                        className={`rounded-lg p-1.5 transition-colors ${isMenuOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-2 top-10 z-20 w-32 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                          <button
                            onClick={() => {
                              if (!conversationId) return;
                              setEditingId(conversationId);
                              setEditValue(entry.question);
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Edit2 size={12} />
                            Rename
                          </button>
                          <button
                            onClick={async () => {
                              if (conversationId) {
                                await onDeleteConversation(conversationId);
                                setEntries(prev => prev.filter(e => String(e.conversation_id || '') !== conversationId));
                              }
                              setMenuOpenId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer: Settings */}
      <div className="border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={() => { onOpenSettings(); onClose(); }}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shadow-sm group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
            <Settings size={16} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
          </div>
          <span className="text-[13px] font-bold">Account Settings</span>
        </button>
      </div>
      {/* end sidebar */}
      </div>
    {/* end overlay */}
    </div>
  );
}
