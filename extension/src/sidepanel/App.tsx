import { useState } from 'react';
import { Settings, Send, Sparkles, CreditCard } from 'lucide-react';

export default function SidePanel() {
    const [credits] = useState({ used: 12, total: 50 });

    // Calculate percentage for the mini-progress bar
    const creditPercentage = (credits.used / credits.total) * 100;
    const logoUrl = chrome.runtime.getURL('public/icons/128.png');

    return (
        <div className="flex flex-col h-screen bg-radial from-[#EEAECA] to-[#94BBE9] text-slate-900 font-sans overflow-hidden">

            {/* HEADER */}
            <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-1.5">
                    <div className=" p-1 rounded-lg">
                        {/*<Sparkles size={16} className="text-white" />*/}
                        <img src={logoUrl} alt="OryxSolver logo" className="h-4 w-4 rounded" />
                    </div>
                    <h1 className="text-lg font-extrabold tracking-tight">
                        <span className="text-blue-600">Oryx</span>
                        <span className="text-slate-900">Solver</span>
                    </h1>
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium ">Upgrade to Pro</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* THE CREDIT POWER-PILL */}
                    <div className="relative group cursor-help">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 transition-all hover:border-indigo-300">
                            <CreditCard size={14} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-700">{credits.used}/{credits.total}</span>
                        </div>
                        {/* MINI PROGRESS BAR: Hidden inside the pill bottom */}
                        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-500"
                                style={{ width: `${creditPercentage}%` }}
                            />
                        </div>
                    </div>

                    <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <Settings size={20} />
                    </button>
                </div>
            </header>

            {/* See last question solved*/}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <span className="text-lg font-extrabold tracking-tight">See Last questions</span>
            </div>
            {/* CHAT AREA: Scrollable */}
            <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-transparent">
                {/* Placeholder for "Empty State" - We will design this next! */}
                <div className="flex flex-col items-center justify-center h-full opacity-40 text-center space-y-2">
                    <Sparkles size={48} className="text-indigo-300 mb-2" />
                    <p className="font-medium text-slate-600">No questions solved yet.</p>
                    <p className="text-xs text-slate-400 max-w-[200px]">Click the sparkle next to a question on your page to get started!</p>
                </div>
            </main>
            {/* FOOTER: Follow-up Input */}
            <footer className="p-4 bg-white border-t border-slate-200">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        placeholder="Ask a follow-up..."
                        className="w-full pl-4 pr-12 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <button className="absolute right-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95">
                        <Send size={16} />
                    </button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                    OryxSolver can make mistakes. Verify important info.
                </p>
            </footer>
        </div>
    );
}
