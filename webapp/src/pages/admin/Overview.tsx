import { useEffect, useState } from 'react';
import { fetchEdge } from '../../lib/edge';
import {
  Users, BarChart3, ShieldAlert, RefreshCw, TrendingUp,
  CreditCard, ArrowUpRight, ArrowDownRight, Minus, Activity, UserCheck, Star, Zap
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { AdminStats } from '../../types/admin';

export default function OverviewSection() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchEdge<{ stats?: AdminStats } & AdminStats>('/admin-metrics');
      // Backend returns { stats: {...} } when fresh, or spreads stats to root when cached
      const resolved = data.stats ?? (data as unknown as AdminStats);
      setStats(resolved);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { load(); }, []);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Platform Overview
          </h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">
            Refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 transition-all disabled:opacity-60 shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Users"
          value={stats?.totalUsers ?? null}
          sub={`+${stats?.newUsers7d ?? 0} this week`}
          trend={stats?.newUsers7d ? 'up' : 'neutral'}
          icon={<Users size={16} />}
          gradient="from-indigo-500 to-blue-500"
          loading={loading}
        />
        <KpiCard
          title="Active Today"
          value={stats?.activeUsersToday ?? null}
          sub={`${stats?.activeUsers7d ?? 0} this week`}
          trend={stats?.activeUsersToday ? 'up' : 'neutral'}
          icon={<UserCheck size={16} />}
          gradient="from-violet-500 to-purple-600"
          loading={loading}
        />
        <KpiCard
          title="Solves (24h)"
          value={stats?.totalToday ?? null}
          sub={`${stats?.creditsToday?.total ?? 0} credits burned`}
          trend={stats?.totalToday ? 'up' : 'neutral'}
          icon={<BarChart3 size={16} />}
          gradient="from-emerald-500 to-teal-500"
          loading={loading}
        />
        <KpiCard
          title="Error Rate"
          value={stats ? `${stats.errorRate}%` : null}
          sub={`${stats?.failedCount ?? 0} failed requests`}
          trend={(stats?.errorRate ?? 0) > 5 ? 'down' : 'up'}
          icon={<ShieldAlert size={16} />}
          gradient={(stats?.errorRate ?? 0) > 5 ? 'from-red-500 to-rose-600' : 'from-emerald-500 to-teal-500'}
          loading={loading}
        />
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SmallStatCard
          label="Pro Users"
          value={stats?.proUsers?.toLocaleString() ?? null}
          icon={<Zap size={14} />}
          loading={loading}
        />
        <SmallStatCard
          label="Premium Users"
          value={stats?.premiumUsers?.toLocaleString() ?? null}
          icon={<Star size={14} />}
          loading={loading}
        />
        <SmallStatCard
          label="Credits This Month"
          value={stats?.creditsMonth?.total?.toLocaleString() ?? null}
          icon={<CreditCard size={14} />}
          loading={loading}
        />
        <SmallStatCard
          label="Active 30d"
          value={stats?.activeUsers30d?.toLocaleString() ?? null}
          icon={<Activity size={14} />}
          loading={loading}
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col"
          style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                <TrendingUp size={14} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Solve Volume</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-600 font-medium">Requests — last 7 days</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {loading ? <span className="inline-block w-10 h-5 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" /> : (stats?.trends?.solvesPerDay?.reduce((a, b) => a + b.count, 0) ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-semibold">7-day total</p>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] w-full mt-2">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (!stats?.trends?.solvesPerDay?.length ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 dark:text-zinc-600 font-medium">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trends.solvesPerDay} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#818cf8' }}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ))}
          </div>
        </div>

        {/* Credits Breakdown */}
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col"
          style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
              <CreditCard size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Credits This Month</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-600 font-medium">Plan vs promo utilization</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-5">
            {[
              {
                label: 'Paid Credits',
                value: stats?.creditsMonth?.paid ?? 0,
                total: stats?.creditsMonth?.total ?? 1,
                color: 'bg-indigo-500',
                track: 'bg-indigo-100 dark:bg-indigo-500/10',
              },
              {
                label: 'Free / Promo',
                value: stats?.creditsMonth?.free ?? 0,
                total: stats?.creditsMonth?.total ?? 1,
                color: 'bg-emerald-500',
                track: 'bg-emerald-100 dark:bg-emerald-500/10',
              },
            ].map(({ label, value, total, color, track }) => {
              const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
              return (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {loading ? '—' : value.toLocaleString()}
                    </span>
                  </div>
                  <div className={`h-2 w-full ${track} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-1000`}
                      style={{ width: loading ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-600">{pct.toFixed(0)}% of total</p>
                </div>
              );
            })}

            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500">Total burned</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {loading ? '—' : (stats?.creditsMonth?.total ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col"
          style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                <Users size={14} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">New User Sign-ups</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-600 font-medium">New accounts — last 7 days</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {loading ? <span className="inline-block w-8 h-5 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" /> : (stats?.newUsers7d ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-semibold">this week</p>
            </div>
          </div>
          
          <div className="flex-1 min-h-[200px] w-full mt-2">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (!stats?.trends?.usersPerDay?.length ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 dark:text-zinc-600 font-medium">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.trends.usersPerDay} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
                    cursor={{ fill: '#334155', opacity: 0.1 }}
                    labelFormatter={(l) => new Date(l).toLocaleDateString()}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col"
          style={{ backgroundColor: 'var(--surface-panel)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-500/10 flex items-center justify-center">
              <Activity size={14} className="text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Model Usage</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-600 font-medium">Distribution</p>
            </div>
          </div>
          <div className="flex-1 min-h-[200px] w-full mt-2">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (!stats?.modelUsage?.length ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 dark:text-zinc-600 font-medium">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={stats.modelUsage}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="model"
                  >
                    {stats.modelUsage.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any, name: any, props: any) => [`${value} solves (${props?.payload?.percentage?.toFixed(1) ?? 0}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, trend, icon, gradient, loading,
}: {
  title: string;
  value: string | number | null;
  sub: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  gradient: string;
  loading?: boolean;
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400 dark:text-zinc-600';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden relative group"
      style={{ backgroundColor: 'var(--surface-panel)' }}>
      {/* Background gradient accent */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />

      <div className="flex items-start justify-between mb-4 relative">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        <TrendIcon size={16} className={trendColor} />
      </div>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 mb-1 relative">{title}</p>
      <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none relative">
        {loading ? <span className="inline-block w-16 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" /> : (value ?? '—')}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-semibold mt-1.5 relative">{sub}</p>
    </div>
  );
}

// ─── Small Stat Card ─────────────────────────────────────────────────────────
function SmallStatCard({
  label, value, icon, alert, loading,
}: {
  label: string;
  value: string | number | null;
  icon: React.ReactNode;
  alert?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm flex items-center gap-3 transition-all hover:-translate-y-0.5 ${
      alert
        ? 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5'
        : 'border-slate-200 dark:border-zinc-800'
    }`}
      style={!alert ? { backgroundColor: 'var(--surface-panel)' } : {}}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
        alert
          ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
      }`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-600 truncate">{label}</p>
        <p className={`text-lg font-black tracking-tight ${alert ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
          {loading ? <span className="inline-block w-12 h-5 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" /> : (value ?? '—')}
        </p>
      </div>
    </div>
  );
}
