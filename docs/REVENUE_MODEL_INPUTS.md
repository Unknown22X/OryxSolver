# OryxSolver Revenue/Profit Inputs

Use this once, then I will generate full estimates (low/base/high, monthly and yearly).

## 1) Pricing and plans

1. Pro price confirmed: `$4/month`? (`yes/no`), yes
2. Do you want yearly plan later? If yes, price?,idk maybe later,so dont put it into account now
3. Free plan limits:
   - free monthly text solves:40
   - free monthly image solves:10
4. Pro plan limits:
   - pro monthly text solves:150
   - pro monthly image solves:50

## 2) User growth assumptions
i have no idea , give the wors case for this 
5. Month 1 active users (MAU) target:
6. Monthly growth rate (ex: `15%`):
7. Free -> Pro conversion rate (ex: `2%`, `5%`, `8%`):
8. Monthly Pro churn rate (ex: `6%`):

## 3) Usage assumptions per active user

9. Avg solves/user/month on free:
10. Avg solves/user/month on pro:
11. Image share of solves on free (ex: `20%`):
12. Image share of solves on pro (ex: `35%`):
13. Avg input+output tokens per text solve:
14. Avg input+output tokens per image solve:

## 4) AI provider mix

Current stack detected: Gemini via `supabase/functions/ai-proxy`.

15. Model routing mix (% of requests):
   - cheap model:
   - strong model:
   - backup model:
16. Cost per 1M tokens for each model (input/output separately if different):
17. Estimated failed/retried requests rate (ex: `5%`):

## 5) Infra costs

Current stack detected:
- Supabase (DB + Edge Functions + bandwidth/storage)
- Supabase Auth
- Web hosting for marketing/pricing site

18. Supabase plan monthly fixed cost:
19. Supabase variable usage estimate/month (if known):
20. Supabase Auth monthly cost (if free now, set `0`):
21. Web hosting monthly cost:
22. Any other tools (monitoring/email/logging/analytics):

## 6) Payment costs

Current assumption from you: payment provider may take `20%`.

23. Exact payment fee model:
   - percent fee:
   - fixed fee per transaction:
24. Refund/chargeback rate assumption:
25. Tax/VAT handling:
   - included in $4 or charged on top?
   - estimated tax % impact on net revenue:

## 7) Business rules

26. Do you count COGS for free users fully (yes/no)?
27. Do you want owner salary included in "profit" (yes/no)?
28. Target gross margin %:
29. Target net margin %:

## 8) Output format preference

30. Projection horizon:
   - `6 months` or `12 months` or both
31. Cases to generate:
   - conservative / base / aggressive (default)
32. Currency:
   - USD or SAR

---

After you answer these, I will produce:

- `docs/REVENUE_PROFIT_ESTIMATE.md`
  - Monthly and annual revenue
  - COGS split (AI, infra, payment fees)
  - Gross profit and net profit
  - Breakeven point
  - Sensitivity table (conversion/churn/token cost)
  - Low/Base/High scenarios
