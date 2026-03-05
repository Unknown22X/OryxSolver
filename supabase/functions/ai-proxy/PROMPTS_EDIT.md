# Edit Prompts Here

This is the prompt-edit reference for each mode.

Code source that actually runs:
- `supabase/functions/ai-proxy/modePrompts.ts`

Use this markdown as a planning sheet.
Paste your long prompt text directly inside:
- `MODE_RAW_PROMPTS.standard`
- `MODE_RAW_PROMPTS.exam`
- `MODE_RAW_PROMPTS.eli5`
- `MODE_RAW_PROMPTS.step_by_step`
- `MODE_RAW_PROMPTS.gen_alpha`

## Shared Contract (All Modes)

- First line must be: `FINAL_ANSWER: ...`
- Then:
  - `STEPS:`
  - `1) ...`
  - `2) ...`
- MCQ final answer: letter only (`A/B/C/D`)
- Response language: same as question (Arabic stays Arabic)

## `standard`

- Goal: balanced speed + clarity
- Audience: most users
- Pricing: Free + Pro
- Prompt template:
  - Put your full raw prompt in `MODE_RAW_PROMPTS.standard`

## `exam`

- Goal: formal, test-ready style
- Audience: exam prep
- Pricing: Free + Pro
- Prompt template:
  - Put your full raw prompt in `MODE_RAW_PROMPTS.exam`

## `eli5`

- Goal: simplify hard concepts
- Audience: beginners
- Pricing: Free + Pro
- Prompt template:
  - Put your full raw prompt in `MODE_RAW_PROMPTS.eli5`

## `step_by_step`

- Goal: procedural walkthrough
- Audience: users who need method, especially math
- Pricing: Free + Pro (Pro recommended)
- Prompt template:
  - Put your full raw prompt in `MODE_RAW_PROMPTS.step_by_step`

## `gen_alpha`

- Goal: higher engagement tone
- Audience: users preferring casual style
- Pricing: Pro recommended
- Prompt template:
  - Put your full raw prompt in `MODE_RAW_PROMPTS.gen_alpha`
  - Keep explanation depth same as `standard`; only tone changes.

## Example You Can Replace

`FINAL_ANSWER: B`
`STEPS:`
`1) ...`
`2) ...`
`3) ...`
