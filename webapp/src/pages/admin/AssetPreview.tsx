import { MascotIcon } from '../../components/MascotIcon';
import type { MascotName } from '../../components/MascotIcon';

import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

const MASCOT_ENTRIES: { name: MascotName; label: string; desc: string }[] = [
  { name: 'logo', label: 'Primary Logo', desc: 'Main brand identity used in headers and splash screens.' },
  { name: 'bot-avatar', label: 'AI Assistant', desc: 'The face of Oryx in chat responses.' },
  { name: 'thinking', label: 'Thinking State', desc: 'Animated status indicator during AI processing.' },
  { name: 'greeting', label: 'Welcome Greeter', desc: 'Greets users on the dashboard and onboarding.' },
  { name: 'historian', label: 'The Historian', desc: 'Used for empty states and archive sections.' },
  { name: 'engineer', label: 'The Engineer', desc: 'Represents the technical side/admin console.' },
  { name: 'champion', label: 'Success Mascot', desc: 'Celebrates achievements and completed tasks.' },
  { name: 'sparkle', label: 'Premium/AI Spark', desc: 'Subtle accent for AI-powered features.' },
  { name: 'success', label: 'Success State', desc: 'Generic success confirmation mascot.' },
  { name: 'error', label: 'Error State', desc: 'Friendly error handling mascot.' },
  { name: 'scan_homework', label: 'Homework Scanner 1', desc: 'Visual for document scanning features.' },
  { name: 'scan_homework2', label: 'Homework Scanner 2', desc: 'Alternative visual for scanning.' },
];

export default function AssetPreview() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Mascot Library</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-500 font-medium mt-1">
            Browse and verify all transparent mascot assets currently in the system.
          </p>
        </div>
        <div className="flex gap-2">
           <a 
             href="/app_icons" 
             target="_blank" 
             rel="noreferrer"
             className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-indigo-500 transition-colors"
           >
             <ExternalLink size={14} />
             Open Source Folder
           </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MASCOT_ENTRIES.map((mascot) => (
          <div 
            key={mascot.name}
            className="group relative bg-white dark:bg-zinc-900/50 rounded-[32px] border-2 border-slate-100 dark:border-zinc-800/60 p-6 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 overflow-hidden"
          >
            {/* Background pattern for transparency testing */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none" 
              style={{ backgroundImage: 'conic-gradient(#000 0.25turn, #fff 0.25turn 0.5turn, #000 0.5turn 0.75turn, #fff 0.75turn)', backgroundSize: '20px 20px' }}>
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className="w-32 h-32 flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                <MascotIcon name={mascot.name} size={100} className="drop-shadow-2xl" />
              </div>

              <div className="space-y-1 w-full">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{mascot.label}</h3>
                <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 leading-relaxed px-2 line-clamp-2 h-8">{mascot.desc}</p>
              </div>

              <div className="mt-6 w-full flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(`<MascotIcon name="${mascot.name}" size={48} />`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-indigo-500 hover:text-white transition-all active:scale-95"
                >
                  {copied === `<MascotIcon name="${mascot.name}" size={48} />` ? (
                    <>
                      <Check size={12} className="text-white" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy Code
                    </>
                  )}
                </button>
              </div>
              
              <p className="mt-3 text-[9px] font-black text-indigo-500/40 dark:text-indigo-400/20 uppercase tracking-[0.2em]">
                {mascot.name}.png
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-indigo-600 rounded-[32px] shadow-2xl shadow-indigo-600/20 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 opacity-10 -rotate-12 translate-x-1/4 -translate-y-1/4">
           <MascotIcon name="champion" size={300} />
        </div>
        <div className="relative">
          <h3 className="text-xl font-black tracking-tight">Need to add more?</h3>
          <p className="text-indigo-100 font-bold text-sm mt-1">Upload transparent PNGs to your assets folder and update MASCOT_MAP.</p>
        </div>
        <div className="relative">
          <button className="px-8 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm hover:scale-105 transition-transform active:scale-95">
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
