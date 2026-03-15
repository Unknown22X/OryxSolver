# OryxSolver Regression Test Pack (10 Cases)

Run this after backend deploys (`solve`, `ai-proxy`, `sync-profile`) and extension rebuild.

## Preconditions

- Signed in user with verified email.
- Fresh extension reload.
- `VITE_SOLVE_API_URL` and `VITE_SYNC_PROFILE_API_URL` set.

## Cases

1. Standard short MCQ (text only)
- Input: short MCQ question.
- Expect: `Final Answer` shown, explanation steps shown, no error.

2. Standard long reading-comprehension question
- Input: long passage + options.
- Expect: complete answer and steps (no clipped sentence ending).

3. ELI5 mode
- Input: medium question in `eli5`.
- Expect: simpler tone, correct logic preserved.

4. Gen Alpha mode
- Input: same question in `gen_alpha`.
- Expect: casual slang tone, correct answer unchanged, technical terms preserved.

5. Step-by-step math
- Input: multi-step math problem.
- Expect: valid math steps, correct final answer, no hallucinated operations.

6. Coding/debug prompt
- Input: small code bug question.
- Expect: technically correct explanation and actionable fix.

7. Image-only submission (free plan)
- Input: 1 image, empty text.
- Expect: request accepted, default question handling works.

8. Image limit enforcement (free plan)
- Input: 2 images in one message.
- Expect: user-friendly limit error for free tier.

9. Timeout/truncation resilience
- Input: difficult long question likely to stress output length.
- Expect: no raw 502; fallback path returns answer or friendly retry error.

10. Usage accounting
- Input: successful solve on free plan.
- Expect: credits and monthly image usage update correctly in header usage state.

## Pass Criteria

- No unexpected 5xx shown to user.
- No clipped/half output in rendered explanation.
- Error messages are mapped to friendly text (`timeout`, `quota`, `incomplete`, `limits`).
- Correctness remains stable across style modes.

## Optional Diagnostic Notes

- Capture for each run:
  - mode used
  - response time
  - error code (if any)
  - whether fallback occurred

## Related Ops Docs

- Retention and cleanup for solve run logs: `docs/SOLVE_RUNS_RETENTION.md`
