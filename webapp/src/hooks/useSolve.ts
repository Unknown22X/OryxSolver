import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchEdge, fetchEdgeStream } from '../lib/edge';
import { broadcastUsageUpdated } from '../lib/usageEvents';
import { compressImages } from '../lib/imageCompressor';
import type { User } from '@supabase/supabase-js';

interface SolveRequest {
  text: string;
  images?: File[];
  styleMode?: string;
  language?: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  conversationId?: string;
  isBulk?: boolean;
}

interface SolveResponse {
  answer: string;
  explanation: string;
  steps?: string[];
  suggestions?: Array<{ label: string; prompt: string; styleMode: string }>;
  usage?: {
    subscriptionTier: 'free' | 'pro' | 'premium';
    subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
    monthlyQuestionsUsed: number;
    monthlyQuestionsLimit: number;
    monthlyQuestionsRemaining: number;
    monthlyImagesUsed: number;
    monthlyImagesLimit: number;
    monthlyBulkUsed: number;
    monthlyBulkLimit: number;
    paygoCreditsRemaining?: number;
  };
  metadata?: {
    conversationId?: string;
    model?: string;
    aiMode?: 'normal' | 'fast_fallback';
    styleMode?: string;
    isBulk?: boolean;
    isFollowUp?: boolean;
  };
  isPreview?: boolean;
  statusPhase?: SolveStreamPhase;
  interrupted?: boolean;
}

type SolveStreamPhase =
  | 'auth'
  | 'preparing'
  | 'cache'
  | 'calling_ai'
  | 'refining'
  | 'finalizing';

type SolveStreamEvent =
  | { type: 'status'; phase: SolveStreamPhase }
  | { type: 'preview'; answer: string; explanation?: string; steps?: string[] }
  | { type: 'final'; data: SolveResponse }
  | { type: 'error'; code?: string; message: string };

interface ChatMessage {
  id: string;
  question: string;
  images?: string[];
  isBulk?: boolean;
  response: SolveResponse;
  error?: string;
}

interface UseSolveReturn {
  isSending: boolean;
  error: string | null;
  chatSession: ChatMessage[];
  sendMessage: (request: SolveRequest) => Promise<SolveResponse | null>;
  clearSession: () => void;
  setSession: (session: ChatMessage[]) => void;
}

export function useSolve(user: User | null): UseSolveReturn {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatMessage[]>([]);
  const managedObjectUrlsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stillUsed = new Set<string>();
    for (const message of chatSession) {
      for (const image of message.images ?? []) {
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
      abortControllerRef.current?.abort();
      for (const url of managedObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      managedObjectUrlsRef.current.clear();
    };
  }, []);

  const clearInterruptedMessages = useCallback(() => {
    setChatSession((prev) => prev.filter((message) => !message.response?.interrupted));
  }, []);

  const buildFormData = useCallback((request: SolveRequest, stream = false) => {
    const formData = new FormData();
    formData.append('question', request.text);
    formData.append('style_mode', request.styleMode || 'standard');
    if (stream) {
      formData.append('stream', 'true');
    }
    if (request.language) {
      formData.append('language', request.language);
    }
    if (request.history && request.history.length > 0) {
      formData.append('history', JSON.stringify(request.history));
    }
    if (request.conversationId) {
      formData.append('conversation_id', request.conversationId);
    }
    if (request.isBulk) {
      formData.append('is_bulk', 'true');
    }
    if (request.images && request.images.length > 0) {
      request.images.forEach((image, index) => {
        formData.append('images', image, image.name || `image_${index}`);
      });
    }
    return formData;
  }, []);

  const isStreamEvent = useCallback((value: unknown): value is SolveStreamEvent => {
    if (!value || typeof value !== 'object') return false;
    const event = value as { type?: unknown };
    return event.type === 'status' || event.type === 'preview' || event.type === 'final' || event.type === 'error';
  }, []);

  const sendMessage = useCallback(async (request: SolveRequest): Promise<SolveResponse | null> => {
    if (!user) {
      setError('Please sign in to use Oryx');
      return null;
    }

    setIsSending(true);
    setError(null);
    abortControllerRef.current?.abort();
    clearInterruptedMessages();
    abortControllerRef.current = new AbortController();
    const pendingId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const previewImages = request.images?.map((image) => {
        const objectUrl = URL.createObjectURL(image);
        managedObjectUrlsRef.current.add(objectUrl);
        return objectUrl;
      });

      const pendingMessage: ChatMessage = {
        id: pendingId,
        question: request.text,
        images: previewImages,
        isBulk: request.isBulk,
        response: { answer: 'Thinking...', explanation: '', statusPhase: 'preparing' },
      };
      setChatSession((prev) => [...prev, pendingMessage]);

      const applyStreamEvent = (event: SolveStreamEvent) => {
        if (event.type === 'status') {
          setChatSession((prev) =>
            prev.map((msg) =>
              msg.id === pendingId
                ? {
                    ...msg,
                    response: {
                      ...msg.response,
                      statusPhase: event.phase,
                      answer: msg.response.isPreview ? msg.response.answer : 'Thinking...',
                    },
                  }
                : msg,
            ),
          );
          return;
        }

        if (event.type === 'preview') {
          setChatSession((prev) =>
            prev.map((msg) =>
              msg.id === pendingId
                ? {
                    ...msg,
                    response: {
                      answer: event.answer,
                      explanation: event.explanation || '',
                      steps: Array.isArray(event.steps) ? event.steps : [],
                      suggestions: [],
                      isPreview: true,
                      statusPhase: 'refining',
                    },
                  }
                : msg,
            ),
          );
        }
      };

      const parseNdjsonStream = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResponse: SolveResponse | null = null;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed: unknown = JSON.parse(trimmed);
                if (!isStreamEvent(parsed)) {
                  console.warn('[webapp] Ignoring malformed stream event shape');
                  continue;
                }
                applyStreamEvent(parsed);
                if (parsed.type === 'error') {
                  const streamError = new Error(parsed.message) as Error & { code?: string };
                  streamError.code = parsed.code;
                  throw streamError;
                }
                if (parsed.type === 'final') {
                  finalResponse = parsed.data;
                }
              } catch (streamError) {
                if (streamError instanceof Error && 'code' in streamError) {
                  throw streamError;
                }
                console.warn('[webapp] Ignoring malformed NDJSON line', streamError);
              }
            }
          }

          const trailing = buffer.trim();
          if (trailing) {
            try {
              const parsed: unknown = JSON.parse(trailing);
              if (!isStreamEvent(parsed)) {
                console.warn('[webapp] Ignoring malformed trailing stream event shape');
              } else {
                applyStreamEvent(parsed);
                if (parsed.type === 'error') {
                  const streamError = new Error(parsed.message) as Error & { code?: string };
                  streamError.code = parsed.code;
                  throw streamError;
                }
                if (parsed.type === 'final') {
                  finalResponse = parsed.data;
                }
              }
            } catch (streamError) {
              if (streamError instanceof Error && 'code' in streamError) {
                throw streamError;
              }
              console.warn('[webapp] Ignoring malformed trailing NDJSON line', streamError);
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (!finalResponse) {
          const interruptedError = new Error('Streaming solve ended before final response.') as Error & { code?: string };
          interruptedError.code = 'STREAM_INTERRUPTED';
          throw interruptedError;
        }

        return finalResponse;
      };

      const uploadImages =
        request.images && request.images.length > 0
          ? await compressImages(request.images)
          : request.images;

      const requestForUpload: SolveRequest = {
        ...request,
        images: uploadImages,
      };

      const data = request.isBulk
        ? await fetchEdge<SolveResponse>('solve', {
            method: 'POST',
            body: buildFormData(requestForUpload, false),
            signal: abortControllerRef.current.signal,
          })
        : await (async () => {
            const response = await fetchEdgeStream('solve', {
              method: 'POST',
              body: buildFormData(requestForUpload, true),
              signal: abortControllerRef.current?.signal,
            });
            if (!response.body) {
              throw new Error('Streaming solve returned no body.');
            }
            return parseNdjsonStream(response.body);
          })();

      if (data.usage) {
        broadcastUsageUpdated(data.usage);
      }

      clearInterruptedMessages();
      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? { ...msg, response: { ...data, isPreview: false }, error: undefined }
            : msg,
        ),
      );

      return data;
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as Error & { code?: string }).code || '') : '';
      if (err instanceof Error && (err.name === 'AbortError' || code === 'STREAM_INTERRUPTED')) {
        if (code === 'STREAM_INTERRUPTED') {
          console.warn('[webapp] Stream interrupted before final response');
        }
        setChatSession((prev) =>
          prev.map((msg) =>
            msg.id === pendingId
              ? {
                  ...msg,
                  response: {
                    ...msg.response,
                    answer: 'Solve Cancelled',
                    explanation: 'This request was interrupted by a newer one.',
                    interrupted: true,
                    statusPhase: undefined,
                  },
                }
              : msg,
          ),
        );
        return null;
      }

      const errorMessage = (err as Error).message || 'Failed to send message';
      setError(errorMessage);
      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                error: errorMessage,
                response: {
                  answer: '',
                  explanation: '',
                  steps: [],
                  suggestions: [],
                  statusPhase: undefined,
                },
              }
            : msg,
        ),
      );
      return null;
    } finally {
      setIsSending(false);
    }
  }, [buildFormData, clearInterruptedMessages, isStreamEvent, user]);

  const clearSession = useCallback(() => {
    setChatSession([]);
    setError(null);
  }, []);

  const setSession = useCallback((session: ChatMessage[]) => {
    setChatSession(session);
  }, []);

  return {
    isSending,
    error,
    chatSession,
    sendMessage,
    clearSession,
    setSession,
  };
}
