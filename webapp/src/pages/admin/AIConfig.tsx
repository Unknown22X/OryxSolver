import { useEffect, useState } from 'react';
import { fetchEdge } from '../../lib/edge';
import { Bot, Save, Loader2, CheckCircle2, AlertCircle, Settings2, Sliders } from 'lucide-react';
import type { AdminRole } from '../../types/admin';

export default function AIConfigSection({ adminRole }: { adminRole: AdminRole }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [enabledModels, setEnabledModels] = useState<string>('');
  const [systemLimits, setSystemLimits] = useState<string>('{}');
  const [aiSystemPrompt, setAiSystemPrompt] = useState<string>('');

  const isReadOnly = adminRole === 'read-only';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchEdge<{ config: { key: string; value: any }[] }>('/admin-actions/config');
        const rows = data.config || [];
        const rowMap = new Map(rows.map((r: { key: string; value: any }) => [r.key, r.value]));

        const models = rowMap.get('enabled_models') as string[];
        if (Array.isArray(models)) {
          setEnabledModels(models.join(', '));
        }

        const limits = rowMap.get('system_limits');
        if (limits) {
          setSystemLimits(JSON.stringify(limits, null, 2));
        }

        const prompt = rowMap.get('ai_system_prompt') as string;
        if (typeof prompt === 'string') {
          setAiSystemPrompt(prompt);
        } else if (prompt && typeof prompt === 'object' && (prompt as any).prompt) {
          setAiSystemPrompt((prompt as any).prompt);
        }
      } catch (err) {
        console.error('Failed to load AI config', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      let parsedLimits: Record<string, any> = {};
      try {
        parsedLimits = JSON.parse(systemLimits);
      } catch {
        throw new Error('Invalid JSON in System Limits field.');
      }

      const parsedModels = enabledModels.split(',').map(s => s.trim()).filter(Boolean);

      await fetchEdge('/admin-actions/update-config', {
        method: 'POST',
        body: JSON.stringify({
          configUpdates: [
            { key: 'enabled_models', value: parsedModels },
            { key: 'system_limits', value: parsedLimits },
            { key: 'ai_system_prompt', value: { prompt: aiSystemPrompt } },
          ],
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save AI configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 h-96 animate-pulse" style={{ backgroundColor: 'var(--surface-panel)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">AI Configuration</h2>
          <p className="text-sm text-slate-400 dark:text-zinc-500 mt-0.5 font-medium">Manage enabled models, system limits, and prompts</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-6" style={{ backgroundColor: 'var(--surface-panel)' }}>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
              <Bot size={16} className="text-indigo-500" />
              <h3 className="text-sm font-black tracking-tight">Enabled Models</h3>
            </div>
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Comma-separated list</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={enabledModels}
              onChange={e => setEnabledModels(e.target.value)}
              placeholder="e.g. gemini-2.5-flash-lite, gemini-2.5-flash"
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
              <Sliders size={16} className="text-amber-500" />
              <h3 className="text-sm font-black tracking-tight">System Limits</h3>
            </div>
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Valid JSON object</label>
            <textarea
              disabled={isReadOnly}
              value={systemLimits}
              onChange={e => setSystemLimits(e.target.value)}
              placeholder={'{\n  "daily_solve_cap": 500000,\n  "free_credit_monthly": 50\n}'}
              rows={4}
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50 resize-y"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1 text-slate-900 dark:text-white">
              <Settings2 size={16} className="text-emerald-500" />
              <h3 className="text-sm font-black tracking-tight">Base System Prompt</h3>
            </div>
            <label className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-widest block">Core instruction for the AI — overrides edge function default</label>
            <textarea
              disabled={isReadOnly}
              value={aiSystemPrompt}
              onChange={e => setAiSystemPrompt(e.target.value)}
              placeholder="You are OryxSolver, an advanced educational AI. Provide clear, step-by-step explanations..."
              rows={8}
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-600 disabled:opacity-50 resize-y"
            />
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95 ${
                saved ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              } text-white disabled:opacity-60`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saved ? 'Saved Successfully!' : saving ? 'Saving…' : 'Save AI Configuration'}
            </button>
            {saveError && (
              <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5"><AlertCircle size={14} />{saveError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
