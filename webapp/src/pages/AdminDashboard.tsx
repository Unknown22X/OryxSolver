import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout, Users, Zap, BarChart3, LogOut, Sparkles, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Stats = {
  totalSolves: number;
  activeUsers: number;
  captureRate: number;
  conversionRate: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAdminAndLoad() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }

        // Check for admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('auth_user_id', user.id)
          .single();

        if (profileError || !profile || profile.role !== 'admin') {
          setError(profileError?.message || "You don't have permission to view this dashboard.");
          setLoading(false);
          return;
        }

        // Fetch stats
        const { count: totalSolves } = await supabase
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'solve_completed');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: usersData } = await supabase
          .from('analytics_events')
          .select('user_id')
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        const uniqueUsers = new Set(usersData?.map(e => e.user_id).filter(Boolean)).size;

        const { count: started } = await supabase
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'screen_capture_started');
        
        const { count: completed } = await supabase
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'screen_capture_completed');

        const { count: modalOpens } = await supabase
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'upgrade_modal_opened');
        
        const { count: linkClicks } = await supabase
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .eq('event_name', 'upgrade_link_clicked');

        setStats({
          totalSolves: totalSolves || 0,
          activeUsers: uniqueUsers || 0,
          captureRate: started ? Math.round(((completed || 0) / started) * 100) : 0,
          conversionRate: modalOpens ? Math.round(((linkClicks || 0) / modalOpens) * 100) : 0
        });
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    checkAdminAndLoad();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0c1b] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0a0c1b] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-500/10 border border-red-500/20 p-10 rounded-[40px] max-w-lg shadow-2xl">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
          <Shield size={32} />
        </div>
        <h1 className="text-3xl font-black text-white mb-4">Access Denied</h1>
        <p className="text-slate-400 font-bold mb-8 leading-relaxed">
          {error}
          <br /><br />
          <span className="text-xs uppercase tracking-widest text-slate-500 block mb-2">Developer Note:</span>
          To grant access, run this in your Supabase SQL Editor:
          <code className="block bg-black/40 p-3 rounded-xl mt-3 text-indigo-400 text-xs border border-white/5">
            UPDATE public.profiles SET role = 'admin' <br />
            WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
          </code>
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => navigate('/')} className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">Return Home</button>
          <button onClick={() => window.location.reload()} className="gradient-btn px-8 py-3 rounded-2xl">Check Again</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c1b] text-white">
      {/* Side Nav */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 border-r border-white/5 bg-[#161927] p-6 hidden lg:flex flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-xl font-black tracking-tight">Oryx<span className="text-indigo-500">Admin</span></span>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl flex items-center gap-3 font-black text-sm">
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </div>
          <div className="text-slate-500 hover:bg-white/5 p-3 rounded-xl flex items-center gap-3 font-black text-sm transition-all cursor-pointer">
            <Users size={18} />
            <span>Users</span>
          </div>
          <div className="text-slate-500 hover:bg-white/5 p-3 rounded-xl flex items-center gap-3 font-black text-sm transition-all cursor-pointer">
            <Zap size={18} />
            <span>AI Usage</span>
          </div>
        </nav>

        <button onClick={handleLogout} className="mt-auto flex items-center gap-3 text-slate-500 hover:text-red-400 font-black text-sm transition-colors">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8 lg:p-12">
        <header className="mb-12">
          <h1 className="text-4xl font-black tracking-tight mb-2">Analytics Overview</h1>
          <p className="text-slate-400 font-bold">Real-time performance metrics for OryxSolver.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          <StatCard title="Total Solves" value={stats?.totalSolves || 0} icon={<Zap size={24} />} trend="+12%" />
          <StatCard title="Active Users" value={stats?.activeUsers || 0} icon={<Users size={24} />} trend="+5%" />
          <StatCard title="Capture Success" value={`${stats?.captureRate || 0}%`} icon={<Layout size={24} />} trend="Stable" />
          <StatCard title="Pro Conversion" value={`${stats?.conversionRate || 0}%`} icon={<TrendingUp size={24} />} trend="+2%" />
        </div>

        <div className="bg-[#161927] border border-white/5 rounded-[32px] p-8 h-[400px] flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05)_0%,transparent_100%)]" />
           <div className="text-center relative z-10">
              <BarChart3 size={48} className="text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Usage Charts coming soon</p>
           </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string | number, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-[#161927] border border-white/5 p-6 rounded-[32px] hover:border-indigo-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-emerald-500 text-xs font-black bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>
      </div>
      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}
