# Webapp Content: Mode Guide Page

 the content source for web page linked by `VITE_MODE_GUIDE_URL`.

---

# OryxSolver Modes

Choose how OryxSolver explains the same question.

## Standard
- Best for: everyday homework
- Style: balanced, clear, concise
- Result: fast answer + short explanation

## Exam
- Best for: test prep and formal writing
- Style: precise and formal
- Result: answer-first, clean exam-style steps

## ELI5
- Best for: beginners and hard concepts
- Style: simple words, short sentences
- Result: no jargon, no slang, easy explanation

## Step-by-step
- Best for: math/process-heavy questions
- Style: explicit ordered steps
- Result: deeper walkthrough of how to solve

## Gen Alpha
- Best for: quick, casual understanding
- Style: light slang + correct facts
- Result: engaging tone while keeping correctness

---

## Output Guarantee

Every mode still follows:
1. `FINAL_ANSWER` first
2. concise steps after

For MCQ questions, final answer is the letter only.

---

## Limits by Plan (Prototype)

- Free:
  - some modes available
  - lower monthly limits
  - tighter image limits
- Pro:
  - all modes are available
  - higher limits
  - more images per message
  - better performance under load

---

## Need More Control?

If your answer style is not what you want, use:
- mode chips
- AI suggestion chips
- a follow-up prompt like:
  - "Shorter answer"
  - "Show only steps"
  - "Give one similar example"
