import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { fetchEdge } from '../lib/edge';
import {
  FALLBACK_PUBLIC_CONFIG,
  type LegalSection,
  type ProductFeature,
} from '../lib/appConfig';
import { BarChart3, Users, Zap, CreditCard, Activity, Loader2, ShieldAlert } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { fetchAdminConfig, saveAdminConfig } from '../lib/adminConfigApi';

type AdminStats = {
  totalSolves: number;
  activeUsers: number;
  captureRate: number;
  conversionRate: number;
  totalUsers: number;
  proUsers: number;
  premiumUsers: number;
  freeUsers: number;
  todaySolves: number;
  weekSolves: number;
};

type DailyStat = {
  date: string;
  count: number;
};

type AdminEvent = {
  id: string;
  event_name: string;
  user_id: string | null;
  created_at: string;
};

type AdminFeedbackEntry = {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  rating: number | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<AdminEvent[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<AdminFeedbackEntry[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [termsTitle, setTermsTitle] = useState(FALLBACK_PUBLIC_CONFIG.terms.title);
  const [termsIntro, setTermsIntro] = useState(FALLBACK_PUBLIC_CONFIG.terms.intro);
  const [termsSections, setTermsSections] = useState<LegalSection[]>(FALLBACK_PUBLIC_CONFIG.terms.sections);
  const [privacyTitle, setPrivacyTitle] = useState(FALLBACK_PUBLIC_CONFIG.privacy.title);
  const [privacyIntro, setPrivacyIntro] = useState(FALLBACK_PUBLIC_CONFIG.privacy.intro);
  const [privacySections, setPrivacySections] = useState<LegalSection[]>(FALLBACK_PUBLIC_CONFIG.privacy.sections);
  const [termsVersion, setTermsVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.terms_version);
  const [privacyVersion, setPrivacyVersion] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.privacy_version);
  const [effectiveDate, setEffectiveDate] = useState(FALLBACK_PUBLIC_CONFIG.legalVersions.effective_date);
  const [features, setFeatures] = useState<ProductFeature[]>(FALLBACK_PUBLIC_CONFIG.features);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadAdmin() {
      try {
        const data = await fetchEdge<{
          api_version: 'v1';
          ok: true;
          stats: AdminStats;
          recentEvents: AdminEvent[];
          recentFeedback: AdminFeedbackEntry[];
          dailyStats: DailyStat[];
        }>('/admin-metrics', { method: 'GET' });

        setStats(data.stats);
        setRecentEvents(data.recentEvents);
        setRecentFeedback(data.recentFeedback);
        setDailyStats(data.dailyStats);
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Failed to load admin analytics';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadAdmin();
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const rows = await fetchAdminConfig();
        const rowMap = new Map<string, unknown>();
        for (const row of rows) rowMap.set(row.key, row.value);

        const legalVersions = (rowMap.get('legal_versions') as Record<string, unknown>) ?? {};
        const terms = (rowMap.get('terms_content') as Record<string, unknown>) ?? {};
        const privacy = (rowMap.get('privacy_content') as Record<string, unknown>) ?? {};
        const productFeatures = (rowMap.get('product_features') as Record<string, unknown>) ?? {};

        setTermsVersion(String(legalVersions.terms_version ?? FALLBACK_PUBLIC_CONFIG.legalVersions.terms_version));
        setPrivacyVersion(String(legalVersions.privacy_version ?? FALLBACK_PUBLIC_CONFIG.legalVersions.privacy_version));
        setEffectiveDate(String(legalVersions.effective_date ?? FALLBACK_PUBLIC_CONFIG.legalVersions.effective_date));

        setTermsTitle(String(terms.title ?? FALLBACK_PUBLIC_CONFIG.terms.title));
        setTermsIntro(String(terms.intro ?? FALLBACK_PUBLIC_CONFIG.terms.intro));
        setTermsSections(Array.isArray(terms.sections) ? (terms.sections as LegalSection[]) : FALLBACK_PUBLIC_CONFIG.terms.sections);

        setPrivacyTitle(String(privacy.title ?? FALLBACK_PUBLIC_CONFIG.privacy.title));
        setPrivacyIntro(String(privacy.intro ?? FALLBACK_PUBLIC_CONFIG.privacy.intro));
        setPrivacySections(Array.isArray(privacy.sections) ? (privacy.sections as LegalSection[]) : FALLBACK_PUBLIC_CONFIG.privacy.sections);

        const featureItems = Array.isArray(productFeatures.items)
          ? (productFeatures.items as ProductFeature[])
          : FALLBACK_PUBLIC_CONFIG.features;
        setFeatures(featureItems);
      } catch (err) {
        console.error('Failed to load app config:', err);
        setConfigMessage('Failed to load app configuration.');
      } finally {
        setConfigLoading(false);
      }
    }

    void loadConfig();
  }, []);

  const updateSection = (
    target: 'terms' | 'privacy',
    index: number,
    field: 'heading' | 'body',
    value: string,
  ) => {
    if (target === 'terms') {
      setTermsSections((prev) => prev.map((section, i) => (i === index ? { ...section, [field]: value } : section)));
      return;
    }
    setPrivacySections((prev) => prev.map((section, i) => (i === index ? { ...section, [field]: value } : section)));
  };

  const addSection = (target: 'terms' | 'privacy') => {
    const newSection = { heading: 'New section', body: 'Describe this section.' };
    if (target === 'terms') {
      setTermsSections((prev) => [...prev, newSection]);
      return;
    }
    setPrivacySections((prev) => [...prev, newSection]);
  };

  const removeSection = (target: 'terms' | 'privacy', index: number) => {
    if (target === 'terms') {
      setTermsSections((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setPrivacySections((prev) => prev.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    setFeatures((prev) => [
      ...prev,
      {
        id: `feature_${Date.now()}`,
        title: 'New feature',
        description: 'Feature description',
        enabled: true,
      },
    ]);
  };

  const updateFeature = (index: number, field: keyof ProductFeature, value: string | boolean) => {
    setFeatures((prev) => prev.map((feature, i) => (i === index ? { ...feature, [field]: value } : feature)));
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigMessage(null);
    try {
      await saveAdminConfig([
        {
          key: 'legal_versions',
          value: {
            terms_version: termsVersion,
            privacy_version: privacyVersion,
            effective_date: effectiveDate,
          },
        },
        {
          key: 'terms_content',
          value: {
            title: termsTitle,
            intro: termsIntro,
            sections: termsSections,
          },
        },
        {
          key: 'privacy_content',
          value: {
            title: privacyTitle,
            intro: privacyIntro,
            sections: privacySections,
          },
        },
        {
          key: 'product_features',
          value: { items: features },
        },
      ]);
      setConfigMessage('Configuration saved successfully.');
    } catch (err) {
      console.error('Failed to save app config:', err);
      setConfigMessage('Failed to save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <AppLayout currentPage="admin" user={user}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout currentPage="admin" user={user}>
        <div className="max-w-xl mx-auto p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-2xl font-black mb-2">Access denied</h1>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="gradient-btn px-6 py-2 rounded-xl">
            Go to Dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="admin" user={user}>
      <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-black mb-2">Admin Analytics</h1>
          <p className="text-slate-500 font-bold">Real-time performance metrics for OryxSolver.</p>
        </header>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard title="Total Solves" value={stats?.totalSolves ?? 0} icon={<Zap size={22} />} />
          <StatCard title="Active Users" value={stats?.activeUsers ?? 0} icon={<Users size={22} />} />
          <StatCard title="Capture Success" value={`${stats?.captureRate ?? 0}%`} icon={<Activity size={22} />} />
          <StatCard title="Upgrade Conversion" value={`${stats?.conversionRate ?? 0}%`} icon={<CreditCard size={22} />} />
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={<Users size={22} />} />
          <StatCard title="Pro Users" value={stats?.proUsers ?? 0} icon={<CreditCard size={22} />} />
          <StatCard title="Premium Users" value={stats?.premiumUsers ?? 0} icon={<CreditCard size={22} />} />
          <StatCard title="Free Users" value={stats?.freeUsers ?? 0} icon={<BarChart3 size={22} />} />
        </div>

        <div className="grid xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 rounded-[28px] border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-xl font-black">Recent Activity</h3>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Latest</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {recentEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">
                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-500">
                          {event.event_name.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 truncate max-w-[180px]">
                        {event.user_id || 'Anonymous'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {recentEvents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-500 font-bold">
                        No activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3 mb-6">
              <Activity size={20} className="text-indigo-500" />
              <h3 className="text-lg font-black">Daily Solves</h3>
            </div>
            <div className="flex items-end justify-between h-40 gap-2">
              {dailyStats.map((day) => {
                const maxCount = Math.max(...dailyStats.map(d => d.count), 1);
                const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 10) : 10;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] text-slate-500 font-bold">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
            {dailyStats.length === 0 && (
              <p className="text-center text-slate-500 text-sm mt-8">No data available yet.</p>
            )}
          </div>
        </div>

        <section className="rounded-[28px] border p-6 space-y-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Feedback Inbox</h2>
              <p className="text-sm text-slate-500 font-bold">Bug reports, product feedback, and answer-quality signals from users.</p>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Latest</span>
          </div>

          <div className="grid gap-4">
            {recentFeedback.map((entry) => {
              const metadata = entry.metadata ?? {};
              const kind = String(metadata.kind ?? 'general');
              const outcome = typeof metadata.answerOutcome === 'string' ? metadata.answerOutcome : null;
              const subject = typeof metadata.subject === 'string' ? metadata.subject : null;
              return (
                <div key={entry.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                          {kind.replace(/_/g, ' ')}
                        </span>
                        {outcome && (
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                            outcome === 'correct' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {outcome}
                          </span>
                        )}
                        {entry.rating && (
                          <span className="rounded-full bg-slate-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {entry.rating}/5
                          </span>
                        )}
                      </div>
                      {subject && <p className="text-sm font-black">{subject}</p>}
                      <p className="text-sm text-slate-600 dark:text-slate-300">{entry.comment || 'No comment provided.'}</p>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1 sm:text-right">
                      <p>{new Date(entry.created_at).toLocaleString()}</p>
                      <p className="font-mono">{entry.user_id ?? 'Anonymous'}</p>
                    </div>
                  </div>
                </div>
              );
            })}

            {recentFeedback.length === 0 && (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold text-slate-500" style={{ borderColor: 'var(--border-color)' }}>
                No feedback submitted yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border p-6 space-y-8" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">Product Configuration</h2>
              <p className="text-sm text-slate-500 font-bold">Manage legal pages and feature content without code changes.</p>
            </div>
            <button
              type="button"
              onClick={saveConfig}
              disabled={savingConfig || configLoading}
              className="gradient-btn px-6 py-2 rounded-xl disabled:opacity-50"
            >
              {savingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
          {configMessage && <p className="text-sm font-bold text-indigo-500">{configMessage}</p>}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-bold">
              Terms Version
              <input value={termsVersion} onChange={(e) => setTermsVersion(e.target.value)} className="mt-2 w-full rounded-xl border p-2 bg-transparent" />
            </label>
            <label className="text-sm font-bold">
              Privacy Version
              <input value={privacyVersion} onChange={(e) => setPrivacyVersion(e.target.value)} className="mt-2 w-full rounded-xl border p-2 bg-transparent" />
            </label>
            <label className="text-sm font-bold">
              Effective Date
              <input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-2 w-full rounded-xl border p-2 bg-transparent" />
            </label>
          </div>

          <AdminDocEditor
            title="Terms of Service"
            docTitle={termsTitle}
            intro={termsIntro}
            sections={termsSections}
            onSetDocTitle={setTermsTitle}
            onSetIntro={setTermsIntro}
            onUpdateSection={(index, field, value) => updateSection('terms', index, field, value)}
            onAddSection={() => addSection('terms')}
            onRemoveSection={(index) => removeSection('terms', index)}
          />

          <AdminDocEditor
            title="Privacy Policy"
            docTitle={privacyTitle}
            intro={privacyIntro}
            sections={privacySections}
            onSetDocTitle={setPrivacyTitle}
            onSetIntro={setPrivacyIntro}
            onUpdateSection={(index, field, value) => updateSection('privacy', index, field, value)}
            onAddSection={() => addSection('privacy')}
            onRemoveSection={(index) => removeSection('privacy', index)}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Feature Cards</h3>
              <button type="button" onClick={addFeature} className="px-4 py-2 rounded-xl border font-bold">
                Add Feature
              </button>
            </div>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={feature.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Feature ID
                      <input
                        value={feature.id}
                        onChange={(e) => updateFeature(index, 'id', e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm"
                      />
                    </label>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Title
                      <input
                        value={feature.title}
                        onChange={(e) => updateFeature(index, 'title', e.target.value)}
                        className="mt-1 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm"
                      />
                    </label>
                  </div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
                    Description
                    <textarea
                      value={feature.description}
                      onChange={(e) => updateFeature(index, 'description', e.target.value)}
                      className="mt-1 min-h-20 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={feature.enabled}
                        onChange={(e) => updateFeature(index, 'enabled', e.target.checked)}
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="px-3 py-1 rounded-lg border text-sm font-bold text-red-500 border-red-500/40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
          {icon}
        </div>
      </div>
      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}

function AdminDocEditor({
  title,
  docTitle,
  intro,
  sections,
  onSetDocTitle,
  onSetIntro,
  onUpdateSection,
  onAddSection,
  onRemoveSection,
}: {
  title: string;
  docTitle: string;
  intro: string;
  sections: LegalSection[];
  onSetDocTitle: (value: string) => void;
  onSetIntro: (value: string) => void;
  onUpdateSection: (index: number, field: 'heading' | 'body', value: string) => void;
  onAddSection: () => void;
  onRemoveSection: (index: number) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">{title}</h3>
        <button type="button" onClick={onAddSection} className="px-4 py-2 rounded-xl border font-bold">
          Add Section
        </button>
      </div>
      <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
        Document Title
        <input value={docTitle} onChange={(e) => onSetDocTitle(e.target.value)} className="mt-1 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm" />
      </label>
      <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
        Intro
        <textarea value={intro} onChange={(e) => onSetIntro(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm" />
      </label>
      {sections.map((section, index) => (
        <div key={`${section.heading}-${index}`} className="rounded-xl border p-3 space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
            Heading
            <input
              value={section.heading}
              onChange={(e) => onUpdateSection(index, 'heading', e.target.value)}
              className="mt-1 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm"
            />
          </label>
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
            Body
            <textarea
              value={section.body}
              onChange={(e) => onUpdateSection(index, 'body', e.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border p-2 bg-transparent normal-case tracking-normal text-sm"
            />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={() => onRemoveSection(index)} className="px-3 py-1 rounded-lg border text-sm font-bold text-red-500 border-red-500/40">
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
