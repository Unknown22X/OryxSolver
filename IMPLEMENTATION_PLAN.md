# OryxSolver Full Implementation Plan

## 1. Product Scope and Success Criteria

### 1.1 Primary Goal
Build a Chrome extension that:
- Detects questions from page DOM and/or screenshot capture.
- Sends structured input to backend AI pipeline.
- Returns high-quality answer + explanation (including math rendering).
- Optionally injects suggested answers back into page fields safely.

### 1.2 Non-Goals (v1)
- Fully automatic submission on exam platforms.
- Universal support for every LMS/website on first release.
- Full OAuth-in-extension (Google/Apple) if provider flow is unsupported in side panel mode.

### 1.3 Success Metrics
- Detection success rate: >= 85% on supported sites.
- Solve latency p95: <= 8s for text-only, <= 14s for image-assisted.
- Parse/render error rate (LaTeX/UI): <= 2%.
- Injection success rate on supported fields: >= 90%.
- Crash-free sessions: >= 99%.

### 1.4 Supported Targets for v1
- Google Forms
- Canvas quizzes (basic question blocks)
- Generic MCQ/text forms using standard inputs/textarea/contenteditable

---

## 2. System Architecture

### 2.1 Components
- `Chrome Extension`
  - Sidepanel UI (React)
  - Content scripts (DOM extraction + overlays)
  - Background service worker (capture + routing)
- `Backend API`
  - Auth verification
  - Input normalization
  - AI orchestration and response shaping
  - Usage tracking and limits
- `Database (Postgres)`
  - Users, sessions, usage, question history, solutions

### 2.2 Data Flow (Happy Path)
1. User opens extension sidepanel.
2. Extension extracts question via DOM or capture.
3. Sidepanel sends payload to `/solve`.
4. Backend validates token + usage.
5. AI service generates answer + steps + LaTeX blocks.
6. Backend returns structured response.
7. UI renders result card + timeline steps + KaTeX math.
8. User optionally applies suggested answer to DOM field.

---

## 3. Delivery Phases

## Phase A: Stabilization and Foundation (Week 1)

### A1. Extension Stability
- Fix manifest integrity, CSP, side panel click-open behavior.
- Ensure side panel opens from toolbar icon consistently.
- Ensure build and lint are clean in CI.

### A2. Auth Baseline
- Keep supported auth methods only for extension side panel (email/password/OTP).
- Signed-in/signed-out UI gates.
- Reliable logout redirect back to sidepanel URL.

### A3. Immediate Deliverables
- `npm run build` and `npm run lint` pass.
- Login/logout works repeatedly without blank screen.
- Signed-out and signed-in UI states are visually complete.

### A4. Exit Criteria
- No blocking auth errors in baseline flow.
- Side panel opens and renders 100% of attempts in local test.

---

## Phase B: Backend and Data Model (Week 2)

### B1. Backend Skeleton
- Framework: Node (Fastify/Nest) or Python (FastAPI).
- Add auth middleware verifying Clerk session/JWT.
- Add global request ID + structured logging.

### B2. Database Schema (v1)

#### users
- `id` (uuid, pk)
- `clerk_user_id` (unique)
- `email`
- `created_at`, `updated_at`

#### subscriptions
- `id` (uuid)
- `user_id` (fk users)
- `plan` (`free|pro`)
- `status`
- `renewal_at`
- `created_at`, `updated_at`

#### usage_events
- `id` (uuid)
- `user_id` (fk users)
- `event_type` (`solve_request`, `capture`, `injection`, etc.)
- `units`
- `metadata` (jsonb)
- `created_at`

#### questions
- `id` (uuid)
- `user_id` (fk users)
- `source` (`dom|capture|upload|manual`)
- `raw_text`
- `metadata` (jsonb)
- `created_at`

#### solutions
- `id` (uuid)
- `question_id` (fk questions)
- `final_answer`
- `explanation_markdown`
- `steps` (jsonb array)
- `latex_blocks` (jsonb array)
- `confidence` (numeric)
- `model_name`
- `token_usage` (jsonb)
- `created_at`

#### attachments
- `id` (uuid)
- `question_id` (fk questions)
- `storage_url`
- `mime_type`
- `width`, `height`
- `created_at`

### B3. API Contracts (v1)

#### POST `/solve`
Request:
```json
{
  "questionText": "string",
  "source": "dom|capture|upload|manual",
  "context": {
    "url": "string",
    "title": "string",
    "siteAdapter": "string"
  },
  "attachments": [
    {
      "url": "string",
      "mimeType": "image/png"
    }
  ]
}
```

Response:
```json
{
  "answer": "Option B",
  "finalAnswerLatex": null,
  "steps": [
    "Step 1 ...",
    "Step 2 ..."
  ],
  "explanation": "markdown",
  "latexBlocks": [
    "\\\\int_0^1 x^2 dx = 1/3"
  ],
  "confidence": 0.83,
  "warnings": []
}
```

#### GET `/history`
- Paginated user history.

#### POST `/feedback`
- User rating + issue type for solution quality loop.

### B4. Exit Criteria
- Migrations run cleanly.
- `/solve` accepts and returns schema-valid payloads.
- Authenticated requests only.

---

## Phase C: AI Orchestration and Quality (Weeks 3-4)

### C1. AI Pipeline Steps
1. Input validator (sanitize and normalize).
2. Task classifier:
   - MCQ / short text / math-heavy / image-heavy.
3. Prompt builder with strict output schema.
4. Model execution.
5. Output parser + repair pass (if invalid JSON/schema).
6. Confidence + safety post-processor.

### C2. Prompt Strategy
- Always request:
  - concise `final_answer`
  - ordered `steps[]`
  - optional `latexBlocks[]`
  - uncertainty warning when ambiguous
- Enforce no hallucinated certainty for unclear context.

### C3. Fallback Rules
- If DOM parse weak + image exists -> vision path.
- If parse fails -> return structured error + recovery advice.
- Retry once with simplified prompt on malformed outputs.

### C4. Quality Controls
- Golden test set of representative questions.
- Compare model outputs against expected rubric.
- Add automated regression snapshots for answer shape.

### C5. Exit Criteria
- Stable schema output >= 98% in tests.
- Human-reviewed quality pass on top 50 scenarios.

---

## Phase D: Frontend Response UX and Math Rendering (Week 5)

### D1. UI Rendering Contract
- `AnswerHeroCard` for immediate result visibility.
- Timeline step renderer for explanation flow.
- KaTeX rendering for math blocks and inline math.

### D2. LaTeX Integration
- Parse and render:
  - inline `$...$`
  - display `$$...$$`
  - explicit `latexBlocks[]`
- If parsing fails:
  - render fallback code block
  - log parse error for QA tracking

### D3. UX States
- idle
- detecting
- solving
- solved
- error/retry

### D4. Exit Criteria
- Math renders correctly for benchmark examples.
- Error states are non-blocking and actionable.

---

## Phase E: DOM Detection Engine (Weeks 6-7)

### E1. Detection Strategy
- Generic extractor:
  - identify likely question containers
  - detect choices/labels/inputs
  - detect free-text prompts
- Site adapters for known platforms:
  - high-confidence selectors
  - custom normalization rules

### E2. Confidence Scoring
- Score based on:
  - semantic completeness
  - choice extraction success
  - field mapping confidence
- If score low, prompt user to use capture mode.

### E3. Output Schema
```json
{
  "questionText": "...",
  "choices": ["A", "B", "C"],
  "questionType": "mcq|text|unknown",
  "targetFields": [
    { "selector": "...", "type": "radio|textarea|input" }
  ],
  "confidence": 0.0
}
```

### E4. Exit Criteria
- >= 85% accurate extraction on supported sites.

---

## Phase F: Screenshot + Vision Flow (Week 8)

### F1. Capture UX
- Crop overlay with clear drag interaction.
- Fallback to full visible capture if crop fails.
- Attachment preview and removal state synced in composer.

### F2. Backend Vision Path
- OCR + model vision input route.
- Merge extracted text with user prompt.

### F3. Exit Criteria
- Image-only questions produce valid solve response.
- Capture flow stable across major websites.

---

## Phase G: Safe Answer Injection (Weeks 9-10)

### G1. Injection Modes
- Suggest-only mode (default)
- Assisted apply mode (user click confirms)

### G2. Supported Field Types
- `input[type=text]`, `textarea`, contenteditable
- `input[type=radio]` and `checkbox` by choice matching

### G3. Safety Rules
- Never auto-submit forms.
- Show “applied” toast + undo option.
- Block injection if confidence below threshold.

### G4. Exit Criteria
- >= 90% successful fill on supported selectors.
- No destructive form behaviors.

---

## Phase H: Usage, Plans, and Billing Integration (Week 11)

### H1. Usage Tracking
- Track solve requests server-side only.
- Return remaining usage in each solve response.

### H2. Plan Enforcement
- Free plan hard limits.
- Graceful limit-exceeded response.
- Upgrade prompt in UI with clear context.

### H3. Exit Criteria
- Server-enforced limits cannot be bypassed client-side.

---

## Phase I: Security, Observability, and QA Hardening (Week 12)

### I1. Security
- Minimize manifest permissions.
- Sanitize markdown/HTML before rendering.
- Validate all incoming API payloads.
- Add abuse throttling and anomaly detection.

### I2. Observability
- Structured logs (`request_id`, `user_id`, `site`, `latency`).
- Error monitoring (Sentry or equivalent).
- Dashboard: solve latency, error rates, extraction confidence.

### I3. QA Matrix
- Browsers: Chrome stable/beta
- Sites: each supported target + generic forms
- Flows: auth, capture, solve, inject, logout, limit-exceeded

### I4. Exit Criteria
- Release checklist fully green.

---

## 4. Implementation Backlog by Area

## 4.1 Extension Frontend
- [ ] Split sidepanel state into feature hooks (`useAuthGate`, `useSolve`, `useCapture`).
- [ ] Move solve API calls to service module (`services/solveApi.ts`).
- [ ] Add typed response guards.
- [ ] Add unit tests for parse/render helpers.

## 4.2 Content/Background Scripts
- [ ] Normalize message types into shared constants.
- [ ] Add strict runtime guards for message payloads.
- [ ] Add domain adapter registry for DOM extraction.

## 4.3 Backend
- [ ] Auth middleware and RBAC policy.
- [ ] `/solve` orchestration + retries.
- [ ] History + feedback endpoints.
- [ ] Usage and subscription checks.

## 4.4 Database
- [ ] Migrations for v1 tables.
- [ ] Index and retention policy.
- [ ] Seed script for dev testing.

## 4.5 QA
- [ ] End-to-end smoke tests on supported sites.
- [ ] Golden-answer regression suite.
- [ ] Security test pass.

---

## 5. Risks and Mitigations

### Risk: OAuth in sidepanel/popup instability
- Mitigation: use supported auth methods in extension, move OAuth to Sync Host later.

### Risk: DOM variance across sites
- Mitigation: site adapters + confidence score + capture fallback.

### Risk: AI hallucination or overconfidence
- Mitigation: strict schema + uncertainty policy + feedback loop.

### Risk: Latency spikes
- Mitigation: classifier routing + prompt size control + retries with backoff.

### Risk: Injection misuse
- Mitigation: user-confirmed apply, never auto-submit, explicit undo.

---

## 6. Release Plan

### 6.1 Internal Alpha
- Limited site support.
- Team-only extension build.
- Collect failure traces and QA notes.

### 6.2 Private Beta
- 20-100 users.
- Monitor solve quality, capture success, and UI friction.
- Iterate adapters and prompts weekly.

### 6.3 Public Launch
- Freeze core features.
- Production keys + production domain setup.
- Final security and policy review.

---

## 7. Immediate Next 10 Tasks (Recommended)

1. Lock auth to extension-safe methods (email/password/OTP).
2. Finalize and commit `/solve` request/response TypeScript interfaces.
3. Move sidepanel API call logic to `services/solveApi.ts`.
4. Add backend stub endpoint returning schema-valid mock response.
5. Add KaTeX render path for `latexBlocks` and inline math.
6. Implement DOM extractor v1 for one target site.
7. Implement injection adapter v1 for text + radio fields.
8. Add usage counters from backend response into header.
9. Add request ID logging from extension -> backend.
10. Build QA checklist and run first full smoke pass.

---

## 8. Definition of Done (Per Feature)

A feature is complete only when:
- Code compiles and lint passes.
- Unit/integration tests added where applicable.
- UX states include loading + error + retry.
- Telemetry/logging added for key failures.
- Security implications reviewed.
- Docs updated (README or feature markdown).

