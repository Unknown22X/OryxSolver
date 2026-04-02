import { useEffect, useState } from 'react';
import { fetchEdge } from '../../lib/edge';
import { fetchAdminConfig, saveAdminConfig } from '../../lib/adminConfigApi';
import {
  Megaphone, Loader2, Save, CheckCircle2, Wrench,
  AlertTriangle, Info, PartyPopper, ShieldCheck, Eye,
  FileText, Shield, BookOpen, Mail, ChevronDown, ChevronUp,
  Plus, Trash2, AlertCircle
} from 'lucide-react';
import type { AdminRole } from '../../types/admin';
import type { LegalDocument, LegalSection, LegalVersions } from '../../lib/appConfig';

type BannerConfig = {
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'success';
};

const BANNER_TYPE_STYLES = {
  info: {
    badge: 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
    preview: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400',
    icon: <Info size={13} />,
  },
  warning: {
    badge: 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
    preview: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',
    icon: <AlertTriangle size={13} />,
  },
  success: {
    badge: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    preview: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    icon: <PartyPopper size={13} />,
  },
};

type ActiveSection = 'platform' | 'legal' | 'contact';

export default function SettingsSection({ adminRole }: { adminRole: AdminRole }) {
  const [activeSection, setActiveSection] = useState<ActiveSection>('platform');

  // Platform config state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [banner, setBanner] = useState<BannerConfig>({ active: false, message: '', type: 'info' });
  const [createNotification, setCreateNotification] = useState(false);
  const [loading, setLoading] = useState(true);

  // Legal state
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalSaved, setLegalSaved] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [terms, setTerms] = useState<LegalDocument>({ title: '', intro: '', sections: [] });
  const [privacy, setPrivacy] = useState<LegalDocument>({ title: '', intro: '', sections: [] });
  const [legalVersions, setLegalVersions] = useState<LegalVersions>({
    terms_version: '', privacy_version: '', effective_date: ''
  });
  const [supportEmail, setSupportEmail] = useState('');
  const [expandedDoc, setExpandedDoc] = useState<'terms' | 'privacy' | null>('terms');

  const isReadOnly = adminRole === 'read-only';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [platformData, legalRows] = await Promise.all([
          fetchEdge<{ config: { key: string; value: any }[] }>('/admin-actions/config'),
          fetchAdminConfig(),
        ]);

        // Platform config
        const cfg = platformData.config ?? [];
        const mm = cfg.find(c => c.key === 'maintenance_mode');
        const bn = cfg.find(c => c.key === 'announcement_banner');
        if (mm) setMaintenanceMode(!!mm.value);
        if (bn) setBanner({ active: bn.value?.active ?? false, message: bn.value?.message ?? '', type: bn.value?.type ?? 'info' });

        // Legal config
        const rowMap = new Map(legalRows.map(r => [r.key, r.value]));
        const t = rowMap.get('terms_content') as any;
        const p = rowMap.get('privacy_content') as any;
        const lv = rowMap.get('legal_versions') as any;
        const sc = rowMap.get('support_contact') as any;

        if (t?.title) setTerms(t);
        if (p?.title) setPrivacy(p);
        if (lv?.terms_version) setLegalVersions(lv);
        if (sc?.email) setSupportEmail(sc.email);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Save platform settings
  const handleSavePlatform = async () => {
    setSaving(true); setSaved(false); setSaveError(null);
    try {
      await fetchEdge('/admin-actions/update-config', {
        method: 'POST',
        body: JSON.stringify({
          configUpdates: [
            { key: 'maintenance_mode', value: maintenanceMode },
            { key: 'announcement_banner', value: banner },
          ],
          createNotification,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // Save legal content
  const handleSaveLegal = async () => {
    setLegalSaving(true); setLegalSaved(false); setLegalError(null);
    try {
      await saveAdminConfig([
        { key: 'terms_content', value: terms },
        { key: 'privacy_content', value: privacy },
        { key: 'legal_versions', value: legalVersions },
        { key: 'support_contact', value: { email: supportEmail } },
      ]);
      setLegalSaved(true);
      setTimeout(() => setLegalSaved(false), 3000);
    } catch (err: any) {
      setLegalError(err.message || 'Failed to save legal content.');
    } finally {
      setLegalSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="grid md:grid-cols-2 gap-5">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 h-48 animate-pulse" style={{ backgroundColor: 'var(--surface-panel)' }} />
          ))}
        </div>
      </div>
    );
  }

  const navItems: { id: ActiveSection; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'platform', label: 'Platform', icon: <Wrench size={14} />, desc: 'Maintenance & announcements' },
    { id: 'legal', label: 'Legal Content', icon: <FileText size={14} />, desc: 'ToS, Privacy, versions' },
    { id: 'contact', label: 'Support Contact', icon: <Mail size={14} />, desc: 'Support email address' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">System Settings</h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">Platform-wide configuration and legal content</p>
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
          <Eye size={16} className="text-slate-400 dark:text-zinc-500 shrink-0" />
          <p className="text-sm text-slate-500 dark:text-zinc-400 font-semibold">You are in read-only mode. Changes cannot be saved.</p>
        </div>
      )}

      {/* Sub-nav */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-900/50 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 w-fit">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === item.id
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* ── PLATFORM TAB ─────────────────────────────────── */}
      {activeSection === 'platform' && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Maintenance Mode */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-5" style={{ backgroundColor: 'var(--surface-panel)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                    maintenanceMode
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500'
                  }`}>
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Maintenance Mode</h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 leading-snug font-medium max-w-[200px]">
                      Blocks all non-admin solve API requests and shows a maintenance notice to users.
                    </p>
                  </div>
                </div>
                <Toggle value={maintenanceMode} onChange={setMaintenanceMode} disabled={isReadOnly} color="amber" />
              </div>
              {maintenanceMode ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-start gap-3">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400">Maintenance Mode is ON</p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium mt-0.5">Regular users cannot access the solve API right now.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/15 flex items-start gap-3">
                  <ShieldCheck size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">Platform is Operational</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium mt-0.5">All users have normal access to the solve API.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Announcement Banner */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-4" style={{ backgroundColor: 'var(--surface-panel)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                    banner.active
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500'
                  }`}>
                    <Megaphone size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">Announcement Banner</h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 leading-snug font-medium max-w-[200px]">
                      Show a global notification bar to all users visiting the platform.
                    </p>
                  </div>
                </div>
                <Toggle value={banner.active} onChange={v => setBanner(b => ({ ...b, active: v }))} disabled={isReadOnly} color="indigo" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Banner Type</label>
                <div className="flex gap-2">
                  {(['info', 'warning', 'success'] as const).map(t => (
                    <button key={t} disabled={isReadOnly} onClick={() => setBanner(b => ({ ...b, type: t }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
                        banner.type === t ? BANNER_TYPE_STYLES[t].badge : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-700'
                      }`}>
                      {BANNER_TYPE_STYLES[t].icon} {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Message</label>
                <textarea disabled={isReadOnly} value={banner.message} onChange={e => setBanner(b => ({ ...b, message: e.target.value }))}
                  placeholder="e.g. We're rolling out an update tonight at 11pm UTC…" rows={2}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50 font-medium" />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-notify"
                  checked={createNotification}
                  onChange={e => setCreateNotification(e.target.checked)}
                  disabled={isReadOnly || !banner.active}
                  className="w-4 h-4 rounded border-slate-200 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <label htmlFor="create-notify" className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 cursor-pointer disabled:opacity-50">
                  Also broadcast as persistent notification
                </label>
              </div>

              {banner.active && banner.message && (
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${BANNER_TYPE_STYLES[banner.type].preview}`}>
                  {BANNER_TYPE_STYLES[banner.type].icon}
                  <p className="text-xs font-bold leading-snug">{banner.message}</p>
                </div>
              )}
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <button onClick={handleSavePlatform} disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                  saved ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                } text-white disabled:opacity-60`}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Platform Settings'}
              </button>
              {saveError && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5"><AlertCircle size={12} />{saveError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LEGAL TAB ────────────────────────────────────── */}
      {activeSection === 'legal' && (
        <div className="space-y-5">
          {/* Legal Versions row */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={14} className="text-slate-500 dark:text-zinc-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Legal Version Identifiers</h3>
              <span className="ml-auto text-[10px] font-bold text-slate-400 dark:text-zinc-600 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">Public</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Terms Version', key: 'terms_version', value: legalVersions.terms_version },
                { label: 'Privacy Version', key: 'privacy_version', value: legalVersions.privacy_version },
                { label: 'Effective Date', key: 'effective_date', value: legalVersions.effective_date },
              ].map(({ label, key, value }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">{label}</label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={value}
                    onChange={e => setLegalVersions(v => ({ ...v, [key]: e.target.value }))}
                    placeholder="e.g. 2026-03-25"
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Terms Editor */}
          <LegalDocEditor
            title="Terms of Service"
            icon={<FileText size={14} />}
            doc={terms}
            onChange={setTerms}
            disabled={isReadOnly}
            expanded={expandedDoc === 'terms'}
            onToggle={() => setExpandedDoc(expandedDoc === 'terms' ? null : 'terms')}
          />

          {/* Privacy Editor */}
          <LegalDocEditor
            title="Privacy Policy"
            icon={<Shield size={14} />}
            doc={privacy}
            onChange={setPrivacy}
            disabled={isReadOnly}
            expanded={expandedDoc === 'privacy'}
            onToggle={() => setExpandedDoc(expandedDoc === 'privacy' ? null : 'privacy')}
          />

          {!isReadOnly && (
            <div className="flex items-center gap-3">
              <button onClick={handleSaveLegal} disabled={legalSaving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                  legalSaved ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                } text-white disabled:opacity-60`}>
                {legalSaving ? <Loader2 size={13} className="animate-spin" /> : legalSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                {legalSaved ? 'Saved!' : legalSaving ? 'Saving…' : 'Save Legal Content'}
              </button>
              {legalError && (
                <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5"><AlertCircle size={12} />{legalError}</p>
              )}
              <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium ml-auto">
                Changes will reflect on the public /terms and /privacy pages immediately.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── CONTACT TAB ──────────────────────────────────── */}
      {activeSection === 'contact' && (
        <div className="space-y-5 max-w-xl">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                <Mail size={15} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Support Contact Email</h3>
                <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium mt-0.5">Displayed in legal pages, error messages, and support links across the platform.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Email Address</label>
              <input
                type="email"
                disabled={isReadOnly}
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                placeholder="support@yourdomain.com"
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50"
              />
            </div>
          </div>

          {!isReadOnly && (
            <button onClick={handleSaveLegal} disabled={legalSaving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                legalSaved ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              } text-white disabled:opacity-60`}>
              {legalSaving ? <Loader2 size={13} className="animate-spin" /> : legalSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {legalSaved ? 'Saved!' : legalSaving ? 'Saving…' : 'Save Contact Info'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Toggle Component ─────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled, color }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean; color: 'indigo' | 'amber';
}) {
  const onColor = color === 'amber' ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 disabled:opacity-50 shrink-0 shadow-inner ${value ? onColor : 'bg-slate-200 dark:bg-zinc-700'}`}
      role="switch" aria-checked={value}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

// ─── Legal Document Editor ────────────────────────────────────────────────────
function LegalDocEditor({ title, icon, doc, onChange, disabled, expanded, onToggle }: {
  title: string;
  icon: React.ReactNode;
  doc: LegalDocument;
  onChange: (d: LegalDocument) => void;
  disabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const addSection = () => onChange({ ...doc, sections: [...doc.sections, { heading: '', body: '' }] });
  const removeSection = (i: number) => onChange({ ...doc, sections: doc.sections.filter((_, idx) => idx !== i) });
  const updateSection = (i: number, field: keyof LegalSection, value: string) => {
    const sections = doc.sections.map((s, idx) => idx === i ? { ...s, [field]: value } : s);
    onChange({ ...doc, sections });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface-panel)' }}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 shrink-0">
          {icon}
        </div>
        <div className="text-left flex-1">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="text-[11px] text-slate-400 dark:text-zinc-600 font-medium">{doc.sections.length} sections</p>
        </div>
        {expanded ? <ChevronUp size={15} className="text-slate-400 dark:text-zinc-600 shrink-0" /> : <ChevronDown size={15} className="text-slate-400 dark:text-zinc-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
          {/* Title & Intro */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Document Title</label>
              <input type="text" disabled={disabled} value={doc.title} onChange={e => onChange({ ...doc, title: e.target.value })}
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors" />
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Introduction</label>
              <textarea disabled={disabled} value={doc.intro} onChange={e => onChange({ ...doc, intro: e.target.value })} rows={2}
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors resize-none font-medium" />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest">Sections</label>
              {!disabled && (
                <button onClick={addSection}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors">
                  <Plus size={11} /> Add Section
                </button>
              )}
            </div>

            {doc.sections.map((section, i) => (
              <div key={i} className="rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-600 w-5 text-center">{i + 1}</span>
                  <input type="text" disabled={disabled} value={section.heading} onChange={e => updateSection(i, 'heading', e.target.value)}
                    placeholder="Section heading…"
                    className="flex-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600" />
                  {!disabled && (
                    <button onClick={() => removeSection(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <textarea disabled={disabled} value={section.body} onChange={e => updateSection(i, 'body', e.target.value)}
                  placeholder="Section content…" rows={3}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors resize-none font-medium placeholder:text-slate-400 dark:placeholder:text-zinc-600 leading-relaxed ml-7" />
              </div>
            ))}
            {doc.sections.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400 dark:text-zinc-600 font-medium">
                No sections yet. {!disabled && 'Click "Add Section" to get started.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
