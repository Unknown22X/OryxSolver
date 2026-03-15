// Injection logic for identifying questions on popular platforms and injecting the Oryx Logo inline.
import katex from 'katex';
import {
  MSG_CROP_CAPTURE_ERROR,
  MSG_CROP_CAPTURE_READY,
  MSG_CROP_RECT_SELECTED,
  MSG_INLINE_EXTRACT_QUESTION,
  MSG_INLINE_SOLVE_AND_INJECT,
  MSG_INLINE_SOLVE_RESULT,
} from '../shared/messageTypes';

function generateUniqueId() {
  return 'oryx-' + Math.random().toString(36).substr(2, 9);
}

function getOryxInlineIcon(size: number, color = 'currentColor') {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2l2.8 6.8L22 11l-7.2 2.2L12 22l-2.8-8.8L2 11l7.2-2.2L12 2z"/>
    </svg>
  `;
}

interface SiteConfig {
  name: string;
  hostRegex: RegExp;
  questionSelector: string;
  titleSelector?: string; 
  minScore?: number;
  forceOverflowVisible?: boolean;
  forceImageCapture?: boolean;
}

// Minimum confidence score (0–1) for treating an element as a real question container
const MIN_QUESTION_SCORE = 0.55;

function ensureKatexStyles(shadowRoot?: ShadowRoot | null) {
    if (!shadowRoot) return;
    const existing = shadowRoot.getElementById('oryx-katex-css');
    if (existing) return;
    const link = document.createElement('link');
    link.id = 'oryx-katex-css';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/katex/katex.min.css');
    shadowRoot.appendChild(link);
}

function escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function renderMarkdownLite(input: string): string {
    let out = escapeHtml(input);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/\n/g, '<br>');
    return out;
}

type MathSegment = { type: 'text' | 'math'; content: string; display?: boolean };

function splitMathSegments(input: string): MathSegment[] {
    const segments: MathSegment[] = [];
    let i = 0;
    while (i < input.length) {
        const nextDollar = input.indexOf('$', i);
        if (nextDollar === -1) {
            segments.push({ type: 'text', content: input.slice(i) });
            break;
        }
        if (nextDollar > i) {
            segments.push({ type: 'text', content: input.slice(i, nextDollar) });
        }
        const isDisplay = input[nextDollar + 1] === '$';
        if (isDisplay) {
            const end = input.indexOf('$$', nextDollar + 2);
            if (end === -1) {
                segments.push({ type: 'text', content: input.slice(nextDollar) });
                break;
            }
            const content = input.slice(nextDollar + 2, end);
            segments.push({ type: 'math', content, display: true });
            i = end + 2;
        } else {
            let end = nextDollar + 1;
            while (true) {
                end = input.indexOf('$', end);
                if (end === -1) break;
                if (input[end - 1] !== '\\') break;
                end += 1;
            }
            if (end === -1) {
                segments.push({ type: 'text', content: input.slice(nextDollar) });
                break;
            }
            const content = input.slice(nextDollar + 1, end);
            segments.push({ type: 'math', content, display: false });
            i = end + 1;
        }
    }
    return segments;
}

function renderInlineContent(input: string): string {
    if (!input) return '';
    const segments = splitMathSegments(input);
    return segments.map((seg) => {
        if (seg.type === 'math') {
            try {
                return katex.renderToString(seg.content, {
                    displayMode: Boolean(seg.display),
                    throwOnError: false,
                });
            } catch {
                return `<code>${escapeHtml(seg.content)}</code>`;
            }
        }
        return renderMarkdownLite(seg.content);
    }).join('');
}

function extractChoice(answer: string, explanation?: string): string | null {
    const combined = `${answer || ''} ${explanation || ''}`;
    const match = combined.match(/\b(?:option\s*)?([A-D])\b/i);
    return match ? match[1].toUpperCase() : null;
}

function normalizeInlineMath(input: string): string {
    if (!input) return input;
    let out = input;
    // Basic LaTeX cleanup for inline display (avoid raw backslashes).
    out = out.replace(/\\text\{([^}]*)\}/g, '$1');
    out = out.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)');
    out = out.replace(/\\cdot/g, '*');
    out = out.replace(/\\times/g, '*');
    out = out.replace(/\\div/g, '/');
    out = out.replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');
    out = out.replace(/\\left/g, '');
    out = out.replace(/\\right/g, '');
    return out;
}

function extractChoiceFromOptions(answer: string, options: { label: string }[]): string | null {
    if (!options || options.length === 0) return null;
    const cleanAnswer = answer.trim().toLowerCase();
    if (!cleanAnswer) return null;

    // Direct letter response
    const directMatch = cleanAnswer.match(/\b([A-D])\b/i);
    if (directMatch) return directMatch[1].toUpperCase();

    let bestIndex = -1;
    let bestScore = 0;
    options.forEach((opt, idx) => {
        const label = (opt.label || '').toLowerCase();
        if (!label) return;
        let score = 0;
        if (label === cleanAnswer) score = 100;
        else if (cleanAnswer.length < 3 && label.startsWith(cleanAnswer)) score = 90;
        else if (label.includes(cleanAnswer)) score = 80;
        else if (cleanAnswer.includes(label)) score = 70;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = idx;
        }
    });

    if (bestIndex >= 0 && bestScore >= 70) {
        const letter = String.fromCharCode(65 + bestIndex);
        return letter;
    }
    return null;
}

let pendingAutoCrop:
  | { resolve: (value: string | null) => void; timeoutId: number }
  | null = null;

function getFrameOffset(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let currentWindow: Window | null = window;
  while (currentWindow && currentWindow !== currentWindow.top) {
    const frame = currentWindow.frameElement as HTMLElement | null;
    if (!frame) break;
    const rect = frame.getBoundingClientRect();
    x += rect.left;
    y += rect.top;
    currentWindow = currentWindow.parent;
  }
  return { x, y };
}

function findContextElements(el: HTMLElement, config: SiteConfig | null): HTMLElement[] {
  const elements: HTMLElement[] = [el];
  const parent = el.parentElement;
  if (config?.titleSelector) {
    const title = (el.querySelector(config.titleSelector) || parent?.querySelector(config.titleSelector)) as HTMLElement | null;
    if (title && !elements.includes(title)) elements.push(title);
  }

  const siblings: Element[] = [];
  let prev = el.previousElementSibling;
  let count = 0;
  while (prev && count < 4) {
    siblings.push(prev);
    prev = prev.previousElementSibling;
    count += 1;
  }

  siblings.forEach((sib) => {
    const node = sib as HTMLElement;
    const text = node.innerText?.trim() || '';
    const hasMath = node.querySelector('.katex, mjx-container, svg, img') !== null;
    if (hasMath || /[=+\-*/^]/.test(text) || text.includes('?')) {
      elements.push(node);
    }
  });

  return elements;
}

function unionRects(rects: DOMRect[]): { left: number; top: number; right: number; bottom: number } | null {
  if (rects.length === 0) return null;
  let left = rects[0].left;
  let top = rects[0].top;
  let right = rects[0].right;
  let bottom = rects[0].bottom;
  rects.slice(1).forEach((r) => {
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  return { left, top, right, bottom };
}

function getElementViewportRect(el: HTMLElement, config: SiteConfig | null) {
  const rects = findContextElements(el, config)
    .map((node) => node.getBoundingClientRect())
    .filter((r) => r.width > 4 && r.height > 4);

  const merged = unionRects(rects) || el.getBoundingClientRect();

  const padding = 18;
  const offset = getFrameOffset();

  // If we are inside a cross-origin iframe, we won't get a frame offset.
  const inIframe = window !== window.top;
  const safeOffset = inIframe && offset.x === 0 && offset.y === 0;
  if (safeOffset) {
    return {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  const x = Math.max(0, merged.left + offset.x - padding);
  const y = Math.max(0, merged.top + offset.y - padding);
  const width = Math.min(window.innerWidth, merged.right - merged.left + padding * 2);
  const height = Math.min(window.innerHeight, merged.bottom - merged.top + padding * 2);
  return { x, y, width, height };
}

function requestAutoCrop(rect: { x: number; y: number; width: number; height: number }): Promise<string | null> {
  return new Promise((resolve) => {
    if (pendingAutoCrop) {
      resolve(null);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      pendingAutoCrop = null;
      resolve(null);
    }, 5000);

    pendingAutoCrop = { resolve, timeoutId };
    chrome.runtime.sendMessage(
      {
        type: MSG_CROP_RECT_SELECTED,
        payload: { ...rect, dpr: window.devicePixelRatio || 1 },
      },
      (res) => {
        if (!res?.ok) {
          if (pendingAutoCrop) {
            window.clearTimeout(pendingAutoCrop.timeoutId);
            pendingAutoCrop = null;
          }
          resolve(null);
        }
      }
    );
  });
}

function shouldAutoCapture(
  config: SiteConfig | null,
  text: string,
  images: string[],
  hasVisuals: boolean,
): boolean {
  if (config?.forceImageCapture) return true;
  if (images.length > 0) return false;
  const hasMath = /[=+\-*/^]/.test(text) || /\b(x|y|z|sin|cos|tan|log)\b/i.test(text);
  const isShort = text.trim().length < 160;
  return (hasMath && isShort) || (hasVisuals && isShort);
}

function getCleanVisibleText(element: HTMLElement): string {
    // Clone to manipulate without affecting DOM
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Remove style and script tags which cause the CSS noise in Copy All
    const noise = clone.querySelectorAll('style, script, .tippy-box, [aria-hidden="true"]');
    noise.forEach(n => n.remove());

    // Replace math markup with TeX when available
    const replaced = new Set<Element>();
    const annotations = clone.querySelectorAll('annotation[encoding="application/x-tex"], mjx-annotation');
    annotations.forEach((node) => {
        const tex = node.textContent?.trim();
        if (!tex) return;
        const target = (node.closest('.katex') || node.closest('mjx-container') || node.parentElement) as Element | null;
        if (!target || replaced.has(target)) return;
        const span = document.createElement('span');
        span.textContent = tex;
        target.replaceWith(span);
        replaced.add(target);
    });

    // Replace common fraction markup with numerator/denominator text
    const fractionEls = clone.querySelectorAll('[class*="fraction" i]');
    fractionEls.forEach((el) => {
        if (replaced.has(el)) return;
        const numerator = (el.querySelector('[class*="numerator" i]') as HTMLElement | null)?.innerText?.trim();
        const denominator = (el.querySelector('[class*="denominator" i]') as HTMLElement | null)?.innerText?.trim();
        if (numerator && denominator) {
            const span = document.createElement('span');
            span.textContent = `(${numerator})/(${denominator})`;
            el.replaceWith(span);
            replaced.add(el);
        }
    });
    
    // Get text and clean it
    let text = clone.innerText;
    
    // Domain-specific cleanup for 1600.lol and others
    // Remove "Mark for Review", timers (02:05), and navigation noise
    text = text.replace(/Mark for Review/gi, '')
               .replace(/\d{1,2}:\d{2}/g, '') // Timers like 02:32
               .replace(/Question \d+ \/ \d+/gi, '')
               .replace(/ABCD/g, ''); // Choice markers

    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const SUPPORTED_SITES: SiteConfig[] = [
  {
    name: 'Google Forms',
    hostRegex: /docs\.google\.com\/forms/i,
    questionSelector: 'div[jsmodel="CP1oW"]',
    titleSelector: 'div[role="heading"]',
  },
  {
    name: 'Microsoft Forms',
    hostRegex: /forms\.(office|microsoft)\.com/i,
    questionSelector: '.office-form-question, [data-automation-id="questionItem"], .question-item',
    titleSelector: '.question-title, [data-automation-id="questionTitle"], .question-title-container',
    minScore: 0.35,
  },
  {
    name: 'Canvas',
    hostRegex: /instructure\.com/i,
    questionSelector: '.question, .display_question',
    titleSelector: '.question_text',
  },
  {
    name: 'Madrasati',
    hostRegex: /madrasati\./i,
    // Target the specific question cards more accurately
    questionSelector: '.card.mb-4.question-item, .question-card, .view-question-container, .question-text-container, [class*="question" i], [id*="question" i]',
    titleSelector: '.card-header, .question-title, .question-text',
    minScore: 0.4,
    forceOverflowVisible: true,
    forceImageCapture: true,
  },
  {
    name: 'Madrasti',
    hostRegex: /madrasti\./i,
    questionSelector: '.card.mb-4.question-item, .question-card, .view-question-container, .question-text-container, [class*="question" i], [id*="question" i]',
    titleSelector: '.card-header, .question-title, .question-text',
    minScore: 0.4,
    forceOverflowVisible: true,
    forceImageCapture: true,
  },
  {
    name: '1600.lol',
    hostRegex: /1600\.lol/i,
    // Focus on primary question card containers; allow common wrappers, but rely on scoring + dedupe to avoid duplicates.
    questionSelector: '.question-bank-item, [class*="QuestionDisplay"], [class*="QuestionWrapper"], [data-testid*="question" i], [class*="question" i], [id*="question" i]',
    minScore: 0.4,
    forceOverflowVisible: true,
    forceImageCapture: true,
  },
  {
    name: 'OnePrep',
    hostRegex: /oneprep\.(xyz|com|io)/i,
    // Use more specific component classes
    questionSelector: '.question-module, [class*="QuestionModule"], .question-container, [class*="QuestionWrapper"], .css-1yv5z6m, .css-1n4m6p6, .css-1v7j8b3, [data-testid*="question" i], [class*="question" i], [id*="question" i]',
    minScore: 0.4,
    forceOverflowVisible: true,
    forceImageCapture: true,
  },
  {
    name: 'CrackSAT',
    hostRegex: /cracksat\.net/i,
    questionSelector: '.col-md-9 p, #content p',
  },
  {
    name: 'Generic Educational',
    hostRegex: /.*/,
    questionSelector: '.question, .quiz-question, .problem, .exercise, [class*="question-item" i], [class*="question-container" i], [class*="question-wrapper" i], div[id*="question" i], .assessment-question, .form-group.p-3',
  }
];

function getCurrentSiteConfig(): SiteConfig | null {
  const url = window.location.href;
  for (const site of SUPPORTED_SITES) {
    if (site.name !== 'Generic Educational' && site.hostRegex.test(url)) return site;
  }
  return SUPPORTED_SITES.find(s => s.name === 'Generic Educational') || null;
}

function querySelectorAllDeep(selector: string): HTMLElement[] {
  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const traverse = (root: ParentNode) => {
    root.querySelectorAll(selector).forEach((el) => {
      const node = el as HTMLElement;
      if (!seen.has(node)) {
        seen.add(node);
        results.push(node);
      }
    });

    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode as Element | null;
    while (current) {
      const shadow = (current as HTMLElement).shadowRoot;
      if (shadow) traverse(shadow);
      current = walker.nextNode() as Element | null;
    }
  };

  traverse(document);
  return results;
}

function scoreQuestionContainer(el: HTMLElement, config: SiteConfig | null): number {
  let score = 0;

  const text = getCleanVisibleText(el);
  const length = text.length;
  const hasQuestionMark = text.includes('?');
  const hasInputs = !!el.querySelector('input, textarea, select, [role="textbox"]');
  const hasOptions = !!el.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]');
  const hasImages = !!el.querySelector('img');
  const hasHeading = !!el.querySelector('h1, h2, h3, h4, [role="heading"]');
  const hasTitle = !!(config?.titleSelector && el.querySelector(config.titleSelector));

  // Base on text length
  if (length >= 30 && length < 120) score += 0.25;
  else if (length >= 120 && length < 400) score += 0.35;
  else if (length >= 400) score += 0.3;

  // Questions typically have a '?'
  if (hasQuestionMark) score += 0.15;

  // Presence of form fields
  if (hasInputs) score += 0.2;
  if (hasOptions) score += 0.15;

  // Helpful structural hints
  if (hasHeading) score += 0.1;
  if (hasImages) score += 0.1;
  if (hasTitle) score += 0.15;

  // Slight boost for known structured sites
  if (config && config.name !== 'Generic Educational') {
    score += 0.05;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

// Store the floating selection button globally for easy management
let selectionButton: HTMLDivElement | null = null;

function showHighlightButton(x: number, y: number, text: string) {
    if (!selectionButton) {
        selectionButton = document.createElement('div');
        selectionButton.id = 'oryx-selection-solve-btn';
        selectionButton.style.cssText = `
            position: absolute;
            z-index: 2147483647;
            background: #6366f1;
            color: white;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: system-ui, -apple-system, sans-serif;
            pointer-events: auto;
        `;
        selectionButton.innerHTML = `
            ${getOryxInlineIcon(16, '#ffffff')}
            <span>Solve Highlight</span>
        `;
        selectionButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const selection = window.getSelection();
            const range = selection?.getRangeAt(0);
            const commonAncestor = range?.commonAncestorContainer as HTMLElement;
            const container = commonAncestor?.nodeType === 1 ? commonAncestor : commonAncestor?.parentElement;
            
            if (container) {
                // Try to find the actual question container to get better context
                const questionEl = findQuestionContainer(container);
                let contextEl = questionEl || container;
                
                // Enhancement: If contextEl is very small or has no images, look one level up
                if (contextEl.innerText.length < 50 || contextEl.querySelectorAll('img').length === 0) {
                    contextEl = contextEl.parentElement || contextEl;
                }

                let imagesUnderSelection = getImagesInContainer(contextEl, 4);

                // Fallback: If still no images and the text looks like it needs them, 
                // look for any large visible image in the viewport (useful for full-page math problems)
                if (imagesUnderSelection.length === 0) {
                    const allVisibleImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                        const rect = img.getBoundingClientRect();
                        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 100;
                    });
                    if (allVisibleImgs.length > 0) {
                        imagesUnderSelection = [allVisibleImgs[0].src];
                    }
                }

                console.log('[Oryx] Solving highlighted text:', text.substring(0, 50) + '...', 'Images found:', imagesUnderSelection.length);
                
                chrome.runtime.sendMessage({
                    type: MSG_INLINE_EXTRACT_QUESTION,
                    payload: { 
                      text: text.trim(),
                      images: imagesUnderSelection.slice(0, 4)
                    }
                });
            }
            selectionButton!.style.transform = 'scale(0.95)';
            selectionButton!.innerHTML = '<span>Sent to Oryx!</span>';
            setTimeout(() => hideHighlightButton(), 1200);
        });
        document.body.appendChild(selectionButton);
    }
    selectionButton.style.display = 'flex';
    selectionButton.style.left = `${x}px`;
    selectionButton.style.top = `${y + 15}px`; // Show below cursor
}

function hideHighlightButton() {
    if (selectionButton) selectionButton.style.display = 'none';
}

interface QuestionFields {
  textFields: (HTMLInputElement | HTMLTextAreaElement)[];
  options: { label: string; input: HTMLInputElement; container: HTMLElement }[];
}

function findQuestionContainer(el: HTMLElement | null): HTMLElement | null {
    if (!el) return null;
    const config = getCurrentSiteConfig();
    const selectors = (config?.questionSelector || '') + ', .question, .quiz-question, .problem, .exercise, [class*="question-item" i], [class*="question-container" i]';
    return el.closest(selectors);
}

function getImagesInContainer(container: HTMLElement, max = 6): string[] {
    const images: string[] = [];
    
    // 1. Standard images
    const imgs = container.querySelectorAll('img');
    for (const img of Array.from(imgs)) {
        if (images.length >= max) break;
        const src = img.getAttribute('src') || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (!src || src.includes('icon') || src.includes('logo')) continue;
        
        const isSupported = src.startsWith('http') || src.startsWith('data:image/');
        if (!isSupported) continue;

        const w = img.width;
        const h = img.height;
        if ((w > 0 && w < 12) || (h > 0 && h < 12)) continue;
        
        if (!images.includes(src)) images.push(src);
    }

    // 2. Background images
    if (images.length < max) {
        const bgEls = container.querySelectorAll('*');
        for (const el of Array.from(bgEls)) {
            if (images.length >= max) break;
            const style = window.getComputedStyle(el as Element);
            const bg = style.backgroundImage;
            if (bg && bg.startsWith('url(')) {
                const url = bg.slice(4, -1).replace(/['"]/g, "");
                if (url.startsWith('http') && !images.includes(url)) {
                    images.push(url);
                }
            }
        }
    }

    // 3. SVGs (Limited support - send as identification if possible, or just count)
    // For now, we mainly care about pixel-based images for the Vision model.
    
    return images;
}

function findFieldsInContainer(container: HTMLElement): QuestionFields {
  const fields: QuestionFields = { textFields: [], options: [] };
  
  // 1. Find text-like inputs
  const textInputs = container.querySelectorAll('input[type="text"], input:not([type]), textarea');
  textInputs.forEach(input => {
    fields.textFields.push(input as (HTMLInputElement | HTMLTextAreaElement));
  });

  // 2. Find radio/checkbox options
  const radioInputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  radioInputs.forEach(input => {
    const radio = input as HTMLInputElement;
    // Try to find a label
    let labelText = '';
    
    // Check for associated <label>
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) labelText = label.textContent?.trim() || '';
    }
    
    // Check for parent label
    if (!labelText) {
      const parentLabel = radio.closest('label');
      if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
    }

    // Check for nearby text (heuristic for Google Forms/etc where labels are siblings)
    if (!labelText) {
      const parent = radio.parentElement;
      if (parent) labelText = parent.textContent?.trim() || '';
    }

    if (labelText) {
      fields.options.push({ label: labelText, input: radio, container: radio.closest('div, li, .choice-container') || radio.parentElement! });
    }
  });

  return fields;
}

function applyAnswerToFields(answer: string, fields: QuestionFields) {
  const cleanAnswer = answer.trim().toLowerCase();
  
  // 1. Handle Radios/Checkboxes (Fuzzy Match)
  if (fields.options.length > 0) {
    let bestMatch: { input: HTMLInputElement; score: number } | null = null;
    
    for (const opt of fields.options) {
      const label = opt.label.toLowerCase();
      let score = 0;
      
      // Exact match
      if (label === cleanAnswer) score = 100;
      // Answer is "Option A" or "A" etc.
      else if (cleanAnswer.length < 3 && label.startsWith(cleanAnswer)) score = 90;
      else if (label.includes(cleanAnswer)) score = 80;
      else if (cleanAnswer.includes(label)) score = 70;

      if (score > (bestMatch?.score || 0)) {
        bestMatch = { input: opt.input, score };
      }
    }

    if (bestMatch && bestMatch.score > 50) {
      bestMatch.input.click();
      return true;
    }
  }

  // 2. Handle Text Fields (Direct fill if precisely one field)
  if (fields.textFields.length === 1) {
    const field = fields.textFields[0];
    field.value = answer;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

function injectLogo(element: HTMLElement, config?: SiteConfig | null) {
  if (element.dataset.oryxInjected === "true") return;
  element.dataset.oryxInjected = "true";

  // Make sure the parent container can anchor an absolute child if it's not already
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') {
      element.style.position = 'relative';
  }
  if (config?.forceOverflowVisible && computedStyle.overflow !== 'visible') {
      element.style.overflow = 'visible';
  }

  const injectionId = generateUniqueId();
  element.dataset.oryxInjectedId = injectionId;
  
  const shadowHost = document.createElement('div');
  shadowHost.className = 'oryx-inline-injector';
  shadowHost.style.position = 'relative'; // Using relative flow so it doesn't break forms
  shadowHost.style.display = 'flex';
  shadowHost.style.flexDirection = 'column';
  shadowHost.style.alignItems = 'flex-end';
  shadowHost.style.marginTop = '12px';
  shadowHost.style.width = '100%';
  shadowHost.style.zIndex = '2147483647';
  
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  const button = document.createElement('button');
  button.innerHTML = `
    ${getOryxInlineIcon(20, '#4f46e5')}
    <span style="font-size: 11px; font-weight: 800; margin-left: 6px; display: none; font-family: system-ui, sans-serif;">Solve Inline</span>
  `;
  button.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    background: white; border: 1.5px solid #e2e8f0; border-radius: 8px;
    padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    color: #475569;
  `;

  const answerBox = document.createElement('div');
  answerBox.id = 'answer-' + injectionId;
  answerBox.style.cssText = `
    display: none; width: 100%; max-width: 600px; margin-top: 12px;
    background: #f8fafc; border: 2px solid #e0e7ff; border-radius: 12px;
    padding: 16px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.1);
    font-family: system-ui, sans-serif; text-align: left;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.borderColor = '#6366f1';
    button.style.backgroundColor = '#f5f7ff';
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 10px 15px -3px rgba(99, 102, 241, 0.2), 0 4px 6px -2px rgba(99, 102, 241, 0.1)';
    const span = button.querySelector('span');
    if (span) { span.style.display = 'inline'; span.style.color = '#6366f1'; }
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.borderColor = '#e2e8f0';
    button.style.backgroundColor = 'white';
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
    const span = button.querySelector('span');
    if (span) span.style.display = 'none';
  });

  button.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();

    const runSolve = async () => {
      const currentConfig = getCurrentSiteConfig();
      // Always use the full container text to capture math, options, etc.
      let questionText = getCleanVisibleText(element);
      const extractedFields = findFieldsInContainer(element);
      let choiceLines = '';
      if (extractedFields.options.length > 0) {
        choiceLines = extractedFields.options
          .map((opt, idx) => {
            const label = (opt.label || '').trim();
            if (!label) return null;
            const letter = String.fromCharCode(65 + idx);
            return `${letter}) ${label}`;
          })
          .filter(Boolean)
          .join('\n');
        if (choiceLines) {
          questionText += `\n\nChoices:\n${choiceLines}`;
        }
      }
      
      // Find images in this question card
      const questionImages = getImagesInContainer(element, 4);
      const hasVisuals = Boolean(element.querySelector('svg, canvas, mjx-container, .katex'));
      let capturedImage: string | null = null;
      if (shouldAutoCapture(currentConfig, questionText, questionImages, hasVisuals)) {
        const rect = getElementViewportRect(element, currentConfig);
        capturedImage = await requestAutoCrop(rect);
      }
      if (capturedImage) {
        questionImages.unshift(capturedImage);
      }

      console.log('[Oryx] Manual click solve triggered. Text length:', questionText.length, 'Images:', questionImages.length);
      button.innerHTML = `<span style="font-size:11px; font-weight:800; color:#6366f1; white-space:nowrap; padding:2px; font-family: system-ui;">Thinking...</span>`;
      answerBox.style.display = 'block';
      answerBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: #6366f1; font-weight: 700;">
           <span style="display:inline-flex; animation: pulse 1.5s infinite;">${getOryxInlineIcon(16, '#6366f1')}</span>
           Decoding question...
        </div>
        <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }</style>
      `;

      const imageNote = capturedImage ? 'Use the attached image as the source of truth if the text seems incomplete.' : '';
      const shouldPreferImageOnly = Boolean(capturedImage && currentConfig?.forceImageCapture);
      const sendText = shouldPreferImageOnly
        ? `Solve from the attached image. If there is any conflict, use the image.${choiceLines ? `\n\nDetected choices:\n${choiceLines}` : ''}`
        : `Please provide a very short direct answer, followed by a 1-sentence explanation. If multiple choice, include the choice letter (A/B/C/D) in the answer. Use plain text only (no LaTeX); write fractions as a/b. ${imageNote}\n\n${questionText.trim()}`;
      chrome.runtime.sendMessage({
        type: MSG_INLINE_SOLVE_AND_INJECT,
        payload: { 
          text: sendText,
          images: questionImages,
          injectionId
        }
      });
    };

    void runSolve();
  });

  shadowRoot.appendChild(button);
  shadowRoot.appendChild(answerBox);
  
  // Prepend so it appears at the start of the card/question without breaking flex layouts at the bottom
  if (element.firstChild) {
      element.insertBefore(shadowHost, element.firstChild);
  } else {
      element.appendChild(shadowHost);
  }
}

function addExtractAllButton(config: SiteConfig) {
    if (document.getElementById('oryx-extract-all-container')) return;
    
    const container = document.createElement('div');
    container.id = 'oryx-extract-all-container';
    container.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 2147483647;
        display: none; flex-direction: column; gap: 10px; align-items: flex-end;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = `
        <span style="display:inline-flex; margin-right:8px;">${getOryxInlineIcon(16, '#6366f1')}</span>
        Copy All
    `;
    copyBtn.style.cssText = `
        background: white; border: 2px solid #6366f1; color: #6366f1;
        padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 13px;
        cursor: pointer; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.3);
        display: flex; align-items: center; transition: all 0.2s;
    `;
    
    const solveBtn = document.createElement('button');
    solveBtn.innerHTML = `✨ Solve Bulk Answers`;
    solveBtn.style.cssText = `
        background: #6366f1; border: 2px solid #6366f1; color: white;
        padding: 10px 20px; border-radius: 20px; font-weight: 800; font-size: 14px;
        cursor: pointer; box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.4);
        display: flex; align-items: center; transition: all 0.2s;
    `;

    [copyBtn, solveBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
             btn.style.transform = 'scale(1.05) translateY(-3px)';
        });
        btn.addEventListener('mouseleave', () => {
             btn.style.transform = 'scale(1) translateY(0)';
        });
    });

    copyBtn.addEventListener('click', () => {
        let questions = Array.from(document.querySelectorAll(config.questionSelector)) as HTMLElement[];
        if (questions.length === 0) {
            questions = querySelectorAllDeep(config.questionSelector);
        }
        if (questions.length === 0 && config.name !== 'Generic Educational') {
            const fallbackSelector = '[data-testid*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i]';
            questions = querySelectorAllDeep(fallbackSelector);
        }
        let allText = '';
        let count = 0;
        let lastTop = -999;
        const minScore = config.minScore ?? MIN_QUESTION_SCORE;
        
        questions.forEach((el) => {
            const score = scoreQuestionContainer(el, config);
            if (score < minScore) return;

            const text = getCleanVisibleText(el);
            if (text.length < 20 || text.includes('المقررات والمصادر')) return;
            
            // Prevent duplicate adjacent extractions (within 100px)
            const top = el.getBoundingClientRect().top + window.scrollY;
            if (Math.abs(top - lastTop) < 100) return;
            lastTop = top;
            
            count++;
            // Try to find if question already has a number like "42." or "Q1:" to avoid mislabeling
            const textLines = text.split('\n');
            const firstLine = textLines[0] || '';
            const matchNumber = firstLine.match(/^(\d+)([\).:\s]|$)/);
            const label = matchNumber ? matchNumber[1] : count;

            allText += `QUESTION ${label}:\n${text}\n\n`;
        });
        
        if (allText) {
            const originalHtml = copyBtn.innerHTML;
            navigator.clipboard.writeText(allText.trim()).then(() => {
                copyBtn.innerHTML = '✨ Copied!';
                setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000);
            }).catch(err => {
                console.error('[Oryx] Failed to copy text:', err);
                copyBtn.innerHTML = '❌ Copy Failed';
                setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000);
            });
        }
    });

    solveBtn.addEventListener('click', () => {
        let questions = Array.from(document.querySelectorAll(config.questionSelector)) as HTMLElement[];
        if (questions.length === 0) {
            questions = querySelectorAllDeep(config.questionSelector);
        }
        if (questions.length === 0 && config.name !== 'Generic Educational') {
            const fallbackSelector = '[data-testid*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i]';
            questions = querySelectorAllDeep(fallbackSelector);
        }
        let allText = '';
        const allImages: string[] = [];
        let count = 0;
        let lastTop = -999;
        const minScore = config.minScore ?? MIN_QUESTION_SCORE;
        questions.forEach((el) => {
            const score = scoreQuestionContainer(el, config);
            if (score < minScore) return;

            const text = getCleanVisibleText(el);
            if (text.length < 25 || text.includes('المقررات والمصادر') || text.includes('وصف الخدمة') || text.includes('دليل الاستخدام')) return;
            
            // Skip purely numeric/navigational elements
            if (/^\d+\s*$/.test(text)) return;

            // Prevent split-question duplicate extraction
            const top = el.getBoundingClientRect().top + window.scrollY;
            if (Math.abs(top - lastTop) < 100) return;
            lastTop = top;

            count++;
            // Try to detect existing number to maintain context for users (e.g. skip "Question 1" if it's really #42)
            const textLines = text.split('\n');
            const firstLine = textLines[0] || '';
            const matchNumber = firstLine.match(/^(\d+)([\).:\s]|$)/);
            const label = matchNumber ? matchNumber[1] : count;
            
            allText += `QUESTION ${label}:\n${text}\n\n`;
            
            // Collect images - search current element AND its parent for related figures
            const imgs = getImagesInContainer(el, 2);
            if (imgs.length === 0 && el.parentElement) {
                // Secondary search in immediate parent (often holds the heading/image for a group)
                const parentImgs = getImagesInContainer(el.parentElement, 1);
                parentImgs.forEach(src => {
                    if (!allImages.includes(src)) allImages.push(src);
                });
            }

            imgs.forEach(src => {
                if (!allImages.includes(src)) allImages.push(src);
            });
        });

        // Global Fallback for Bulk: If no question-linked images were found,
        // grab all large and moderately visible images from the viewport area.
        if (allImages.length === 0) {
            console.log('[Oryx] No local images found in bulk containers, trying viewport scan...');
            const viewportImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                const r = img.getBoundingClientRect();
                const isTiny = r.width < 50 || r.height < 50;
                const isLogo = img.src.includes('logo') || img.src.includes('icon') || img.alt.includes('logo');
                // Check if it's within a reasonable vertical range of the viewport
                return r.top >= -1000 && r.top < window.innerHeight + 1000 && !isTiny && !isLogo;
            }).sort((a,b) => {
                // Sort by size - we want the biggest diagrams
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                return (rb.width * rb.height) - (ra.width * ra.height);
            }).slice(0, 8);
            
            viewportImgs.forEach(img => {
                const src = img.getAttribute('src') || img.src || img.getAttribute('data-src');
                if (src && !allImages.includes(src)) allImages.push(src);
            });
        }
        
        // Final sanity check: if we found text but no images, log a warning
        if (allText && allImages.length === 0) {
            console.warn('[Oryx] Bulk extraction: Found questions but 0 images.');
        }
        
        if (allText) {
            chrome.runtime.sendMessage({
                type: MSG_INLINE_EXTRACT_QUESTION,
                payload: { 
                  text: `I need an answer key for the following questions. Please provide a clear, numbered list of ONLY the final answers (e.g., 1. A, 2. 15, 3. True). Do not include any steps, reasoning, or extra text.

Questions:
${allText}`,
                  images: allImages.slice(0, 8), 
                  isBulk: true
                }
            });
            const originalHtml = solveBtn.innerHTML;
            solveBtn.innerHTML = '🚀 Sending to Panel...';
            setTimeout(() => { solveBtn.innerHTML = originalHtml; }, 3000);
        }
    });

    container.appendChild(solveBtn);
    container.appendChild(copyBtn);
    document.body.appendChild(container);
}

function initInjector() {
  console.log('[Oryx] Initializing content injector...');
  const config = getCurrentSiteConfig();
  
  // Highlight Listener (Site Independent)
  document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 10) {
          showHighlightButton(e.pageX, e.pageY, text);
      } else {
          // Small delay before hiding to allow the button click to fire if needed
          setTimeout(() => {
              const currentSelection = window.getSelection();
              if (!currentSelection || currentSelection.toString().length < 2) {
                  hideHighlightButton();
              }
          }, 100);
      }
  });

  if (config) {
    console.log(`[Oryx] Supported site detected: ${config.name}`);
    addExtractAllButton(config);
    
    const scanAndInject = () => {
        const currentConfig = getCurrentSiteConfig();
        if (!currentConfig) return;

        let allPotential = Array.from(document.querySelectorAll(currentConfig.questionSelector));
        if (allPotential.length === 0) {
          allPotential = querySelectorAllDeep(currentConfig.questionSelector);
        }
        if (allPotential.length === 0 && currentConfig.name !== 'Generic Educational') {
          const fallbackSelector = '[data-testid*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i]';
          allPotential = querySelectorAllDeep(fallbackSelector);
        }

        // #region agent log
        chrome.runtime.sendMessage({
          type: 'ORYX_DEBUG_SCAN',
          payload: {
            sessionId: '8f43c7',
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'inlineInjector.ts:scanAndInject:start',
            message: 'scanAndInject initial candidate count',
            data: {
              site: currentConfig.name,
              selector: currentConfig.questionSelector,
              potentialCount: allPotential.length,
              url: window.location.href,
            },
          },
        }).catch(() => {});
        // #endregion agent log
        
        // 1. Initial Filtering (Ignore tags, tiny text, and hidden elements)
        const roughCandidates = allPotential.filter(q => {
            const el = q as HTMLElement;
            // Ignore common layout/nav tags
            if (['BODY', 'HTML', 'MAIN', 'HEADER', 'FOOTER', 'FORM', 'NAV', 'ASIDE', 'BUTTON', 'INPUT', 'LABEL', 'SPAN', 'A', 'SVG'].includes(el.tagName)) return false;
            
            // Ignore very tiny text or hidden elements, unless it has an image
            const text = el.innerText.trim();
            const hasImg = el.querySelector('img') !== null;
            if (text.length < 5 && !hasImg) return false;
            if (text.length < 15 && !hasImg && !el.innerText.includes('?')) return false;
            
            // DONT MATCH OPTIONS/CHOICES - This is a common cause of multiple logos
            const className = (el.className || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const role = (el.getAttribute('role') || '').toLowerCase();
            
            // 1600.lol and OnePrep specific: ignore choice bubbles/buttons
            if (role === 'button' || role === 'radio' || role === 'checkbox' || role === 'option') return false;
            if ((className.includes('choice') || className.includes('option') || id.includes('choice') || id.includes('option')) && 
                !(className.includes('question') || id.includes('question'))) {
                return false;
            }

            // Depth check: If it has too many children or is a tiny leaf node, skip
            if (el.children.length > 80) return false;

            // Ignore if it's way too big (likely a whole page section wrapper)
            if (el.offsetHeight > window.innerHeight * 0.98) return false;
            if (el.offsetWidth < 40 || el.offsetHeight < 20) return false;

            return true;
        });

        // 2. Score candidates and drop low-confidence containers
        const minScore = currentConfig.minScore ?? MIN_QUESTION_SCORE;

        const scoredCandidates = roughCandidates
          .map((node) => {
            const el = node as HTMLElement;
            const score = scoreQuestionContainer(el, currentConfig);
            return { el, score };
          })
          .filter((c) => c.score >= minScore);

        const candidates = scoredCandidates.map((c) => c.el);

        // #region agent log
        chrome.runtime.sendMessage({
          type: 'ORYX_DEBUG_SCAN',
          payload: {
            sessionId: '8f43c7',
            runId: 'pre-fix',
            hypothesisId: 'H2',
            location: 'inlineInjector.ts:scanAndInject:scored',
            message: 'scanAndInject scored candidates after threshold',
            data: {
              site: currentConfig.name,
              minScore,
              scoredCount: scoredCandidates.length,
            },
          },
        }).catch(() => {});
        // #endregion agent log

        // 3. Parent-Child Deduplication (Keep only the outermost containers)
        const finalists = candidates.filter(q => {
            const el = q as HTMLElement;
            
            // Check if any ancestor is ALREADY a candidate
            let parent = el.parentElement;
            while (parent) {
                if (candidates.includes(parent)) return false; 
                parent = parent.parentElement;
            }
            
            // Explicitly ignore elements that clearly look like choice/option containers even if they match selector
            const style = window.getComputedStyle(el);
            if (style.cursor === 'pointer' && el.innerText.length < 200) return false;
            if (el.tagName === 'BUTTON' || el.closest('button')) return false;
            
            return true;
        });

        // 4. Proximity Sibling De-dupe: If two finalists are very close siblings, they are likely parts of one problem
        const sorted = (finalists as HTMLElement[]).sort((a,b) => (a.getBoundingClientRect().top + window.scrollY) - (b.getBoundingClientRect().top + window.scrollY));
        const deduplicatedFinalists: HTMLElement[] = [];
        
        for (let i = 0; i < sorted.length; i++) {
            const current = sorted[i] as HTMLElement;
            const prev = deduplicatedFinalists[deduplicatedFinalists.length - 1];
            
            if (prev) {
                const dist = Math.abs(current.offsetTop - prev.offsetTop);
                // If they are less than 250px apart and share a parent, they are likely one problem (nested cards)
                if (dist < 250 && current.parentElement === prev.parentElement) continue;
            }
            deduplicatedFinalists.push(current);
        }
        
        deduplicatedFinalists.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.dataset.oryxInjected === "true") return;
            if (htmlEl.querySelector('[data-oryx-injected="true"]')) return;
            injectLogo(htmlEl, currentConfig);
        });

        // #region agent log
        chrome.runtime.sendMessage({
          type: 'ORYX_DEBUG_SCAN',
          payload: {
            sessionId: '8f43c7',
            runId: 'pre-fix',
            hypothesisId: 'H3',
            location: 'inlineInjector.ts:scanAndInject:inject',
            message: 'scanAndInject final injected count',
            data: {
              site: currentConfig.name,
              deduplicatedCount: deduplicatedFinalists.length,
              injectedCount: document.querySelectorAll('[data-oryx-injected="true"]').length,
            },
          },
        }).catch(() => {});
        // #endregion agent log

        const validCount = document.querySelectorAll('[data-oryx-injected="true"]').length;
        const extContainer = document.getElementById('oryx-extract-all-container');
        if (extContainer && validCount > 0) {
            extContainer.style.display = 'flex';
        }
    };
    
    const observer = new MutationObserver(scanAndInject);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial scan
    setTimeout(scanAndInject, 1000);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MSG_CROP_CAPTURE_READY && pendingAutoCrop) {
    const resolve = pendingAutoCrop.resolve;
    window.clearTimeout(pendingAutoCrop.timeoutId);
    pendingAutoCrop = null;
    resolve(String(message.imageDataUrl || ''));
    return;
  }
  if (message?.type === MSG_CROP_CAPTURE_ERROR && pendingAutoCrop) {
    const resolve = pendingAutoCrop.resolve;
    window.clearTimeout(pendingAutoCrop.timeoutId);
    pendingAutoCrop = null;
    resolve(null);
    return;
  }
  if (message.type === MSG_INLINE_SOLVE_RESULT) {
    const { injectionId, answer, explanation } = message.payload;
    const shadowHosts = document.querySelectorAll('.oryx-inline-injector');
    for (const host of Array.from(shadowHosts)) {
      if (host.shadowRoot && host.parentElement?.dataset.oryxInjectedId === injectionId) {
        const answerBox = host.shadowRoot.getElementById('answer-' + injectionId);
        const btn = host.shadowRoot.querySelector('button');
        
        if (answerBox) {
          const fields = findFieldsInContainer(host.parentElement as HTMLElement);
          const hasOptions = fields.options.length > 0;
          const hasSingleTextField = fields.textFields.length === 1;
          const canSafelyAutoApply = hasOptions || hasSingleTextField;
          ensureKatexStyles(host.shadowRoot);
          const choiceFromText = extractChoice(answer, explanation);
          const choiceFromOptions = choiceFromText ? null : extractChoiceFromOptions(answer || '', fields.options);
          const choice = choiceFromText || choiceFromOptions;
          const answerHtml = renderInlineContent(normalizeInlineMath(answer || ''));
          const explanationHtml = renderInlineContent(normalizeInlineMath(explanation || ''));
          const choiceHtml = choice
            ? `<div style="margin-bottom: 6px; font-size: 12px; font-weight: 800; color: #4f46e5;">Choice: ${escapeHtml(choice)}</div>`
            : '';
          
          // Only show the auto-apply button when we have a reasonably clear target field.
          const applyButtonHtml = canSafelyAutoApply
            ? `<button id="apply-btn-${injectionId}" style="
                 background: #6366f1; color: white; border: none; padding: 4px 10px; 
                 border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;
                 white-space: nowrap; margin-left: 12px; transition: all 0.2s;
               ">Apply to Field</button>`
            : '';

          answerBox.innerHTML = `
            <div style="font-weight: 800; color: #1e293b; font-size: 15px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: flex-start;">
               <div style="flex: 1;">✨ ${answerHtml || escapeHtml(answer || '')}</div>
               ${applyButtonHtml}
            </div>
            ${choiceHtml}
            <div style="font-size: 13px; color: #475569; line-height: 1.5;">
               ${explanationHtml}
            </div>
          `;

          const applyBtn = answerBox.querySelector(`#apply-btn-${injectionId}`) as HTMLButtonElement | null;
          if (applyBtn && canSafelyAutoApply) {
            applyBtn.addEventListener('click', () => {
              const success = applyAnswerToFields(answer, fields);
              if (success) {
                applyBtn.innerHTML = '✅ Applied';
                applyBtn.style.background = '#10b981';
                setTimeout(() => {
                  applyBtn.innerHTML = 'Apply to Field';
                  applyBtn.style.background = '#6366f1';
                }, 2000);
              } else {
                applyBtn.innerHTML = '❓ Manual Copy';
                applyBtn.style.background = '#f59e0b';
              }
            });
          }

          if (btn) btn.innerHTML = `${getOryxInlineIcon(20, '#4f46e5')}`;
          break;
        }
      }
    }
  }
});

if (document.body) initInjector();
else document.addEventListener('DOMContentLoaded', initInjector);
