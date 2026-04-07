export type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

export type SolveUsage = {
  subscriptionTier: 'free' | 'pro' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'canceled' | 'trialing' | 'past_due';
  monthlyQuestionsUsed: number;
  monthlyQuestionsLimit: number;
  monthlyQuestionsRemaining: number;
  stepQuestionsUsed?: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
  monthlyBulkUsed: number;
  monthlyBulkLimit: number;
  paygoCreditsRemaining?: number;
};

export type SolveMetadata = {
  model: string;
  aiMode: 'normal' | 'fast_fallback';
  styleMode: StyleMode;
  conversationId: string;
  isBulk?: boolean;
  isFollowUp?: boolean;
  streamMode?: 'streamed' | 'fallback_full' | 'non_stream';
};

export type BulkSolveItem = {
  index: number;
  label: string;
  question?: string;
  answer: string;
};

export type SolveSuggestion = {
  label: string;
  prompt: string;
  styleMode?: StyleMode;
};

export type SolveSuccessResponse = {
  api_version: 'v1';
  ok: true;
  answer: string;
  explanation: string;
  steps: string[];
  usage: SolveUsage;
  metadata: SolveMetadata;
  suggestions: SolveSuggestion[];
  bulk_items?: BulkSolveItem[];
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

export type SolveDeltaEvent = {
  type: 'delta';
  text: string;
};

export type SolveFinalEvent = {
  type: 'final';
  data: SolveSuccessResponse;
};

export type SolveErrorEvent = {
  type: 'error';
  code?: string;
  message: string;
};

export type SolveStreamEvent =
  | SolveStatusEvent
  | SolvePreviewEvent
  | SolveDeltaEvent
  | SolveFinalEvent
  | SolveErrorEvent;

export type ErrorResponse = {
  error: string;
  code: string;
  details?: unknown;
};

export type SaveHistoryRequest = {
  question: string;
  answer: string;
  source?: string;
};

export type SaveHistoryResponse = {
  api_version: 'v1';
  ok: true;
  saved: boolean;
  id: string | null;
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
  bulk_items?: BulkSolveItem[];
};

export type HistoryListResponse = {
  api_version: 'v1';
  ok: true;
  entries: HistoryEntry[];
  nextCursor: string | null;
};
