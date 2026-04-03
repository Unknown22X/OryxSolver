import {
  MSG_INLINE_EXTRACT_QUESTION,
  MSG_INLINE_SOLVE_AND_INJECT,
} from './messageTypes';

const PENDING_INLINE_QUESTION_KEY = 'pendingInlineQuestion';
const MAX_INLINE_TEXT_CHARS = 2600;

export type PendingInlineQuestionType =
  | typeof MSG_INLINE_EXTRACT_QUESTION
  | typeof MSG_INLINE_SOLVE_AND_INJECT;

export type PendingInlineQuestion = {
  type: PendingInlineQuestionType;
  text: string;
  images: string[];
  injectionId?: string;
  isBulk?: boolean;
  timestamp: number;
  tabId: number;
};

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>;

function getStorageArea(): StorageAreaLike {
  return chrome.storage.session ?? chrome.storage.local;
}

function sanitizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .slice(0, 8);
}

function isPendingInlineQuestionType(value: unknown): value is PendingInlineQuestionType {
  return value === MSG_INLINE_EXTRACT_QUESTION || value === MSG_INLINE_SOLVE_AND_INJECT;
}

export function sanitizePendingInlineQuestion(
  value: Partial<PendingInlineQuestion> | null | undefined,
): PendingInlineQuestion | null {
  if (!value || !isPendingInlineQuestionType(value.type)) return null;

  const text = String(value.text ?? '').trim().slice(0, MAX_INLINE_TEXT_CHARS);
  const tabId = Number(value.tabId);
  const timestamp = Number(value.timestamp ?? Date.now());

  if (!text || !Number.isInteger(tabId) || tabId < 0) {
    return null;
  }

  return {
    type: value.type,
    text,
    images: sanitizeImages(value.images),
    injectionId:
      typeof value.injectionId === 'string' && value.injectionId.trim()
        ? value.injectionId.trim()
        : undefined,
    isBulk: value.isBulk === true,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    tabId,
  };
}

export async function savePendingInlineQuestion(value: PendingInlineQuestion): Promise<void> {
  const payload = sanitizePendingInlineQuestion(value);
  if (!payload) {
    throw new Error('Invalid inline question payload.');
  }

  await getStorageArea().set({ [PENDING_INLINE_QUESTION_KEY]: payload });
}

export async function readPendingInlineQuestion(): Promise<PendingInlineQuestion | null> {
  const result = await getStorageArea().get(PENDING_INLINE_QUESTION_KEY);
  return sanitizePendingInlineQuestion(result[PENDING_INLINE_QUESTION_KEY] as PendingInlineQuestion | undefined);
}

export async function clearPendingInlineQuestion(): Promise<void> {
  await getStorageArea().remove(PENDING_INLINE_QUESTION_KEY);
}

export async function takePendingInlineQuestion(): Promise<PendingInlineQuestion | null> {
  const payload = await readPendingInlineQuestion();
  if (payload) {
    await clearPendingInlineQuestion();
  }
  return payload;
}
