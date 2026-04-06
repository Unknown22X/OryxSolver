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

function getOryxInlineIcon(size: number) {
  return `
    <img
      src="${chrome.runtime.getURL('icons/32.png')}"
      width="${size}"
      height="${size}"
      alt="Oryx"
      style="display:block; width:${size}px; height:${size}px; object-fit:contain;"
    />
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

// Minimum confidence score (0-1) for treating an element as a real question container
const MIN_QUESTION_SCORE = 0.45;
const INLINE_SOLVE_RESULT_TIMEOUT_MS = 90_000;

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

let pendingAutoCrop:
  | { resolve: (value: string | null) => void; timeoutId: number }
  | null = null;
const pendingInlineSolveTimeouts = new Map<string, number>();

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

function hasOptions(el: HTMLElement): boolean {
    return !!el.querySelector('input, [role="radio"], [role="option"], .choice, .option, [class*="choice" i], [class*="option" i]');
}

function findContextElements(el: HTMLElement, config: SiteConfig | null): HTMLElement[] {
  const elements: HTMLElement[] = [el];
  const parent = el.parentElement;
  
  if (config?.titleSelector) {
    const title = (el.querySelector(config.titleSelector) || parent?.querySelector(config.titleSelector)) as HTMLElement | null;
    if (title && !elements.includes(title)) {
        elements.unshift(title);
    }
  }

  const findPassageInSiblings = (startEl: HTMLElement) => {
    let prev = startEl.previousElementSibling;
    let count = 0;
    while (prev && count < 5) {
      const node = prev as HTMLElement;
      // Stop if we hit another distinct question
      if (hasOptions(node) || node.dataset.oryxInjected === "true" || node.classList.contains('oryx-inline-injector')) break;

      const text = node.innerText?.trim() || '';
      const hasMath = node.querySelector('.katex, mjx-container, svg, img') !== null;
      const hasPassageKeywords = /passage|text 1|text 2|read the following|background|context|----|-----/i.test(text);
      
      if (hasMath || hasPassageKeywords || text.length > 40) {
        if (!elements.includes(node)) {
          elements.unshift(node);
        }
      }
      prev = prev.previousElementSibling;
      count += 1;
    }
  };

  findPassageInSiblings(el);

  // 3. Split Layout Case (Deep Search)
  let current: HTMLElement | null = parent;
  let level = 0;
  while (current && level < 8) {
      const sibs = Array.from(current.parentElement?.children || []);
      const myIdx = sibs.indexOf(current);
      for (let i = 0; i < myIdx; i++) {
          const sib = sibs[i] as HTMLElement;
          const text = sib.innerText?.trim() || '';
          const hasOptionsSib = hasOptions(sib);
          // Only include if it doesn't look like a separate question or generic boilerplate
          if (!hasOptionsSib && (text.length > 80 || sib.querySelector('img, svg')) && !/immersive reader|algebra quiz|quiz \(copy\)|mute preppy|report|go back|directions/i.test(text)) {
              if (!elements.includes(sib)) elements.unshift(sib);
          }
      }
      current = current.parentElement;
      level++;
      if (elements.length > 5) break;
  }

  if (config?.name === 'OnePrep' || config?.name === '1600.lol') {
    const passageCandidates = Array.from(document.querySelectorAll(
      [
        '[class*="passage" i]',
        '[data-testid*="passage" i]',
        '[class*="stimulus" i]',
        '[data-testid*="stimulus" i]',
        '[class*="text" i]',
      ].join(', ')
    )) as HTMLElement[];

    const questionRect = el.getBoundingClientRect();
    const nearbyPassages = passageCandidates
      .filter((node) => {
        if (elements.includes(node) || hasOptions(node)) return false;
        const text = sanitizeBulkTextBlock(getCleanVisibleText(node));
        if (text.length < 120) return false;
        if (/mute preppy|report|go back|directions|calculator|reference|hide/i.test(text)) return false;
        const rect = node.getBoundingClientRect();
        const verticalOverlap = Math.min(questionRect.bottom, rect.bottom) - Math.max(questionRect.top, rect.top);
        const isLeftPane = rect.right <= questionRect.left + 40;
        const isNearby = Math.abs(rect.top - questionRect.top) < window.innerHeight * 0.6;
        return verticalOverlap > 40 || (isLeftPane && isNearby);
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return Math.abs(ra.top - questionRect.top) - Math.abs(rb.top - questionRect.top);
      })
      .slice(0, 2);

    nearbyPassages.reverse().forEach((node) => {
      if (!elements.includes(node)) elements.unshift(node);
    });
  }

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
  const contextElements = findContextElements(el, config);
  const rects = contextElements
    .map((node) => node.getBoundingClientRect())
    .filter((r) => r.width > 4 && r.height > 4 && r.height < window.innerHeight * 1.5);

  const merged = unionRects(rects) || el.getBoundingClientRect();
  const padding = 18;
  const offset = getFrameOffset();

  const inIframe = window !== window.top;
  if (inIframe && offset.x === 0 && offset.y === 0) {
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
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

function safeSendMessage(message: unknown, callback?: (response: any) => void) {
  try {
    const maybePromise = chrome.runtime.sendMessage(message, callback as any);
    if (maybePromise && typeof (maybePromise as Promise<any>).catch === 'function') {
      void (maybePromise as Promise<any>).catch(() => {});
    }
  } catch {
    // Ignore sendMessage failures when the background isn't available.
  }
}

function shouldAutoCapture(config: SiteConfig | null, text: string, images: string[], hasVisuals: boolean): boolean {
  if (config?.forceImageCapture) return true;
  if (images.some((src) => /^https?:\/\//i.test(src))) return true;
  if (images.length > 0) return false;
  const hasMath = /[=+\-*/^]/.test(text) || /\b(x|y|z|sin|cos|tan|log)\b/i.test(text);
  const isShort = text.trim().length < 160;
  return (hasMath && isShort) || (hasVisuals && isShort);
}

function lineLooksLikeUiCode(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const ascii = trimmed.replace(/[^\x20-\x7E]/g, ' ');
    const styleHits = (ascii.match(/\b(?:position|display|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|float|cursor|background(?:-[a-z]+)?|font-size|max-width|min-width|top|right|bottom|left|z-index)\s*:/gi) || []).length;
    const scriptHits = (ascii.match(/\b(?:function|var|let|const|window|document|createElement|appendChild|insertBefore|getElementsByTagName|parentNode|async|await|gtag|dataLayer|modal|script|src=)\b/gi) || []).length;
    const hasUrlLikeCode = /https?\s*:\s*\/\s*\//i.test(ascii);
    const hasDomCode = /\$\s*\(|\)\s*;|=>|insertAfter|appendChild|querySelector|dataset\./i.test(ascii);
    if (styleHits >= 2 || scriptHits >= 2) return true;
    if (hasUrlLikeCode || hasDomCode) return true;
    if (/@media/i.test(ascii) && /max-width|min-width|important|display\s*:|position\s*:/i.test(ascii)) return true;
    if (/[{};]/.test(ascii) && (styleHits >= 1 || scriptHits >= 1)) return true;
    return false;
}

function stripCodeLikeNoise(text: string): string {
    const kept: string[] = [];
    text.split(/\n+/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (lineLooksLikeUiCode(trimmed)) return;
        kept.push(trimmed);
    });
    return kept.join('\n').trim();
}

function getCleanVisibleText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    const noise = clone.querySelectorAll('style, script, .tippy-box, [aria-hidden="true"]');
    noise.forEach(n => n.remove());

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
    
    let text = clone.innerText;
    text = text.replace(/Mark for Review/gi, '')
               .replace(/Mute Preppy/gi, '')
               .replace(/\bReport\b/gi, '')
               .replace(/\bGo back\b/gi, '')
               .replace(/\bDirections\b/gi, '')
               .replace(/\bCalculator\b/gi, '')
               .replace(/\bReference\b/gi, '')
               .replace(/\bMore\b/gi, '')
               .replace(/\bHide\b/gi, '')
               .replace(/\d{1,2}:\d{2}/g, '')
               .replace(/Question \d+ \/ \d+/gi, '')
               .replace(/ABCD/g, '')
               .replace(/Immersive Reader in Microsoft Forms allows you to hear the text of a form title and questions read out loud while following along\. You can find the Immersive Reader button next to form title or questions after activating this control\. You can also change the spacing of line and words to make them easier to read, highlight parts of speech and syllables, select single words or lines of words read aloud, and select language preferences\./gi, '')
               .replace(/Immersive Reader in Microsoft Forms allows you to hear the text/gi, '')
               .replace(/Algebra Quiz/gi, '')
               .replace(/\(Copy\)/gi, '');

    const arabicNoise = [
        /----\s+------\s+\d+(\.\d+)-/g,
        /-----\s+--\s+---/g,
        /-----/g,
        /----\s+-------\s+-------/g,
        /-----\s+-------/g,
        /------\s+-------/g,
        /----------/g,
        /---\s+---\s+--\s+---/g,
        /------\s+\/\s+------\s+-------/g,
        /--\s+----/g
    ];
    arabicNoise.forEach(re => { text = text.replace(re, ''); });

    return sanitizeBulkTextBlock(stripCodeLikeNoise(text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()));
}

interface BulkQuestionEntry {
  label: string;
  lines: string[];
  text: string;
  images: string[];
}

function normalizeBulkComparisonText(text: string): string {
  return text.toLowerCase().replace(/[\s\n\r\t]+/g, '').replace(/[^\p{L}\p{N}+=\-*/^<>≤≥(),.:;]/gu, '');
}

function sanitizeBulkTextBlock(text: string): string {
  let out = text.replace(/\u00a0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
  const uiNoisePatterns = [
    /أدخل إجابتك الرياضية/gi,
    /التبديل إلى نص/gi,
    /enter your answer(?:\s+mathematically)?/gi,
    /enter your maths? answer/gi,
    /switch to text/gi,
    /التبديل إلى نص/gi,
    /required to answer/gi,
    /this question is required/gi,
    /\brequired\b/gi,
    /mark for review/gi,
    /immersive reader in microsoft forms allows you to hear the text/gi,
    /find the immersive reader button next to form title or questions/gi,
    /after activating this control/gi,
    /you can also change the spacing of line and words/gi,
    /highlight parts of speech/gi,
    /select single words or lines of words read aloud/gi,
    /select language preferences/gi,
    /algebra quiz/gi,
    /\(copy\)/gi,
  ];
  uiNoisePatterns.forEach((pattern) => { out = out.replace(pattern, ' '); });
  out = out.replace(/\(\s*\d+\s*(?:نقط|نقطة|points?)\s*\)/gi, '')
           .replace(/[ \t]+\n/g, '\n')
           .replace(/\n[ \t]+/g, '\n')
           .replace(/[ \t]{2,}/g, ' ')
           .replace(/\n{3,}/g, '\n\n')
           .trim();
  return out;
}

function lineLooksLikeUiNavigation(line: string): boolean {
  const text = line.trim().toLowerCase();
  if (!text) return false;

  const englishUiNoise = [
    'system maintenance',
    'login',
    'logout',
    'settings',
    'dashboard',
    'notifications',
    'microsoft teams',
    'office 365',
    'google drive',
    'copyright',
  ];
  if (englishUiNoise.some((token) => text.includes(token))) return true;

  const arabicUiNoise = [
    'الرئيسية',
    'مهامي',
    'المقررات',
    'المصادر',
    'الواجبات',
    'الاختبارات',
    'لوحات النقاش',
    'الأنشطة',
    'مساراتي',
    'غرفة المعلمين',
    'الإعلانات',
    'الرسائل',
    'التقارير',
    'التقويم',
    'تسجيل الدخول',
    'تسجيل الخروج',
    'معلومات عن الخدمة',
  ];
  return arabicUiNoise.some((token) => text.includes(token));
}

function focusInlineQuestionText(rawText: string): string {
  const MAX_INLINE_QUESTION_CHARS = 2200;
  const MAX_INLINE_LINES = 28;

  const lines = dedupeBulkLines(rawText.split(/\n+/))
    .map((line) => sanitizeBulkTextBlock(line))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !lineLooksLikeUiCode(line))
    .filter((line) => !lineLooksLikeUiNavigation(line));

  if (lines.length === 0) {
    return sanitizeBulkTextBlock(rawText).slice(0, MAX_INLINE_QUESTION_CHARS);
  }

  const questionSignal = /[?؟]|(^|\s)(question|choices?|اختر|السؤال|حل|صورة الشكل|المستقيم|true|false)(\s|$)/i;
  const firstSignalIdx = lines.findIndex((line) => questionSignal.test(line));
  const focusedLines = firstSignalIdx > 1 ? lines.slice(Math.max(0, firstSignalIdx - 1)) : lines;
  const clampedLines = focusedLines.slice(0, MAX_INLINE_LINES);
  const joined = clampedLines.join('\n').trim();

  if (joined.length <= MAX_INLINE_QUESTION_CHARS) return joined;
  return `${joined.slice(0, MAX_INLINE_QUESTION_CHARS).trim()}\n...`;
}

function looksMathHeavy(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  const operatorCount = (compact.match(/[=+\-*/^<>≤≥]/g) || []).length;
  return operatorCount >= 1 && /[A-Za-z0-9]/.test(compact);
}

function expandBulkLine(line: string): string[] {
  let out = sanitizeBulkTextBlock(line);
  if (!out) return [];
  out = out.replace(/^QUESTION\s+\d+:\s*/i, '').replace(/^(\d+)\.(?=\S)/, '$1. ');
  const instructionMatch = out.match(/^(\d+\.\s*)?(Solve(?: for x)?|Simplify|Divide|Long Division|Solve the following simultaneous equation)(.+)$/i);
  if (instructionMatch) {
    const [, prefix = '', instruction, restRaw] = instructionMatch;
    const rest = restRaw.trim();
    if (rest && looksMathHeavy(rest)) return [`${prefix}${instruction}`.trim(), rest];
  }
  return [out];
}

function dedupeBulkLines(lines: string[]): string[] {
  const result: string[] = [];
  lines.forEach((line) => {
    expandBulkLine(line).forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const normalized = normalizeBulkComparisonText(trimmed);
      if (!normalized) return;
      const previous = result[result.length - 1];
      const previousNormalized = previous ? normalizeBulkComparisonText(previous) : '';
      if (previousNormalized === normalized) return;
      if (previousNormalized && normalized.includes(previousNormalized) && normalized.length > previousNormalized.length + 6) {
        result[result.length - 1] = trimmed;
        return;
      }
      if (result.some((existing) => normalizeBulkComparisonText(existing) === normalized)) return;
      result.push(trimmed);
    });
  });
  return result;
}

function extractBulkQuestionLabel(lines: string[], fallback: number): string {
  for (const line of lines) {
    const match = line.match(/^(\d+)(?:[\).:]|\s|$)/);
    if (match) return match[1];
  }
  return String(fallback);
}

function stripLeadingQuestionNumber(line: string, label: string): string {
  return line.replace(new RegExp(`^${label}\\s*[\\).:-]?\\s*`), '').trim();
}

function isMostlyContainedText(candidate: string, target: string): boolean {
  const normalizedCandidate = normalizeBulkComparisonText(candidate);
  const normalizedTarget = normalizeBulkComparisonText(target);
  if (!normalizedCandidate || !normalizedTarget) return false;
  return normalizedTarget.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedTarget);
}

function buildBulkQuestionEntry(el: HTMLElement, config: SiteConfig, fallbackIndex: number): BulkQuestionEntry | null {
  const contextElements = findContextElements(el, config);
  const stemText = sanitizeBulkTextBlock(getCleanVisibleText(el));
  if (stemText.length < 10) return null;
  if (/^\d+\s*$/.test(stemText)) return null;
  const lines: string[] = [];
  contextElements.forEach((node) => {
    const text = sanitizeBulkTextBlock(getCleanVisibleText(node as HTMLElement));
    if (!text) return;
    if (node !== el && isMostlyContainedText(text, stemText)) return;
    text.split(/\n+/).forEach((line) => lines.push(line));
  });
  const cleanedLines = dedupeBulkLines(lines);
  if (cleanedLines.length === 0) return null;
  const label = extractBulkQuestionLabel(cleanedLines, fallbackIndex);
  const normalizedLines = cleanedLines.map((line, index) => (index === 0 ? stripLeadingQuestionNumber(line, label) : line)).filter(Boolean);
  const images: string[] = [];
  contextElements.forEach((node) => { getImagesInContainer(node as HTMLElement, 2).forEach((src) => { if (!images.includes(src)) images.push(src); }); });
  const text = normalizedLines.join('\n').trim();
  if (!text) return null;
  return { label, lines: normalizedLines, text, images };
}

function stripSharedBulkLines(entries: BulkQuestionEntry[]): BulkQuestionEntry[] {
  if (entries.length < 2) return entries;
  const counts = new Map<string, { count: number; sample: string }>();
  entries.forEach((entry) => {
    const seen = new Set<string>();
    entry.lines.forEach((line) => {
      const normalized = normalizeBulkComparisonText(line);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      const current = counts.get(normalized);
      counts.set(normalized, { count: (current?.count || 0) + 1, sample: current?.sample || line });
    });
  });
  const threshold = Math.max(2, Math.ceil(entries.length * 0.6));
  const shared = new Set(Array.from(counts.entries()).filter(([, value]) => {
    const sample = value.sample.trim();
    return value.count >= threshold && sample.length >= 12 && !looksMathHeavy(sample) && !/^\d+[\).:\s]/.test(sample);
  }).map(([key]) => key));
  if (shared.size === 0) return entries;
  return entries.map((entry) => {
    const filteredLines = entry.lines.filter((line) => !shared.has(normalizeBulkComparisonText(line)));
    const nextLines = filteredLines.length > 0 ? filteredLines : entry.lines;
    return { ...entry, lines: nextLines, text: nextLines.join('\n').trim() };
  });
}

function collectBulkQuestionEntries(config: SiteConfig): BulkQuestionEntry[] {
  let allPotential = Array.from(document.querySelectorAll(config.questionSelector)) as HTMLElement[];
  if (allPotential.length === 0) allPotential = querySelectorAllDeep(config.questionSelector);
  if (allPotential.length === 0 && config.name !== 'Generic Educational') {
    allPotential = querySelectorAllDeep('[data-testid*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i]');
  }
  const questions = getFinalistQuestions(allPotential, config);
  const entries: BulkQuestionEntry[] = [];
  let count = 0;
  questions.forEach((el) => {
    const entry = buildBulkQuestionEntry(el, config, count + 1);
    if (!entry) return;
    count += 1;
    entries.push(entry);
  });
  return stripSharedBulkLines(entries).filter((entry) => entry.text.length >= 8);
}

const SUPPORTED_SITES: SiteConfig[] = [
  { name: 'Google Forms', hostRegex: /docs\.google\.com\/forms/i, questionSelector: 'div[jsmodel="CP1oW"]', titleSelector: 'div[role="heading"]' },
  { name: 'Microsoft Forms', hostRegex: /forms\.(office|microsoft)\.com/i, questionSelector: '.office-form-question, [data-automation-id="questionItem"], .question-item', titleSelector: '.question-title, [data-automation-id="questionTitle"], .question-title-container', minScore: 0.35 },
  { name: 'Canvas', hostRegex: /instructure\.com/i, questionSelector: '.question, .display_question', titleSelector: '.question_text' },
  { name: 'Madrasati', hostRegex: /madrasati\./i, questionSelector: '.card.mb-4.question-item, .question-card, .view-question-container, .question-text-container, [class*="question" i], [id*="question" i]', titleSelector: '.card-header, .question-title, .question-text', minScore: 0.4, forceOverflowVisible: true, forceImageCapture: true },
  { name: 'Madrasti', hostRegex: /madrasti\./i, questionSelector: '.card.mb-4.question-item, .question-card, .view-question-container, .question-text-container, [class*="question" i], [id*="question" i]', titleSelector: '.card-header, .question-title, .question-text', minScore: 0.4, forceOverflowVisible: true, forceImageCapture: true },
  { name: '1600.lol', hostRegex: /1600\.lol/i, questionSelector: '.question-bank-item, [class*="QuestionDisplay"], [class*="QuestionWrapper"], [data-testid*="question" i], [class*="question" i], [id*="question" i]', minScore: 0.4, forceOverflowVisible: true, forceImageCapture: true },
  { name: 'OnePrep', hostRegex: /oneprep\.(xyz|com|io|app)/i, questionSelector: '.question-module, [class*="QuestionModule"], .question-container, [class*="QuestionWrapper"], [data-testid*="question" i], [class*="question" i], [id*="question" i]', minScore: 0.4, forceOverflowVisible: true, forceImageCapture: true },
  { name: 'Generic Educational', hostRegex: /.*/, questionSelector: '.question, .quiz-question, .problem, .exercise, [class*="question-item" i], [class*="question-container" i], [class*="question-wrapper" i], div[id*="question" i], .assessment-question, .form-group.p-3, [data-testid*="question" i], [data-test*="question" i], fieldset, [role="radiogroup"], [role="group"][aria-labelledby]' }
];

function looksLikeQuestionPage(): boolean {
  const questionishRoots = document.querySelectorAll(
    [
      '.question',
      '.quiz-question',
      '.problem',
      '.exercise',
      '[class*="question" i]',
      '[id*="question" i]',
      '[data-testid*="question" i]',
      '[class*="problem" i]',
      '[class*="exercise" i]',
    ].join(', ')
  ).length;

  const answerInputs = document.querySelectorAll(
    'input[type="radio"], input[type="checkbox"], textarea, input[type="text"], input:not([type]), [role="radio"], [role="checkbox"]'
  ).length;

  const mathNodes = document.querySelectorAll('mjx-container, .katex, .katex-display, svg[aria-label*="math" i]').length;
  const bodyText = (document.body?.innerText || '').slice(0, 5000);
  const hasPromptLanguage = /\b(what|which|solve|find|value|correct|incorrect|true|false|choose)\b/i.test(bodyText);

  return (questionishRoots > 0 && (answerInputs > 0 || mathNodes > 0))
    || (answerInputs > 0 && (mathNodes > 0 || hasPromptLanguage));
}

function getCurrentSiteConfig(): SiteConfig | null {
  const url = window.location.href;
  for (const site of SUPPORTED_SITES) { if (site.name !== 'Generic Educational' && site.hostRegex.test(url)) return site; }
  if (looksLikeQuestionPage()) {
    return SUPPORTED_SITES.find(s => s.name === 'Generic Educational') || null;
  }
  return null;
}

function querySelectorAllDeep(selector: string): HTMLElement[] {
  const results: HTMLElement[] = []; const seen = new Set<HTMLElement>();
  const traverse = (root: ParentNode) => {
    root.querySelectorAll(selector).forEach((el) => { const node = el as HTMLElement; if (!seen.has(node)) { seen.add(node); results.push(node); } });
    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode as Element | null;
    while (current) { const shadow = (current as HTMLElement).shadowRoot; if (shadow) traverse(shadow); current = walker.nextNode() as Element | null; }
  };
  traverse(document); return results;
}

function findFallbackQuestionContainers(): HTMLElement[] {
  const selectors = 'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], textarea, input[type="text"], input:not([type]), [role="textbox"]';
  const controls = Array.from(document.querySelectorAll(selectors)) as HTMLElement[];
  const candidates = new Set<HTMLElement>();
  const controlSelector = 'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]';

  controls.forEach((control) => {
    let current: HTMLElement | null = control.closest('fieldset, [role="radiogroup"], [role="group"], [class*="question" i], [data-testid*="question" i], [data-test*="question" i], .card, section, article, li, div') as HTMLElement | null;
    let depth = 0;
    while (current && depth < 6) {
      const optionCount = current.querySelectorAll(controlSelector).length;
      const textLength = sanitizeBulkTextBlock(getCleanVisibleText(current)).length;
      if ((optionCount >= 2 || current.querySelectorAll('textarea, input[type="text"], input:not([type]), [role="textbox"]').length > 0) && textLength >= 20 && textLength <= 2600) {
        candidates.add(current);
        break;
      }
      current = current.parentElement;
      depth += 1;
    }
  });

  return Array.from(candidates);
}

function scoreQuestionContainer(el: HTMLElement, config: SiteConfig | null): number {
  let score = 0;
  const text = getCleanVisibleText(el); const length = text.length;
  const hasQuestionMark = text.includes('?');
  const hasInputs = !!el.querySelector('input, textarea, select, [role="textbox"]');
  const hasTextEntry = !!el.querySelector('textarea, input[type="text"], input:not([type]), [role="textbox"]');
  const hasRadioOptions = !!el.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]');
  const radioOptionCount = el.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]').length;
  const hasImages = !!el.querySelector('img');
  const hasHeading = !!el.querySelector('h1, h2, h3, h4, [role="heading"]');
  const hasTitle = !!(config?.titleSelector && el.querySelector(config.titleSelector));
  const className = (el.className || '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const looksLikeChoiceRow =
    (className.includes('choice') || className.includes('option') || id.includes('choice') || id.includes('option')) &&
    !className.includes('question') &&
    !id.includes('question');
  if (length >= 30 && length < 120) score += 0.25; else if (length >= 120 && length < 400) score += 0.35; else if (length >= 400 && length < 1200) score += 0.3;
  else if (length >= 1200) score -= 0.4;
  if (hasQuestionMark) score += 0.15;
  if (hasInputs) score += 0.2;
  if (hasTextEntry) score += 0.18;
  if (hasRadioOptions) score += 0.15;
  if (hasHeading) score += 0.1;
  if (hasImages) score += 0.1;
  const innerCardCount = el.querySelectorAll('.office-form-question, [data-automation-id="questionItem"], .question-card, .card').length;
  if (innerCardCount > 1) score -= 0.5; // Penalize containers that hold multiple questions
  if (hasTitle) score += 0.15;
  if (config && config.name !== 'Generic Educational') score += 0.05;
  if (!hasTextEntry && radioOptionCount <= 1 && length < 120) score -= 0.35;
  if (looksLikeChoiceRow) score -= 0.45;
  return Math.max(0, Math.min(1, score));
}

let selectionButton: HTMLDivElement | null = null;
function showHighlightButton(x: number, y: number, text: string) {
    if (!selectionButton) {
        selectionButton = document.createElement('div'); selectionButton.id = 'oryx-selection-solve-btn';
        selectionButton.style.cssText = 'position: absolute; z-index: 2147483647; background: #6366f1; color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4); display: flex; align-items: center; gap: 8px; transition: all 0.2s; font-family: system-ui, sans-serif; pointer-events: auto;';
        selectionButton.innerHTML = `${getOryxInlineIcon(16)}<span>Solve Selection</span>`;
        selectionButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            const selection = window.getSelection(); const range = selection?.getRangeAt(0); const commonAncestor = range?.commonAncestorContainer as HTMLElement;
            const container = commonAncestor?.nodeType === 1 ? commonAncestor : commonAncestor?.parentElement;
            if (container) {
                const currentConfig = getCurrentSiteConfig();
                const questionEl = findQuestionContainer(container);
                let contextEl = questionEl || container;
                if (contextEl.innerText.length < 50 || contextEl.querySelectorAll('img').length === 0) contextEl = contextEl.parentElement || contextEl;

                const contextElements = questionEl ? findContextElements(questionEl, currentConfig) : [contextEl];
                const contextTextRaw = dedupeBulkLines(
                  contextElements.flatMap((node) => sanitizeBulkTextBlock(getCleanVisibleText(node as HTMLElement)).split(/\n+/))
                ).join('\n');
                const contextText = focusInlineQuestionText(contextTextRaw);

                const images = getImagesInContainer(contextEl, 4);
                const contextRect = getElementViewportRect(questionEl || contextEl, currentConfig);
                void requestAutoCrop(contextRect).then((capture) => {
                  const inlineImages = buildInlineImages(capture, images, currentConfig, 4);
                  const payloadText = [
                    'Solve this question.',
                    'Use the selected snippet first, and then the context.',
                    '',
                    'Selected text:',
                    focusInlineQuestionText(sanitizeBulkTextBlock(text.trim())),
                    '',
                    'Context:',
                    contextText || focusInlineQuestionText(sanitizeBulkTextBlock(text.trim())),
                  ].join('\n');
                  safeSendMessage({ type: MSG_INLINE_EXTRACT_QUESTION, payload: { text: payloadText, images: inlineImages } });
                });
            }
            selectionButton!.style.transform = 'scale(0.95)'; selectionButton!.innerHTML = '<span>Sent to Oryx!</span>';
            setTimeout(() => hideHighlightButton(), 1200);
        });
        document.body.appendChild(selectionButton);
    }
    selectionButton.style.display = 'flex'; selectionButton.style.left = `${x}px`; selectionButton.style.top = `${y + 15}px`;
}
function hideHighlightButton() { if (selectionButton) selectionButton.style.display = 'none'; }

interface QuestionFields { textFields: (HTMLInputElement | HTMLTextAreaElement)[]; options: { label: string; input: HTMLInputElement; container: HTMLElement }[]; }

function getInlineSolveButtonIdleHtml() {
  return `${getOryxInlineIcon(20)}<span style="font-size: 11px; font-weight: 800; margin-left: 6px; color: #475569; font-family: system-ui, sans-serif;">Solve</span>`;
}

function setInlineButtonIdle(button: HTMLButtonElement | null) {
  if (!button) return;
  button.disabled = false;
  button.style.opacity = '1';
  button.style.cursor = 'pointer';
  button.innerHTML = getInlineSolveButtonIdleHtml();
}

function setInlineButtonLoading(button: HTMLButtonElement | null) {
  if (!button) return;
  button.disabled = true;
  button.style.opacity = '0.85';
  button.style.cursor = 'wait';
  button.innerHTML = '<div class="oryx-thinking-spinner" style="width:16px; height:16px; border:2px solid #6366f1; border-top-color:transparent; border-radius:50%; animation: oryx-spin 0.8s linear infinite;"></div><style>@keyframes oryx-spin { to { transform: rotate(360deg); } }</style><span style="font-size: 11px; font-weight: 800; margin-left: 6px; color: #6366f1;">Thinking...</span>';
}

function showInlineAnalyzingState(answerBox: HTMLElement) {
  answerBox.style.display = 'block';
  answerBox.innerHTML = '<div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px;"><div style="width: 12px; height: 12px; border: 2px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: oryx-spin 0.8s linear infinite;"></div> Analyzing question...</div>';
}

function showInlineSendError(answerBox: HTMLElement, message: string) {
  answerBox.style.display = 'block';
  answerBox.innerHTML = `<div style="color: #ef4444; font-weight: 700; font-size: 14px; margin-bottom: 4px;">- Solve Failed</div><div style="font-size: 12px; color: #64748b;">${escapeHtml(message || 'Unable to send this question right now.')}</div>`;
}

function findQuestionContainer(el: HTMLElement | null): HTMLElement | null {
    if (!el) return null;
    const config = getCurrentSiteConfig();
    const selectors = (config?.questionSelector || '') + ', .question, .quiz-question, .problem, .exercise, [class*="question" i]';
    return el.closest(selectors);
}

function getImagesInContainer(container: HTMLElement, max = 6): string[] {
    const images: string[] = [];
    const isLikelyUiAsset = (value: string) => /logo|icon|avatar|profile|favicon|badge|spinner|office|outlook|microsoft|google|gstatic|clarity/i.test(value);
    const imgs = container.querySelectorAll('img');
    for (const img of Array.from(imgs)) {
        if (images.length >= max) break;
        const src = img.getAttribute('src') || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (!src || src === 'null') continue;
        const alt = `${img.getAttribute('alt') || ''} ${img.getAttribute('aria-label') || ''} ${img.className || ''}`.toLowerCase();
        if (isLikelyUiAsset(`${src} ${alt}`)) continue;
        if (img.closest('header, nav, footer, [role="banner"], [role="navigation"], .navbar, .header, .footer, .toolbar')) continue;
        const rect = img.getBoundingClientRect();
        const w = rect.width || img.width || img.naturalWidth;
        const h = rect.height || img.height || img.naturalHeight;
        if ((w > 0 && w < 24) || (h > 0 && h < 24)) continue;
        if (w > 0 && h > 0 && (w * h) < 900) continue;
        if (!images.includes(src)) images.push(src);
    }
    // Also scan for picture/choice elements
    const pictureElements = container.querySelectorAll('picture, [class*="choice"], [class*="option"], .choice-img');
    for (const el of Array.from(pictureElements)) {
        if (images.length >= max) break;
        const imgsInEl = el.querySelectorAll('img');
        for (const img of Array.from(imgsInEl)) {
            if (images.length >= max) break;
            const src = img.getAttribute('src') || img.src || img.getAttribute('data-src');
            if (src && !images.includes(src)) images.push(src);
        }
    }
    // Scan for background images
    if (images.length < max) {
        const bgEls = container.querySelectorAll('*');
        for (const el of Array.from(bgEls)) {
            if (images.length >= max) break;
            const style = window.getComputedStyle(el as Element);
            const bg = style.backgroundImage;
            if (bg && bg.startsWith('url(') && !bg.includes('none')) {
                const url = bg.slice(4, -1).replace(/['"]/g, "");
                const rect = (el as HTMLElement).getBoundingClientRect();
                if (rect.width >= 24 && rect.height >= 24 && url.startsWith('http') && !isLikelyUiAsset(url) && !images.includes(url)) images.push(url);
            }
        }
    }
    return images;
}

function buildInlineImages(primaryCapture: string | null, images: string[], config: SiteConfig | null, max = 4): string[] {
    const deduped = images.filter((src, index) => src && images.indexOf(src) === index);
    if (!primaryCapture) return deduped.slice(0, max);
    if (config?.forceImageCapture) return [primaryCapture];
    // When we have a screenshot AND remote URLs, include both:
    // the capture gives the AI layout/math context; the original URLs give
    // full-resolution image content. The bridge will try to fetch URLs
    // client-side and convert them to Files to avoid backend CORS issues.
    return [primaryCapture, ...deduped.filter((src) => src !== primaryCapture)].slice(0, max);
}

function findFieldsInContainer(container: HTMLElement): QuestionFields {
  const fields: QuestionFields = { textFields: [], options: [] };
  const textInputs = container.querySelectorAll('input[type="text"], input:not([type]), textarea');
  textInputs.forEach(input => { fields.textFields.push(input as (HTMLInputElement | HTMLTextAreaElement)); });
  const radioInputs = container.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  radioInputs.forEach(input => {
    const radio = input as HTMLInputElement;
    let labelText = '';
    if (radio.id) {
       const label = document.querySelector(`label[for="${radio.id}"]`);
       if (label) labelText = label.textContent?.trim() || '';
    }
    if (!labelText) {
       const parentLabel = radio.closest('label');
       if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
    }
    if (!labelText) {
       const parent = radio.parentElement;
       if (parent) labelText = parent.textContent?.trim() || '';
    }
    if (labelText) fields.options.push({ label: labelText, input: radio, container: radio.closest('div, li, .choice-container') || radio.parentElement! });
  });
  return fields;
}

// ── Answer Injection ──────────────────────────────────────────────────

type FieldSnapshot = {
  element: HTMLInputElement | HTMLTextAreaElement;
  previousValue: string;
  previousChecked: boolean;
};

/**
 * Extract a choice letter (A-D) from the AI answer string.
 * Handles formats like "A", "A)", "A.", "**A**", "Option A", "Choice A",
 * "The answer is A", etc.
 */
function extractAnswerChoice(answer: string): string | null {
  const cleaned = answer
    .replace(/\*\*/g, '')  // strip markdown bold
    .replace(/`/g, '')     // strip code ticks
    .trim();

  // Direct letter at start: "A", "A)", "A.", "A:"
  const directMatch = cleaned.match(/^([A-Da-d])\s*[).:\-]?\s/);
  if (directMatch) return directMatch[1].toUpperCase();

  // "The answer is A" / "Answer: A" / "Correct answer is B"
  const answerIsMatch = cleaned.match(/(?:the\s+)?(?:correct\s+)?answer\s*(?:is|:)\s*\(?([A-Da-d])\)?/i);
  if (answerIsMatch) return answerIsMatch[1].toUpperCase();

  // "Option A" / "Choice B"
  const optionMatch = cleaned.match(/(?:option|choice)\s+([A-Da-d])\b/i);
  if (optionMatch) return optionMatch[1].toUpperCase();

  // Just a single letter by itself (possibly with punctuation)
  const singleLetterMatch = cleaned.match(/^[(\[]?([A-Da-d])[)\].]?$/);
  if (singleLetterMatch) return singleLetterMatch[1].toUpperCase();

  return null;
}

/**
 * Apply the AI answer to form fields within a question container.
 * Returns an array of field snapshots for undo, or null if nothing was applied.
 */
function applyAnswerToFields(
  container: HTMLElement,
  answer: string,
): FieldSnapshot[] | null {
  const fields = findFieldsInContainer(container);
  const snapshots: FieldSnapshot[] = [];

  // ── Try MCQ first ──
  if (fields.options.length >= 2) {
    const choiceLetter = extractAnswerChoice(answer);
    if (choiceLetter) {
      const letterIndex = choiceLetter.charCodeAt(0) - 65; // A=0, B=1, …

      // Strategy 1: Match by position (A→first, B→second, etc.)
      let matched = false;
      if (letterIndex >= 0 && letterIndex < fields.options.length) {
        const opt = fields.options[letterIndex];
        snapshots.push({
          element: opt.input,
          previousValue: opt.input.value,
          previousChecked: opt.input.checked,
        });
        opt.input.checked = true;
        opt.input.dispatchEvent(new Event('change', { bubbles: true }));
        opt.input.dispatchEvent(new Event('input', { bubbles: true }));
        // Some frameworks listen for click
        opt.input.click();
        matched = true;
      }

      // Strategy 2: If position didn't work, try label text matching
      if (!matched) {
        for (const opt of fields.options) {
          const labelStart = opt.label.trim();
          // Check if label starts with the letter: "A) something" or "A. something"
          if (/^[A-Da-d]\s*[).:\-]/i.test(labelStart) &&
              labelStart[0].toUpperCase() === choiceLetter) {
            snapshots.push({
              element: opt.input,
              previousValue: opt.input.value,
              previousChecked: opt.input.checked,
            });
            opt.input.checked = true;
            opt.input.dispatchEvent(new Event('change', { bubbles: true }));
            opt.input.dispatchEvent(new Event('input', { bubbles: true }));
            opt.input.click();
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        // Highlight the selected option briefly
        for (const snap of snapshots) {
          const optEntry = fields.options.find(o => o.input === snap.element);
          if (optEntry?.container) {
            optEntry.container.style.transition = 'background-color 0.3s, outline 0.3s';
            optEntry.container.style.outline = '2px solid #6366f1';
            optEntry.container.style.outlineOffset = '2px';
            optEntry.container.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
          }
        }
        return snapshots;
      }
    }

    // Strategy 3: Match by answer text content against option labels
    const answerLower = answer.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (answerLower.length > 2) {
      for (const opt of fields.options) {
        const labelLower = opt.label.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        if (labelLower && (answerLower.includes(labelLower) || labelLower.includes(answerLower))) {
          snapshots.push({
            element: opt.input,
            previousValue: opt.input.value,
            previousChecked: opt.input.checked,
          });
          opt.input.checked = true;
          opt.input.dispatchEvent(new Event('change', { bubbles: true }));
          opt.input.dispatchEvent(new Event('input', { bubbles: true }));
          opt.input.click();
          const optEntry = fields.options.find(o => o.input === opt.input);
          if (optEntry?.container) {
            optEntry.container.style.transition = 'background-color 0.3s, outline 0.3s';
            optEntry.container.style.outline = '2px solid #6366f1';
            optEntry.container.style.outlineOffset = '2px';
            optEntry.container.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
          }
          return snapshots;
        }
      }
    }
  }

  // ── Try text fields ──
  if (fields.textFields.length > 0) {
    // Clean the answer to just the core value (strip "The answer is..." prefix)
    let cleanAnswer = answer
      .replace(/\*\*/g, '')
      .replace(/^(?:the\s+)?(?:correct\s+)?answer\s*(?:is|:)\s*/i, '')
      .trim();
    // If answer is very long (explanation mixed in), take first line only
    if (cleanAnswer.length > 200) {
      cleanAnswer = cleanAnswer.split('\n')[0].trim();
    }

    const field = fields.textFields[0];
    snapshots.push({
      element: field,
      previousValue: field.value,
      previousChecked: false,
    });
    // Use native setter to trigger React/Vue/Angular change detection
    const nativeSetter = Object.getOwnPropertyDescriptor(
      field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(field, cleanAnswer);
    } else {
      field.value = cleanAnswer;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.style.transition = 'outline 0.3s, background-color 0.3s';
    field.style.outline = '2px solid #6366f1';
    field.style.outlineOffset = '1px';
    field.style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
    return snapshots;
  }

  return null;
}

/**
 * Undo previously applied answer changes.
 */
function undoAppliedAnswer(snapshots: FieldSnapshot[]) {
  for (const snap of snapshots) {
    if (snap.element instanceof HTMLInputElement && (snap.element.type === 'radio' || snap.element.type === 'checkbox')) {
      snap.element.checked = snap.previousChecked;
      snap.element.dispatchEvent(new Event('change', { bubbles: true }));
      // Remove highlight from parent container
      const container = snap.element.closest('div, li, .choice-container') as HTMLElement | null;
      if (container) {
        container.style.outline = '';
        container.style.outlineOffset = '';
        container.style.backgroundColor = '';
      }
    } else {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        snap.element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(snap.element, snap.previousValue);
      } else {
        snap.element.value = snap.previousValue;
      }
      snap.element.dispatchEvent(new Event('input', { bubbles: true }));
      snap.element.dispatchEvent(new Event('change', { bubbles: true }));
      snap.element.style.outline = '';
      snap.element.style.outlineOffset = '';
      snap.element.style.backgroundColor = '';
    }
  }
}

/**
 * Build the Apply / Applied+Undo bar for the inline answer card.
 */
function buildApplyUndoBar(
  container: HTMLElement,
  answer: string,
): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0;';

  const applyBtn = document.createElement('button');
  applyBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
    <span style="margin-left: 5px;">Apply Answer</span>
  `;
  applyBtn.style.cssText = 'display: flex; align-items: center; background: #6366f1; color: white; border: none; border-radius: 8px; padding: 6px 14px; font-size: 11px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);';
  applyBtn.addEventListener('mouseenter', () => { applyBtn.style.background = '#4f46e5'; applyBtn.style.transform = 'translateY(-1px)'; });
  applyBtn.addEventListener('mouseleave', () => { applyBtn.style.background = '#6366f1'; applyBtn.style.transform = 'translateY(0)'; });

  let appliedSnapshots: FieldSnapshot[] | null = null;

  applyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const snapshots = applyAnswerToFields(container, answer);
    if (snapshots && snapshots.length > 0) {
      appliedSnapshots = snapshots;
      applyBtn.style.display = 'none';
      appliedIndicator.style.display = 'flex';
      undoBtn.style.display = 'flex';
    } else {
      applyBtn.innerHTML = '<span style="font-size: 11px; font-weight: 800;">No fields found</span>';
      applyBtn.style.background = '#94a3b8';
      applyBtn.style.cursor = 'default';
      setTimeout(() => {
        applyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          <span style="margin-left: 5px;">Apply Answer</span>
        `;
        applyBtn.style.background = '#6366f1';
        applyBtn.style.cursor = 'pointer';
      }, 2000);
    }
  });

  const appliedIndicator = document.createElement('div');
  appliedIndicator.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span style="margin-left: 4px;">Applied</span>
  `;
  appliedIndicator.style.cssText = 'display: none; align-items: center; background: #10b981; color: white; border-radius: 8px; padding: 6px 14px; font-size: 11px; font-weight: 800;';

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.style.cssText = 'display: none; align-items: center; background: transparent; color: #64748b; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 5px 12px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s;';
  undoBtn.addEventListener('mouseenter', () => { undoBtn.style.borderColor = '#ef4444'; undoBtn.style.color = '#ef4444'; });
  undoBtn.addEventListener('mouseleave', () => { undoBtn.style.borderColor = '#e2e8f0'; undoBtn.style.color = '#64748b'; });
  undoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (appliedSnapshots) {
      undoAppliedAnswer(appliedSnapshots);
      appliedSnapshots = null;
    }
    appliedIndicator.style.display = 'none';
    undoBtn.style.display = 'none';
    applyBtn.style.display = 'flex';
  });

  bar.appendChild(applyBtn);
  bar.appendChild(appliedIndicator);
  bar.appendChild(undoBtn);
  return bar;
}

function injectLogo(element: HTMLElement, config?: SiteConfig | null) {
  if (element.dataset.oryxInjected === "true") return;
  element.dataset.oryxInjected = "true";
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.position === 'static') element.style.position = 'relative';
  if (config?.forceOverflowVisible && computedStyle.overflow !== 'visible') element.style.overflow = 'visible';
  const injectionId = generateUniqueId();
  element.dataset.oryxInjectedId = injectionId;
  const shadowHost = document.createElement('div');
  shadowHost.className = 'oryx-inline-injector';
  shadowHost.style.cssText = 'position: absolute; bottom: 10px; right: 10px; inset-inline-end: 10px; display: flex; flex-direction: column; align-items: flex-end; width: auto; max-width: min(620px, calc(100vw - 24px)); z-index: 2147483647; pointer-events: none;';
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.innerHTML = getInlineSolveButtonIdleHtml();
  button.style.cssText = 'display: flex; align-items: center; justify-content: center; background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s; color: #475569; pointer-events: auto;';
  const answerBox = document.createElement('div');
  answerBox.id = 'answer-' + injectionId;
  answerBox.style.cssText = 'display: none; position: absolute; bottom: calc(100% + 8px); right: 0; inset-inline-end: 0; width: min(600px, 72vw); background: #f8fafc; border: 2px solid #e0e7ff; border-radius: 12px; padding: 16px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.1); font-family: system-ui, sans-serif; text-align: left; pointer-events: auto;';
  
  button.addEventListener('mouseenter', () => {
    if (button.disabled) return;
    button.style.borderColor = '#6366f1'; button.style.backgroundColor = '#f5f7ff'; button.style.transform = 'translateY(-2px)';
    const span = button.querySelector('span'); if (span) span.style.color = '#6366f1';
  });
  button.addEventListener('mouseleave', () => {
    button.style.borderColor = '#e2e8f0'; button.style.backgroundColor = 'white'; button.style.transform = 'translateY(0)';
    const span = button.querySelector('span'); if (span) span.style.color = '#475569';
  });
  
  button.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (button.disabled) return;
    const runSolve = async () => {
      try {
        const currentConfig = getCurrentSiteConfig();
        const contextElements = findContextElements(element, currentConfig);
        const extractedFields = findFieldsInContainer(element);
        const questionTextRaw = dedupeBulkLines(
          contextElements.flatMap((node) => sanitizeBulkTextBlock(getCleanVisibleText(node as HTMLElement)).split(/\n+/))
        ).join('\n');
        let questionText = focusInlineQuestionText(questionTextRaw);
        if (extractedFields.options.length > 0) {
          const choiceLines = extractedFields.options.map((opt, idx) => {
              const label = (opt.label || '').trim();
              return label ? `${String.fromCharCode(65 + idx)}) ${label}` : null;
            }).filter(Boolean).join('\n');
          if (choiceLines && !questionText.includes(choiceLines.slice(0, 20))) questionText += `\n\nChoices:\n${choiceLines}`;
        }
        const questionImages: string[] = [];
        contextElements.forEach(node => { getImagesInContainer(node as HTMLElement, 2).forEach(src => { if (!questionImages.includes(src)) questionImages.push(src); }); });
        getImagesInContainer(element, 6).forEach(src => { if (!questionImages.includes(src)) questionImages.push(src); });

        setInlineButtonLoading(button);
        showInlineAnalyzingState(answerBox);

        const brevityNote = "Be brief: return the final answer and a short explanation (1-2 sentences).";
        const imageNote = questionImages.length > 0 ? "Use attached images if needed." : "";

        let finalMathImage: string | null = null;
        if (shouldAutoCapture(currentConfig, questionText, questionImages, element.contains(element.querySelector('svg, mjx-container, .katex')))) {
            const rect = getElementViewportRect(element, currentConfig);
            finalMathImage = await requestAutoCrop(rect);
        }
        const inlineImages = buildInlineImages(finalMathImage, questionImages, currentConfig, 4);

        const staleTimeout = pendingInlineSolveTimeouts.get(injectionId);
        if (typeof staleTimeout === 'number') {
          window.clearTimeout(staleTimeout);
        }
        const timeoutId = window.setTimeout(() => {
          pendingInlineSolveTimeouts.delete(injectionId);
          setInlineButtonIdle(button);
          showInlineSendError(answerBox, 'Timed out waiting for a response. Please try again.');
        }, INLINE_SOLVE_RESULT_TIMEOUT_MS);
        pendingInlineSolveTimeouts.set(injectionId, timeoutId);

        safeSendMessage({
          type: MSG_INLINE_SOLVE_AND_INJECT,
          payload: {
            injectionId,
            text: [
              'Solve this question.',
              brevityNote,
              'If this is multiple choice, return the exact choice letter and text.',
              'Use the passage/context if present.',
              imageNote,
              '',
              'Question:',
              focusInlineQuestionText(questionText.trim()),
            ].filter(Boolean).join('\n'),
            images: inlineImages,
          }
        }, (response?: { ok?: boolean; error?: string }) => {
          const runtimeError = chrome.runtime.lastError;
          if (!runtimeError && response?.ok) return;

          const activeTimeout = pendingInlineSolveTimeouts.get(injectionId);
          if (typeof activeTimeout === 'number') {
            window.clearTimeout(activeTimeout);
            pendingInlineSolveTimeouts.delete(injectionId);
          }
          setInlineButtonIdle(button);
          showInlineSendError(
            answerBox,
            runtimeError?.message || response?.error || 'Could not send this question to the extension.',
          );
        });
      } catch (error) {
        const activeTimeout = pendingInlineSolveTimeouts.get(injectionId);
        if (typeof activeTimeout === 'number') {
          window.clearTimeout(activeTimeout);
          pendingInlineSolveTimeouts.delete(injectionId);
        }
        setInlineButtonIdle(button);
        const errorMessage = error instanceof Error ? error.message : 'Unable to prepare this question.';
        showInlineSendError(answerBox, errorMessage);
      }
    };
    void runSolve();
  });
  shadowRoot.appendChild(button); shadowRoot.appendChild(answerBox);
  element.appendChild(shadowHost);
}

function getFinalistQuestions(allPotential: HTMLElement[], config: SiteConfig): HTMLElement[] {
    const roughCandidates = allPotential.filter(q => {
        const el = q as HTMLElement;
        if (['BODY', 'HTML', 'MAIN', 'HEADER', 'FOOTER', 'FORM', 'NAV', 'ASIDE', 'BUTTON', 'INPUT', 'LABEL', 'SPAN', 'A', 'SVG'].includes(el.tagName)) return false;
        const text = el.innerText.trim();
        const hasImg = el.querySelector('img') !== null;
        const optionCount = el.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]').length;
        if (text.length < 5 && !hasImg) return false;
        if (text.length < 15 && !hasImg && !el.innerText.includes('-')) return false;
        const className = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const role = (el.getAttribute('role') || '').toLowerCase();
        if (role === 'button' || role === 'radio' || role === 'checkbox' || role === 'option') return false;
        if ((className.includes('choice') || className.includes('option') || id.includes('choice') || id.includes('option')) && !(className.includes('question') || id.includes('question'))) return false;
        if (optionCount === 1 && text.length < 100) return false;
        if (el.children.length > 150) return false;
        if (el.offsetHeight > window.innerHeight * 1.2) return false;
        if (el.offsetWidth < 40 || el.offsetHeight < 20) return false;
        return true;
    });
    const minScore = config.minScore || MIN_QUESTION_SCORE;
    const scoredCandidates = roughCandidates.map((node) => {
        const el = node as HTMLElement;
        const score = scoreQuestionContainer(el, config);
        const optionCount = el.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]').length;
        const hasTextEntry = !!el.querySelector('textarea, input[type="text"], input:not([type]), [role="textbox"]');
        const hasTitle = !!(config?.titleSelector && el.querySelector(config.titleSelector));
        const textLength = getCleanVisibleText(el).length;
        return { el, score, optionCount, hasTextEntry, hasTitle, textLength };
    }).filter((c) => c.score >= minScore);
    const finalists = scoredCandidates.filter((candidate) => {
        const el = candidate.el;
        const betterAncestor = scoredCandidates.some((other) => {
            if (other.el === el || !other.el.contains(el)) return false;
            const materiallyMoreOptions = other.optionCount >= Math.max(2, candidate.optionCount + 1);
            const betterStructured = other.hasTitle || other.hasTextEntry || other.textLength > candidate.textLength + 40;
            const scoreCloseOrBetter = other.score >= candidate.score - 0.05;
            return scoreCloseOrBetter && (materiallyMoreOptions || betterStructured);
        });
        if (betterAncestor) return false;
        const style = window.getComputedStyle(el);
        if (style.cursor === 'pointer' && el.innerText.length < 200) return false;
        if (el.tagName === 'BUTTON' || el.closest('button')) return false;
        return true;
    }).map((candidate) => candidate.el);
    const sorted = finalists.sort((a,b) => {
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        return (ra.top + window.scrollY) - (rb.top + window.scrollY) || (ra.left - rb.left);
    });
    const deduplicatedFinalists: HTMLElement[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i]; const prev = deduplicatedFinalists[deduplicatedFinalists.length - 1];
        if (prev) {
            const rectCur = current.getBoundingClientRect(); const rectPrev = prev.getBoundingClientRect();
            const vDist = Math.abs(rectCur.top - rectPrev.top);
            if (vDist < 120 && current.parentElement === prev.parentElement) {
                const curTextLen = current.innerText.trim().length;
                const prevTextLen = prev.innerText.trim().length;
                if (!hasOptions(current) || (curTextLen < 40 && prevTextLen > 100)) continue;
            }
        }
        deduplicatedFinalists.push(current);
    }
    return deduplicatedFinalists;
}

function addExtractAllButton(config: SiteConfig) {
    if (document.getElementById('oryx-extract-all-container')) return;
    const container = document.createElement('div');
    container.id = 'oryx-extract-all-container';
    container.style.cssText = 'position: fixed; bottom: 30px; right: 30px; z-index: 2147483647; display: none; flex-direction: column; gap: 10px; align-items: flex-end; font-family: system-ui, sans-serif;';
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = `<span style="display:inline-flex; margin-right:8px;">${getOryxInlineIcon(16)}</span>Copy All`;
    copyBtn.style.cssText = 'background: white; border: 2px solid #6366f1; color: #6366f1; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.3); display: flex; align-items: center; transition: all 0.2s;';
    const solveBtn = document.createElement('button');
    solveBtn.innerHTML = '- Solve Bulk Answers';
    solveBtn.style.cssText = 'background: #6366f1; border: 2px solid #6366f1; color: white; padding: 10px 20px; border-radius: 20px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.4); display: flex; align-items: center; transition: all 0.2s;';
    [copyBtn, solveBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05) translateY(-3px)'; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1) translateY(0)'; });
    });
    copyBtn.addEventListener('click', () => {
        const entries = collectBulkQuestionEntries(config);
        const allText = entries.map((entry) => `QUESTION ${entry.label}:\n${entry.text}`).join('\n\n');
        if (allText) {
            const originalHtml = copyBtn.innerHTML;
            navigator.clipboard.writeText(allText.trim()).then(() => { copyBtn.innerHTML = '- Copied!'; setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000); }).catch(() => { copyBtn.innerHTML = '- Copy Failed'; setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000); });
        }
    });
    solveBtn.addEventListener('click', () => {
        const entries = collectBulkQuestionEntries(config);
        const allText = entries.map((entry) => `QUESTION ${entry.label}:\n${entry.text}`).join('\n\n');
        const allImages: string[] = [];
        entries.forEach((entry) => { entry.images.forEach((src) => { if (!allImages.includes(src)) allImages.push(src); }); });
        if (allText) {
            safeSendMessage({ 
              type: MSG_INLINE_EXTRACT_QUESTION, 
              payload: { 
                text: `I need an answer key for the following questions. Provide a clear, numbered list of ONLY the final answers (e.g., 1. A, 2. 15, 3. True). No steps or reasoning.\n\nQuestions:\n${allText}`, 
                images: allImages.slice(0, 8), // Restored to 8 as requested
                isBulk: true 
              } 
            });
            const originalHtml = solveBtn.innerHTML; solveBtn.innerHTML = '- Sending...'; setTimeout(() => { solveBtn.innerHTML = originalHtml; }, 3000);
        }
    });
    container.appendChild(solveBtn); container.appendChild(copyBtn); document.body.appendChild(container);
}

function initInjector() {
  const config = getCurrentSiteConfig();
  document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection(); const text = selection?.toString().trim();
      if (text && text.length > 10) showHighlightButton(e.pageX, e.pageY, text);
      else setTimeout(() => { const currentSelection = window.getSelection(); if (!currentSelection || currentSelection.toString().length < 2) hideHighlightButton(); }, 100);
  });
  if (config) {
    const scanAndInject = () => {
        const currentConfig = getCurrentSiteConfig(); if (!currentConfig) return;
        let allPotential = querySelectorAllDeep(currentConfig.questionSelector);
        if (allPotential.length === 0) {
          allPotential = querySelectorAllDeep('[data-testid*="question" i], [data-test*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i], fieldset, [role="radiogroup"]');
        }
        if (allPotential.length === 0) {
          allPotential = findFallbackQuestionContainers();
        }
        const deduplicatedFinalists = getFinalistQuestions(allPotential, currentConfig);
        if (deduplicatedFinalists.length > 0 && !document.getElementById('oryx-extract-all-container')) {
          addExtractAllButton(currentConfig);
        }
        deduplicatedFinalists.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.dataset.oryxInjected !== "true" || !htmlEl.querySelector('.oryx-inline-injector')) injectLogo(htmlEl, currentConfig);
        });
        const validCount = document.querySelectorAll('[data-oryx-injected="true"]').length;
        const extContainer = document.getElementById('oryx-extract-all-container');
        if (extContainer && validCount > 0) extContainer.style.display = 'flex';
    };
    let scanFrame = 0;
    const scheduleScan = () => { if (scanFrame) return; scanFrame = window.requestAnimationFrame(() => { scanFrame = 0; scanAndInject(); }); };
    const observer = new MutationObserver((mutations) => { if (mutations.some((m) => m.addedNodes.length > 0)) scheduleScan(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(scheduleScan, 1000);
  }
}

const inlineInjectorWindow = window as typeof window & { __oryxInlineInjectorReady?: boolean };
if (!inlineInjectorWindow.__oryxInlineInjectorReady) {
  inlineInjectorWindow.__oryxInlineInjectorReady = true;
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MSG_CROP_CAPTURE_READY && pendingAutoCrop) {
      const resolve = pendingAutoCrop.resolve; window.clearTimeout(pendingAutoCrop.timeoutId);
      pendingAutoCrop = null; resolve(String(message.imageDataUrl || '')); return;
    }
    if (message?.type === MSG_CROP_CAPTURE_ERROR && pendingAutoCrop) {
      const resolve = pendingAutoCrop.resolve; window.clearTimeout(pendingAutoCrop.timeoutId);
      pendingAutoCrop = null; resolve(null); return;
    }
    if (message.type === MSG_INLINE_SOLVE_RESULT) {
      const { injectionId, answer, explanation, steps } = message.payload;
      const timeoutId = pendingInlineSolveTimeouts.get(injectionId);
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
        pendingInlineSolveTimeouts.delete(injectionId);
      }
      const host = Array.from(document.querySelectorAll('.oryx-inline-injector')).find(h => (h as HTMLElement).parentElement?.dataset.oryxInjectedId === injectionId) as HTMLElement;
      if (host && host.shadowRoot) {
          const answerBox = host.shadowRoot.getElementById('answer-' + injectionId);
          const btn = host.shadowRoot.querySelector('button');
          setInlineButtonIdle(btn as HTMLButtonElement | null);
          if (answerBox) {
            if (answer === 'Solve Failed') {
                answerBox.innerHTML = `<div style="color: #ef4444; font-weight: 700; font-size: 14px; margin-bottom: 4px;">- Solve Failed</div><div style="font-size: 12px; color: #64748b;">${escapeHtml(explanation || 'Unknown error occurred')}</div>`;
            } else {
                ensureKatexStyles(host.shadowRoot);
                const answerHtml = renderInlineContent(normalizeInlineMath(answer || ''));
                const explanationHtml = renderInlineContent(normalizeInlineMath(explanation || ''));
                let stepsHtml = '';
                if (Array.isArray(steps) && steps.length > 0) {
                  stepsHtml = `<div style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                    <div style="font-weight: 800; font-size: 11px; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                      STEPS
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${steps.map((step, idx) => `
                      <div style="display: flex; gap: 10px; align-items: flex-start;">
                        <div style="flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; margin-top: 2px;">${idx + 1}</div>
                        <div style="font-size: 13px; color: #475569; line-height: 1.5; flex: 1; font-weight: 500;">${renderInlineContent(normalizeInlineMath(step))}</div>
                      </div>
                    `).join('')}
                    </div>
                  </div>`;
                }
                answerBox.innerHTML = `
                  <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 12px 16px; border-radius: 12px; color: white; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);">
                    <div style="font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      SUGGESTED ANSWER
                    </div>
                    <div style="font-weight: 900; font-size: 20px;">${answerHtml || escapeHtml(answer || '')}</div>
                  </div>
                  <div style="font-size: 13px; color: #475569; line-height: 1.6; padding: 0 4px; font-weight: 500;">${explanationHtml || escapeHtml(explanation || '')}</div>
                  ${stepsHtml}
                `;
                // Append Apply/Undo bar — the question container is the shadow host's parent
                const questionContainer = host.parentElement;
                if (questionContainer) {
                  answerBox.appendChild(buildApplyUndoBar(questionContainer, answer));
                }
            }
          }
      }
    }
  });
  if (document.body) initInjector(); else document.addEventListener('DOMContentLoaded', initInjector, { once: true });
}
