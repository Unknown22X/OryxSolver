import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  clearPendingInlineQuestion,
  sanitizePendingInlineQuestion,
  takePendingInlineQuestion,
  type PendingInlineQuestion,
} from '../../shared/inlineQuestionStore';
import {
  MSG_INLINE_EXTRACT_QUESTION,
  MSG_INLINE_SOLVE_AND_INJECT,
  MSG_INLINE_SOLVE_RESULT,
  MSG_INLINE_QUESTION_READY,
} from '../../shared/messageTypes';
import type { StyleMode } from '../types';

type SendResult = { answer: string; explanation: string; steps?: string[] } | null;

type UseInlineQuestionBridgeOptions = {
  handleSend: (payload: {
    text: string;
    images: (File | { url: string })[];
    styleMode: StyleMode;
    isBulk?: boolean;
  }) => Promise<SendResult>;
  setInlineContextSnippet: Dispatch<SetStateAction<string | null>>;
};

const MAX_PENDING_INLINE_AGE_MS = 2 * 60 * 1000;

function isOwnContentScriptSender(sender: chrome.runtime.MessageSender) {
  return (!sender.id || sender.id === chrome.runtime.id) && typeof sender.tab?.id === 'number';
}

function isOwnExtensionSender(sender: chrome.runtime.MessageSender) {
  return !sender.id || sender.id === chrome.runtime.id;
}

function dataUrlToFile(dataUrl: string, filename = 'capture.png'): File | null {
  try {
    const [meta, b64] = dataUrl.split(',');
    if (!meta || !b64) return null;
    const mimeMatch = meta.match(/data:(.*?);base64/);
    const mime = mimeMatch?.[1] || 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

/**
 * Tries to fetch an https:// image URL and convert it to a File so the
 * backend can receive it as a direct upload instead of a remote URL fetch.
 * This avoids CORS/403 failures for images hosted on LMS platforms.
 * Falls back to { url } if the fetch fails (e.g. timed out, not an image).
 */
async function fetchUrlToFile(url: string, idx: number): Promise<File | { url: string }> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return { url };
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return { url };
    const blob = await resp.blob();
    if (blob.size > 5 * 1024 * 1024) return { url }; // skip if > 5 MB
    return new File([blob], `page-image-${idx + 1}.${blob.type.split('/')[1] || 'png'}`, {
      type: blob.type || 'image/png',
    });
  } catch {
    return { url };
  }
}

/**
 * Normalizes image strings from the inline store into the (File | {url}) format
 * expected by handleSend / useSolve.
 *
 * - data: URLs → File (direct base64 upload, avoids URL round-trip)
 * - https:// URLs → attempted client-side fetch → File; falls back to {url}
 *   Fetching here works because the extension sidepanel has cross-origin access.
 */
async function normalizeInlineImages(urls: string[] = []): Promise<(File | { url: string })[]> {
  const results = await Promise.all(
    urls.map(async (url, idx) => {
      if (!url || typeof url !== 'string') return null;

      if (url.startsWith('data:image/')) {
        return dataUrlToFile(url, `inline-capture-${idx + 1}.png`) || { url };
      }

      if (/^https?:\/\//i.test(url)) {
        return fetchUrlToFile(url, idx);
      }

      return null;
    }),
  );

  return results.filter((item): item is File | { url: string } => item !== null);
}

async function relayInlineSolveResult(
  tabId: number,
  injectionId: string,
  result: NonNullable<SendResult>,
) {
  await chrome.tabs.sendMessage(tabId, {
    type: MSG_INLINE_SOLVE_RESULT,
    payload: {
      injectionId,
      answer: result.answer,
      explanation: result.explanation,
      steps: result.steps
    },
  });
}

async function relayInlineSolveFailure(tabId: number, injectionId: string, explanation: string) {
  await chrome.tabs.sendMessage(tabId, {
    type: MSG_INLINE_SOLVE_RESULT,
    payload: {
      injectionId,
      answer: 'Solve Failed',
      explanation,
      steps: [],
    },
  });
}

export function useInlineQuestionBridge({
  handleSend,
  setInlineContextSnippet,
}: UseInlineQuestionBridgeOptions) {
  const lastHandledRef = useRef<string | null>(null);
  // Keep a stable ref to avoid stale closures inside the message listener.
  const handleSendRef = useRef(handleSend);
  const setSnippetRef = useRef(setInlineContextSnippet);
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);
  useEffect(() => { setSnippetRef.current = setInlineContextSnippet; }, [setInlineContextSnippet]);

  useEffect(() => {
    const processPendingQuestion = async (pending: PendingInlineQuestion | null) => {
      if (!pending) return;
      if (Date.now() - pending.timestamp >= MAX_PENDING_INLINE_AGE_MS) return;

      const intentId = pending.injectionId || String(pending.timestamp);
      if (lastHandledRef.current === intentId) return;
      lastHandledRef.current = intentId;

      setSnippetRef.current(pending.text.slice(0, 160));

      const normalizedImages = await normalizeInlineImages(pending.images);
      const result = await handleSendRef.current({
        text: pending.text,
        images: normalizedImages,
        styleMode: 'standard',
        isBulk: pending.isBulk,
      });

      if (
        pending.type === MSG_INLINE_SOLVE_AND_INJECT &&
        pending.injectionId
      ) {
        if (result?.answer) {
          await relayInlineSolveResult(pending.tabId, pending.injectionId, result).catch((error) => {
            console.warn('Failed to relay inline solve result:', error);
          });
        } else {
          await relayInlineSolveFailure(
            pending.tabId,
            pending.injectionId,
            'Could not start or complete this solve. Please try again.',
          ).catch((error) => {
            console.warn('Failed to relay inline solve failure:', error);
          });
        }
      }
    };

    // On mount: consume any question saved to storage before this panel opened.
    void takePendingInlineQuestion()
      .then(processPendingQuestion)
      .catch((error) => {
        console.warn('Failed to load pending inline question:', error);
      });

    const handleMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const msg =
        typeof message === 'object' && message !== null
          ? (message as {
              type?: string;
              payload?: {
                text?: unknown;
                images?: unknown;
                injectionId?: unknown;
                isBulk?: unknown;
                timestamp?: unknown;
              };
            })
          : null;

      if (!msg) return;

      // ── Path A: Background notified us that a new question is in storage ──
      // (fires when the sidepanel is already open and a new inline solve comes in)
      if (msg.type === MSG_INLINE_QUESTION_READY && isOwnExtensionSender(sender) && !sender.tab) {
        void takePendingInlineQuestion()
          .then(processPendingQuestion)
          .catch((error) => {
            console.warn('Failed to load pending inline question on notify:', error);
          });
        return;
      }

      // ── Path B: Direct message from a content script ──
      // (rare race path — normally background intercepts first)
      if (
        !isOwnContentScriptSender(sender) ||
        !sender.tab?.id ||
        (msg.type !== MSG_INLINE_EXTRACT_QUESTION && msg.type !== MSG_INLINE_SOLVE_AND_INJECT)
      ) {
        return;
      }

      const pending = sanitizePendingInlineQuestion({
        type: msg.type,
        text: msg.payload?.text as string | undefined,
        images: msg.payload?.images as string[] | undefined,
        injectionId: msg.payload?.injectionId as string | undefined,
        isBulk: msg.payload?.isBulk === true,
        timestamp: Number(msg.payload?.timestamp ?? Date.now()),
        tabId: sender.tab.id,
      });

      if (!pending) return;

      void processPendingQuestion(pending);
      void clearPendingInlineQuestion().catch(() => {});
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  // Only re-run on mount/unmount — refs keep handleSend/setSnippet current.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
