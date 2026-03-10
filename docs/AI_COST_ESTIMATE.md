# OryxSolver AI Cost Estimate

This file estimates AI cost per question from the current backend prompt and routing logic.

Code references:
- Prompt builder: [supabase/functions/ai-proxy/modePrompts.ts](/d:/codes/projects/OryxSolver/supabase/functions/ai-proxy/modePrompts.ts)
- Model routing: [supabase/functions/ai-proxy/index.ts](/d:/codes/projects/OryxSolver/supabase/functions/ai-proxy/index.ts)
- Solve mode selection: [supabase/functions/solve/index.ts](/d:/codes/projects/OryxSolver/supabase/functions/solve/index.ts)

## Current behavior

- The app always sends a large system-style prompt plus the user question.
- Simple text questions usually try `gemini-2.5-flash` first.
- Complex text questions, image questions, and `step_by_step` usually try `gemini-2.5-pro` first.
- `gen_alpha` mode has the largest prompt and costs more than the other text modes.

## Estimated input tokens per request

These are approximate counts based on the current prompt template and a few example question lengths.
Exact billing depends on Gemini's tokenizer and the real user question.

| Mode | Estimated input tokens |
|---|---:|
| `standard` | `600-655` |
| `exam` | `610-660` |
| `eli5` | `620-670` |
| `step_by_step` | `620-675` |
| `gen_alpha` | `980-1030` |

## Pricing assumptions used in this estimate

These numbers were estimated using public Gemini API pricing at the time of writing. Re-check before launch.

- `gemini-2.5-flash`: about `$0.30 / 1M input tokens`, `$2.50 / 1M output tokens`
- `gemini-2.5-pro`: about `$1.25 / 1M input tokens`, `$10.00 / 1M output tokens`

## Estimated cost per question

### Flash-first text question

Typical simple question:
- Input: `~620` tokens
- Output: `~200-400` tokens

Estimated cost:
- Low: `~$0.0007`
- Typical: `~$0.0010`
- High: `~$0.0012`

### Pro-first text question

Typical harder question:
- Input: `~650` tokens
- Output: `~300-600` tokens

Estimated cost:
- Low: `~$0.0038`
- Typical: `~$0.0050`
- High: `~$0.0068`

### Gen Alpha text question

Because the prompt is larger:
- Input: `~1000` tokens
- Output: `~250-400` tokens

Estimated cost:
- On Flash: `~$0.0009-$0.0013`
- On Pro: `~$0.0043-$0.0053`

## Practical blended estimate

For planning, use this range:

- Cheap/simple text solve: `~$0.0007-$0.0012`
- Harder text solve: `~$0.0040-$0.0070`
- Mixed average across real usage: `~$0.0020-$0.0050`

## Free-limit planning

If you give `25` free questions per month, estimated AI cost per free user is roughly:

- Mostly simple questions: `~$0.02-$0.03`
- Mixed normal usage: `~$0.05-$0.12`
- Heavy complex usage: `~$0.15+`

If you give `40` free questions per month, estimated AI cost per free user is roughly:

- Mostly simple questions: `~$0.03-$0.05`
- Mixed normal usage: `~$0.08-$0.20`
- Heavy complex usage: `~$0.24+`

## Important limits

- Image questions are not estimated precisely here.
- Retries, fallbacks, and truncated-response continuation passes can increase cost.
- Real output length is one of the biggest cost drivers.
- Gemini pricing can change over time.

## Best next step

After launch, log actual token usage from Gemini response metadata for each solve.
That will let this estimate be replaced with real cost per question, per mode, and per user.

## Quick formula

Use this to recompute any case:

`cost = (input_tokens / 1_000_000 * input_price_per_million) + (output_tokens / 1_000_000 * output_price_per_million)`

Example:

`620 input` and `300 output` on Flash:

`(620 / 1_000_000 * 0.30) + (300 / 1_000_000 * 2.50) = $0.000936`
