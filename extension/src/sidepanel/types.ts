export type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

export type AiSuggestion = {
  label: string;
  prompt: string;
  styleMode?: StyleMode;
};

export type AiResponse = {
  answer: string;
  explanation: string;
  steps?: string[];
  suggestions?: AiSuggestion[];
  isPreview?: boolean;
  statusPhase?: 'auth' | 'preparing' | 'cache' | 'calling_ai' | 'refining' | 'finalizing';
  interrupted?: boolean;
};

export type SendPayload = {
  text: string;
  images: (File | { url: string })[];
  styleMode: StyleMode;
};

export type AuthView = 'sign-in' | 'sign-up' | 'forgot-password';
export type AuthMethod = 'password' | 'code';

export type UsageSnapshot = {
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
  stepQuestionsUsed: number;
};

export type UpgradeMoment = {
  level: 'soft' | 'strong' | 'paywall' | null;
  percent: number;
  title: string;
  message: string;
};

export type ChatTurn = {
  id: string;
  question: string;
  response: AiResponse;
  images?: string[];
  isBulk?: boolean;
};
