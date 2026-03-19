import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getFunctionUrl } from '../lib/functions';
import { broadcastUsageUpdated, requestUsageRefresh } from '../lib/usageEvents';
import type { User } from '@supabase/supabase-js';

interface SolveRequest {
  text: string;
  images?: File[];
  styleMode?: string;
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
  };
}

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
      for (const url of managedObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      managedObjectUrlsRef.current.clear();
    };
  }, []);

  const sendMessage = useCallback(async (request: SolveRequest): Promise<SolveResponse | null> => {
    if (!user) {
      setError('Please sign in to use Oryx');
      return null;
    }

    setIsSending(true);
    setError(null);
    const pendingId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      const formData = new FormData();
      formData.append('question', request.text);
      formData.append('style_mode', request.styleMode || 'standard');
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
        response: { answer: 'Thinking...', explanation: '' },
      };
      setChatSession((prev) => [...prev, pendingMessage]);

      const response = await fetch(getFunctionUrl('solve'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        requestUsageRefresh();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data: SolveResponse = await response.json();
      if (data.usage) {
        broadcastUsageUpdated(data.usage);
      }

      setChatSession((prev) =>
        prev.map((msg) =>
          msg.id === pendingId
            ? { ...msg, response: data, error: undefined }
            : msg,
        ),
      );

      return data;
    } catch (err) {
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
                },
              }
            : msg,
        ),
      );
      return null;
    } finally {
      setIsSending(false);
    }
  }, [user]);

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
