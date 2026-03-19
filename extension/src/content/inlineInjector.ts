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

// Minimum confidence score (0-1) for treating an element as a real question container
const MIN_QUESTION_SCORE = 0.45;

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
      const text = node.innerText?.trim() || '';
      
      // Stop if we hit another distinct question (has its own options)
      if (hasOptions(node)) break;

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
  while (current && level < 5) {
      const sibs = Array.from(current.parentElement?.children || []);
      const myIdx = sibs.indexOf(current);
      for (let i = 0; i < myIdx; i++) {
          const sib = sibs[i] as HTMLElement;
          const text = sib.innerText?.trim() || '';
          // Only include if it doesn't look like a separate independent question
          if (!hasOptions(sib) && (text.length > 60 || sib.querySelector('img, svg'))) {
              if (!elements.includes(sib)) elements.unshift(sib);
          }
      }
      current = current.parentElement;
      level++;
      if (elements.length > 2) break;
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
  // Use findContextElements but filter out very large containers that might bloat the crop too much
  const contextElements = findContextElements(el, config);
  const rects = contextElements
    .map((node) => node.getBoundingClientRect())
    .filter((r) => r.width > 4 && r.height > 4 && r.height < window.innerHeight * 1.5);

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

    // Arabic Metadata Removal (Madrasati / Generic) - Enhanced with \s+ for robustness
    const arabicNoise = [
        /----\s+------\s+\d+(\.\d+)-/g,
        /-----\s+--\s+---/g,
        /-----/g,
        /----\s+-------\s+-------/g,
        /-----\s+-------/g,
        /------\s+-------/g,
        /---\s+---\s+--\s+---/g,
        /------\s+\/\s+------\s+-------/g,
        /-----/g,
        /--\s+----/g
    ];
    arabicNoise.forEach(re => { text = text.replace(re, ''); });

    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

interface BulkQuestionEntry {
  label: string;
  lines: string[];
  text: string;
  images: string[];
}

function normalizeBulkComparisonText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, '')
    .replace(/[^\p{L}\p{N}+=\-*/^<>≤≥(),.:;]/gu, '');
}

function sanitizeBulkTextBlock(text: string): string {
  let out = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const uiNoisePatterns = [
    /أدخل إجابتك الرياضية/gi,
    /التبديل إلى نص/gi,
    /enter your answer(?:\s+mathematically)?/gi,
    /switch to text/gi,
    /required to answer/gi,
    /this question is required/gi,
    /\brequired\b/gi,
    /mark for review/gi,
  ];

  uiNoisePatterns.forEach((pattern) => {
    out = out.replace(pattern, ' ');
  });

  out = out
    .replace(/\(\s*\d+\s*(?:نقطة|points?)\s*\)/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

function looksMathHeavy(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  const operatorCount = (compact.match(/[=+\-*/^<>≤≥]/g) || []).length;
  return operatorCount >= 1 && /[A-Za-z0-9]/.test(compact);
}

function expandBulkLine(line: string): string[] {
  let out = sanitizeBulkTextBlock(line);
  if (!out) return [];

  out = out
    .replace(/^QUESTION\s+\d+:\s*/i, '')
    .replace(/^(\d+)\.(?=\S)/, '$1. ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s*:\s*/g, ': ')
    .replace(/([)\]])(?=[A-Za-z\u0600-\u06FF])/g, '$1 ');

  const instructionMatch = out.match(
    /^(\d+\.\s*)?(Solve(?: for x)?|Simplify|Divide|Long Division|Solve the following simultaneous equation)(.+)$/i,
  );

  if (instructionMatch) {
    const [, prefix = '', instruction, restRaw] = instructionMatch;
    const rest = restRaw.trim();
    if (rest && looksMathHeavy(rest)) {
      return [`${prefix}${instruction}`.trim(), rest];
    }
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
  if (stemText.includes('-------- --------') || stemText.includes('--- ------') || stemText.includes('---- ---------')) return null;

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
  const normalizedLines = cleanedLines
    .map((line, index) => (index === 0 ? stripLeadingQuestionNumber(line, label) : line))
    .filter(Boolean);

  const images: string[] = [];
  contextElements.forEach((node) => {
    getImagesInContainer(node as HTMLElement, 2).forEach((src) => {
      if (!images.includes(src)) images.push(src);
    });
  });

  const text = normalizedLines.join('\n').trim();
  if (!text) return null;

  return {
    label,
    lines: normalizedLines,
    text,
    images,
  };
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
  const shared = new Set(
    Array.from(counts.entries())
      .filter(([, value]) => {
        const sample = value.sample.trim();
        return value.count >= threshold
          && sample.length >= 12
          && !looksMathHeavy(sample)
          && !/^\d+[\).:\s]/.test(sample);
      })
      .map(([key]) => key),
  );

  if (shared.size === 0) return entries;

  return entries.map((entry) => {
    const filteredLines = entry.lines.filter((line) => !shared.has(normalizeBulkComparisonText(line)));
    const nextLines = filteredLines.length > 0 ? filteredLines : entry.lines;
    return {
      ...entry,
      lines: nextLines,
      text: nextLines.join('\n').trim(),
    };
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
    hostRegex: /oneprep\.(xyz|com|io|app)/i,
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
            display: flex; align-items: center; gap: 8px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: system-ui, -apple-system, sans-serif;
            pointer-events: auto;
        `;
        selectionButton.innerHTML = `
            ${getOryxInlineIcon(16, '#ffffff')}
            <span>Solve Highlight</span>
        `;
        selectionButton.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            const selection = window.getSelection();
            const range = selection?.getRangeAt(0);
            const commonAncestor = range?.commonAncestorContainer as HTMLElement;
            const container = commonAncestor?.nodeType === 1 ? commonAncestor : commonAncestor?.parentElement;
            
            if (container) {
                const questionEl = findQuestionContainer(container);
                let contextEl = questionEl || container;
                if (contextEl.innerText.length < 50 || contextEl.querySelectorAll('img').length === 0) {
                    contextEl = contextEl.parentElement || contextEl;
                }
                let imagesUnderSelection = getImagesInContainer(contextEl, 4);
                if (imagesUnderSelection.length === 0) {
                    const allVisibleImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                        const rect = img.getBoundingClientRect();
                        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 100;
                    });
                    if (allVisibleImgs.length > 0) {
                        imagesUnderSelection = [allVisibleImgs[0].src];
                    }
                }
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
    selectionButton.style.top = `${y + 15}px`;
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
    const imgs = container.querySelectorAll('img');
    for (const img of Array.from(imgs)) {
        if (images.length >= max) break;
        // Try multiple attribute sources
        const src = img.getAttribute('src') || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('data-image');
        if (!src || src.includes('icon') || src.includes('logo') || src === 'null') continue;
        const isSupported = src.startsWith('http') || src.startsWith('data:image/') || src.startsWith('//');
        if (!isSupported) continue;
        const w = img.width || img.naturalWidth; 
        const h = img.height || img.naturalHeight;
        if ((w > 0 && w < 12) || (h > 0 && h < 12)) continue;
        // Also check computed dimensions
        const rect = img.getBoundingClientRect();
        if ((rect.width > 0 && rect.width < 12) || (rect.height > 0 && rect.height < 12)) continue;
        if (!images.includes(src)) {
            console.log('[ORYX] Found image:', src.substring(0, 60));
            images.push(src);
        }
    }
    // Also scan for picture/choice elements that might contain images
    const pictureElements = container.querySelectorAll('picture, [class*="choice"], [class*="option"], [role="option"], .choice-img, img[alt]');
    for (const el of Array.from(pictureElements)) {
        if (images.length >= max) break;
        const imgsInEl = el.querySelectorAll('img');
        for (const img of Array.from(imgsInEl)) {
            if (images.length >= max) break;
            const src = img.getAttribute('src') || img.src || img.getAttribute('data-src');
            if (!src || src.includes('icon') || src.includes('logo')) continue;
            if (!images.includes(src)) {
                console.log('[ORYX] Found image in choice:', src.substring(0, 60));
                images.push(src);
            }
        }
    }
    if (images.length < max) {
        const bgEls = container.querySelectorAll('*');
        for (const el of Array.from(bgEls)) {
            if (images.length >= max) break;
            const style = window.getComputedStyle(el as Element);
            const bg = style.backgroundImage;
            if (bg && bg.startsWith('url(') && !bg.includes('none')) {
                const url = bg.slice(4, -1).replace(/['"]/g, "");
                if (url.startsWith('http') && !images.includes(url)) {
                    console.log('[ORYX] Found background image:', url.substring(0, 60));
                    images.push(url);
                }
            }
        }
    }
    return images;
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
    if (labelText) {
      fields.options.push({ label: labelText, input: radio, container: radio.closest('div, li, .choice-container') || radio.parentElement! });
    }
  });
  return fields;
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
  shadowHost.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: flex-end; margin-top: 12px; width: 100%; z-index: 2147483647;';
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.innerHTML = `${getOryxInlineIcon(20, '#4f46e5')}<span style="font-size: 11px; font-weight: 800; margin-left: 6px; display: none; font-family: system-ui, sans-serif;">Solve Inline</span>`;
  button.style.cssText = 'display: flex; align-items: center; justify-content: center; background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s; color: #475569;';
  const answerBox = document.createElement('div');
  answerBox.id = 'answer-' + injectionId;
  answerBox.style.cssText = 'display: none; width: 100%; max-width: 600px; margin-top: 12px; background: #f8fafc; border: 2px solid #e0e7ff; border-radius: 12px; padding: 16px; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.1); font-family: system-ui, sans-serif; text-align: left;';
  button.addEventListener('mouseenter', () => {
    button.style.borderColor = '#6366f1'; button.style.backgroundColor = '#f5f7ff'; button.style.transform = 'translateY(-2px)';
    const span = button.querySelector('span'); if (span) { span.style.display = 'inline'; span.style.color = '#6366f1'; }
  });
  button.addEventListener('mouseleave', () => {
    button.style.borderColor = '#e2e8f0'; button.style.backgroundColor = 'white'; button.style.transform = 'translateY(0)';
    const span = button.querySelector('span'); if (span) span.style.display = 'none';
  });
  button.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    console.log('[ORYX] - INLINE BUTTON CLICKED! Element:', element.className, element.id);
    console.log('[ORYX] - Element text (first 100):', element.innerText?.substring(0, 100));
    try {
    const runSolve = async () => {
      const currentConfig = getCurrentSiteConfig();
      console.log('[ORYX] Config:', currentConfig?.name);
      const contextElements = findContextElements(element, currentConfig);
      console.log('[ORYX] Context elements found:', contextElements.length);
      const extractedFields = findFieldsInContainer(element);
      console.log('[ORYX] Options found:', extractedFields.options.length);
      console.log('[ORYX] Options labels:', extractedFields.options.map(o => o.label.substring(0, 30)));
      let questionText = contextElements.map(node => getCleanVisibleText(node as HTMLElement)).join('\n\n');
      let choiceLines = '';
      if (extractedFields.options.length > 0) {
        choiceLines = extractedFields.options.map((opt, idx) => {
            const label = (opt.label || '').trim();
            if (!label) return null;
            return `${String.fromCharCode(65 + idx)}) ${label}`;
          }).filter(Boolean).join('\n');
        if (choiceLines && !questionText.includes(choiceLines.slice(0, 20))) questionText += `\n\nChoices:\n${choiceLines}`;
      }
      
      // Capture images from context elements
      const questionImages: string[] = [];
      contextElements.forEach(node => { getImagesInContainer(node as HTMLElement, 2).forEach(src => { if (!questionImages.includes(src)) questionImages.push(src); }); });
      
      // Also capture images from the main question element itself (covers picture options)
      const mainElementImages = getImagesInContainer(element, 6);
      console.log('[ORYX] Images from main element:', mainElementImages.length);
      mainElementImages.forEach(src => {
        if (!questionImages.includes(src)) {
          questionImages.push(src);
        }
      });
      
      // Also scan siblings for images (Madrasati might have images in separate elements)
      const siblingScan = () => {
        let sibling = element.nextElementSibling;
        let count = 0;
        while (sibling && count < 5) {
          const imgs = getImagesInContainer(sibling as HTMLElement, 4);
          imgs.forEach(src => {
            if (!questionImages.includes(src)) {
              console.log('[ORYX] Found image in next sibling:', src.substring(0, 50));
              questionImages.push(src);
            }
          });
          sibling = sibling.nextElementSibling;
          count++;
        }
        // Also check previous siblings
        let prevSibling = element.previousElementSibling;
        count = 0;
        while (prevSibling && count < 3) {
          const imgs = getImagesInContainer(prevSibling as HTMLElement, 4);
          imgs.forEach(src => {
            if (!questionImages.includes(src)) {
              console.log('[ORYX] Found image in prev sibling:', src.substring(0, 50));
              questionImages.push(src);
            }
          });
          prevSibling = prevSibling.previousElementSibling;
          count++;
        }
      };
      siblingScan();
      
      // Also capture images from option/choice elements if they exist
      if (extractedFields.options.length > 0) {
        console.log('[ORYX] Scanning options for images...');
        extractedFields.options.forEach((opt, idx) => {
          const optionContainer = opt.container as HTMLElement;
          console.log('[ORYX] Option', idx, 'container:', optionContainer?.className);
          if (optionContainer) {
            const optionImages = getImagesInContainer(optionContainer, 2);
            console.log('[ORYX] Option', idx, 'images:', optionImages.length);
            optionImages.forEach(src => {
              if (!questionImages.includes(src)) questionImages.push(src);
            });
          }
        });
      }
      
      // If still no images found, do a broader scan of the question element for any images
      if (questionImages.length === 0) {
        console.log('[ORYX] No images found yet, doing broader scan...');
        const allImgs = element.querySelectorAll('img');
        console.log('[ORYX] All images in question element:', allImgs.length);
        for (const img of Array.from(allImgs)) {
          const src = img.getAttribute('src') || img.src;
          if (src && !src.includes('icon') && !src.includes('logo') && (img.width > 20 || img.height > 20)) {
            if (!questionImages.includes(src)) {
              questionImages.push(src);
              console.log('[ORYX] Added image:', src.substring(0, 50));
            }
          }
        }
      }
      
      console.log('[ORYX] Question images found:', questionImages.length, questionImages.map(s => s.substring(0, 50)));
      console.log('[ORYX] Question text (first 200 chars):', questionText.substring(0, 200));
      const hasVisuals = Boolean(element.querySelector('svg, canvas, mjx-container, .katex'));
      let capturedImage: string | null = null;
      if (shouldAutoCapture(currentConfig, questionText, questionImages, hasVisuals)) {
        const rect = getElementViewportRect(element, currentConfig);
        capturedImage = await requestAutoCrop(rect);
      }
      if (capturedImage) questionImages.unshift(capturedImage);
      button.innerHTML = `<span style="font-size:11px; font-weight:800; color:#6366f1; white-space:nowrap; padding:2px; font-family: system-ui;">Thinking...</span>`;
      answerBox.style.display = 'block';
      answerBox.innerHTML = `<div style="display: flex; align-items: center; gap: 8px; color: #6366f1; font-weight: 700;"><span style="display:inline-flex; animation: pulse 1.5s infinite;">${getOryxInlineIcon(16, '#6366f1')}</span>Decoding question...</div><style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }</style>`;
      const imageNote = capturedImage ? 'Use the attached image as the source of truth if the text seems incomplete.' : '';
      const brevityNote = 'Be extremely brief: Provide a short direct answer and a 1-2 sentence explanation max.';
      const shouldPreferImageOnly = Boolean(capturedImage && currentConfig?.forceImageCapture);
      const sendText = shouldPreferImageOnly ? `Solve from the attached image. ${brevityNote} If there is any conflict, use the image.${choiceLines ? `\n\nDetected choices:\n${choiceLines}` : ''}` : `Solve this question. ${brevityNote} ${imageNote}\n\n${questionText.trim()}`;
      chrome.runtime.sendMessage({ type: MSG_INLINE_SOLVE_AND_INJECT, payload: { text: sendText, images: questionImages, injectionId } });
    };
    void runSolve();
    } catch (err) {
      console.error('[ORYX] Error in inline solve:', err);
      button.innerHTML = `<span style="font-size:11px; font-weight:800; color:#ef4444; white-space:nowrap; padding:2px; font-family: system-ui;">Error</span>`;
    }
  });
  shadowRoot.appendChild(button); shadowRoot.appendChild(answerBox);
  if (element.firstChild) element.insertBefore(shadowHost, element.firstChild); else element.appendChild(shadowHost);
}

function getFinalistQuestions(allPotential: HTMLElement[], config: SiteConfig): HTMLElement[] {
    const roughCandidates = allPotential.filter(q => {
        const el = q as HTMLElement;
        if (['BODY', 'HTML', 'MAIN', 'HEADER', 'FOOTER', 'FORM', 'NAV', 'ASIDE', 'BUTTON', 'INPUT', 'LABEL', 'SPAN', 'A', 'SVG'].includes(el.tagName)) return false;
        const text = el.innerText.trim();
        const hasImg = el.querySelector('img') !== null;
        if (text.length < 5 && !hasImg) return false;
        if (text.length < 15 && !hasImg && !el.innerText.includes('-')) return false;
        const className = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const role = (el.getAttribute('role') || '').toLowerCase();
        if (role === 'button' || role === 'radio' || role === 'checkbox' || role === 'option') return false;
        if ((className.includes('choice') || className.includes('option') || id.includes('choice') || id.includes('option')) && !(className.includes('question') || id.includes('question'))) return false;
        if (el.children.length > 150) return false;
        if (el.offsetHeight > window.innerHeight * 1.2) return false;
        if (el.offsetWidth < 40 || el.offsetHeight < 20) return false;
        return true;
    });
    const minScore = config.minScore || MIN_QUESTION_SCORE;
    const scoredCandidates = roughCandidates.map((node) => { const el = node as HTMLElement; const score = scoreQuestionContainer(el, config); return { el, score }; }).filter((c) => c.score >= minScore);
    const candidates = scoredCandidates.map((c) => c.el);
    const finalists = candidates.filter(q => {
        const el = q as HTMLElement;
        let parent = el.parentElement;
        while (parent) { if (candidates.includes(parent)) return false; parent = parent.parentElement; }
        const style = window.getComputedStyle(el);
        if (style.cursor === 'pointer' && el.innerText.length < 200) return false;
        if (el.tagName === 'BUTTON' || el.closest('button')) return false;
        return true;
    });
    const sorted = finalists.sort((a,b) => {
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        return (ra.top + window.scrollY) - (rb.top + window.scrollY) || (ra.left - rb.left);
    });
    const deduplicatedFinalists: HTMLElement[] = [];
    const hasOptions = (el: HTMLElement) => !!el.querySelector('input, [role="radio"], [role="option"], .choice, .option');
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i]; const prev = deduplicatedFinalists[deduplicatedFinalists.length - 1];
        if (prev) {
            const rectCur = current.getBoundingClientRect(); const rectPrev = prev.getBoundingClientRect();
            const vDist = Math.abs(rectCur.top - rectPrev.top); const hDist = Math.abs(rectCur.left - rectPrev.right); const hDistAlt = Math.abs(rectPrev.left - rectCur.right);
            let isShared = false;
            if (vDist < 120 && current.parentElement === prev.parentElement) isShared = true;
            else if (vDist < 80 && (hDist < 100 || hDistAlt < 100)) {
                let p1: HTMLElement | null = current.parentElement;
                for (let j = 0; j < 3 && p1; j++) {
                    let p2: HTMLElement | null = prev.parentElement;
                    for (let k = 0; k < 3 && p2; k++) { if (p1 === p2) { isShared = true; break; } p2 = p2.parentElement; }
                    if (isShared) break; p1 = p1.parentElement;
                }
            }
            if (isShared) {
                if (hasOptions(current) && !hasOptions(prev)) deduplicatedFinalists[deduplicatedFinalists.length - 1] = current;
                continue;
            }
            const curClass = current.className || ''; const prevClass = prev.className || '';
            if (vDist < 300 && curClass.split(' ')[0] === prevClass.split(' ')[0] && curClass.length > 5) {
                if (current.parentElement === prev.parentElement) continue;
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
    container.style.cssText = 'position: fixed; bottom: 30px; right: 30px; z-index: 2147483647; display: none; flex-direction: column; gap: 10px; align-items: flex-end; font-family: system-ui, -apple-system, sans-serif;';
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = `<span style="display:inline-flex; margin-right:8px;">${getOryxInlineIcon(16, '#6366f1')}</span>Copy All`;
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
            navigator.clipboard.writeText(allText.trim()).then(() => { copyBtn.innerHTML = '- Copied!'; setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000); }).catch(err => { console.error('[Oryx] Failed to copy text:', err); copyBtn.innerHTML = '- Copy Failed'; setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 3000); });
        }
    });
    solveBtn.addEventListener('click', () => {
        const entries = collectBulkQuestionEntries(config);
        const allText = entries.map((entry) => `QUESTION ${entry.label}:\n${entry.text}`).join('\n\n');
        const allImages: string[] = [];
        entries.forEach((entry) => {
            entry.images.forEach((src) => {
                if (!allImages.includes(src)) allImages.push(src);
            });
        });
        if (allImages.length === 0) {
            const viewportImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                const r = img.getBoundingClientRect(); const isTiny = r.width < 50 || r.height < 50;
                const isLogo = img.src.includes('logo') || img.src.includes('icon') || img.alt.includes('logo');
                return r.top >= -1000 && r.top < window.innerHeight + 1000 && !isTiny && !isLogo;
            }).sort((a,b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return (rb.width * rb.height) - (ra.width * ra.height); }).slice(0, 8);
            viewportImgs.forEach(img => { const src = img.getAttribute('src') || img.src || img.getAttribute('data-src'); if (src && !allImages.includes(src)) allImages.push(src); });
        }
        if (allText) {
            chrome.runtime.sendMessage({ type: MSG_INLINE_EXTRACT_QUESTION, payload: { text: `I need an answer key for the following questions. Please provide a clear, numbered list of ONLY the final answers (e.g., 1. A, 2. 15, 3. True). Do not include any steps, reasoning, or extra text.\n\nIMPORTANT: Use the attached images to solve any geometry or visual problems. Match each image to its corresponding question text.\n\nQuestions:\n${allText}`, images: allImages.slice(0, 8), isBulk: true } });
            const originalHtml = solveBtn.innerHTML; solveBtn.innerHTML = '- Sending to Panel...'; setTimeout(() => { solveBtn.innerHTML = originalHtml; }, 3000);
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
    addExtractAllButton(config);
    const scanAndInject = () => {
        const currentConfig = getCurrentSiteConfig(); 
        if (!currentConfig) {
          console.log('[ORYX] No config found for this site');
          return;
        }
        console.log('[ORYX] Using config:', currentConfig.name, 'selector:', currentConfig.questionSelector);
        let allPotential = Array.from(document.querySelectorAll(currentConfig.questionSelector)) as HTMLElement[];
        console.log('[ORYX] Raw selector matches:', allPotential.length);
        if (allPotential.length === 0) allPotential = querySelectorAllDeep(currentConfig.questionSelector);
        if (allPotential.length === 0 && currentConfig.name !== 'Generic Educational') allPotential = querySelectorAllDeep('[data-testid*="question" i], [class*="question" i], [id*="question" i], [class*="problem" i], [class*="exercise" i]');
        
        const minScore = currentConfig.minScore || MIN_QUESTION_SCORE;
        const scoredCandidates = allPotential.map((node) => { 
          const el = node as HTMLElement; 
          const score = scoreQuestionContainer(el, currentConfig); 
          return { el, score }; 
        });
        
        console.log('[ORYX] Score breakdown:', scoredCandidates.map(c => ({ text: c.el.innerText?.substring(0,50), score: c.score.toFixed(2) })));
        
        const filteredByScore = scoredCandidates.filter((c) => c.score >= minScore);
        console.log('[ORYX] Passed threshold (' + minScore + '):', filteredByScore.length);
        
        const deduplicatedFinalists = getFinalistQuestions(allPotential, currentConfig);
        console.log('[ORYX] Final questions after dedup:', deduplicatedFinalists.length);
        deduplicatedFinalists.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const needsInjection = htmlEl.dataset.oryxInjected !== "true" || !htmlEl.querySelector('.oryx-inline-injector');
            if (needsInjection) {
                if (!htmlEl.querySelector('.oryx-inline-injector')) { delete htmlEl.dataset.oryxInjected; delete htmlEl.dataset.oryxInjectedId; }
                injectLogo(htmlEl, currentConfig);
            }
        });
        const validCount = document.querySelectorAll('[data-oryx-injected="true"]').length;
        const extContainer = document.getElementById('oryx-extract-all-container');
        if (extContainer && validCount > 0) extContainer.style.display = 'flex';
    };
    let scanFrame = 0;
    const scheduleScan = () => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = 0;
        scanAndInject();
      });
    };
    const observer = new MutationObserver((mutations) => {
      const hasStructuralChange = mutations.some(
        (mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0,
      );
      if (hasStructuralChange) {
        scheduleScan();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
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
      const { injectionId, answer, explanation } = message.payload;
      const shadowHosts = document.querySelectorAll('.oryx-inline-injector');
      for (const host of Array.from(shadowHosts)) {
        if (host.shadowRoot && host.parentElement?.dataset.oryxInjectedId === injectionId) {
          const answerBox = host.shadowRoot.getElementById('answer-' + injectionId);
          const btn = host.shadowRoot.querySelector('button');
          
          // Reset thinking state regardless of success/fail
          if (btn) btn.innerHTML = `${getOryxInlineIcon(20, '#4f46e5')}`;

          if (answerBox) {
            if (answer === 'Solve Failed') {
                answerBox.innerHTML = `
                  <div style="color: #ef4444; font-weight: 700; font-size: 14px; margin-bottom: 4px;">- Solve Failed</div>
                  <div style="font-size: 12px; color: #64748b;">${escapeHtml(explanation || 'Unknown error occurred')}</div>
                `;
                break;
            }
            ensureKatexStyles(host.shadowRoot);
            const answerHtml = renderInlineContent(normalizeInlineMath(answer || ''));
            const explanationHtml = renderInlineContent(normalizeInlineMath(explanation || ''));
            answerBox.innerHTML = `<div style="font-weight: 800; color: #1e293b; font-size: 15px; margin-bottom: 6px;">- ${answerHtml || escapeHtml(answer || '')}</div><div style="font-size: 13px; color: #475569; line-height: 1.5;">${explanationHtml}</div>`;
            if (btn) btn.innerHTML = `${getOryxInlineIcon(20, '#4f46e5')}`;
            break;
          }
        }
      }
    }
  });

  if (document.body) initInjector();
  else document.addEventListener('DOMContentLoaded', initInjector, { once: true });
}
