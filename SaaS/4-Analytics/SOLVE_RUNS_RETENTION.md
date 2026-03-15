# Solve Runs Retention Policy

`solve_runs` is for reliability debugging, not permanent storage.

## What to log

Keep rows minimal:
- `auth_user_id`
- `mode`
- `style_mode`
- `model`
- `latency_ms`
- `status`
- `error_code`
- `used_fallback`
- `created_at`

Do **not** store full question/answer text in this table.

## Retention target

- Prototype: keep `14-30 days`
- Production: keep `30-90 days` max

## Cleanup job (daily)

Use a scheduled SQL job (daily) to remove old rows:

```sql
delete from public.solve_runs
where created_at < now() - interval '30 days';
```

Adjust the interval to your retention target.

## Sampling policy

To reduce storage and write volume:
- Log `100%` of error rows
- Log only `10-20%` of success rows

## Optional rollups

For long-term analytics:
- Keep raw rows short-term
- Store daily aggregates in a separate table
- Delete raw rows after retention window

## Why this matters

- Prevents silent storage growth
- Keeps observability useful and affordable
- Preserves enough data to debug timeouts/truncation/quota issues

## Cost Roadmap Notes

- Future policy (planned): keep advanced/strict explanation modes as Pro-only.
- Current direction: cheap-first model routing for easy prompts, strong model for complex/image prompts.
- Hard-question reliability policy:
  - adaptive token budget by complexity/mode
  - continuation-on-truncation (auto-continue once, then merge)
  - concise-first fallback for extreme cases

## Additional Cost Control (Images)

- Planned: compress/resize images before upload from extension.
- Recommended baseline:
  - Resize long edge to `1280px` max
  - Convert to `jpeg/webp` (quality ~`0.75-0.85`) when source is photo/screenshot
  - Keep single image target around `150KB-350KB`
- Example impact:
  - `4000px` image -> `1280px`
  - `4MB` -> ~`200KB`

### Guardrails

- Do not over-compress text-heavy screenshots (math/code text must stay readable).
- Keep PNG if JPEG artifacts hurt readability.
- Apply compression in extension client before sending to `/solve`.
