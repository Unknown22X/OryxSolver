// Simplistic basic DOM Extractor
// Intended to capture text from Canvas, Google Forms, or user selection.

const domExtractorWindow = window as typeof window & { __oryxDomExtractorListenerReady?: boolean };
if (!domExtractorWindow.__oryxDomExtractorListenerReady) {
  domExtractorWindow.__oryxDomExtractorListenerReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'EXTRACT_PAGE_CONTEXT') {
      const selection = window.getSelection()?.toString().trim();
      if (selection) {
        sendResponse({ ok: true, text: selection });
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
