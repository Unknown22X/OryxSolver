import { useEffect, useState, useCallback } from 'react';
import { fetchEdge } from '../../lib/edge';
import {
  Search, Shield, ChevronDown, AlertCircle, Loader2, X, CreditCard,
  Lock, Unlock, Users, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import type { UserProfile, AdminRole } from '../../types/admin';

const PLAN_COLORS: Record<string, string> = {
  premium: 'bg-violet-100 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400',
  pro: 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  free: 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400',
};

const PLAN_DOT: Record<string, string> = {
  premium: 'bg-violet-500',
  pro: 'bg-indigo-500',
  free: 'bg-slate-400',
};

export default function UsersSection({ adminRole }: { adminRole: AdminRole }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const data = await fetchEdge<{ users: UserProfile[]; total: number }>(
        `/admin-actions/search-users?q=${encodeURIComponent(q)}&page=${p}`
      );
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, search); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const creditsAvailable = (u: UserProfile) => {
    const w = u.credit_wallets?.[0];
    return Math.max((w?.granted_credits ?? 0) - (w?.used_credits ?? 0), 0);
  };

  const totalPages = Math.ceil(total / 20) || 1;

  const filteredUsers = planFilter === 'all'
    ? users
    : users.filter(u => (u.subscriptions?.[0]?.tier ?? 'free') === planFilter);

  const planCounts = {
    all: users.length,
    free: users.filter(u => !u.subscriptions?.[0]?.tier || u.subscriptions?.[0]?.tier === 'free').length,
    pro: users.filter(u => u.subscriptions?.[0]?.tier === 'pro').length,
    premium: users.filter(u => u.subscriptions?.[0]?.tier === 'premium').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            User Management
          </h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">
            {total.toLocaleString()} total accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Search email or name…"
              className="w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-slate-900 dark:text-white shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <button
            onClick={() => { setPage(1); load(1, search); }}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Plan filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900/50 rounded-xl w-fit border border-slate-200/60 dark:border-zinc-800/60">
        {(['all', 'free', 'pro', 'premium'] as const).map(plan => (
          <button
            key={plan}
            onClick={() => setPlanFilter(plan)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              planFilter === plan
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            {plan !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${PLAN_DOT[plan]}`} />}
            {plan}
            <span className="opacity-60 font-semibold">{planCounts[plan]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm"
        style={{ backgroundColor: 'var(--surface-panel)' }}>
        <div className="overflow-x-auto">
          {error && (
            <div className="m-5 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle size={18} />
              <div className="text-sm font-medium">
                <p className="font-bold">Connection Error</p>
                <p className="opacity-80">{error}</p>
              </div>
            </div>
          )}
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50">
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">User</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Plan</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Credits</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600">Joined</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 text-center">Status</th>
                <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-3.5">
                      <div className="h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" style={{ width: `${60 + (i * 7) % 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <Users className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 dark:text-zinc-600 font-medium">No users found</p>
                  </td>
                </tr>
              ) : filteredUsers.map(u => {
                const credits = creditsAvailable(u);
                const plan = u.subscriptions?.[0]?.tier ?? 'free';
                const initials = (u.display_name || u.email || '?').charAt(0).toUpperCase();
                const avatarColors = ['from-indigo-500 to-blue-600', 'from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600'];
                const colorIdx = (u.id?.charCodeAt(0) ?? 0) % avatarColors.length;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors group">
                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center font-black text-white text-xs shrink-0`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate max-w-[160px] text-slate-900 dark:text-zinc-100">
                            {u.display_name || 'Anonymous'}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate max-w-[160px] font-medium">
                            {u.email || 'No email'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border ${PLAN_COLORS[plan]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${PLAN_DOT[plan]}`} />
                        {plan}
                      </span>
                    </td>

                    {/* Credits */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={12} className="text-slate-400 dark:text-zinc-600 shrink-0" />
                        <span className={`text-sm font-black ${credits < 10 ? 'text-red-500' : credits < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                          {credits.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-600">
                        {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      {u.is_locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500">
                          <Lock size={9} /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={9} /> Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-indigo-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                      >
                        <Shield size={11} />
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-900/30">
          <span className="text-xs text-slate-400 dark:text-zinc-600 font-semibold">
            Page <span className="text-slate-700 dark:text-zinc-300 font-black">{page}</span> of <span className="text-slate-700 dark:text-zinc-300 font-black">{totalPages}</span>
            <span className="ml-2 text-slate-300 dark:text-zinc-700">·</span>
            <span className="ml-2">{total.toLocaleString()} total</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={users.length < 20}
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          adminRole={adminRole}
          onClose={() => setSelectedUser(null)}
          onUpdate={() => load(page, search)}
        />
      )}
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
function UserDetailModal({ user, adminRole, onClose, onUpdate }: {
  user: UserProfile; adminRole: AdminRole; onClose: () => void; onUpdate: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsDelta, setCreditsDelta] = useState<string>('');
  const [newRole, setNewRole] = useState<AdminRole>(user.role);
  const [newPlan, setNewPlan] = useState<string>(user.subscriptions?.[0]?.tier ?? 'free');
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState(false);
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [notifyData, setNotifyData] = useState({ title: '', message: '' });

  const isReadOnly = adminRole === 'read-only';
  const currentCredits = Math.max((user.credit_wallets?.[0]?.granted_credits ?? 0) - (user.credit_wallets?.[0]?.used_credits ?? 0), 0);
  const delta = parseInt(creditsDelta) || 0;
  const preview = Math.max(currentCredits + delta, 0);
  const hasChanges = newRole !== user.role || delta !== 0 || newPlan !== (user.subscriptions?.[0]?.tier ?? 'free');

  const handleUpdate = async () => {
    if (hasChanges && !reason.trim()) {
      setError('A reason is required for administrative changes.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (newRole !== user.role || newPlan !== (user.subscriptions?.[0]?.tier ?? 'free')) {
        await fetchEdge('/admin-actions/update-user', {
          method: 'POST',
          body: JSON.stringify({ targetUserId: user.auth_user_id, updates: { role: newRole, subscription_tier: newPlan }, reason }),
        });
      }
      if (delta !== 0) {
        await fetchEdge('/admin-actions/adjust-credits', {
          method: 'POST',
          body: JSON.stringify({ targetUserId: user.auth_user_id, delta, reason }),
        });
      }
      setSuccess(true);
      setTimeout(() => { onUpdate(); onClose(); }, 800);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Check logs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNotification = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await fetchEdge('/admin-actions/send-notification', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: user.auth_user_id,
          title: notifyData.title,
          message: notifyData.message,
          type: 'info'
        }),
      });
      setNotifyData({ title: '', message: '' });
      setShowNotifyForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async () => {
    if (!reason.trim()) { setError('A reason is required to lock / unlock an account.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await fetchEdge('/admin-actions/update-user', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: user.auth_user_id,
          updates: { is_locked: !user.is_locked },
          reason,
        }),
      });
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const plan = user.subscriptions?.[0]?.tier ?? 'free';
  const initials = (user.display_name || user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-black text-white text-lg`}>
                {initials}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">{user.display_name || 'Anonymous'}</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium mt-0.5">{user.email ?? 'No email'}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${PLAN_COLORS[plan]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${PLAN_DOT[plan]}`} />
                    {plan}
                  </span>
                  {user.is_locked && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-500">
                      <Lock size={8} /> Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Credits summary bar */}
        <div className="mx-6 my-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Credits Balance</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-3xl font-black text-slate-900 dark:text-white">{currentCredits.toLocaleString()}</p>
                {delta !== 0 && (
                  <>
                    <span className="text-slate-400 dark:text-zinc-600 font-bold">→</span>
                    <span className={`text-2xl font-black ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{preview.toLocaleString()}</span>
                    <span className={`text-sm font-bold ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>({delta > 0 ? '+' : ''}{delta})</span>
                  </>
                )}
              </div>
            </div>
            <CreditCard size={20} className="text-slate-300 dark:text-zinc-700" />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4 space-y-4">
          {/* Role + Plan grid */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <SelectBox
                value={newRole}
                onChange={e => setNewRole(e.target.value as AdminRole)}
                disabled={adminRole !== 'admin' || isReadOnly}
                options={[
                  { value: 'authenticated', label: 'User' },
                  { value: 'support', label: 'Support' },
                  { value: 'read-only', label: 'Read-Only Admin' },
                  { value: 'admin', label: 'Super Admin' },
                ]}
              />
            </Field>
            <Field label="Subscription Plan">
              <SelectBox
                value={newPlan}
                onChange={e => setNewPlan(e.target.value)}
                disabled={isReadOnly}
                options={[
                  { value: 'free', label: 'Free' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'premium', label: 'Premium' },
                ]}
              />
            </Field>
          </div>

          {/* Credits adjust */}
          <Field label="Credit Adjustment (+50 to add, -20 to remove)">
            <input
              type="number"
              disabled={isReadOnly}
              placeholder="e.g. 100 or -25"
              value={creditsDelta}
              onChange={e => setCreditsDelta(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl py-2.5 px-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50"
            />
          </Field>

          {/* Reason */}
          <Field label="Reason (required for changes)">
            <textarea
              disabled={isReadOnly}
              placeholder="Document the reason for this administrative action…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 h-20 resize-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-colors disabled:opacity-50 font-medium"
            />
          </Field>

          {/* Send Direct Notification */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
             <button
               type="button"
               onClick={() => setShowNotifyForm(!showNotifyForm)}
               className="text-[10px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-widest flex items-center gap-1.5"
             >
               {showNotifyForm ? <X size={10} /> : <Zap size={10} />}
               {showNotifyForm ? 'Hide Message Form' : 'Send In-App Notification'}
             </button>

             {showNotifyForm && (
               <div className="mt-4 space-y-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 animate-in slide-in-from-top-2 duration-300">
                  <Field label="Notification Title">
                    <input
                      type="text"
                      placeholder="e.g. Credit Granted"
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl py-2 px-3 text-xs font-bold"
                      value={notifyData.title}
                      onChange={e => setNotifyData({...notifyData, title: e.target.value})}
                    />
                  </Field>
                  <Field label="Message">
                    <textarea
                      placeholder="Write your message here..."
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 text-xs h-16 resize-none"
                      value={notifyData.message}
                      onChange={e => setNotifyData({...notifyData, message: e.target.value})}
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={submitting || !notifyData.title || !notifyData.message}
                      onClick={handleSendNotification}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {submitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
               </div>
             )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
              <CheckCircle2 size={14} className="shrink-0" /> Changes saved successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/60 dark:bg-zinc-900/30">
          <button
            disabled={isReadOnly || submitting}
            onClick={handleToggleLock}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${
              user.is_locked
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15'
            }`}
          >
            {user.is_locked ? <Unlock size={12} /> : <Lock size={12} />}
            {user.is_locked ? 'Unlock Account' : 'Lock Account'}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          {!isReadOnly && (
            <button
              disabled={submitting || !hasChanges}
              onClick={handleUpdate}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
              Apply Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">{label}</label>
      {children}
    </div>
  );
}

function SelectBox({ value, onChange, disabled, options }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; disabled?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl py-2.5 pl-4 pr-8 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}
