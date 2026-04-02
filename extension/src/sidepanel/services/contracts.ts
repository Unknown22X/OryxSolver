import type { StyleMode } from '../types';

export type SolveRequest = {
  question: string;
  styleMode: StyleMode;
  images: (File | { url: string })[];
  language?: string;
  history?: Array<{ role: 'user' | 'model', text: string }>;
  conversationId?: string;
  quotedStep?: { text: string; index: number } | null;
  isBulk?: boolean;
};

export type SolveSuggestion = {
  label: string;
  prompt: string;
  styleMode?: StyleMode;
};

export type SolveResponse = {
  api_version: 'v1';
  ok: true;
  answer: string;
  explanation: string;
  steps: string[];
  usage: {
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
    stepQuestionsUsed?: number;
  };
  metadata: {
    model: string;
    aiMode: 'normal' | 'fast_fallback';
    styleMode: StyleMode;
    conversationId: string;
    isBulk?: boolean;
  };
  isBulk?: boolean;
  suggestions: SolveSuggestion[];
};

export type SolveStreamPhase =
  | 'auth'
  | 'preparing'
  | 'cache'
  | 'calling_ai'
  | 'refining'
  | 'finalizing';

export type SolveStatusEvent = {
  type: 'status';
  phase: SolveStreamPhase;
};

export type SolvePreviewEvent = {
  type: 'preview';
  answer: string;
  explanation?: string;
  steps?: string[];
};

export type SolveFinalEvent = {
  type: 'final';
  data: SolveResponse;
};

export type SolveErrorEvent = {
  type: 'error';
  code?: string;
  message: string;
};

export type SolveStreamEvent =
  | SolveStatusEvent
  | SolvePreviewEvent
  | SolveFinalEvent
  | SolveErrorEvent;

export type ApiError = {
  error?: string;
  code?: string;
};

export type HistoryEntry = {
  id: string;
  created_at: string;
  question: string;
  answer: string;
  explanation?: string | null;
  conversation_id?: string | null;
  style_mode?: StyleMode | string | null;
  image_urls?: string[];
  is_bulk?: boolean;
  steps?: string[];
};

export type HistoryListResponse = {
  api_version: 'v1';
  ok: true;
  entries: HistoryEntry[];
  nextCursor: string | null;
};
