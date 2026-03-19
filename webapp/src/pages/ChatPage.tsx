import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
  Sparkles, Send, Paperclip, X, Copy, Check,
  Zap, Loader2, MessageSquare, Lightbulb, 
  BookOpen, Calculator, Bot, Menu, Plus, History, Search, ChevronRight
} from 'lucide-react';
import { useSolve } from '../hooks/useSolve';
import { fetchHistoryList } from '../lib/historyApi';
import { trackEvent } from '../lib/analyticsClient';
import { useUsage } from '../hooks/useUsage';
import RichText from '../components/RichText';
import type { User } from '@supabase/supabase-js';

type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

interface HistorySidebarEntry {
  id: string;
  subject: string;
  question: string;
  created_at: string;
  conversation_id?: string | null;
  style_mode?: StyleMode | null;
}

function parseExplanationSteps(explanation: string): string[] {
  return explanation
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^(\d+[).\s-]+|[-*]\s+)/, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim(),
    )
    .filter(Boolean);
}

function normalizeComparableText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[*`]/g, '')
    .trim()
    .toLowerCase();
}

function isConversationalPrompt(question: string, answer: string, explanation: string) {
  const combined = `${question}\n${answer}\n${explanation}`.toLowerCase();
  const prompt = question.trim().toLowerCase();

  const conversationalPatterns = [
    /^(hi|hello|hey|yo)\b/,
    /\bwho are you\b/,
    /\bwhat('?s| is) your name\b/,
    /\bhow are you\b/,
    /\bthank(s| you)\b/,
    /\bi('?m| am) (tired|bored|stressed|sick) of stud/,
    /\bmotivate me\b/,
    /\bgive me (an )?example\b/,
    /\bmake me a practice question\b/,
    /\bquiz me\b/,
  ];

  if (conversationalPatterns.some((pattern) => pattern.test(combined))) return true;
  if (/[=+\-*/^]/.test(prompt)) return false;
  if (/\bsolve\b|\bcalculate\b|\bderive\b|\bequation\b|\bformula\b/i.test(prompt)) return false;
  return prompt.length <= 80 && /^(what|why|how|can|could|would|do|are|is)\b/.test(prompt);
}

function getResponsePresentation(question: string, answer: string, steps: string[], explanation: string) {
  const cleanAnswer = answer.trim();
  const combined = `${cleanAnswer}\n${explanation}`.toLowerCase();
  const looksLikeChoice =
    /^(option\s+)?[a-d](?:[).:]\s*|\s*$)/i.test(cleanAnswer) ||
    /^choice\s+[a-d]\b/i.test(cleanAnswer);
  const shortSingleBlock = cleanAnswer.length > 0 && cleanAnswer.length <= 90 && !cleanAnswer.includes('\n');
  const conversational = isConversationalPrompt(question, answer, explanation);

  if (conversational) {
    return {
      answerLabel: 'Response',
      answerHint: 'Natural reply',
      explanationLabel: 'More context',
      layout: 'chat' as const,
      hideSteps: true,
    };
  }

  if (steps.length > 0) {
    return {
      answerLabel: looksLikeChoice ? 'Selected answer' : 'Answer',
      answerHint: looksLikeChoice ? 'Chosen result' : 'Main result',
      explanationLabel: 'Why this works',
      layout: 'answer' as const,
      hideSteps: false,
    };
  }

  if (/(example|practice|quiz|flash[\s-]?card)/i.test(combined)) {
    return {
      answerLabel: 'Example',
      answerHint: 'Practice-style response',
      explanationLabel: 'How to use it',
      layout: 'answer' as const,
      hideSteps: true,
    };
  }

  if (shortSingleBlock) {
    return {
      answerLabel: 'Quick answer',
      answerHint: 'Direct response',
      explanationLabel: 'More context',
      layout: 'answer' as const,
      hideSteps: true,
    };
  }

  return {
    answerLabel: 'Response',
    answerHint: 'Main response',
    explanationLabel: 'More context',
    layout: 'answer' as const,
    hideSteps: false,
  };
}

const STYLE_MODES: Array<{ value: StyleMode; label: string; icon: React.ReactNode; desc: string }> = [
  { value: 'standard', label: 'Standard', icon: <Zap size={14} />, desc: 'Clear, direct answers' },
  { value: 'exam', label: 'Exam', icon: <BookOpen size={14} />, desc: 'Exam-style formatting' },
  { value: 'eli5', label: 'ELI5', icon: <Lightbulb size={14} />, desc: "Explain like I'm 5" },
  { value: 'step_by_step', label: 'Step-by-Step', icon: <Calculator size={14} />, desc: 'Detailed walkthrough' },
  { value: 'gen_alpha', label: 'Gen Alpha', icon: <MessageSquare size={14} />, desc: 'Gen Alpha style' },
];

const STARTER_PROMPTS = [
  'Check my working for this problem',
  'Explain the first step only',
  'Turn this into a practice question',
  'Summarize the key idea fast',
];

function getModeToneClass(mode: StyleMode) {
  switch (mode) {
    case 'exam':
      return 'oryx-chip-exam';
    case 'eli5':
      return 'oryx-chip-eli5';
    case 'step_by_step':
      return 'oryx-chip-steps';
    case 'gen_alpha':
      return 'oryx-chip-alpha';
    case 'standard':
    default:
      return 'oryx-chip-standard';
  }
}

export default function ChatPage({ user }: { user: User }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversationId = searchParams.get('conversationId');

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [styleMode, setStyleMode] = useState<StyleMode>('standard');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [history, setHistory] = useState<HistorySidebarEntry[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false); // Track if history for current conv is loaded
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { chatSession, sendMessage, isSending, error, setSession, clearSession } = useSolve(user);
  const { usage, refetch: refetchUsage } = useUsage(user);

  useEffect(() => {
    setActiveConversationId(conversationId);
  }, [conversationId]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await fetchHistoryList({ limit: 50 });
      const groupedConversations = new Map<string, HistorySidebarEntry & { latest_at: string }>();
      const standaloneEntries: HistorySidebarEntry[] = [];

      for (const entry of data.entries) {
        const conversationKey = entry.conversation_id?.trim();
        if (!conversationKey) {
          standaloneEntries.push({
            id: entry.id,
            subject: entry.question,
            question: entry.question,
            created_at: entry.created_at,
            conversation_id: entry.conversation_id,
            style_mode: (entry.style_mode as StyleMode | null) ?? null,
          });
          continue;
        }

        const existing = groupedConversations.get(conversationKey);
        if (!existing) {
          groupedConversations.set(conversationKey, {
            id: entry.id,
            subject: entry.question,
            question: entry.question,
            created_at: entry.created_at,
            latest_at: entry.created_at,
            conversation_id: conversationKey,
            style_mode: (entry.style_mode as StyleMode | null) ?? null,
          });
          continue;
        }

        existing.question = entry.question;
        existing.subject = entry.question;
        existing.created_at = entry.created_at;
        if (!existing.style_mode && entry.style_mode) {
          existing.style_mode = entry.style_mode as StyleMode;
        }
      }

      setHistory(
        [...Array.from(groupedConversations.values()), ...standaloneEntries].sort(
          (a, b) =>
            new Date((b as HistorySidebarEntry & { latest_at?: string }).latest_at ?? b.created_at).getTime() -
            new Date((a as HistorySidebarEntry & { latest_at?: string }).latest_at ?? a.created_at).getTime(),
        ),
      );
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConversation = async (id: string) => {
      try {
        setChatLoading(true);
        const data = await fetchHistoryList({ conversationId: id });
        if (cancelled) return;
        const reversed = [...data.entries].reverse();
        const mappedSession = reversed.map((entry) => ({
          id: entry.id,
          question: entry.question,
          images: entry.image_urls,
          isBulk: entry.is_bulk,
          response: {
            answer: entry.answer,
            explanation: entry.explanation || '',
            steps: entry.steps || [],
          },
        }));
        setSession(mappedSession);
        setActiveConversationId(id);
        const threadMode = reversed.find((entry) => typeof entry.style_mode === 'string')?.style_mode;
        if (
          threadMode === 'standard' ||
          threadMode === 'exam' ||
          threadMode === 'eli5' ||
          threadMode === 'step_by_step' ||
          threadMode === 'gen_alpha'
        ) {
          setStyleMode(threadMode);
        }
        setInitialHistoryLoaded(true); // Mark history as loaded
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load conversation', error);
      } finally {
        if (!cancelled) {
          setChatLoading(false);
        }
      }
    };

    if (conversationId) {
      void loadConversation(conversationId);
    } else {
      setChatLoading(false);
      clearSession();
      setActiveConversationId(null);
      setInitialHistoryLoaded(true); // No conversation to load
    }
    return () => {
      cancelled = true;
    };
  }, [conversationId, setSession, clearSession]);

  useEffect(() => {
    // Scroll to bottom only when a new message is added, not on initial history load
    if (messagesEndRef.current && initialHistoryLoaded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatSession, initialHistoryLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
    }
    e.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const historyForSolve = useMemo(
    () =>
      chatSession
        .filter((msg) => msg.response && msg.response.answer && msg.response.answer !== 'Thinking...')
        .flatMap((msg) => [
          { role: 'user' as const, text: msg.question },
          {
            role: 'model' as const,
            text: [msg.response.answer, msg.response.explanation].filter(Boolean).join('\n\n'),
          },
        ]),
    [chatSession],
  );

  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return;
    if (isSending) return;

    const currentMessage = message;
    setMessage('');

    try {
      trackEvent('solve_started', { mode: styleMode, imageCount: attachments.length });
      const response = await sendMessage({
        text: currentMessage,
        images: attachments,
        styleMode,
        history: historyForSolve,
        conversationId: activeConversationId || conversationId || undefined,
      });
      if (response) {
        trackEvent('solve_completed', { mode: styleMode });
        
        // Update URL if this was a new conversation
        if (response.metadata?.conversationId) {
          setActiveConversationId(response.metadata.conversationId);
          if (!conversationId) {
            setSearchParams({ conversationId: response.metadata.conversationId }, { replace: true });
          }
        }
        
        void loadHistory();
        void refetchUsage();
      } else {
        trackEvent('solve_failed', { mode: styleMode });
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Solve failed';
      trackEvent('solve_failed', { mode: styleMode, error: messageText });
    } finally {
      setAttachments([]);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredHistory = history.filter(h => 
    h.question?.toLowerCase().includes(historySearch.toLowerCase()) ||
    h.subject?.toLowerCase().includes(historySearch.toLowerCase())
  );

  const startNewChat = () => {
    navigate('/chat');
    clearSession();
    setActiveConversationId(null);
    setMessage('');
    setAttachments([]);
    setHistorySearch('');
    setChatLoading(false);
    setInitialHistoryLoaded(true);
  };

  return (
    <AppLayout currentPage="chat" user={user}>
      <div className="oryx-shell-bg flex h-full w-full flex-row transition-colors">
        
        {/* SIDEBAR - HISTORY */}
        <aside 
          className={`${rightSidebarOpen ? 'w-[300px] border-r border-slate-200 dark:border-white/5' : 'w-0 border-r-0'} transition-all duration-500 ease-in-out overflow-hidden flex-shrink-0 hidden md:flex flex-col backdrop-blur-xl z-20`}
          style={{ backgroundColor: 'var(--surface-sidebar)', borderColor: 'var(--border-color)' }}
        >
          <div className="w-[300px] h-full flex flex-col">
            <div className="p-6 flex items-center justify-between flex-shrink-0">
              <h2 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <History size={14} className="text-indigo-500" />
                History
              </h2>
              <button 
                onClick={startNewChat} 
                className="oryx-surface-panel flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-all hover:scale-105 active:scale-95 dark:text-slate-300" 
                title="Start a new chat"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="px-6 mb-4 flex-shrink-0">
              <div className="relative group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search your solves..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="oryx-input-surface w-full rounded-2xl py-2.5 pl-10 pr-4 text-xs text-slate-900 outline-none transition-all placeholder-slate-400 focus:border-indigo-500/50 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/chat?conversationId=${entry.conversation_id || entry.id}`)}
                    className={`w-full text-left p-4 rounded-[20px] transition-all mb-1 border group relative ${
                      (entry.conversation_id || entry.id) === conversationId
                        ? 'oryx-surface-panel border-indigo-500/20 shadow-xl shadow-black/5'
                        : 'bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {(entry.conversation_id || entry.id) === conversationId && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
                    )}
                    <p className={`text-[13px] font-bold line-clamp-2 leading-relaxed mb-3 ${
                      (entry.conversation_id || entry.id) === conversationId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                    }`}>
                      {entry.question || entry.subject || 'New Conversation'}
                    </p>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                         {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                       </span>
                       <ChevronRight size={12} className={`transition-transform duration-300 ${ (entry.conversation_id || entry.id) === conversationId ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="oryx-surface-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                    <History size={20} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No history yet</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden transition-colors" style={{ backgroundColor: 'transparent' }}>
          
          <header className="oryx-surface-header sticky top-0 z-10 flex h-14 flex-shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)} 
                className="hidden rounded-lg p-2 -ml-2 text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 md:block"
                title="Toggle Sidebar"
              >
                <Menu size={20} />
              </button>
              <h1 className="font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-sm">
                  <Sparkles size={12} className="text-white" />
                </div>
                Oryx Solver
              </h1>
            </div>
            <button 
              onClick={startNewChat} 
              className="oryx-surface-soft flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700"
              style={{ backgroundColor: 'var(--surface-soft)', borderColor: 'var(--border-color)' }}
              title="Start a new chat"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth" id="messages-container">
            {chatLoading ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-500 dark:text-indigo-400" />
               </div>
            ) : chatSession.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto px-4 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-slate-200/80 bg-white/85 shadow-lg shadow-sky-500/10 dark:border-white/10 dark:bg-white/[0.04]">
                  <Sparkles size={30} className="text-sky-600 dark:text-teal-300" />
                </div>
                
                <h2 className="text-3xl md:text-4xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                  Start with one question. Keep the thread clean.
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-xl">
                  Upload an image, type a question, or paste the assignment text. Choose the mode before you start, then keep follow-ups in the same conversation.
                </p>
                
                <div className="flex flex-wrap justify-center gap-3 mb-10">
                  {STYLE_MODES.map((mode) => {
                    const isLocked = usage?.subscriptionTier === 'free' && (mode.value === 'gen_alpha' || mode.value === 'step_by_step');
                    const isActive = styleMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setStyleMode(mode.value)}
                        disabled={isLocked}
                        title={mode.desc}
                        className={`oryx-mode-chip ${getModeToneClass(mode.value)} ${isActive ? 'is-active' : ''} group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${isActive ? 'shadow-lg shadow-sky-500/10 active:scale-95' : ''} ${isLocked ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                      >
                        <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{mode.icon}</span>
                        {mode.label}
                        {isLocked && <Bot size={12} className="opacity-50" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setMessage(prompt)}
                      className="rounded-full border border-slate-200/80 bg-white/86 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto py-8">
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                    Solve failed: {error}
                  </div>
                )}
                {chatSession.map((msg) => {
                  const ans = msg.response?.answer?.trim() || '';
                  const exp = msg.response?.explanation?.trim() || '';
                  const answerMissing = ans.toLowerCase() === 'answer available in explanation';
                  const fallbackSteps = (msg.response?.steps?.length ?? 0) > 0 ? [] : parseExplanationSteps(exp);
                  const rawSteps = (msg.response?.steps?.length ?? 0) > 0 ? msg.response?.steps || [] : fallbackSteps;
                  const preliminaryPresentation = getResponsePresentation(msg.question, ans, rawSteps, exp);
                  const candidateSteps = preliminaryPresentation.hideSteps ? [] : rawSteps;
                  const validSteps = candidateSteps.filter((step) => {
                    const normalizedStep = normalizeComparableText(step);
                    return (
                      normalizedStep.length > 0 &&
                      normalizedStep !== normalizeComparableText(ans) &&
                      normalizedStep !== normalizeComparableText(exp)
                    );
                  });
                  const stepsCombined = normalizeComparableText(validSteps.join('\n'));
                  const showExplanation =
                    exp &&
                    !answerMissing &&
                    normalizeComparableText(exp) !== normalizeComparableText(ans) &&
                    normalizeComparableText(exp) !== stepsCombined;
                  const presentation = getResponsePresentation(msg.question, ans, validSteps, exp);

                  return (
                  <div key={msg.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* User Message */}
                    <div className="flex justify-end pr-2">
                      <div className="max-w-[85%] md:max-w-[80%] rounded-[28px] rounded-tr-none bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-5 shadow-xl shadow-indigo-500/10 border border-white/10">
                        <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap">{msg.question}</p>
                        {msg.images && msg.images.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {msg.images.map((img, i) => (
                              <img key={i} src={img} alt="Attached" className="w-full h-auto rounded-[20px] border border-white/20 object-cover shadow-lg" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* AI Message */}
                    {msg.response && (
                      <div className="flex justify-start items-start gap-4 group">
                        <div className="oryx-surface-soft flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[18px] shadow-sm transition-transform group-hover:scale-110">
                          <Bot size={20} className="text-indigo-500" />
                        </div>
                        <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[90%]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Oryx Solver</span>
                            <button 
                              onClick={() => copyToClipboard(ans, msg.id)} 
                              className="oryx-surface-soft rounded-xl p-2 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-indigo-500 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-indigo-400" title="Copy answer"
                            >
                              {copiedId === msg.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          
                          <div className="oryx-surface-panel max-w-none rounded-[28px] rounded-tl-none p-6 prose-slate text-slate-800 dark:prose-invert dark:text-slate-200">
                            {msg.error && (
                              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                                <div className="font-black uppercase tracking-[0.16em] text-[10px] mb-1">Request failed</div>
                                <p>{msg.error}</p>
                              </div>
                            )}
                            {ans && ans.toLowerCase() !== 'answer available in explanation' && presentation.layout === 'answer' && (
                              <div className="mb-6 rounded-[24px] border border-indigo-100/80 bg-indigo-50/70 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                                <div className="mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
                                  <Sparkles size={14} />
                                  <span className="text-[10px] font-black uppercase tracking-[0.22em]">{presentation.answerLabel}</span>
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-400 dark:text-indigo-200/70">
                                    {presentation.answerHint}
                                  </span>
                                </div>
                                {ans === 'Thinking...' ? (
                                  <div className="flex items-center gap-3 py-2">
                                    <div className="flex gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-indigo-500/70">Analyzing your question...</span>
                                  </div>
                                ) : (
                                  <RichText
                                    content={ans}
                                    className="text-[16px] font-semibold leading-relaxed text-slate-900 dark:text-white [&_.katex]:text-slate-900 dark:[&_.katex]:text-white"
                                  />
                                )}
                              </div>
                            )}

                            {ans && ans.toLowerCase() !== 'answer available in explanation' && presentation.layout === 'chat' && (
                              <div className="mb-4 rounded-[20px] border border-slate-200/80 bg-white/75 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="mb-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                  <Sparkles size={14} className="text-indigo-500 dark:text-indigo-300" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">{presentation.answerLabel}</span>
                                </div>
                                <RichText
                                  content={ans}
                                  className="text-[16px] leading-relaxed text-slate-800 dark:text-slate-100 [&_.katex]:text-slate-900 dark:[&_.katex]:text-white"
                                />
                              </div>
                            )}

                            {validSteps.length > 0 && (
                              <div className="space-y-3 mt-4">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <MessageSquare size={14} />
                                  <span className="text-xs font-semibold uppercase tracking-wider">Steps</span>
                                </div>
                                {validSteps.map((step, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--surface-soft)', color: 'var(--text-secondary)' }}>
                                      {i + 1}
                                    </div>
                                    <div className="flex-1">
                                      <RichText content={step} className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {showExplanation && (
                              <div className="mt-5 rounded-xl border p-4" style={{ backgroundColor: 'var(--surface-soft)', borderColor: 'var(--border-color)' }}>
                                <div className="flex items-center gap-2 mb-2 text-gray-600 dark:text-gray-400">
                                  <Lightbulb size={14} />
                                  <span className="text-xs font-semibold uppercase tracking-wider">{presentation.explanationLabel}</span>
                                </div>
                                <RichText content={exp} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
                <div ref={messagesEndRef} className="h-0" />
              </div>
            )}
          </div>

          {/* Input Area - pinned to bottom */}
          <div className="flex-none w-full border-t p-4 pt-4 pb-6 md:pb-8" style={{ background: 'linear-gradient(180deg, transparent 0%, var(--surface-header) 24%, var(--surface-panel-strong) 100%)', borderColor: 'var(--border-color)' }}>
            <div className="max-w-3xl mx-auto">
              {chatSession.length > 0 && (
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <Sparkles size={12} className="text-indigo-500 dark:text-indigo-300" />
                    Mode locked for this thread: {STYLE_MODES.find((mode) => mode.value === styleMode)?.label ?? 'Standard'}
                  </div>
                  {activeConversationId && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Follow-ups stay in this thread
                    </span>
                  )}
                </div>
              )}
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap px-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="oryx-surface-soft flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm">
                      <Paperclip size={14} className="text-gray-600 dark:text-gray-300" />
                      <span className="text-xs font-medium text-gray-800 dark:text-white max-w-[150px] truncate">{file.name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-500 p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600" title="Remove attachment"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="group relative flex items-end gap-3 overflow-hidden rounded-[28px] border-2 p-3 shadow-2xl transition-all focus-within:border-indigo-500/50 focus-within:ring-8 focus-within:ring-indigo-500/[0.03]" style={{ backgroundColor: 'var(--surface-panel-strong)', borderColor: 'var(--border-color)' }}>
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.01] to-blue-500/[0.01] pointer-events-none" />
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                  accept="image/png, image/jpeg, application/pdf"
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="oryx-surface-soft mb-0.5 ml-1 flex-shrink-0 rounded-[20px] p-3 text-slate-500 shadow-sm transition-all hover:bg-white dark:text-slate-400 dark:hover:bg-white/10 active:scale-95"
                  style={{ backgroundColor: 'var(--surface-soft)', borderColor: 'var(--border-color)' }}
                  title="Attach images"
                >
                  <Paperclip size={20} />
                </button>
                
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Oryx anything..."
                  className="flex-1 max-h-48 min-h-[48px] py-3 px-1 bg-transparent outline-none text-[16px] font-medium text-slate-900 dark:text-white placeholder-slate-400 resize-none leading-relaxed"
                  rows={1}
                  style={{ height: 'auto' }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                />
                
                <button
                  onClick={handleSend}
                  disabled={isSending || (!message.trim() && attachments.length === 0)}
                  className={`p-3 mb-0.5 mr-1 rounded-[20px] flex-shrink-0 transition-all duration-300 flex items-center justify-center shadow-lg
                    ${(!message.trim() && attachments.length === 0) && !isSending
                      ? 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-white/5' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20 ' + (isSending ? 'opacity-80 cursor-not-allowed' : 'hover:scale-[1.05] active:scale-95')}`}
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} className="ml-0.5" />}
                </button>
              </div>
              
              <p className="mt-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Oryx Solver can make mistakes. Consider verifying important information.</p>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
