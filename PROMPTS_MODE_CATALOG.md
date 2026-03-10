# OryxSolver Prompt Catalog (Prototype)

This file defines how each mode should behave in `ai-proxy`.

## Shared Output Contract (All Modes)

Model must return:

1. `FINAL_ANSWER: <short answer>`
2. `STEPS:`
3. Numbered steps (`1)`, `2)`, ...)

Rules:
- `FINAL_ANSWER` must always be first line.
- MCQ: return letter only (`A/B/C/D`) in `FINAL_ANSWER`.
- FRQ: return short direct answer in `FINAL_ANSWER`.
- Steps are concise and readable.

## Mode Matrix

| Mode | Goal | For Who | Pricing Tier | Latency Target | Example Prompt Snippet |
|---|---|---|---|---|---|
| `standard` | Balanced clarity + speed | Most users | Free + Pro | Medium | "Explain clearly, concise steps." |
| `exam` | Formal test-style answer | Students preparing for exams | Free + Pro | Medium | "Use formal, precise language, no slang." |
| `eli5` | Very simple explanation | Beginners / younger students | Free + Pro | Medium | "Use simple words, short sentences, no slang/memes." |
| `step_by_step` | Deep procedural breakdown | Users who want process | Free + Pro | Medium-High | "Give explicit ordered steps." |
| `gen_alpha` | Casual style with correctness | Engagement / quick understanding | Pro recommended | Medium | "Light slang only, keep facts accurate." |

## Cost Guidance (Prototype)

Use this as product logic (not model billing truth):

- Free:
  - `standard`, `exam`, `eli5`: allowed
  - `step_by_step`: allowed with shorter max tokens
  - `gen_alpha`: allowed but can be rate-limited if needed
- Pro:
  - all modes fully enabled
  - larger output token limits
  - optional richer examples

## Suggested Generation Budgets

- `fast_fallback`:
  - `maxOutputTokens`: 180-260
  - 2-3 steps
- `normal`:
  - `maxOutputTokens`: 500-900
  - 3-6 steps

## Example Prompts (You Will Replace Later)

### Standard
`Explain this question and give the answer first, then short steps.`

### Exam
`Provide the final answer first, then concise formal steps like an exam solution key.`

### ELI5
`Explain this like I am 5 years old with simple words and short sentences.`

### Step-by-step
`Break this into explicit ordered steps and include the key equation/reasoning at each step.`

### Gen Alpha
`Explain this with light Gen Alpha slang but keep all facts fully correct and concise.`

## Where This Is Plugged In

- Prompt policy + parsing:
  - `supabase/functions/ai-proxy/index.ts`
- Mode passed from UI:
  - `extension/src/sidepanel/components/MessageComposer.tsx`
  - `extension/src/sidepanel/App.tsx`
