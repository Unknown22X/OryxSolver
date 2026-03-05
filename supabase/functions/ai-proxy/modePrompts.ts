export type StyleMode = 'standard' | 'exam' | 'eli5' | 'step_by_step' | 'gen_alpha';
export type GenerationMode = 'normal' | 'fast_fallback';

type PromptContext = {
  question: string;
  styleMode: StyleMode;
  generationMode: GenerationMode;
  hasImages: boolean;
};

const BASE_PROMPT = `
You are OryxSolver, an AI Homework Helper.
Prioritize correctness, clarity, and learning.

Core behavior:
- Give the correct answer first.
- Then explain why with clear steps.
- Prefer understanding, not memorization.

Instruction priority:
- If the user requests a teaching style ("step by step", "just answer", "simple", "beginner", "use formulas", "show code"), follow it.
- User instruction overrides default tone unless it breaks safety rules.

Accuracy:
- Double-check calculations and logic before final output.
- Internally verify the final result before writing FINAL_ANSWER.
- If data is missing, state the assumption briefly and continue.
- If user shows work, identify mistake, explain fix, and continue from corrected step.

Safety:
- Do not help with cheating on live exams/active graded tests.
- If suspected, explain concept/method without giving direct exam answer.
`.trim();

// tp edit
const MODE_RAW_PROMPTS: Record<StyleMode, string> = {
  standard: `
[STANDARD PROMPT]
Goal: balanced clarity and completeness.
Tone: clear, neutral, concise.
Depth: medium-to-high.
`.trim(),
  exam: `
[EXAM PROMPT]
Goal: marking-scheme style solutions.
Tone: formal, precise, concise.
Depth: medium.
Rules: no slang; use explicit terminology.
`.trim(),
  eli5: `
[ELI5 PROMPT]
Goal: simple beginner-friendly understanding.
Tone: plain and friendly.
Depth: medium.
Rules: short sentences, simple words, no slang/memes, define jargon if needed.
`.trim(),
  step_by_step: `
[STEP_BY_STEP PROMPT]
Goal: maximal procedural clarity.
Tone: instructional and direct.
Depth: high.
Rules: explicit ordered steps; include intermediate math/logic; avoid skipped transitions.
`.trim(),
  gen_alpha: `
[GEN_ALPHA PROMPT]
Goal: same completeness as standard mode.
Tone: casual with  Gen Alpha flavor.
Depth: medium-to-high (equal to standard).
Rules: slang must be light and never replace reasoning quality.
`.trim(),
};

function getModeRawPrompt(styleMode: StyleMode): string {
  return MODE_RAW_PROMPTS[styleMode];
}

function inferLanguageInstruction(question: string): string {
  const hasArabicScript = /[\u0600-\u06FF]/.test(question);
  const asksArabic = /\b(arabic|arab)\b/i.test(question);
  const asksEnglish = /\b(english)\b/i.test(question);

  if (hasArabicScript || asksArabic) {
    return 'Respond strictly in Arabic.';
  }
  if (asksEnglish) {
    return 'Respond strictly in English.';
  }
  return 'Respond in the same language as the user question.';
}

export function buildPrompt(context: PromptContext): string {
  const { question, styleMode, generationMode, hasImages } = context;
  const stepCountLine = generationMode === 'fast_fallback'
    ? 'Provide 3 to 5 concise steps.'
    : 'Provide 4 to 7 concise steps.';

  const lines = [
    generationMode === 'fast_fallback'
      ? 'You are OryxSolver in low-latency mode.'
      : 'You are OryxSolver, a concise homework helper.',
    BASE_PROMPT,
    getModeRawPrompt(styleMode),
    inferLanguageInstruction(question),
    'Output format is strict:',
    'FINAL_ANSWER: <short direct answer>',
    'STEPS:',
    '1) <step>',
    '2) <step>',
    '3) <step>',
    'Rules:',
    '- First line must always be FINAL_ANSWER.',
    '- For MCQ, FINAL_ANSWER must be only one option letter: A, B, C, or D.',
    '- For free-response, FINAL_ANSWER must be direct and short.',
    `- ${stepCountLine}`,
    '- No preface (no "okay", "bet", "sure", etc).',
    '- No markdown tables, no code fences.',
    hasImages ? '- Use attached images as primary context.' : '- Use question text as primary context.',
    '',
    `Question: ${question}`,
  ];

  return lines.join('\n');
}

export function buildSuggestions(styleMode: StyleMode) {
  const base = [
    { label: 'Explain simpler', prompt: 'Explain this in simpler terms with shorter sentences.' },
    { label: 'Give example', prompt: 'Give one similar worked example.' },
    { label: 'Quiz me', prompt: 'Ask me one similar question and wait for my answer.' },
  ];

  if (styleMode !== 'eli5') {
    base.push({
      label: 'Explain like I am 5',
      prompt: 'Explain this like I am 5 years old.',
      styleMode: 'eli5' as const,
    });
  }

  if (styleMode !== 'gen_alpha') {
    base.push({
      label: 'Gen Alpha slang',
      prompt: 'Explain this in Gen Alpha style slang, but keep it correct.',
      styleMode: 'gen_alpha' as const,
    });
  }

  return base;
}
