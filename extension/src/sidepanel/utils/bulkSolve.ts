import { postSolveRequest } from '../services/solveApi';
import type { StyleMode } from '../types';

export interface BulkSolveOptions {
  text: string;
  images: (File | { url: string })[];
  styleMode: StyleMode;
  language: string;
  token: string;
  signal?: AbortSignal;
  onProgress?: (progressText: string) => void;
}

export async function executeBulkSolveChunked({
  text,
  images,
  styleMode,
  language,
  token,
  signal,
  onProgress,
}: BulkSolveOptions): Promise<{ answer: string; explanation: string }> {
  const questionBlocks = text.split(/QUESTION\s+\d+:/i).filter((b) => b.trim().length > 5);

  const formatBulkItems = (
    items: Array<{ index: number; label: string; answer: string }> | undefined,
    fallbackAnswer: string,
  ) => {
    if (Array.isArray(items) && items.length > 0) {
      return items
        .sort((a, b) => a.index - b.index)
        .map((item) => `${item.label}. ${item.answer}`.trim())
        .join('\n');
    }
    return fallbackAnswer.trim();
  };

  if (questionBlocks.length <= 5) {
    // If 5 or fewer, solve safely in one shot
    const response = await postSolveRequest(
      token,
      {
        question: text,
        styleMode,
        images,
        language,
        surface: 'extension',
        history: [],
        isBulk: true,
      },
      { signal }
    );
    return {
      answer: formatBulkItems(response.bulk_items, response.answer || response.explanation || ''),
      explanation: response.explanation,
    };
  }

  let combinedAnswer = '';
  let combinedExplanation = '';
  const chunkSize = 5;

  for (let i = 0; i < questionBlocks.length; i += chunkSize) {
    const chunk = questionBlocks.slice(i, i + chunkSize);
    const chunkText = `I need an answer key for the following questions. Provide a clear, numbered list of ONLY the final answers. No steps or reasoning.\n\nQuestions:\n${chunk.map((q, idx) => `QUESTION ${i + idx + 1}:\n${q.trim()}`).join('\n\n')}`;

    if (onProgress) {
      onProgress(`Solving Questions ${i + 1}-${Math.min(i + chunkSize, questionBlocks.length)}...`);
    }

    try {
      const runChunk = () => postSolveRequest(
        token,
        {
          question: chunkText,
          styleMode,
          images,
          language,
          surface: 'extension',
          history: [],
          isBulk: true,
        },
        { signal }
      );

      let chunkResponse = await runChunk();
      const chunkItems = Array.isArray(chunkResponse.bulk_items) ? chunkResponse.bulk_items : [];
      if (chunkItems.length > 0 && chunkItems.length !== chunk.length) {
        chunkResponse = await runChunk();
      }

      combinedAnswer += (combinedAnswer ? '\n' : '') + formatBulkItems(chunkResponse.bulk_items, chunkResponse.answer || chunkResponse.explanation || '');
      combinedExplanation += (combinedExplanation ? '\n\n' : '') + (chunkResponse.explanation || '');
    } catch (chunkError) {
      console.warn(`Bulk chunk ${i / chunkSize} failed:`, chunkError);
      combinedAnswer +=
        (combinedAnswer ? '\n' : '') +
        `[Failed to solve questions ${i + 1}-${Math.min(i + chunkSize, questionBlocks.length)}]`;
    }

    // Add a small delay between chunks to stay within server rate limits
    if (i + chunkSize < questionBlocks.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return { answer: combinedAnswer, explanation: combinedExplanation };
}
