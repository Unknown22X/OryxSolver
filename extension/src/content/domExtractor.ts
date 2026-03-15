// Simplistic basic DOM Extractor
// Intended to capture text from Canvas, Google Forms, Microsoft Forms, or user selection.
import { MSG_EXTRACT_PAGE_CONTEXT } from '../shared/messageTypes';

const domExtractorWindow = window as typeof window & { __oryxDomExtractorListenerReady?: boolean };
if (!domExtractorWindow.__oryxDomExtractorListenerReady) {
  domExtractorWindow.__oryxDomExtractorListenerReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MSG_EXTRACT_PAGE_CONTEXT) {
      const selection = window.getSelection()?.toString().trim();
      if (selection) {
        sendResponse({ ok: true, text: selection });
        return true;
      }

      // Microsoft Forms: Questions are in .office-form-question-text or [data-automation-id="questionTitle"]
      const msFormsQuestions = document.querySelectorAll('.office-form-question-text, [data-automation-id="questionTitle"], .question-title');
      if (msFormsQuestions.length > 0) {
        sendResponse({ ok: true, text: msFormsQuestions[0]?.textContent?.trim() || '' });
        return true;
      }

      // Canvas Quiz questions commonly have the class .question_text
      const canvasQuestions = document.querySelectorAll('.question_text');
      if (canvasQuestions.length > 0) {
        sendResponse({ ok: true, text: canvasQuestions[0]?.textContent?.trim() || '' });
        return true;
      }

      // Simple heuristic: Google Forms uses specific ARIA roles for questions
      const gFormsItems = document.querySelectorAll('[role="heading"][aria-level="3"]');
      if (gFormsItems.length > 0) {
         sendResponse({ ok: true, text: gFormsItems[0]?.textContent?.trim() || '' });
         return true;
      }

      // Default to empty if no prominent text could be found
      sendResponse({ ok: true, text: '' });
      return true;
    }
  });
}
