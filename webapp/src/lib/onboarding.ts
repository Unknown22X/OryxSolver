import type { User } from '@supabase/supabase-js';

export type OnboardingGoal = 'ace_exams' | 'daily_homework' | 'learn_faster' | 'bulk_revision';
export type OnboardingMode = 'standard' | 'exam' | 'eli5';
export type OnboardingTheme = 'light' | 'dark' | 'system';

export type OnboardingMetadata = {
  onboarding_completed?: boolean;
  onboarding_completed_at?: string;
  onboarding_goal?: OnboardingGoal;
  onboarding_subjects?: string[];
  onboarding_mode?: OnboardingMode;
  onboarding_theme?: OnboardingTheme;
};

export type OnboardingPreferences = {
  goal: OnboardingGoal;
  subjects: string[];
  mode: OnboardingMode;
  theme: OnboardingTheme;
  completed: boolean;
};

function getMetadata(user: User | null | undefined): OnboardingMetadata {
  if (!user) return {};
  const metadata = (user.user_metadata ?? {}) as OnboardingMetadata;
  return metadata;
}

export function getOnboardingPreferences(user: User | null | undefined): OnboardingPreferences {
  const metadata = getMetadata(user);
  const goal = metadata.onboarding_goal;
  const mode = metadata.onboarding_mode;
  const theme = metadata.onboarding_theme;
  const subjects = Array.isArray(metadata.onboarding_subjects)
    ? metadata.onboarding_subjects.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  return {
    goal:
      goal === 'ace_exams' || goal === 'daily_homework' || goal === 'learn_faster' || goal === 'bulk_revision'
        ? goal
        : 'daily_homework',
    subjects,
    mode: mode === 'exam' || mode === 'eli5' || mode === 'standard' ? mode : 'standard',
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system',
    completed: hasCompletedOnboarding(user),
  };
}

export function getOnboardingStorageKey(userId: string) {
  return `oryx_onboarding_done_${userId}`;
}

export function hasCompletedOnboarding(user: User | null | undefined) {
  if (!user) return false;
  const metadata = getMetadata(user);
  if (metadata.onboarding_completed === true) return true;
  if (typeof metadata.onboarding_completed_at === 'string' && metadata.onboarding_completed_at.trim()) return true;

  try {
    return localStorage.getItem(getOnboardingStorageKey(user.id)) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingCompletedLocally(userId: string) {
  try {
    localStorage.setItem(getOnboardingStorageKey(userId), 'true');
  } catch {
    // Ignore storage failures and rely on auth metadata.
  }
}

export function clearOnboardingCompletedLocally(userId: string) {
  try {
    localStorage.removeItem(getOnboardingStorageKey(userId));
  } catch {
    // Ignore storage failures and rely on auth metadata.
  }
}
