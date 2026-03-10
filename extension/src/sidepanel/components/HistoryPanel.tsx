import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, MessageSquare, ChevronRight, Settings, Plus } from 'lucide-react';
import type { AiResponse } from '../types';

type HistoryEntry = {
  id: string;
  created_at: string;
  question: string;
  answer: string;
};

type HistoryPanelProps = {
  onSelect: (response: AiResponse, question: string) => void;
  onNewSolve: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

export default function HistoryPanel({ onSelect, onNewSolve, onOpenSettings, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('history_entries')
          .select('id, created_at, question, answer')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          setEntries(data as HistoryEntry[]);
        }
      } catch (e) {
        console.error('Failed to load history', e);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
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
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-indigo-500/50" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center opacity-70">
            <MessageSquare size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 px-4">No past solves yet. Solve your first problem!</p>
          </div>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect({ answer: entry.answer, explanation: entry.answer, suggestions: [] }, entry.question)}
              className="group flex w-full flex-col gap-1 rounded-xl p-3 text-left transition hover:bg-slate-50 active:scale-[0.98] dark:hover:bg-slate-800/50"
            >
              <p className="line-clamp-1 text-[13.5px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {entry.question || 'Image capture'}
              </p>
              <p className="text-[10px] font-semibold text-slate-400">
                {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </button>
          ))
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
    </div>
  );
}
