// Simplistic basic DOM Extractor
// Intended to capture text from Canvas, Google Forms, Microsoft Forms, or user selection.
import { MSG_EXTRACT_PAGE_CONTEXT } from '../shared/messageTypes';
import { cleanAndNormalizeQuestion } from '../shared/mathCleanup';

/**
 * Math-aware text extraction from an element
 */
function getMathAwareText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // 1. MS Forms specific: Many math blocks have an aria-label that contains the clean math string (e.g. LaTeX or plain text)
  // We prioritize this as it is often much higher quality than the visual DOM.
  const mathBlocks = clone.querySelectorAll('[role="math"], .math-container, .mjx-chtml[aria-label], .MathJax[aria-label]');
  mathBlocks.forEach(block => {
    const label = block.getAttribute('aria-label');
    if (label && (label.includes('=') || label.includes('+') || label.includes('^') || /[a-z]\d/i.test(label))) {
      const span = document.createElement('span');
      span.textContent = ` ${label} `; 
      block.replaceWith(span);
    }
  });

  // 2. Handle MathJax/KaTeX annotations (LaTeX)
  const texNodes = clone.querySelectorAll('annotation[encoding="application/x-tex"], script[type="math/tex"]');
  texNodes.forEach(node => {
    const tex = node.textContent?.trim();
    if (tex) {
      // Find the outermost math container to replace
      const wrapper = node.closest('.katex, .MathJax, [data-automation-id="questionTitle"], .office-form-question-text');
      if (wrapper && wrapper.contains(node)) {
        const span = document.createElement('span');
        span.textContent = ` ${tex} `; // Wrap in spaces
        wrapper.replaceWith(span);
      }
    }
  });

  // 3. Preserve Superscripts and Subscripts
  clone.querySelectorAll('sup').forEach(sup => {
    if (!sup.textContent?.startsWith('^')) sup.prepend('^');
  });
  clone.querySelectorAll('sub').forEach(sub => {
    if (!sub.textContent?.startsWith('_')) sub.prepend('_');
  });

  // 4. Handle common fraction structures
  const fractions = clone.querySelectorAll('.fraction, [class*="fraction" i]');
  fractions.forEach(f => {
    const num = f.querySelector('.numerator, [class*="numerator" i]')?.textContent?.trim();
    const den = f.querySelector('.denominator, [class*="denominator" i]')?.textContent?.trim();
    if (num && den) {
      const span = document.createElement('span');
      span.textContent = `(${num})/(${den})`;
      f.replaceWith(span);
    }
  });

  // 5. Remove UI Noise BEFORE innerText extraction
  // This prevents capturing placeholders like "Enter your answer" or choice markers
  const noise = clone.querySelectorAll('.office-form-question-placeholder, [aria-placeholder], .meta-data, .office-form-question-textfield, .office-form-question-error');
  noise.forEach(n => n.remove());

  // Use innerText as it respects CSS layout/visibility better than textContent
  return (clone as HTMLElement).innerText || clone.textContent || '';
}

const domExtractorWindow = window as typeof window & { __oryxDomExtractorListenerReady?: boolean };
if (!domExtractorWindow.__oryxDomExtractorListenerReady) {
  domExtractorWindow.__oryxDomExtractorListenerReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MSG_EXTRACT_PAGE_CONTEXT) {
      const selection = window.getSelection();
      let rawText = '';

      if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        rawText = getMathAwareText(container);
      } else {
        // Microsoft Forms: Questions are in .office-form-question-text or [data-automation-id="questionTitle"]
        const msFormsQuestions = document.querySelectorAll('.office-form-question-text, [data-automation-id="questionTitle"], .question-title, .office-form-question-content');
        if (msFormsQuestions.length > 0) {
          // Join multiple titles if they exist (sometimes questions are split)
          rawText = Array.from(msFormsQuestions)
            .map(el => getMathAwareText(el as HTMLElement))
            .filter(Boolean)
            .join('\n\n');
        } else {
           // Canvas/Other fallbacks
           const fallbacks = document.querySelectorAll('.question_text, [role="heading"][aria-level="3"]');
           rawText = Array.from(fallbacks)
             .map(el => getMathAwareText(el as HTMLElement))
             .filter(Boolean)
             .join('\n\n');
        }
      }

      if (rawText) {
        const cleaned = cleanAndNormalizeQuestion(rawText);
        sendResponse({ ok: true, text: cleaned });
      } else {
        sendResponse({ ok: true, text: '' });
      }
      return true;
    }
  });
}
