import { supabase } from './supabase';

export type FeedbackKind = 'general' | 'bug_report' | 'answer_quality' | 'feature_request';
export type AnswerFeedbackOutcome = 'correct' | 'incorrect';

export type FeedbackInput = {
  userId: string;
  rating: number;
  comment: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown> & {
    kind?: FeedbackKind;
    answerOutcome?: AnswerFeedbackOutcome;
  };
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const rating = Number(input.rating);
  const comment = input.comment.trim();
  const conversationId = input.conversationId?.trim() || null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Choose a rating from 1 to 5.');
  }

  if (comment.length < 8) {
    throw new Error('Feedback must be at least 8 characters long.');
  }

  if (comment.length > 2000) {
    throw new Error('Feedback is too long.');
  }

  if (conversationId && !isUuid(conversationId)) {
    throw new Error('Invalid conversation reference.');
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: input.userId,
    rating,
    comment,
    conversation_id: conversationId,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}

export async function submitAnswerFeedback(input: {
  userId: string;
  conversationId?: string | null;
  wasCorrect: boolean;
  comment?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const details = input.comment?.trim();
  const baseComment = input.wasCorrect
    ? 'User confirmed this answer was correct.'
    : 'User reported this answer needs work.';

  await submitFeedback({
    userId: input.userId,
    conversationId: input.conversationId,
    rating: input.wasCorrect ? 5 : 2,
    comment: details ? `${baseComment} ${details}` : baseComment,
    metadata: {
      ...(input.metadata ?? {}),
      kind: 'answer_quality',
      answerOutcome: input.wasCorrect ? 'correct' : 'incorrect',
    },
  });
}

export async function submitBugReport(input: {
  userId: string;
  subject: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const subject = input.subject.trim();
  const description = input.description.trim();

  if (subject.length < 4) {
    throw new Error('Add a short bug title.');
  }

  if (subject.length > 120) {
    throw new Error('Bug title is too long.');
  }

  if (description.length < 12) {
    throw new Error('Describe the bug in a bit more detail.');
  }

  await submitFeedback({
    userId: input.userId,
    rating: 2,
    comment: `Bug report: ${subject}. ${description}`,
    metadata: {
      ...(input.metadata ?? {}),
      kind: 'bug_report',
      subject,
    },
  });
}

export async function submitFeatureRequest(input: {
  userId: string;
  featureId: string;
  featureLabel: string;
  comment?: string;
}): Promise<void> {
  const featureId = input.featureId.trim().toLowerCase();
  const featureLabel = input.featureLabel.trim();
  const comment = input.comment?.trim();

  if (!/^[a-z0-9_-]{2,48}$/i.test(featureId)) {
    throw new Error('Invalid feature request.');
  }

  if (!featureLabel) {
    throw new Error('Feature name is required.');
  }

  await submitFeedback({
    userId: input.userId,
    rating: 5,
    comment: comment ? `Feature request: ${featureLabel}. ${comment}` : `Feature request: ${featureLabel}.`,
    metadata: {
      kind: 'feature_request',
      featureId,
      featureLabel,
      surface: 'webapp',
    },
  });
}
