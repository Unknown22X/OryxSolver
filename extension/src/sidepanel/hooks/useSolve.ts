import { useState, useCallback } from 'react';
import type { ChatTurn, StyleMode, UsageSnapshot } from '../types';
import { postSolveRequest } from '../services/solveApi';
import { mapSolveErrorMessage } from '../services/mapSolveError';
import { mergeUsageSnapshot, buildUsageSnapshot } from '../utils/usageHelpers';
import { getAccessToken } from '../auth/supabaseAuthClient';

export function useSolve(
  usage: UsageSnapshot,
  setUsage: React.Dispatch<React.SetStateAction<UsageSnapshot>>,
  quotedStep: { text: string; index: number } | null,
  setQuotedStep: React.Dispatch<React.SetStateAction<{ text: string; index: number } | null>>,
  onLimitExceeded: () => void
) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendErrorCode, setSendErrorCode] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatTurn[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [lastSendTime, setLastSendTime] = useState(0);

  const clearSession = useCallback(() => {
    setChatSession([]);
    setActiveConversationId(null);
    setSendError(null);
    setQuotedStep(null);
  }, [setQuotedStep]);

  const handleSend = async (payload: { text: string; images: File[]; styleMode: StyleMode }) => {
    if (isSending || Date.now() - lastSendTime < 2000) return;

    // Context Validation
    const isGenericPrompt = ["Solve this question from the attached image.", "Solve this exam question from the attached image.", "Solve this question from the attached image and explain simply.", "Solve this question from the attached image step by step.", "Solve this question from the attached image in light Gen Alpha style."].includes(payload.text.trim());
    
    if (!payload.text.trim() || (isGenericPrompt && payload.images.length === 0)) {
      setSendError("Missing context: Please provide a specific question or upload a screenshot.");
      return;
    }
    
    // Limits
    if (quotedStep && usage.subscriptionTier !== 'pro' && (usage.stepQuestionsUsed || 0) >= 3) {
      setSendError("Step question limit reached. Upgrade to Pro!");
      onLimitExceeded();
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const token = await getAccessToken();
      
      const currentHistory = chatSession.flatMap(turn => [
        { role: 'user' as const, text: turn.question },
        { role: 'model' as const, text: turn.response.explanation || turn.response.answer }
      ]);

      const response = await postSolveRequest(token, {
        question: payload.text,
        styleMode: payload.styleMode,
        images: payload.images,
        history: currentHistory,
        conversationId: activeConversationId || undefined,
        quotedStep: quotedStep || undefined
      });

      if (response.answer) {
        const turnId = response.metadata?.conversationId || Date.now().toString();
        if (response.metadata?.conversationId) setActiveConversationId(response.metadata.conversationId);

        const nextUsage = buildUsageSnapshot(response.usage);
        setUsage(prev => mergeUsageSnapshot(prev, nextUsage));

        const turn: ChatTurn = {
          id: turnId + '-' + Date.now(),
          question: quotedStep ? `[Step ${quotedStep.index + 1}] ${payload.text}` : payload.text,
          response: {
            answer: response.answer,
            explanation: response.explanation,
            suggestions: response.suggestions.map(s => ({
              label: s.label,
              prompt: s.prompt,
              styleMode: s.styleMode
            }))
          }
        };

        setChatSession(prev => [...prev, turn]);
        setLastSendTime(Date.now());
        setQuotedStep(null);
      }
    } catch (error: any) {
      const code = error.code || null;
      setSendError(mapSolveErrorMessage(code, error.message));
      setSendErrorCode(code);
      if (code === 'LIMIT_EXCEEDED') onLimitExceeded();
    } finally {
      setIsSending(false);
    }
  };

  return { isSending, sendError, sendErrorCode, chatSession, setChatSession, activeConversationId, setActiveConversationId, handleSend, clearSession, setSendError };
}
