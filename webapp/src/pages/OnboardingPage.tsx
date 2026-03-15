import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Zap, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';

const SLIDES = [
  {
    icon: <Camera size={48} />,
    title: "Snap any problem",
    description: "Use the precision camera tool to capture questions from your screen. It handles images, text, and complex math perfectly.",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10"
  },
  {
    icon: <Zap size={48} />,
    title: "AI-Powered Solving",
    description: "OryxSolver uses advanced models to understand the context and solve even the most complex STEM problems in seconds.",
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    icon: <GraduationCap size={48} />,
    title: "Learn Step-by-Step",
    description: "Don't just get the answer. Understand the logic with clear, chronological steps and 'Ask' follow-ups for deeper clarity.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  }
];

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const next = () => {
    if (current === SLIDES.length - 1) {
      navigate('/dashboard');
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c1b] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center relative">
        {/* Progress */}
        <div className="flex justify-center gap-2 mb-12">
          {SLIDES.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${i === current ? 'w-8 bg-indigo-500' : 'w-2 bg-white/10'}`} 
            />
          ))}
        </div>

        <div key={current} className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className={`w-24 h-24 ${SLIDES[current].bg} ${SLIDES[current].color} rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl`}>
            {SLIDES[current].icon}
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-4">{SLIDES[current].title}</h1>
          <p className="text-slate-400 text-lg font-bold leading-relaxed mb-12 px-4">
            {SLIDES[current].description}
          </p>
        </div>

        <button 
          onClick={next}
          className="w-full gradient-btn py-5 rounded-[24px] text-lg flex items-center justify-center gap-2 group shadow-2xl shadow-indigo-500/20"
        >
          <span>{current === SLIDES.length - 1 ? 'Start Solving' : 'Continue'}</span>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="mt-12 flex items-center justify-center gap-2 text-slate-600">
          <Sparkles size={14} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">OryxSolver Experience</span>
        </div>
      </div>
    </div>
  );
}
