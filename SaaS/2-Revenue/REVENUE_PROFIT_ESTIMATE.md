# OryxSolver Revenue + Profit Estimate (5,000 total users)

This is a practical estimate with assumptions (since full inputs are not finalized yet).

## Core assumptions

- Total active users (MAU): `5,000`
- Pro price: `$4/month`
- Payment fee: `20%` (your assumption)
- Fixed monthly infra/auth/hosting: `$100/month` (combined estimate)
- Pro conversion baseline: `5%` (250 pro, 4,750 free)
- **Plan limits (your latest input):**
  - Free: `40 text + 10 image` per month
  - Pro: `150 text + 50 image` per month

---

## Scenario A (Lean usage, healthy unit economics)

Assumptions:
- Free avg usage: `8 solves/user/month`
- Pro avg usage: `40 solves/user/month`
- AI cost per solve (blended): `$0.002`

Math:
- Total solves = `4,750*8 + 250*40 = 48,000`
- AI cost = `48,000 * 0.002 = $96`
- Gross revenue = `250 * 4 = $1,000`
- Net after payment fee = `$800`
- Total cost = `AI $96 + fixed $100 = $196`
- **Estimated profit = `$604/month`**

Annual:
- **`$7,248/year`**

---

## Scenario B (Base case)

Assumptions:
- Free avg usage: `12 solves/user/month`
- Pro avg usage: `80 solves/user/month`
- AI cost per solve (blended): `$0.006`

Math:
- Total solves = `4,750*12 + 250*80 = 77,000`
- AI cost = `77,000 * 0.006 = $462`
- Gross revenue = `$1,000`
- Net after payment fee = `$800`
- Total cost = `AI $462 + fixed $100 = $562`
- **Estimated profit = `$238/month`**

Annual:
- **`$2,856/year`**

---

## Scenario C (Heavy usage, weak unit economics)

Assumptions:
- Free avg usage: `20 solves/user/month`
- Pro avg usage: `120 solves/user/month`
- AI cost per solve (blended): `$0.012`

Math:
- Total solves = `4,750*20 + 250*120 = 125,000`
- AI cost = `125,000 * 0.012 = $1,500`
- Gross revenue = `$1,000`
- Net after payment fee = `$800`
- Total cost = `AI $1,500 + fixed $100 = $1,600`
- **Estimated profit = `-$800/month` (loss)**

Annual:
- **`-$9,600/year`**

---

## Conversion sensitivity (using Base usage assumptions)

Base usage kept fixed:
- Free usage `12/month`
- Pro usage `80/month`
- AI cost/solve `$0.006`
- Fixed `$100/month`
- Payment fee `20%`

### 2% Pro conversion (100 pro)
- Net revenue: `100*4*0.8 = $320`
- Total solves: `4,900*12 + 100*80 = 66,800`
- AI cost: `$400.8`
- Profit: `320 - 400.8 - 100 = -$180.8`

### 5% Pro conversion (250 pro)
- Net revenue: `$800`
- AI cost: `$462`
- Profit: `+$238`

### 10% Pro conversion (500 pro)
- Net revenue: `$1,600`
- Total solves: `94,000`
- AI cost: `$564`
- Profit: `+$936`

### 20% Pro conversion (1,000 pro)
- Net revenue: `$3,200`
- Total solves: `128,000`
- AI cost: `$768`
- Profit: `+$2,332`

---

## Practical takeaway

- At `5,000` users, your business is profitable **only if**:
  - conversion is decent (`>= ~5%`), and
  - AI cost per solve stays controlled.
- Biggest profit levers:
  1. increase free->pro conversion,
  2. reduce AI cost/solve (routing/compression/caching),
  3. keep free usage limits tight.

---

## Quick target to stay safe

For this stage, aim for:
- Pro conversion: `8%+`
- Blended AI cost/solve: `< $0.005`
- Payment fee: negotiate below `20%` if possible

That should keep a healthy margin even before major scale.

---

## Quota-based estimate (using your exact monthly limits)

This section assumes users consume their full monthly quotas.

### Volume formulas at 5,000 users

Let `c = pro conversion` (0 to 1), then:

- `pro_users = 5000*c`
- `free_users = 5000*(1-c)`
- `text_solves = free_users*40 + pro_users*150 = 200,000 + 550,000c`
- `image_solves = free_users*10 + pro_users*50 = 50,000 + 200,000c`

### Cost assumptions (for estimate only)

- Text solve cost: `$0.004`
- Image solve cost: `$0.015`
- Fixed monthly cost: `$100`
- Net Pro revenue per user after 20% fee: `$3.20`

So:

- `AI_cost = 0.004*text_solves + 0.015*image_solves = 1,550 + 5,200c`
- `Net_revenue = 5000*c*3.2 = 16,000c`
- `Profit = Net_revenue - AI_cost - 100 = 10,800c - 1,650`

### Break-even conversion

- Set profit = 0:
  - `10,800c - 1,650 = 0`
  - `c = 15.28%`

You need roughly **15.3% Pro conversion** at full quota consumption to break even under these cost assumptions.

### Quick conversion table (full quota usage)

- `5%` conversion (250 pro):
  - Net revenue: `$800`
  - AI cost: `$1,810`
  - Profit: `-$1,110/month`

- `10%` conversion (500 pro):
  - Net revenue: `$1,600`
  - AI cost: `$2,070`
  - Profit: `-$570/month`

- `15%` conversion (750 pro):
  - Net revenue: `$2,400`
  - AI cost: `$2,330`
  - Profit: `-$30/month` (near break-even)

- `20%` conversion (1,000 pro):
  - Net revenue: `$3,200`
  - AI cost: `$2,590`
  - Profit: `+$510/month`

### What this means

With your current limits, profitability is very sensitive to:
1. actual % of users that consume full image quota,
2. real image cost per request,
3. Pro conversion rate.

If real usage is below quota caps (which is common), required conversion drops a lot.
