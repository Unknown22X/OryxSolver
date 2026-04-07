import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchEdge, fetchEdgeStream } from '../lib/edge';
import { broadcastUsageUpdated } from '../lib/usageEvents';
import { compressImages } from '../lib/imageCompressor';
import { toPublicErrorMessage } from '../lib/supabaseAuth';
import type { User } from '@supabase/supabase-js';

interface SolveRequest {
  text: string;
  images?: File[];
  styleMode?: string;
  language?: string;
  surface?: 'webapp' | 'extension';
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  conversationId?: string;
  isBulk?: boolean;
}

interface SolveResponse {
  answer: string;
  explanation: string;
  steps?: string[];
  bulk_items?: Array<{
    index: number;
    label: string;
    question?: string;
    answer: string;
  }>;
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
    streamMode?: 'streamed' | 'fallback_full' | 'non_stream';
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
  | { type: 'delta'; text: string }
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
  const previewTimersRef = useRef<Map<string, number>>(new Map());

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
      for (const timer of previewTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      previewTimersRef.current.clear();
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
    if (request.surface) {
      formData.append('surface', request.surface);
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

  const clearPreviewTimer = useCallback((messageId: string) => {
    const timerId = previewTimersRef.current.get(messageId);
    if (typeof timerId === 'number') {
      window.clearTimeout(timerId);
      previewTimersRef.current.delete(messageId);
    }
  }, []);

  const animatePreviewAnswer = useCallback((
    messageId: string,
    answer: string,
    explanation = '',
    steps: string[] = [],
  ) => {
    clearPreviewTimer(messageId);
    const fullAnswer = answer.trim();
    if (!fullAnswer) {
      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                response: {
                  answer: fullAnswer,
                  explanation,
                  steps,
                  suggestions: [],
                  isPreview: true,
                  statusPhase: 'refining',
                },
              }
            : msg,
        ),
      );
      return;
    }

    let nextIndex = 0;
    const chunkSize = Math.max(1, Math.ceil(fullAnswer.length / 36));

    const tick = () => {
      nextIndex = Math.min(fullAnswer.length, nextIndex + chunkSize);
      const nextAnswer = fullAnswer.slice(0, nextIndex);

      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                response: {
                  answer: nextAnswer,
                  explanation,
                  steps,
                  suggestions: [],
                  isPreview: true,
                  statusPhase: 'refining',
                },
              }
            : msg,
        ),
      );

      if (nextIndex < fullAnswer.length) {
        const timerId = window.setTimeout(tick, 18);
        previewTimersRef.current.set(messageId, timerId);
      } else {
        previewTimersRef.current.delete(messageId);
      }
    };

    tick();
  }, [clearPreviewTimer]);

  const isStreamEvent = useCallback((value: unknown): value is SolveStreamEvent => {
    if (!value || typeof value !== 'object') return false;
    const event = value as { type?: unknown };
    return event.type === 'status' || event.type === 'preview' || event.type === 'delta' || event.type === 'final' || event.type === 'error';
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
        response: { answer: '', explanation: '', statusPhase: 'preparing' },
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
                      answer: msg.response.answer,
                    },
                  }
                : msg,
            ),
          );
          return;
        }

        if (event.type === 'delta') {
          setChatSession((prev) =>
            prev.map((msg) =>
              msg.id === pendingId
                ? {
                    ...msg,
                    response: {
                      ...msg.response,
                      answer: `${msg.response.answer || ''}${event.text}`,
                      explanation: '',
                      steps: [],
                      isPreview: true,
                      statusPhase: 'refining',
                    },
                  }
                : msg,
            ),
          );
          return;
        }

        if (event.type === 'preview') {
          animatePreviewAnswer(
            pendingId,
            event.answer,
            event.explanation || '',
            Array.isArray(event.steps) ? event.steps : [],
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

      const requestFullResponse = () =>
        fetchEdge<SolveResponse>('solve', {
          method: 'POST',
          body: buildFormData(requestForUpload, false),
          signal: abortControllerRef.current?.signal,
        });

      const data = request.isBulk
        ? await requestFullResponse()
        : await (async () => {
            try {
              const response = await fetchEdgeStream('solve', {
                method: 'POST',
                body: buildFormData(requestForUpload, true),
                signal: abortControllerRef.current?.signal,
              });
              if (!response.body) {
                throw Object.assign(new Error('Streaming solve returned no body.'), { code: 'STREAM_INTERRUPTED' });
              }
              return await parseNdjsonStream(response.body);
            } catch (streamError) {
              const code = streamError instanceof Error && 'code' in streamError
                ? String((streamError as Error & { code?: string }).code || '')
                : '';
              const shouldFallback =
                code === 'STREAM_INTERRUPTED' ||
                code === 'AI_STREAM_INTERRUPTED' ||
                code === 'AI_TIMEOUT' ||
                code === 'AI_PROVIDER_ERROR';

              if (!shouldFallback) {
                throw streamError;
              }

              setChatSession((prev) =>
                prev.map((msg) =>
                  msg.id === pendingId
                    ? {
                        ...msg,
                        response: {
                          ...msg.response,
                          answer: msg.response.answer || 'Finishing response...',
                          explanation: '',
                          steps: [],
                          statusPhase: 'refining',
                        },
                      }
                    : msg,
                ),
              );
              return await requestFullResponse();
            }
          })();

      if (data.usage) {
        broadcastUsageUpdated(data.usage);
      }

      const formattedBulkAnswer = Array.isArray(data.bulk_items) && data.bulk_items.length > 0
        ? data.bulk_items
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((item) => `${item.label}. ${item.answer}`.trim())
            .join('\n')
        : data.answer;

      clearPreviewTimer(pendingId);
      clearInterruptedMessages();
      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? { ...msg, response: { ...data, answer: formattedBulkAnswer, isPreview: false }, error: undefined }
            : msg,
        ),
      );

      return { ...data, answer: formattedBulkAnswer };
    } catch (err) {
      clearPreviewTimer(pendingId);
      if (err instanceof Error && err.name === 'AbortError') {
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

      const errorMessage = toPublicErrorMessage(err, 'Failed to send message');
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
  }, [animatePreviewAnswer, buildFormData, clearInterruptedMessages, clearPreviewTimer, isStreamEvent, user]);

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
