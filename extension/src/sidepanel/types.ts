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
};

export type SendPayload = {
  text: string;
  images: (File | { url: string })[];
  styleMode: StyleMode;
};

export type AuthView = 'sign-in' | 'sign-up';
export type AuthMethod = 'password' | 'code';

export type UsageSnapshot = {
  subscriptionTier: 'free' | 'pro';
  subscriptionStatus: 'active' | 'inactive' | 'canceled';
  totalCredits: number;
  usedCredits: number;
  monthlyImagesUsed: number;
  monthlyImagesLimit: number;
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
