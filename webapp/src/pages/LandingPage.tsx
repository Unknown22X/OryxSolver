import { ChevronRight, Sparkles, Camera, BookOpen, Layout, Check, Zap, Shield, MessageSquare, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const MODES = [
  { name: 'Standard', desc: 'Balanced clarity and speed for daily tasks.', icon: <Zap size={20} className="text-amber-400" /> },
  { name: 'Exam', desc: 'Formal, precise answers for test preparation.', icon: <Shield size={20} className="text-blue-400" /> },
  { name: 'ELI5', desc: 'Simple words and concepts for quick grasping.', icon: <Sparkles size={20} className="text-purple-400" /> },
  { name: 'Step-by-step', desc: 'Deep procedural breakdowns for math/STEM.', icon: <Layout size={20} className="text-emerald-400" /> },
  { name: 'Gen Alpha', desc: 'Engaging casual tone with correct facts.', icon: <MessageSquare size={20} className="text-pink-400" /> },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0c1b] text-white selection:bg-indigo-500/30 font-sans">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(79,70,229,0.15)_0%,transparent_70%)]" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0c1b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles size={22} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight uppercase italic">Oryx<span className="text-indigo-500 text-3xl not-italic">.</span></span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-black uppercase tracking-widest text-slate-400">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#modes" className="hover:text-white transition-colors">Modes</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Sign in</Link>
            <Link to="/signup" className="gradient-btn px-6 py-3 rounded-full text-xs shadow-xl shadow-indigo-500/30 uppercase tracking-widest">Get Pro</Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="pt-40 pb-32 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
              <Sparkles size={14} />
              <span>THE ULTIMATE STUDY EDGE</span>
            </div>
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-10 leading-[0.85] animate-in fade-in slide-in-from-bottom-8 duration-700">
              Snap<span className="text-indigo-500">.</span> Solve<span className="text-indigo-500">.</span><br />Learn<span className="text-indigo-500 text-[1.2em]">.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-xl md:text-2xl text-slate-400 font-bold leading-relaxed mb-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              OryxSolver captures anything on your screen—text, images, or math—and provides instant, step-by-step reasoning designed for the modern student.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <Link to="/signup" className="gradient-btn px-10 py-5 rounded-[2rem] text-xl w-full sm:w-auto shadow-2xl shadow-indigo-500/40 hover:scale-105 transition-transform">Start Solving Now</Link>
              <a href="#how" className="px-10 py-5 rounded-[2rem] text-xl font-black bg-white/5 border border-white/10 hover:bg-white/10 transition-all w-full sm:w-auto flex items-center justify-center gap-2">
                <span>See it in action</span>
                <ChevronRight size={20} className="text-indigo-500" />
              </a>
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how" className="py-32 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
              <div className="max-w-2xl">
                <p className="text-indigo-500 font-black uppercase tracking-[0.3em] text-xs mb-4">The Workflow</p>
                <h2 className="text-5xl font-black tracking-tight leading-tight">Master your studies in three simple steps</h2>
              </div>
              <p className="text-slate-400 font-bold max-w-sm">No more typing out long equations. Just point, click, and understand.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              <Step 
                num="01" 
                title="Capture" 
                desc="Use the extension camera to draw a box around any question on any website." 
                icon={<Camera size={32} />}
                color="text-indigo-500"
              />
              <Step 
                num="02" 
                title="Process" 
                desc="Our AI instantly decodes the image, detects math, and analyzes the context." 
                icon={<Zap size={32} />}
                color="text-blue-500"
              />
              <Step 
                num="03" 
                title="Understand" 
                desc="Get a clear answer followed by a chronological timeline of reasoning steps." 
                icon={<BookOpen size={32} />}
                color="text-emerald-500"
              />
            </div>
          </div>
        </section>

        {/* Modes Grid */}
        <section id="modes" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-5xl font-black tracking-tight mb-6">Choose your learning style</h2>
              <p className="text-slate-400 font-bold max-w-xl mx-auto">One question, five ways to learn. Switch modes instantly to get the perfect explanation.</p>
            </div>
            
            <div className="grid md:grid-cols-5 gap-6">
              {MODES.map((m) => (
                <div key={m.name} className="bg-[#161927] p-8 rounded-[32px] border border-white/5 hover:border-indigo-500/30 transition-all group">
                  <div className="mb-6 w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    {m.icon}
                  </div>
                  <h3 className="text-xl font-black mb-3">{m.name}</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-32 px-6 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-5xl font-black tracking-tight mb-6">Simple, transparent pricing</h2>
              <p className="text-slate-400 font-bold">Start for free, upgrade for unlimited power.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Tier */}
              <div className="bg-[#161927] p-10 rounded-[40px] border border-white/5 flex flex-col">
                <div className="mb-8">
                  <h3 className="text-2xl font-black mb-2">Free</h3>
                  <p className="text-slate-500 font-bold">Essential tools for every student.</p>
                </div>
                <div className="text-5xl font-black mb-10">$0<span className="text-lg text-slate-500 font-bold ml-2">/month</span></div>
                <div className="space-y-5 mb-12 flex-1">
                  <PriceItem text="15 Solves per day" />
                  <PriceItem text="3 Modes (Standard, Exam, ELI5)" />
                  <PriceItem text="Screenshot Capture" />
                  <PriceItem text="Local History" disabled />
                  <PriceItem text="Priority AI Support" disabled />
                </div>
                <Link to="/signup" className="w-full py-4 rounded-2xl border border-white/10 font-black uppercase tracking-widest text-xs hover:bg-white/5 transition-all text-center">Get Started</Link>
              </div>

              {/* Pro Tier */}
              <div className="bg-[#161927] p-10 rounded-[40px] border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl">Best Value</div>
                <div className="mb-8">
                  <h3 className="text-2xl font-black mb-2 text-indigo-400">Oryx Pro</h3>
                  <p className="text-slate-500 font-bold">Unlimited power for power students.</p>
                </div>
                <div className="text-5xl font-black mb-10">$9.99<span className="text-lg text-slate-500 font-bold ml-2">/month</span></div>
                <div className="space-y-5 mb-12 flex-1">
                  <PriceItem text="Unlimited AI Solves" highlight />
                  <PriceItem text="All 5 AI Modes included" highlight />
                  <PriceItem text="Advanced Vision AI detection" highlight />
                  <PriceItem text="Sync Cloud History" highlight />
                  <PriceItem text="Priority 24/7 AI Processing" highlight />
                </div>
                <Link to="/signup" className="gradient-btn w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-center">Go Pro Now</Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 text-center">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-600 to-blue-700 p-16 rounded-[60px] shadow-2xl shadow-indigo-500/30">
            <h2 className="text-5xl font-black tracking-tight text-white mb-8">Ready to ace your next assignment?</h2>
            <p className="text-indigo-100 text-xl font-bold mb-12 opacity-90">Join 2,000+ students using OryxSolver to learn faster and smarter every day.</p>
            <Link to="/signup" className="bg-white text-indigo-600 px-12 py-5 rounded-2xl text-xl font-black hover:scale-105 transition-transform inline-flex items-center gap-3">
              Create Free Account
              <ChevronRight size={24} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-20 px-6 border-t border-white/5 text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="font-black uppercase tracking-widest text-sm">OryxSolver</span>
          </div>
          <div className="flex items-center gap-10 text-xs font-black uppercase tracking-widest text-slate-500">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
            <a href="#" className="hover:text-white">Contact</a>
          </div>
          <p className="text-slate-600 font-bold text-sm">&copy; 2026 OryxSolver. Built for students.</p>
        </div>
      </footer>
    </div>
  );
}

function Step({ num, title, desc, icon, color }: { num: string, title: string, desc: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="relative group">
      <div className="text-[120px] font-black text-white/[0.03] absolute -top-20 -left-4 leading-none select-none group-hover:text-indigo-500/10 transition-colors duration-700">{num}</div>
      <div className={`mb-8 w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center ${color} shadow-2xl relative z-10`}>
        {icon}
      </div>
      <h3 className="text-2xl font-black mb-4 relative z-10">{title}</h3>
      <p className="text-slate-400 font-bold leading-relaxed relative z-10">{desc}</p>
    </div>
  );
}

function PriceItem({ text, highlight, disabled }: { text: string, highlight?: boolean, disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-sm font-bold ${disabled ? 'opacity-30 grayscale' : 'opacity-100'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${highlight ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'}`}>
        <Check size={12} strokeWidth={4} />
      </div>
      <span className={highlight ? 'text-white' : 'text-slate-400'}>{text}</span>
    </div>
  );
}
