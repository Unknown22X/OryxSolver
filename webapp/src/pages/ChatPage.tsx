import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
  Sparkles, Send, Paperclip, X, Copy, Check,
  Zap, Loader2, MessageSquare, Lightbulb, 
  BookOpen, Calculator, Bot, Menu, Plus, History, Search, ChevronRight,
  Flame, Trophy, ArrowRight, Play
} from 'lucide-react';
import { useSolve } from '../hooks/useSolve';
import { fetchHistoryList } from '../lib/historyApi';
import { groupHistoryEntries } from '../lib/historyThreads';
import { trackEvent } from '../lib/analyticsClient';
import { useUsage } from '../hooks/useUsage';
import { useTranslation } from 'react-i18next';
import RichText from '../components/RichText';
import type { User } from '@supabase/supabase-js';
import { useServiceHealth } from '../hooks/useServiceHealth';

type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';
type SolveStreamPhase = 'auth' | 'preparing' | 'cache' | 'calling_ai' | 'refining' | 'finalizing';

const getStreamPhaseLabels = (t: any): Record<SolveStreamPhase, string> => ({
  auth: t('chat.phase_auth'),
  preparing: t('chat.phase_preparing'),
  cache: t('chat.phase_cache'),
  calling_ai: t('chat.phase_calling_ai'),
  refining: t('chat.phase_refining'),
  finalizing: t('chat.phase_finalizing'),
});

interface HistorySidebarEntry {
  id: string;
  subject: string;
  question: string;
  created_at: string;
  conversation_id?: string | null;
  style_mode?: StyleMode | null;
  threadId?: string;
  rootQuestion?: string;
}

const HISTORY_ENTRY_CHAR_LIMIT = 12000;
const HISTORY_TOTAL_CHAR_BUDGET = 32000;
const HISTORY_MAX_ITEMS = 12;

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

function trimHistoryForRequest(history: Array<{ role: 'user' | 'model'; text: string }>) {
  let totalChars = 0;
  const trimmedNewestFirst: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const text = item.text.trim();
    if (!text || text.length > HISTORY_ENTRY_CHAR_LIMIT) continue;
    if (
      trimmedNewestFirst.length >= HISTORY_MAX_ITEMS ||
      totalChars + text.length > HISTORY_TOTAL_CHAR_BUDGET
    ) {
      continue;
    }

    trimmedNewestFirst.push({ role: item.role, text });
    totalChars += text.length;
  }

  return trimmedNewestFirst.reverse();
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
    /\b(prompt|system prompt|instructions|internal instructions|rules)\b/,
    /\bwhat did i ask\b/,
    /\bwhat did i say\b/,
    /\bremember\b.*\b(before|earlier|previously)\b/,
    /\bwhat model\b/,
    /\bwhich model\b/,
    /\bgemini\b/,
    /\bapi key\b/,
  ];

  if (conversationalPatterns.some((pattern) => pattern.test(combined))) return true;
  if (/[=+\-*/^]/.test(prompt)) return false;
  if (/\bsolve\b|\bcalculate\b|\bderive\b|\bequation\b|\bformula\b/i.test(prompt)) return false;
  return (
    prompt.length <= 80 &&
    /^(what|why|how|can|could|would|do|are|is)\b/.test(prompt) &&
    /\b(you|your|this thread|before|earlier|previous|remember)\b/.test(prompt)
  );
}

function getResponsePresentation(question: string, answer: string, steps: string[], explanation: string, t: any) {
  const cleanAnswer = answer.trim();
  const combined = `${cleanAnswer}\n${explanation}`.toLowerCase();
  const looksLikeChoice =
    /^(option\s+)?[a-d](?:[).:]\s*|\s*$)/i.test(cleanAnswer) ||
    /^choice\s+[a-d]\b/i.test(cleanAnswer);
  const shortSingleBlock = cleanAnswer.length > 0 && cleanAnswer.length <= 90 && !cleanAnswer.includes('\n');
  const conversational = isConversationalPrompt(question, answer, explanation);

  if (conversational) {
    return {
      answerLabel: t('chat.response'),
      answerHint: t('chat.natural_reply'),
      explanationLabel: t('chat.more_context'),
      layout: 'chat' as const,
      hideSteps: true,
    };
  }

  if (steps.length > 0) {
    return {
      answerLabel: looksLikeChoice ? t('chat.selected_answer') : t('chat.answer'),
      answerHint: looksLikeChoice ? t('chat.chosen_result') : t('chat.main_result'),
      explanationLabel: t('chat.why_this_works'),
      layout: 'answer' as const,
      hideSteps: false,
    };
  }

  if (/(example|practice|quiz|flash[\s-]?card)/i.test(combined)) {
    return {
      answerLabel: t('chat.example'),
      answerHint: t('chat.practice_response'),
      explanationLabel: t('chat.how_to_use_it'),
      layout: 'answer' as const,
      hideSteps: true,
    };
  }

  if (shortSingleBlock) {
    return {
      answerLabel: t('chat.quick_answer'),
      answerHint: t('chat.direct_response'),
      explanationLabel: t('chat.more_context'),
      layout: 'answer' as const,
      hideSteps: true,
    };
  }

  return {
    answerLabel: t('chat.response'),
    answerHint: t('chat.main_response'),
    explanationLabel: t('chat.more_context'),
    layout: 'answer' as const,
    hideSteps: false,
  };
}

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
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const STREAM_PHASE_LABELS = getStreamPhaseLabels(t);

  const STYLE_MODES: Array<{ value: StyleMode; label: string; icon: React.ReactNode; desc: string }> = useMemo(() => [
    { value: 'standard', label: t('chat.mode_standard'), icon: <Zap size={14} />, desc: t('chat.mode_standard_desc') },
    { value: 'exam', label: t('chat.mode_exam'), icon: <BookOpen size={14} />, desc: t('chat.mode_exam_desc') },
    { value: 'eli5', label: t('chat.mode_eli5'), icon: <Lightbulb size={14} />, desc: t('chat.mode_eli5_desc') },
    { value: 'step_by_step', label: t('chat.mode_steps'), icon: <Calculator size={14} />, desc: t('chat.mode_steps_desc') },
    { value: 'gen_alpha', label: t('chat.mode_alpha'), icon: <MessageSquare size={14} />, desc: t('chat.mode_alpha_desc') },
  ], [t]);

  const STARTER_PROMPTS = useMemo(() => [
    { title: t('chat.starter_1_title'), desc: t('chat.starter_1_desc'), prompt: t('chat.starter_1_prompt'), icon: <Check size={18} />, color: 'emerald' },
    { title: t('chat.starter_2_title'), desc: t('chat.starter_2_desc'), prompt: t('chat.starter_2_prompt'), icon: <Lightbulb size={18} />, color: 'amber' },
    { title: t('chat.starter_3_title'), desc: t('chat.starter_3_desc'), prompt: t('chat.starter_3_prompt'), icon: <BookOpen size={18} />, color: 'blue' },
    { title: t('chat.starter_4_title'), desc: t('chat.starter_4_desc'), prompt: t('chat.starter_4_prompt'), icon: <Zap size={18} />, color: 'indigo' },
  ], [t]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const conversationId = searchParams.get('conversationId');

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [styleMode, setStyleMode] = useState<StyleMode>('standard');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 2200;
  });
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
  const { health, retryCountdowns, refresh: refreshHealth } = useServiceHealth();
  const solveBlocked =
    health.readOnly &&
    (health.dependencies.network.status === 'outage' ||
      health.dependencies.backend.status !== 'healthy' ||
      health.dependencies.ai.status !== 'healthy' ||
      health.dependencies.db.status !== 'healthy');

  useEffect(() => {
    setActiveConversationId(conversationId);
  }, [conversationId]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await fetchHistoryList({ limit: 50 });
      setHistory(
        groupHistoryEntries(data.entries).map((entry) => ({
          id: entry.id,
          subject: entry.rootQuestion,
          question: entry.rootQuestion,
          created_at: entry.latestAt,
          conversation_id: entry.conversation_id,
          style_mode: (entry.style_mode as StyleMode | null) ?? null,
          threadId: entry.threadId,
          rootQuestion: entry.rootQuestion,
        })),
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
    const handleResize = () => {
      if (window.innerWidth < 2200) {
        setRightSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      trimHistoryForRequest(
        chatSession
          .filter((msg) => msg.response && msg.response.answer && msg.response.answer !== 'Thinking...')
          .flatMap((msg) => [
            { role: 'user' as const, text: msg.question },
            {
              role: 'model' as const,
              text: [msg.response.answer, msg.response.explanation].filter(Boolean).join('\n\n'),
            },
          ]),
      ),
    [chatSession],
  );

  const handleSend = async () => {
    if (!message.trim() && attachments.length === 0) return;
    if (isSending) return;
    if (solveBlocked) {
      await refreshHealth().catch(() => undefined);
      return;
    }

    const currentMessage = message;
    const currentAttachments = attachments;

    try {
      trackEvent('solve_started', { mode: styleMode, imageCount: attachments.length });
      const response = await sendMessage({
        text: currentMessage,
        images: currentAttachments,
        styleMode,
        language: i18n.language,
        history: historyForSolve,
        conversationId: activeConversationId || conversationId || undefined,
      });
      if (response) {
        trackEvent('solve_completed', { mode: styleMode });
        setMessage('');
        setAttachments([]);
        
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
      <div className="oryx-shell-bg flex h-full w-full flex-row transition-colors" dir={isRtl ? 'rtl' : 'ltr'}>
        
        {/* SIDEBAR - HISTORY */}
        <aside 
          className={`${rightSidebarOpen ? 'w-[220px] xl:w-[236px] border-inline' : 'w-0 border-none'} z-20 hidden flex-shrink-0 overflow-hidden backdrop-blur-xl transition-all duration-500 ease-in-out md:flex md:flex-col`}
          style={{ 
            backgroundColor: 'var(--surface-sidebar)', 
            borderColor: 'var(--border-color)',
            borderRightWidth: isRtl ? 0 : 1,
            borderLeftWidth: isRtl ? 1 : 0
          }}
        >
          <div className="flex h-full w-[220px] flex-col xl:w-[236px]">
            <div className="flex flex-shrink-0 items-center justify-between p-4 lg:p-5">
              <h2 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <History size={14} className="text-indigo-500" />
                {t('chat.history')}
              </h2>
              <button 
                onClick={startNewChat} 
                className="oryx-surface-panel flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition-all hover:scale-105 active:scale-95 dark:text-slate-300" 
                title={t('chat.start_new_chat')}
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="mb-3 flex-shrink-0 px-4 lg:mb-4 lg:px-5">
              <div className="relative group">
                <Search size={14} className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors`} />
                <input
                  type="text"
                  placeholder={t('chat.search_solves')}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className={`oryx-input-surface w-full rounded-2xl py-2.5 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-xs text-slate-900 outline-none transition-all placeholder-slate-400 focus:border-indigo-500/50 dark:text-slate-200`}
                />
              </div>
            </div>

            <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2.5 lg:px-3">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => navigate(`/chat?conversationId=${entry.threadId || entry.conversation_id || entry.id}`)}
                    className={`group relative mb-1 w-full rounded-[18px] border p-3.5 text-left transition-all lg:rounded-[20px] lg:p-4 ${
                      (entry.threadId || entry.conversation_id || entry.id) === conversationId
                        ? 'oryx-surface-panel border-indigo-500/20 shadow-xl shadow-black/5'
                        : 'bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    {(entry.threadId || entry.conversation_id || entry.id) === conversationId && (
                      <div className={`absolute ${isRtl ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 ${isRtl ? 'rounded-l-full' : 'rounded-r-full'}`} />
                    )}
                    <p className={`mb-2.5 line-clamp-2 text-[13px] font-bold leading-relaxed lg:mb-3 lg:text-[14px] ${
                      (entry.threadId || entry.conversation_id || entry.id) === conversationId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                    }`}>
                      {entry.rootQuestion || entry.question || entry.subject || t('chat.new_conversation')}
                    </p>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                         {new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                       </span>
                       <ChevronRight size={12} className={`transition-transform duration-300 ${ (entry.threadId || entry.conversation_id || entry.id) === conversationId ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="oryx-surface-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                    <History size={20} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('chat.no_history')}</p>
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
                className={`hidden rounded-lg p-2 ${isRtl ? '-mr-2 ml-2' : '-ml-2 mr-2'} text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 md:block`}
                title="Toggle Sidebar"
              >
                <Menu size={20} className={isRtl ? 'rotate-180' : ''} />
              </button>
              <h1 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-200">
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
              title={t('chat.start_new_chat')}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t('chat.new_chat')}</span>
            </button>
          </header>

          {/* Messages */}
          <div className="scroll-smooth flex-1 overflow-y-auto p-3 md:p-4 lg:p-5" id="messages-container">
            {chatLoading ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-500 dark:text-indigo-400" />
               </div>
            ) : chatSession.length === 0 ? (
              <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-4 pb-6 text-center md:pt-5 md:pb-7 lg:pt-6">
                <h2 className="mb-3 max-w-[14ch] text-[2.35rem] font-black leading-[0.95] tracking-[-0.04em] text-gray-900 dark:text-white md:text-[3.1rem] xl:text-[3.7rem]">
                  {t('chat.what_to_understand')} <span className="text-indigo-600 dark:text-indigo-400">{t('chat.understand')}</span> {t('chat.today')}
                </h2>
                <p className="mb-5 max-w-2xl text-[15px] font-medium leading-relaxed text-gray-600 dark:text-gray-300 md:text-[17px]">
                  {t('chat.prompt_desc')}
                </p>

                {/* Engagement Stats Row */}
                <div className="mb-6 flex flex-wrap items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4 duration-700 delay-100">
                  <div className="flex items-center gap-2.5 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3.5 py-2 shadow-lg shadow-orange-500/5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-red-500 shadow-lg shadow-orange-500/20">
                      <Flame size={18} className="text-white animate-pulse" />
                    </div>
                    <div className="text-left">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] leading-none text-orange-600 dark:text-orange-400">{t('chat.streak')}</p>
                      <p className="text-base font-bold leading-none text-slate-900 dark:text-white">{t('chat.days', { count: 3 })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-2 shadow-lg shadow-indigo-500/5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/20">
                      <Trophy size={18} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] leading-none text-indigo-600 dark:text-indigo-400">{t('chat.solves')}</p>
                      <p className="text-base font-bold leading-none text-slate-900 dark:text-white">{t('chat.total', { count: history.length || 0 })}</p>
                    </div>
                  </div>
                </div>

                {/* Continue Last Solve Card */}
                {history.length > 0 && (
                  <button
                    onClick={() => navigate(`/chat?conversationId=${history[0].threadId || history[0].conversation_id || history[0].id}`)}
                    className="group mb-7 flex w-full max-w-3xl items-center justify-between rounded-[22px] bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 text-white shadow-2xl shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-95 animate-in fade-in zoom-in-95 duration-700 delay-200"
                  >
                      <div className={`${isRtl ? 'text-right' : 'text-left'} flex min-w-0 items-center gap-3`}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                          <Play size={18} className={`${isRtl ? 'mr-0.5 rotate-180' : 'ml-0.5'} fill-white text-white`} />
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100 opacity-80">{t('chat.jump_back_in')}</p>
                          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-white">{t('chat.continue', { text: history[0].rootQuestion || history[0].question })}</p>
                        </div>
                      </div>
                     <ArrowRight size={17} className={`ml-3 mr-1 flex-shrink-0 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                   </button>
                 )}
                
                <div className="mb-6 grid w-full grid-cols-2 gap-2.5 lg:grid-cols-5">
                  {STYLE_MODES.map((mode) => {
                    const isLocked = usage?.subscriptionTier === 'free' && (mode.value === 'gen_alpha' || mode.value === 'step_by_step');
                    const isActive = styleMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setStyleMode(mode.value)}
                        disabled={isLocked}
                        title={mode.desc}
                        className={`oryx-mode-chip ${getModeToneClass(mode.value)} ${isActive ? 'is-active' : ''} group relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border p-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all sm:min-h-[96px] lg:p-3 ${isActive ? 'shadow-xl shadow-indigo-500/10 active:scale-95' : 'hover:bg-white/50 dark:hover:bg-white/5'} ${isLocked ? 'cursor-not-allowed grayscale opacity-40' : ''}`}
                      >
                         <div className={`rounded-xl p-2 transition-transform duration-300 ${isActive ? 'scale-110 bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:scale-110 dark:bg-white/10'}`}>
                          {mode.icon}
                        </div>
                        {mode.label}
                        {isLocked && <div className={`absolute top-2 ${isRtl ? 'left-2' : 'right-2'}`}><Bot size={10} className="opacity-50" /></div>}
                      </button>
                    );
                  })}
                </div>

                 <div className="grid w-full grid-cols-1 gap-2.5 md:grid-cols-2">
                  {STARTER_PROMPTS.map((item) => {
                    const colorClasses: Record<string, string> = {
                       emerald: 'hover:border-emerald-500/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20',
                       amber: 'hover:border-amber-500/30 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20',
                       blue: 'hover:border-blue-500/30 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20',
                       indigo: 'hover:border-indigo-500/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20'
                    };
                    const currentColor = colorClasses[item.color] || colorClasses.indigo;

                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => setMessage(item.prompt)}
                        className={`group flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-white/50 p-3.5 transition-all hover:shadow-2xl dark:border-white/5 dark:bg-white/[0.02] lg:p-4 ${isRtl ? 'text-right' : 'text-left'} ${currentColor}`}
                      >
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500 transition-colors dark:bg-white/5`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="mb-1 text-[15px] font-black text-slate-900 transition-colors dark:text-white">{item.title}</p>
                          <p className="text-[13px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 py-6 lg:max-w-4xl">
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                    {t('chat.solve_failed', { error })}
                  </div>
                )}
                {chatSession.map((msg) => {
                  const ans = msg.response?.answer?.trim() || '';
                  const exp = msg.response?.explanation?.trim() || '';
                  const statusLabel = msg.response?.statusPhase ? STREAM_PHASE_LABELS[msg.response.statusPhase] : null;
                  const answerMissing = ans.toLowerCase() === 'answer available in explanation';
                  const fallbackSteps = (msg.response?.steps?.length ?? 0) > 0 ? [] : parseExplanationSteps(exp);
                  const rawSteps = (msg.response?.steps?.length ?? 0) > 0 ? msg.response?.steps || [] : fallbackSteps;
                  const preliminaryPresentation = getResponsePresentation(msg.question, ans, rawSteps, exp, t);
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
                  const presentation = getResponsePresentation(msg.question, ans, validSteps, exp, t);

                  return (
                  <div key={msg.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`flex ${isRtl ? 'justify-start pl-2' : 'justify-end pr-2'} group/user-msg animate-in fade-in slide-in-from-${isRtl ? 'left' : 'right'}-4 duration-500`}>
                      <div className="oryx-bubble-user max-w-[85%] md:max-w-[75%] pb-10">
                        <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${isRtl ? 'text-right' : 'text-left'}`}>{msg.question}</p>
                        {msg.images && msg.images.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            {msg.images.map((img, i) => (
                              <img key={i} src={img} alt="Attached" className="w-full h-auto rounded-[18px] border border-slate-200/20 object-cover shadow-sm" />
                            ))}
                          </div>
                        )}
                        <button 
                          onClick={() => copyToClipboard(msg.question, msg.id + '-q')}
                          className={`oryx-copy-btn absolute bottom-2 ${isRtl ? 'left-3' : 'right-3'} opacity-0 group-hover/user-msg:opacity-100 z-10`}
                          title={t('chat.copy_question')}
                        >
                          {copiedId === msg.id + '-q' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span className="text-[9px]">{copiedId === msg.id + '-q' ? t('chat.copied') : t('chat.copy')}</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* AI Message */}
                    {msg.response && (
                      <div className="flex justify-start items-start gap-4 group">
                        <div className="oryx-avatar-container">
                          <Bot size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[90%]">
                          <div className={`oryx-bubble-ai relative prose-slate text-slate-800 dark:prose-invert dark:text-slate-100 ${presentation.layout === 'chat' ? `max-w-fit ${isRtl ? 'pl-12' : 'pr-12'} pb-4` : 'max-w-none pb-10'} group/ai-bubble`}>
                            <button 
                              onClick={() => copyToClipboard(ans, msg.id)} 
                              className={`oryx-copy-btn absolute bottom-2 ${isRtl ? 'left-3' : 'right-3'} opacity-0 group-hover/ai-bubble:opacity-100 shadow-sm z-10`}
                              title={t('chat.copy_response')}
                            >
                              {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              <span className="text-[9px]">{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                            </button>
                            {msg.error && (
                              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                                <div className="font-black uppercase tracking-[0.16em] text-[10px] mb-1">{t('chat.request_failed')}</div>
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
                                  {(statusLabel || msg.response.isPreview || msg.response.interrupted) && (
                                    <span className="ml-auto rounded-full border border-indigo-200/80 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-950/30 dark:text-indigo-200">
                                    {msg.response.interrupted ? t('chat.interrupted') : msg.response.isPreview ? t('chat.preview') : statusLabel}
                                    </span>
                                  )}
                                </div>
                                {ans === 'Thinking...' ? (
                                  <div className="flex items-center gap-3 py-2">
                                    <div className="flex gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-indigo-500/70">{t('chat.analyzing')}</span>
                                  </div>
                                ) : (
                                  <RichText
                                    content={ans}
                                    className="text-[16px] font-semibold leading-relaxed text-slate-900 dark:text-white [&_.katex]:text-slate-900 dark:[&_.katex]:text-white"
                                  />
                                )}
                              </div>
                            )}

                            {statusLabel && !msg.response.interrupted && (
                              <div className="mb-4 rounded-2xl border border-indigo-100/80 bg-indigo-50/60 px-4 py-3 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-950/20 dark:text-indigo-200">
                                {statusLabel}
                              </div>
                            )}

                            {ans && ans.toLowerCase() !== 'answer available in explanation' && presentation.layout === 'chat' && (
                              <RichText
                                content={ans}
                                className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-100"
                              />
                            )}

                            {validSteps.length > 0 && (
                              <div className="space-y-3 mt-4">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <MessageSquare size={14} />
                                  <span className="text-xs font-semibold uppercase tracking-wider">{t('chat.steps')}</span>
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
            <div className="mx-auto max-w-3xl lg:max-w-4xl">
              {chatSession.length > 0 && (
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <Sparkles size={12} className="text-indigo-500 dark:text-indigo-300" />
                    {t('chat.mode_locked')} {STYLE_MODES.find((mode) => mode.value === styleMode)?.label ?? t('chat.mode_standard')}
                  </div>
                  {activeConversationId && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {t('chat.follow_ups_stay')}
                    </span>
                  )}
                </div>
              )}
              {solveBlocked && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  <span>
                    Solving is paused while services recover. Your draft stays here.
                  </span>
                  {retryCountdowns.ai > 0 || retryCountdowns.backend > 0 || retryCountdowns.db > 0 ? (
                    <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-slate-900/40 dark:text-amber-200">
                      Retry in {Math.max(retryCountdowns.ai, retryCountdowns.backend, retryCountdowns.db)}s
                    </span>
                  ) : null}
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
                  title={t('chat.attach_images')}
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
                  placeholder={t('chat.ask_placeholder')}
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
                  disabled={isSending || solveBlocked || (!message.trim() && attachments.length === 0)}
                  className={`p-3 mb-0.5 mr-1 rounded-[20px] flex-shrink-0 transition-all duration-300 flex items-center justify-center shadow-lg
                    ${((!message.trim() && attachments.length === 0) || solveBlocked) && !isSending
                      ? 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-white/5' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20 ' + (isSending ? 'opacity-80 cursor-not-allowed' : 'hover:scale-[1.05] active:scale-95')}`}
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} className={`${isRtl ? 'rotate-180 mr-0.5' : 'ml-0.5'}`} />}
                </button>
              </div>
              
              <p className="mt-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400">{t('chat.disclaimer')}</p>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
