export type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';

export type AiSuggestion = {
  label: string;
  prompt: string;
  styleMode?: StyleMode;
};

export type AiResponse = {
  answer: string;
  explanation: string;
  suggestions?: AiSuggestion[];
};

export type SendPayload = {
  text: string;
  images: File[];
  styleMode: StyleMode;
};
