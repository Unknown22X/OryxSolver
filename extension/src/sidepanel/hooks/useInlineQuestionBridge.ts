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

function isOwnContentScriptSender(sender: chrome.runtime.MessageSender) {
  return (!sender.id || sender.id === chrome.runtime.id) && typeof sender.tab?.id === 'number';
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

async function normalizeInlineImages(urls: string[] = []) {
  return urls.map((url, idx) => {
    if (typeof url === 'string' && url.startsWith('data:image/')) {
      return dataUrlToFile(url, `inline-capture-${idx + 1}.png`) || { url };
    }
    return { url };
  });
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

export function useInlineQuestionBridge({
  handleSend,
  setInlineContextSnippet,
}: UseInlineQuestionBridgeOptions) {
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const processPendingQuestion = async (pending: PendingInlineQuestion | null) => {
      if (!pending) return;
      if (Date.now() - pending.timestamp >= 4000) return;

      const intentId = pending.injectionId || String(pending.timestamp);
      if (lastHandledRef.current === intentId) return;
      lastHandledRef.current = intentId;

      setInlineContextSnippet(pending.text.slice(0, 160));

      const normalizedImages = await normalizeInlineImages(pending.images);
      const result = await handleSend({
        text: pending.text,
        images: normalizedImages,
        styleMode: 'standard',
        isBulk: pending.isBulk,
      });

      if (
        pending.type === MSG_INLINE_SOLVE_AND_INJECT &&
        result?.answer &&
        pending.injectionId
      ) {
        await relayInlineSolveResult(pending.tabId, pending.injectionId, result).catch((error) => {
          console.warn('Failed to relay inline solve result:', error);
        });
      }
    };

    void takePendingInlineQuestion()
      .then(processPendingQuestion)
      .catch((error) => {
        console.warn('Failed to load pending inline question:', error);
      });

    const handleMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const payload =
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

      if (!payload || !isOwnContentScriptSender(sender) || !sender.tab?.id) {
        return;
      }

      if (
        payload.type !== MSG_INLINE_EXTRACT_QUESTION &&
        payload.type !== MSG_INLINE_SOLVE_AND_INJECT
      ) {
        return;
      }

      const pending = sanitizePendingInlineQuestion({
        type: payload.type,
        text: payload.payload?.text as string | undefined,
        images: payload.payload?.images as string[] | undefined,
        injectionId: payload.payload?.injectionId as string | undefined,
        isBulk: payload.payload?.isBulk === true,
        timestamp: Number(payload.payload?.timestamp ?? Date.now()),
        tabId: sender.tab.id,
      });

      if (!pending) {
        return;
      }

      void processPendingQuestion(pending);
      void clearPendingInlineQuestion().catch(() => {});
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [handleSend, setInlineContextSnippet]);
}
