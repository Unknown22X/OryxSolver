import type { StyleMode } from '../types';

export type SolveRequest = {
  question: string;
  styleMode: StyleMode;
  images: File[];
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
    subscriptionTier: 'free' | 'pro';
    subscriptionStatus: 'active' | 'inactive' | 'canceled';
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    monthlyImagesUsed: number;
    monthlyImagesLimit: number;
  };
  metadata: {
    model: string;
    aiMode: 'normal' | 'fast_fallback';
    styleMode: StyleMode;
  };
  suggestions: SolveSuggestion[];
};

export type ApiError = {
  error?: string;
  code?: string;
};
