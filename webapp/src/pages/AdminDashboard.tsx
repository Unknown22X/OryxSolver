import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import {
  Users, Activity, Settings, LayoutDashboard, ShieldAlert, Loader2,
  ArrowLeft, MessageSquare, Bot
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { AdminRole } from '../types/admin';

import OverviewSection from './admin/Overview';
import UsersSection from './admin/Users';
import MonitoringSection from './admin/Monitoring';
import SettingsSection from './admin/Settings';
import FeedbackSection from './admin/Feedback';
import AIConfigSection from './admin/AIConfig';
import AssetPreviewSection from './admin/AssetPreview';

import NotificationCenter from '../components/NotificationCenter';

import { MascotIcon } from '../components/MascotIcon';

export type AdminTab = 'overview' | 'users' | 'monitoring' | 'feedback' | 'ai-config' | 'assets' | 'settings';


export default function AdminDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const { profile: adminProfile, loading: profileLoading } = useProfile(user);
  const navigate = useNavigate();

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-500">Loading console…</p>
        </div>
      </div>
    );
  }

  const role = (adminProfile?.role as AdminRole) || 'authenticated';

  if (!['admin', 'support', 'read-only'].includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Access Denied</h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-2">You do not have the required permissions to view the Admin Console.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 rounded-2xl font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            <ArrowLeft size={16} />
            Return to Safety
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, desc: 'KPIs & trends' },
    { id: 'users', label: 'Users', icon: Users, desc: 'Manage accounts' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, desc: 'Live activity' },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare, desc: 'User feedback' },
    { id: 'ai-config', label: 'AI Config', icon: Bot, desc: 'Model settings', hideFrom: ['read-only'] as AdminRole[] },
    { id: 'assets', label: 'Assets', icon: LayoutDashboard, desc: 'Mascot library' },
    { id: 'settings', label: 'System', icon: Settings, desc: 'Platform config', hideFrom: ['read-only'] as AdminRole[] },

  ] as const;

  const activeTabDef = tabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-zinc-800/80 flex flex-col sticky top-0 h-screen"
        style={{ backgroundColor: 'var(--surface-sidebar)', backdropFilter: 'blur(20px)' }}>

        {/* Logo Area */}
        <div className="px-5 py-6 border-b border-slate-200 dark:border-zinc-800/60">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-semibold mb-5">
            <ArrowLeft size={13} />
            Back to App
          </button>
          <div className="flex items-center gap-3">
            <MascotIcon 
              name="engineer" 
              size={40} 
              className="hover:scale-110 transition-transform duration-300" 
            />
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Admin Console</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-zinc-600 uppercase tracking-wider">Oryx Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 px-3 pt-2 pb-1">Navigation</p>
          {tabs.map((tab) => {
            if ('hideFrom' in tab && (tab.hideFrom as AdminRole[])?.includes(role)) return null;
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="shrink-0 transition-transform group-hover:scale-110">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{tab.label}</p>
                  <p className={`text-[10px] font-medium truncate ${isActive ? 'text-indigo-200' : 'text-slate-400 dark:text-zinc-600'}`}>{tab.desc}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom profile area */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black shadow-sm">
               {adminProfile?.email?.[0].toUpperCase()}
             </div>
             <div className="min-w-0 flex-1">
               <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{adminProfile?.displayName || 'Admin'}</p>
               <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                 role === 'admin' 
                   ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                   : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
               }`}>
                 {role === 'admin' ? '★' : role === 'support' ? '⚙' : '👁'}
               </span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 px-8 py-4 border-b border-slate-200/80 dark:border-zinc-800/60 flex items-center justify-between"
          style={{ backgroundColor: 'var(--surface-header)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${activeTab === 'monitoring' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-zinc-700'}`} />
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{activeTabDef?.label}</h1>
              <p className="text-xs text-slate-400 dark:text-zinc-600 font-medium">{activeTabDef?.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60">
              <MascotIcon name="sparkle" size={16} />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {role === 'admin' ? 'Super Admin' : role === 'support' ? 'Support' : 'Read-Only'}
              </span>
            </div>
            <NotificationCenter />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-3 duration-400">
            {activeTab === 'overview' && <OverviewSection />}
            {activeTab === 'users' && <UsersSection adminRole={role} />}
            {activeTab === 'monitoring' && <MonitoringSection />}
            {activeTab === 'feedback' && <FeedbackSection adminRole={role} />}
            {activeTab === 'ai-config' && role !== 'read-only' && <AIConfigSection adminRole={role} />}
            {activeTab === 'assets' && <AssetPreviewSection />}
            {activeTab === 'settings' && role !== 'read-only' && <SettingsSection adminRole={role} />}

          </div>
        </main>
      </div>
    </div>
  );
}
