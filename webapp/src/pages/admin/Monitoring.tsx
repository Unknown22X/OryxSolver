import { useEffect, useState } from 'react';
import { fetchEdge } from '../../lib/edge';
import {
  AlertCircle, CheckCircle2, Zap, RefreshCw, X, Activity,
  Clock, User2, Hash, ChevronRight, BookOpen, Shield
} from 'lucide-react';
import type { HistoryEntry, AuditLog } from '../../types/admin';

type MonitorTab = 'activity' | 'errors' | 'audit';

export default function MonitoringSection() {
  const [activeTab, setActiveTab] = useState<MonitorTab>('activity');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errors, setErrors] = useState<{ id: string; created_at: string; error_code: string; model: string; profiles?: { email: string | null } }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolve, setSelectedSolve] = useState<HistoryEntry | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const [histData, errorData, auditData] = await Promise.all([
        fetchEdge<{ history: HistoryEntry[] }>(`/admin-actions/history?limit=30&page=${page}`),
        fetchEdge<{ errors: any[] }>(`/admin-actions/errors?limit=30&page=${page}`),
        fetchEdge<{ logs: AuditLog[] }>(`/admin-actions/audit-logs?limit=50&page=${page}`).catch(() => ({ logs: [] })),
      ]);
      setHistory(histData.history || []);
      setErrors(errorData.errors || []);
      setAuditLogs(auditData.logs || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const successCount = history.filter(h => h.status === 'success').length;
  const errorCount = history.filter(h => h.status !== 'success').length;
  const successRate = history.length > 0 ? ((successCount / history.length) * 100).toFixed(0) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Live Monitoring</h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">
            Activity feed · Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-60 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total (this page)', value: history.length, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-100 dark:bg-zinc-800', icon: <Hash size={13} /> },
          { label: 'Success Rate', value: `${successRate}%`, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: <CheckCircle2 size={13} className="text-emerald-500" /> },
          { label: 'Errors', value: errorCount, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', icon: <AlertCircle size={13} className="text-red-500" /> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-6 h-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">{label}</p>
            </div>
            <p className={`text-2xl font-black ${color}`}>
              {loading ? <span className="inline-block w-8 h-6 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" /> : value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-900/50 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 w-fit">
        {([
          { id: 'activity' as MonitorTab, label: 'Activity', icon: <Activity size={12} />, count: history.length, alert: false },
          { id: 'errors' as MonitorTab, label: 'Errors', icon: <AlertCircle size={12} />, count: errors.length, alert: errors.length > 0 },
          { id: 'audit' as MonitorTab, label: 'Audit Log', icon: <BookOpen size={12} />, count: auditLogs.length, alert: false },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {!loading && tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                tab.alert ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Recent Solves */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Activity size={14} className="text-slate-500 dark:text-zinc-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Recent Solves</h3>
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Last 30</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-[480px] overflow-y-auto custom-scrollbar">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" style={{ width: `${50 + i * 8}%` }} />
                      <div className="h-2.5 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" style={{ width: `${30 + i * 5}%` }} />
                    </div>
                  </div>
                ))
              ) : history.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="w-7 h-7 text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-zinc-600 font-medium">No recent activity</p>
                </div>
              ) : history.map(entry => {
                const isOk = entry.status === 'success';
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedSolve(entry)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors group"
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      !isOk ? 'bg-red-50 dark:bg-red-500/10' :
                      'bg-emerald-50 dark:bg-emerald-500/10'
                    }`}>
                      {!isOk ? <AlertCircle size={13} className="text-red-500" /> :
                       <CheckCircle2 size={13} className="text-emerald-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate text-slate-900 dark:text-zinc-100">
                        {entry.profiles?.email || 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium">
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Feed (compact) */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${errors.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-zinc-700'}`} />
              <AlertCircle size={14} className="text-slate-500 dark:text-zinc-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Error Feed</h3>
              {!loading && errors.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">{errors.length > 9 ? '9+' : errors.length}</span>
              )}
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Last 30</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-[480px] overflow-y-auto custom-scrollbar">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 space-y-2">
                    <div className="h-3 rounded bg-red-100 dark:bg-red-500/10 animate-pulse w-1/3" />
                    <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-2/3" />
                  </div>
                ))
              ) : errors.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">All clear!</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1">No recent errors detected</p>
                </div>
              ) : errors.map(err => (
                <div key={err.id} className="px-5 py-3.5 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider">{err.model || 'unknown'}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-medium ml-auto">{new Date(err.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 font-semibold leading-snug">{err.error_code || 'Unknown error'}</p>
                  {err.profiles?.email && <p className="text-[11px] text-slate-400 dark:text-zinc-600 mt-0.5">{err.profiles.email}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ERRORS TAB (full) ── */}
      {activeTab === 'errors' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${errors.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-zinc-700'}`} />
            <AlertCircle size={14} className="text-slate-500 dark:text-zinc-500" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Full Error Feed</h3>
            {!loading && errors.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">{errors.length > 9 ? '9+' : errors.length}</span>
            )}
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Last 30</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-[560px] overflow-y-auto custom-scrollbar">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <div className="h-3 rounded bg-red-100 dark:bg-red-500/10 animate-pulse w-1/4" />
                  <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-3/4" />
                </div>
              ))
            ) : errors.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white">All systems go!</p>
                <p className="text-sm text-slate-400 dark:text-zinc-600 font-medium mt-1">No errors recorded in the last 30 requests</p>
              </div>
            ) : errors.map(err => (
              <div key={err.id} className="px-5 py-4 hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider">{err.model || 'unknown model'}</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-600 font-medium ml-auto">{new Date(err.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-zinc-300 font-semibold leading-snug">{err.error_code || 'Unknown error'}</p>
                {err.profiles?.email && <p className="text-[11px] text-slate-400 dark:text-zinc-600 mt-1 font-medium">User: {err.profiles.email}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2">
            <Shield size={14} className="text-slate-500 dark:text-zinc-500" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Admin Audit Log</h3>
            <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium ml-2">Every admin action is recorded here</p>
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Last 50</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-[560px] overflow-y-auto custom-scrollbar">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-1/2" />
                    <div className="h-2.5 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse w-3/4" />
                  </div>
                </div>
              ))
            ) : auditLogs.length === 0 ? (
              <div className="p-16 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">No audit entries yet</p>
                <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-1">Admin actions like user updates and credit adjustments will appear here</p>
              </div>
            ) : (auditLogs as any[]).map((log, i) => {
              const actionColors: Record<string, string> = {
                ROLE_CHANGE: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
                USER_UPDATE: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
                CREDIT_ADJUST: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
                CONFIG_UPDATE: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
              };
              return (
                <div key={log.id ?? i} className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield size={12} className="text-slate-500 dark:text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${actionColors[log.action_type] ?? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'}`}>
                          {log.action_type}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          by <span className="font-black text-slate-700 dark:text-zinc-200">{log.admin_role}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-600 ml-auto shrink-0">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.reason && (
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500 font-medium mt-1 leading-snug">
                          <span className="text-slate-300 dark:text-zinc-700">"</span>{log.reason}<span className="text-slate-300 dark:text-zinc-700">"</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === 'activity' || activeTab === 'errors') && (
        <div className="flex items-center justify-between px-1 py-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm font-bold text-slate-500 dark:text-zinc-500">
            Page {page}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loading || (history.length < 30 && errors.length < 30)}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {selectedSolve && (
        <SolveModal solve={selectedSolve} onClose={() => setSelectedSolve(null)} />
      )}
    </div>
  );
}

// ─── Solve Detail Modal ───────────────────────────────────────────────────────
function SolveModal({ solve, onClose }: { solve: HistoryEntry; onClose: () => void }) {
  const isOk = solve.status === 'success';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              !isOk ? 'bg-red-50 dark:bg-red-500/10' :
              'bg-emerald-50 dark:bg-emerald-500/10'
            }`}>
              {!isOk ? <AlertCircle size={16} className="text-red-500" /> :
               <CheckCircle2 size={16} className="text-emerald-500" />}
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Solve Details</h3>
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono mt-0.5">{solve.id.slice(0, 24)}…</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<User2 size={12} />} label="User" value={solve.profiles?.email ?? 'Anonymous'} />
            <InfoRow icon={isOk ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} label="Status" value={solve.status} highlight={isOk ? 'green' : 'red'} />
            <InfoRow icon={<Clock size={12} />} label="Time" value={new Date(solve.created_at).toLocaleString()} />
            {solve.model && <InfoRow icon={<Zap size={12} />} label="Model" value={solve.model} />}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end bg-slate-50/60 dark:bg-zinc-900/30">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-black hover:opacity-90 transition-opacity active:scale-95">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, highlight }: {
  icon?: React.ReactNode; label: string; value: string; highlight?: 'green' | 'red';
}) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 p-3">
      <div className="flex items-center gap-1.5 mb-1 text-slate-400 dark:text-zinc-600">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-sm font-bold truncate ${
        highlight === 'green' ? 'text-emerald-600 dark:text-emerald-400' :
        highlight === 'red' ? 'text-red-600 dark:text-red-400' :
        'text-slate-900 dark:text-zinc-100'
      }`}>{value}</p>
    </div>
  );
}
