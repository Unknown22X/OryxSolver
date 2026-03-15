export type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

export type SolveUsage = {
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'active' | 'inactive' | 'canceled';
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
};

export type SolveMetadata = {
  model: string;
  aiMode: 'normal' | 'fast_fallback';
  styleMode: StyleMode;
  conversationId: string;
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
};

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
};

export type HistoryListResponse = {
  api_version: 'v1';
  ok: true;
  entries: HistoryEntry[];
  nextCursor: string | null;
};
