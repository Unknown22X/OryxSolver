# Financial model (estimates) — 2026-04-03

This is a **rough** revenue / profit / AI cost model based on what’s currently in the repo + public pricing pages.

## What the product currently sells (from the repo)

**Monthly plans** (`webapp/src/pages/PricingPage.tsx`)

- Free: **$0** / month, **15** questions included
- Pro: **$3.99** / month, **150** questions included
- Premium: **$9.99** / month, **500** questions included

**One-time credit packs** (`webapp/src/pages/PricingPage.tsx`)

- 10 for $0.99
- 50 for $1.99
- 200 for $4.99
- 500 for $8.99
- 1000 for $14.99
- 2500 for $29.99

**Plan limits** (enforced server-side) (`supabase/functions/_shared/usage.ts`)

- Free: 15 questions / month
- Pro: 200 questions / month
- Premium: 800 questions / month

## Payment fees (Lemon Squeezy)

From Lemon Squeezy’s pricing page: **5% + $0.50 per transaction**.

That fixed $0.50 matters a lot for small purchases.

### Net revenue per purchase (after 5% + $0.50)

Using the fee formula: `net = gross - (0.50 + 0.05 * gross)`

- Pro ($3.99) → net ≈ **$3.29**
- Premium ($9.99) → net ≈ **$8.99**
- Credits 10 ($0.99) → net ≈ **$0.44** (very fee-heavy)
- Credits 50 ($4.99) → net ≈ **$4.24**

If you care about profit, the $0.99 pack is usually not worth the complexity unless it’s a loss-leader.

## AI costs (Gemini)

Your backend calls `supabase/functions/ai-proxy/index.ts`, which calls the Gemini API.

**Important:** Google’s docs list `gemini-2.0-flash` and `gemini-2.0-flash-lite` as **deprecated** with shutdown dates in 2026 — plan a migration now (use the 2.5 family or newer).

### A simple per-solve cost model

For `gemini-2.5-flash-lite`, the pricing page lists:

- Input: **$0.10 / 1M tokens**
- Output: **$0.40 / 1M tokens**

So:

`ai_cost_per_solve_usd = (input_tokens * 0.10 + output_tokens * 0.40) / 1_000_000`

Example costs:

- 1k in + 1k out → **$0.00050** per solve (0.05 cents)
- 1.5k in + 2k out → **$0.00095** per solve (0.095 cents)

### What this means

Even heavy usage is usually cheap versus subscription revenue:

- Worst-case Premium user using all 500 included questions at ~$0.001/solve → **~$0.50 AI cost/month**

Your main cost drivers are more likely:

- Payment fees + refunds/chargebacks
- Supabase base costs + compute/storage overages
- Marketing / CAC

## Fixed costs (baseline you’ll almost certainly have)

You should assume a baseline monthly fixed cost bucket (roughly):

- Supabase: at least **$25/month** for the Pro plan (plus compute/storage overages depending on usage)
- Domain + email (SMTP provider) + logging/monitoring

I recommend you model a fixed-cost placeholder like **$100–$500/month** until you know your real bills.

## Quick scenario table (net revenue, simple AI cost, fixed cost placeholder)

See `scripts/finance-model.ps1` for the exact assumptions and editable knobs.
