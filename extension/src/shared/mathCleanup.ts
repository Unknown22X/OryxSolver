/**
 * mathCleanup.ts - Utilities for normalizing math questions copied from web pages.
 *
 * Handles two input formats found in the wild:
 *   - Plain text:  x2−10x+24=0  (unicode minus, squashed exponents)
 *   - LaTeX:       $4a^2-1=0$   (dollar-delimited, needs stripping/converting)
 *
 * Usage:
 *   const result = processQuestion(rawPastedText);
 *   sendToAI(result.cleanedText);
 *   if (!result.isValid) showWarnings(result.warnings);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  cleanedText: string;
  /** Optional guidance shown to the user */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Constants (hoisted — avoids recompilation on every call)
// ---------------------------------------------------------------------------

/**
 * Matches the redundant "QUESTION N:" header lines injected by the platform.
 * These are separate from the actual "N. Solve" lines we want to keep.
 */
const QUESTION_HEADER_REGEX = /^QUESTION\s+\d+:\s*$/gim;

/**
 * UI instructions injected by the question platform.
 * Combined into one regex for a single-pass removal.
 * Patterns are intentionally slightly fuzzy (maths?, workings?) to catch minor variants.
 */
const UI_NOISE_REGEX = new RegExp(
  [
    'Enter your maths? answer',
    'JUST type the answer,? nothing else',
    'do workings? in your cop(?:y|ies)',
    'NB JUST type the answer',
    'Enter your answer',
  ].join('|'),
  'gi'
);

/**
 * Math function names that must not be treated as "letter + digit" squash candidates.
 * E.g. "sin2x" should stay as "sin2x", not become "sin^2x".
 */
const MATH_KEYWORDS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'log', 'ln', 'exp',
  'sqrt', 'lim', 'int', 'sum',
]);

/** Unicode superscript digits → ASCII digit string */
const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

const SUPERSCRIPT_REGEX = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Converts the inner content of a $...$ LaTeX block into a clean, readable
 * math string the AI can parse without LaTeX knowledge.
 *
 * Examples:
 *   \frac{x^2-9}{x^2-4x+3}              →  (x^2-9)/(x^2-4x+3)
 *   \left(4x^3+6x^2\right)\div\left(...) →  (4x^3+6x^2)÷(...)
 *   3x-1\le x-2                          →  3x-1≤x-2
 *   \left(8x^3-1\right)\ by\ \left(...)  →  (8x^3-1) ÷ (...)
 */
function convertLatexBlock(latex: string): string {
  return latex
    // ── Brackets ───────────────────────────────────────────────────────────
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\{/g, '{')
    .replace(/\\right\}/g, '}')
    // Bare \left. and \right. (invisible delimiters used in some LaTeX)
    .replace(/\\(?:left|right)\./g, '')

    // ── Fractions: \frac{a}{b} → (a)/(b) ──────────────────────────────────
    // Trim whitespace inside each group to handle "x^2-9\ \ " artifacts
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, num, den) =>
      `(${num.trim()})/(${den.trim()})`
    )

    // ── Inequalities ────────────────────────────────────────────────────────
    .replace(/\\leq?\b/g, '≤')
    .replace(/\\geq?\b/g, '≥')

    // ── Operators ───────────────────────────────────────────────────────────
    .replace(/\\div\b/g, '÷')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')

    // ── "\ by\ " — LaTeX-escaped prose meaning "divided by" ─────────────────
    // e.g. (8x^3-1)\ by\ (2x-1) → (8x^3-1) ÷ (2x-1)
    .replace(/\\\s*by\\\s*/gi, ' ÷ ')

    // ── Spacing / line-break commands ────────────────────────────────────────
    .replace(/\\ /g, ' ')    // forced space:  \ 
    .replace(/\\\\/g, ' ')   // line break:    \\
    .replace(/\\,/g, ' ')    // thin space:    \,
    .replace(/\\;/g, ' ')    // medium space:  \;

    // ── Catch-all: drop any remaining unhandled backslash-commands ───────────
    // Prevents raw LaTeX tokens like \right from reaching the AI.
    // Also catches stray backslashes left behind (e.g. "\ \ " → " ").
    .replace(/\\[a-zA-Z]*/g, '')

    .trim();
}

/**
 * Deduplicates questions in the pasted block.
 *
 * The platform sometimes emits the same question 2–3 times under different
 * header formats (e.g. "QUESTION 23:" + bare "23." + another bare block).
 * Strategy: split into blocks at each question boundary, normalise for
 * comparison, discard duplicates, reassemble.
 */
function deduplicateQuestions(text: string): string {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isNewBlock =
      /^QUESTION\s+\d+:/i.test(trimmed) ||
      /^\d+\.\s/.test(trimmed);

    if (isNewBlock && current.length > 0) {
      blocks.push(current.join('\n').trim());
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join('\n').trim());

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const block of blocks) {
    // Strip leading "QUESTION N:" header line for both comparison and output
    const withoutHeader = block.replace(/^QUESTION\s+\d+:\s*/i, '').trim();
    if (!withoutHeader) continue;

    // Normalise for duplicate comparison:
    // Strip leading "N." number, lowercase, collapse whitespace
    const key = withoutHeader
      .replace(/^\d+\.\s*/, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(withoutHeader);
    }
  }

  return unique.join('\n\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cleans and normalises a block of math questions copied from a web page.
 *
 * Processing order (matters — do not reorder steps):
 *   0. Deduplication          — remove repeated question blocks
 *   1. Strip QUESTION headers — "QUESTION 4:" lines add no value
 *   2. Unicode normalisation  — unicode minus, non-breaking space, superscripts
 *   3. UI noise removal       — strips platform instructions
 *   4. LaTeX block processing — converts $...$ before plain-text heuristics run
 *   5. Plain-text exponents   — x2 → x^2 (only on non-LaTeX content)
 *   6. Comma spacing          — "y=0,10x" → "y=0, 10x"
 *   7. General whitespace     — collapse runs, trim
 */
export function cleanAndNormalizeQuestion(text: string): string {
  if (!text?.trim()) return '';

  // ── Step 0: Deduplication ─────────────────────────────────────────────────
  let cleaned = deduplicateQuestions(text);

  // ── Step 1: Strip "QUESTION N:" header lines ──────────────────────────────
  // deduplicateQuestions already strips these from block starts,
  // but run again in case any remain mid-text after reassembly.
  cleaned = cleaned.replace(QUESTION_HEADER_REGEX, '');

  // ── Step 2: Unicode normalisation ─────────────────────────────────────────
  cleaned = cleaned
    .replace(/\u2212/g, '-')   // Unicode MINUS SIGN (U+2212) → hyphen-minus
    .replace(/\u00a0/g, ' ')   // Non-breaking space → regular space
    .replace(/\u200b/g, '')    // Zero-width space → remove
    .replace(/\u00ad/g, '')    // Soft hyphen → remove
    // Unicode superscripts: x² → x^2
    .replace(SUPERSCRIPT_REGEX, (match) =>
      '^' + match.split('').map((c) => SUPERSCRIPT_MAP[c] ?? c).join('')
    );

  // ── Step 3: Remove UI noise ───────────────────────────────────────────────
  // First remove entire parenthetical groups that contain noise phrases
  // (e.g. "(NB JUST type the answer, nothing else, do workings in your copy)")
  // so we don't leave an orphaned shell like "( , nothing else, )".
  // Then catch any remaining bare noise phrases with a space replacement
  // to avoid squashing adjacent words/math.
  cleaned = cleaned.replace(
    /\([^)]*(?:NB JUST|JUST type|do workings?|nothing else|Enter your|your copy)[^)]*\)/gi,
    ''
  );
  cleaned = cleaned.replace(UI_NOISE_REGEX, ' ');

  // ── Step 4: Process LaTeX blocks ($...$) ─────────────────────────────────
  // Ensure a space before $...$ blocks so "equation$2x..." → "equation 2x..."
  // Must run BEFORE the plain-text exponent heuristic — LaTeX already uses ^
  // notation, so running the heuristic on it would double-apply.
  cleaned = cleaned.replace(/([^\s])(\$)/g, '$1 $2');
  cleaned = cleaned.replace(/\$([^$]+)\$/g, (_, inner) => convertLatexBlock(inner));

  // ── Step 4b: Remove orphaned empty parentheses left by noise removal ──────
  // "(NB JUST...)" becomes "( , nothing else, )" after partial noise removal
  cleaned = cleaned.replace(/\(\s*[,\s]*\)/g, '');
  cleaned = cleaned.replace(/\([^a-z0-9=+\-*/^<>≤≥÷×·(]{0,10}\)/gi, '');

  // ── Step 5: Fix squashed plain-text exponents ─────────────────────────────
  // Handles two forms:
  //   x2   → x^2  (bare variable + digit)
  //   2x2  → 2x^2 (coefficient + variable + same digit — e.g. "4x2" from "4x²")
  // Single letter only — multi-char variables (ab2) are ambiguous and left alone.
  // Skips known math function names (sin2, log2, etc.).
  cleaned = cleaned.replace(/(\d?)([a-z])(\d)\b/gi, (match, coeff, letter, exp) => {
    if (MATH_KEYWORDS.has(letter.toLowerCase())) return match;
    return `${coeff}${letter}^${exp}`;
  });

  // ── Step 6: Comma spacing ─────────────────────────────────────────────────
  cleaned = cleaned.replace(/,(\S)/g, ', $1');

  // ── Step 7: General whitespace cleanup ────────────────────────────────────
  // Collapse multiple blank lines to one, collapse inline spaces, trim
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ /gm, '')     // remove leading space on each line
    .trim();

  return cleaned;
}

/**
 * Runs pre-send quality checks on already-cleaned text.
 * Focuses on signals that the text is garbled, not on things the AI handles naturally.
 */
export function performQA(cleanedText: string): Omit<ValidationResult, 'cleanedText'> {
  const warnings: string[] = [];
  let suggestion: string | undefined;

  // Guard: empty after cleaning
  if (!cleanedText.trim()) {
    return {
      isValid: false,
      warnings: ['No content found after cleaning.'],
      suggestion: 'Check that you copied the question text correctly.',
    };
  }

  // Residual UI noise not caught by the regex
  if (/enter your (maths?|math) answer/i.test(cleanedText)) {
    warnings.push('Residual UI instructions detected after cleaning.');
    suggestion = 'Try re-copying just the question text, excluding the input field.';
  }

  // Unresolved LaTeX commands — convertLatexBlock didn't handle everything
  if (/\\[a-zA-Z]{2,}/.test(cleanedText)) {
    warnings.push('Unresolved LaTeX commands detected (e.g. \\frac, \\left).');
    if (!suggestion) suggestion = 'Math notation may not be read correctly by the AI.';
  }

  // Suspiciously high alphanumeric density — possible garbled/squashed paste.
  // Threshold 0.85: catches "9x6x3y2xz" but not legitimate "4x^2+3x-1=0"
  // (operators and ^ bring density down on well-formed expressions).
  const alphanumericOnly = cleanedText.replace(/[^0-9a-z]/gi, '');
  const density = alphanumericOnly.length / (cleanedText.length || 1);
  if (density > 0.85 && cleanedText.length > 20) {
    warnings.push('Text is unusually dense — math may be squashed or garbled.');
    if (!suggestion) suggestion = 'Try re-copying the question or selecting the text more carefully.';
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    suggestion,
  };
}

/**
 * Primary entry point. Cleans raw pasted text then runs QA on the result.
 *
 * @param rawText - Text directly from the clipboard / paste event
 * @returns ValidationResult with cleanedText ready to send to the AI
 *
 * @example
 *   const { cleanedText, isValid, warnings, suggestion } = processQuestion(pastedText);
 *   if (!isValid) showWarning(suggestion);
 *   sendToAI(cleanedText);
 */
export function processQuestion(rawText: string): ValidationResult {
  const cleanedText = cleanAndNormalizeQuestion(rawText);
  const qa = performQA(cleanedText);

  return {
    ...qa,
    cleanedText,
  };
}