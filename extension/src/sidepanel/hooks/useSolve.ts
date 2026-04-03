import { useState, useCallback, useEffect, useRef } from 'react';
import type { ChatTurn, StyleMode, UsageSnapshot } from '../types';
import { postSolveRequest, streamSolveRequest } from '../services/solveApi';
import { mapSolveErrorMessage } from '../services/mapSolveError';
import { mergeUsageSnapshot, buildUsageSnapshot } from '../utils/usageHelpers';
import { getAccessToken } from '../auth/supabaseAuthClient';
import { compressImages } from '../utils/imageCompressor';
import { analytics } from '../services/analyticsService';
import type { SolveStreamEvent } from '../services/contracts';

export function useSolve(
  usage: UsageSnapshot,
  setUsage: React.Dispatch<React.SetStateAction<UsageSnapshot>>,
  quotedStep: { text: string; index: number } | null,
  setQuotedStep: React.Dispatch<React.SetStateAction<{ text: string; index: number } | null>>,
  onLimitExceeded: () => void,
  defaultLanguage?: string
) {
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendErrorCode, setSendErrorCode] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatTurn[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [lastSendTime, setLastSendTime] = useState(0);
  const managedObjectUrlsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stillUsed = new Set<string>();
    for (const turn of chatSession) {
      for (const image of turn.images ?? []) {
        if (image.startsWith('blob:')) {
          stillUsed.add(image);
        }
      }
    }

    for (const url of managedObjectUrlsRef.current) {
      if (!stillUsed.has(url)) {
        URL.revokeObjectURL(url);
        managedObjectUrlsRef.current.delete(url);
      }
    }
  }, [chatSession]);

  useEffect(() => {
    return () => {
      for (const url of managedObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      managedObjectUrlsRef.current.clear();
    };
  }, []);

  const clearSession = useCallback(() => {
    setChatSession([]);
    setActiveConversationId(null);
    setSendError(null);
    setQuotedStep(null);
  }, [setQuotedStep]);

  const clearInterruptedTurns = useCallback(() => {
    setChatSession((prev) => prev.filter((turn) => !turn.response?.interrupted));
  }, []);

  const handleSend = useCallback(async (payload: { text: string; images: (File | { url: string })[]; styleMode: StyleMode; language?: string; isBulk?: boolean }): Promise<{answer: string; explanation: string; steps?: string[]} | null> => {
    const effectiveLanguage = payload.language || defaultLanguage;
    if (isSending || Date.now() - lastSendTime < 2000) return null;

    // Context Validation
    const isGenericPrompt = ["Solve this question from the attached image.", "Solve this exam question from the attached image.", "Solve this question from the attached image and explain simply.", "Solve this question from the attached image step by step.", "Solve this question from the attached image in light Gen Alpha style."].includes(payload.text.trim());
    
    if (!payload.text.trim() || (isGenericPrompt && payload.images.length === 0)) {
      setSendError("Missing context: Please provide a specific question or upload a screenshot.");
      return null;
    }
    
    // Limits
    if (quotedStep && usage.subscriptionTier === 'free' && (usage.stepQuestionsUsed || 0) >= 3) {
      setSendError("Step question limit reached. Upgrade to Pro!");
      onLimitExceeded();
      return null;
    }

    setIsSending(true);
    setSendError(null);
    
    abortControllerRef.current?.abort();
    clearInterruptedTurns();
    abortControllerRef.current = new AbortController();
    
    analytics.track('solve_started', { mode: payload.styleMode, imageCount: payload.images.length, isBulk: !!payload.isBulk, hasQuote: !!quotedStep });
    const pendingTurnId = `pending-${Date.now()}`;

    try {
      const token = await getAccessToken();
      const previewImages = payload.images.map((img) => {
        if (!(img instanceof File)) return img.url;
        const objectUrl = URL.createObjectURL(img);
        managedObjectUrlsRef.current.add(objectUrl);
        return objectUrl;
      });

      const pendingQuestion = quotedStep ? `[Step ${quotedStep.index + 1}] ${payload.text}` : payload.text;
      setChatSession((prev) => [
        ...prev,
        {
          id: pendingTurnId,
          question: pendingQuestion,
          images: previewImages,
          isBulk: payload.isBulk,
          response: {
            answer: 'Thinking...',
            explanation: '',
            steps: [],
            suggestions: [],
            statusPhase: 'preparing',
          },
        },
      ]);

      // Compress images client-side before upload to reduce AI vision costs
      const compressedImages = await compressImages(payload.images);
      
      const currentHistory = chatSession
        .slice(-10) // Only send 10 latest turns to stay within server limits
        .flatMap(turn => [
          { role: 'user' as const, text: turn.question },
          { role: 'model' as const, text: turn.response.explanation || turn.response.answer }
        ]);

      if (payload.isBulk) {
        const questionBlocks = payload.text.split(/QUESTION\s+\d+:/i).filter(b => b.trim().length > 5);
        if (questionBlocks.length > 5) {
          let combinedAnswer = ''; let combinedExplanation = '';
          const chunkSize = 5;
          for (let i = 0; i < questionBlocks.length; i += chunkSize) {
            const chunk = questionBlocks.slice(i, i + chunkSize);
            const chunkText = `I need an answer key for the following questions. Provide a clear, numbered list of ONLY the final answers. No steps or reasoning.\n\nQuestions:\n${chunk.map((q, idx) => `QUESTION ${i + idx + 1}:\n${q.trim()}`).join('\n\n')}`;
            
            setChatSession(prev => prev.map(entry => entry.id === pendingTurnId ? {
              ...entry, response: { ...entry.response, answer: `Solving Questions ${i+1}-${Math.min(i+chunkSize, questionBlocks.length)}...` }
            } : entry));

            try {
              const chunkResponse = await postSolveRequest(token, {
                question: chunkText,
                styleMode: payload.styleMode,
                images: compressedImages,
                language: effectiveLanguage,
                history: [], 
                isBulk: true
              }, { signal: abortControllerRef.current?.signal });
              
              combinedAnswer += (combinedAnswer ? '\n' : '') + (chunkResponse.answer || '');
              combinedExplanation += (combinedExplanation ? '\n\n' : '') + (chunkResponse.explanation || '');
            } catch (chunkError: any) {
              console.warn(`Bulk chunk ${i/chunkSize} failed:`, chunkError);
              combinedAnswer += (combinedAnswer ? '\n' : '') + `[Failed to solve questions ${i+1}-${Math.min(i+chunkSize, questionBlocks.length)}]`;
            }

            // Add a small delay between chunks to stay within server rate limits
            if (i + chunkSize < questionBlocks.length) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
          
          const turn: ChatTurn = {
            id: Date.now().toString(),
            question: pendingQuestion,
            images: previewImages,
            isBulk: true,
            response: { answer: combinedAnswer, explanation: combinedExplanation, steps: [], suggestions: [] }
          };
          setChatSession(prev => prev.map((entry) => (entry.id === pendingTurnId ? turn : entry)));
          setIsSending(false); setLastSendTime(Date.now());
          return { answer: combinedAnswer, explanation: combinedExplanation };
        }
      }

      const streamedRequest = !payload.isBulk;
      const requestPayload = {
        question: payload.text,
        styleMode: payload.styleMode,
        images: compressedImages,
        language: effectiveLanguage,
        history: currentHistory,
        conversationId: activeConversationId || undefined,
        quotedStep: quotedStep || undefined,
        isBulk: payload.isBulk
      };
      const applyStreamEvent = (event: SolveStreamEvent) => {
        if (event.type === 'status') {
          setChatSession((prev) => prev.map((entry) => entry.id === pendingTurnId ? {
            ...entry,
            response: {
              ...entry.response,
              statusPhase: event.phase,
              answer: entry.response.isPreview ? entry.response.answer : 'Thinking...',
            },
          } : entry));
          return;
        }

        if (event.type === 'preview') {
          setChatSession((prev) => prev.map((entry) => entry.id === pendingTurnId ? {
            ...entry,
            response: {
              answer: event.answer,
              explanation: event.explanation || '',
              steps: Array.isArray(event.steps) ? event.steps : [],
              suggestions: [],
              isPreview: true,
              statusPhase: 'refining',
            },
          } : entry));
        }
      };
      const response = streamedRequest
        ? await streamSolveRequest(token, requestPayload, {
            onEvent: applyStreamEvent,
          }, { signal: abortControllerRef.current?.signal })
        : await postSolveRequest(token, requestPayload, { signal: abortControllerRef.current?.signal });

      if (response.answer) {
        const turnId = response.metadata?.conversationId || Date.now().toString();
        if (response.metadata?.conversationId) setActiveConversationId(response.metadata.conversationId);

        const nextUsage = buildUsageSnapshot(response.usage);
        setUsage(prev => mergeUsageSnapshot(prev, nextUsage));

        const turn: ChatTurn = {
          id: turnId + '-' + Date.now(),
          question: pendingQuestion,
          images: previewImages,
          isBulk: payload.isBulk,
          response: {
            answer: response.answer,
            explanation: response.explanation,
            steps: Array.isArray(response.steps) ? response.steps : undefined,
            isPreview: false,
            suggestions: response.suggestions.map(s => ({
              label: s.label,
              prompt: s.prompt,
              styleMode: s.styleMode
            }))
          }
        };

        setChatSession(prev => prev.map((entry) => (entry.id === pendingTurnId ? turn : entry)));
        clearInterruptedTurns();
        setLastSendTime(Date.now());
        setQuotedStep(null);
        analytics.track('solve_completed', {
          mode: payload.styleMode,
          isBulk: !!payload.isBulk,
          model: response.metadata?.model ?? null,
          aiMode: response.metadata?.aiMode ?? null,
        });
        return { 
          answer: response.answer, 
          explanation: response.explanation,
          steps: Array.isArray(response.steps) ? response.steps : undefined
        };
      }
      setChatSession(prev => prev.filter((entry) => entry.id !== pendingTurnId));
      return null;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 20 || error.code === 'STREAM_INTERRUPTED') {
        if (error.code === 'STREAM_INTERRUPTED') {
          console.warn('[ORYX] Stream interrupted before final response');
        }
        setChatSession(prev => prev.map(entry => {
          if (entry.id === pendingTurnId) {
            return {
              ...entry,
              response: {
                ...entry.response,
                interrupted: true,
                statusPhase: undefined,
                answer: 'Solve Cancelled',
                explanation: 'This request was interrupted by a newer one.',
              }
            };
          }
          return entry;
        }));
        return null;
      }
      
      const code = String(error.code || error.status || '');
      const friendlyMsg = mapSolveErrorMessage(code, error.message);
      
      setChatSession(prev => prev.map(entry => {
        if (entry.id.startsWith('pending-')) {
          return {
            ...entry,
            response: {
              ...entry.response,
              answer: 'Solve Failed',
              explanation: friendlyMsg,
              statusPhase: undefined,
            }
          };
        }
        return entry;
      }));
      
      setSendError(friendlyMsg);
      setSendErrorCode(code);
      analytics.track('solve_failed', { code, message: error.message });
      
      if (code === 'LIMIT_EXCEEDED' || code === 'CREDIT_LIMIT_REACHED' || code === 'IMAGE_LIMIT_REACHED' || code === 'BULK_LIMIT_REACHED') {
        onLimitExceeded();
      }
      return null;
    } finally {
      setIsSending(false);
    }
  }, [isSending, lastSendTime, usage, chatSession, quotedStep, activeConversationId, onLimitExceeded, setUsage, setQuotedStep, clearInterruptedTurns]);

  return { isSending, sendError, sendErrorCode, chatSession, setChatSession, activeConversationId, setActiveConversationId, handleSend, clearSession, setSendError };
}
