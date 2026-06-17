# Handoff: TASK-0014P through TASK-0023

**Written:** 2026-06-17
**Covers:** TASK-0014P, TASK-0018P, TASK-0020, TASK-0021, TASK-0022, TASK-0023 (plan)
**For:** anyone picking up this codebase, or resuming after a break

---

## The Arc

These six tasks represent the AI evaluation pipeline being built and fully connected — from the raw orchestration engine in memory, through persistence, all the way to the reviewer-facing UI. By the end of this arc, an intake can be submitted, evaluated by 12 AI agents, reviewed, approved through two gates, and previewed for distribution. The only thing left is actually writing to external systems (Monday, GitHub), which is planned in TASK-0023.

---

## TASK-0014P — Reject → Regenerate Loop Fix

**Commit:** `e6ca087`

### Problem it solved

After a reviewer rejected an AI draft, the intake was stuck. Regeneration required a draft with `reviewStatus === "draft"`, but rejection sets it to `"rejected"`. There was no escape — the intake sat in `intake_review` forever.

### What changed

One line in `regenerateAnalysisDraft` in `intake-workflow-service.ts`: the lookup changed from requiring `reviewStatus === "draft"` to accepting `reviewStatus === "draft" || "rejected"`. That's it.

### The correct loop it enables

```
intake_review
  → draft arrives                      (reviewStatus: "draft")
  → reviewer rejects                   (reviewStatus: "rejected", stays intake_review)
  → reviewer calls regen with guidance → rejected draft becomes "superseded"
  → new draft arrives                  (reviewStatus: "draft")
  → repeat up to 5 times
  → reviewer accepts or revises        → reviewedProjectPackage created → Gate 1
```

Regen limit of 5 still applies across all cycles. Accepted and superseded drafts still block regeneration. No state machine changes.

---

## TASK-0018P — Evaluation Orchestrator Patch

**Commit:** `0f89600` (batched with TASK-0019)

### Three small fixes before persistence was built

**1. Confidence scale.** Agent confidence was being validated against 0–100 but the spec said 0–1. Fixed the validator and all mock agent stub values. QualityScore dimensions (also in the orchestrator output) are still 0–100 — those are a separate scale.

**2. Demo output spacing.** A formatting bug in the demo script was printing `latency=0msconf=0.8` (two fields jammed together). Fixed to `latency=0ms | conf=0.8`.

**3. Mock Critic/QA agent.** When the feasibility score was low, the mock critic wasn't explaining why. Fixed `buildWeaknesses()` to include a human-readable explanation when `feasibility < 60` (e.g. "Feasibility score is low (2 high-severity risks) — review scope, risks, and blocking items before proceeding").

These were discovered during a demo run before TASK-0019 persisted the evaluation shape. Better to fix the scale before it was baked into the database.

---

## TASK-0020 — Wire EvaluationOrchestrator into Live Intake Workflow

**Commits:** `df6a946` (steps 1–6), `603ca16` (step 7)

### What this task was

The evaluation orchestrator existed in memory. TASK-0020 connected it to the actual intake workflow — so pressing the "Generate Mock AI Draft" button in the UI could optionally route through the real 12-agent pipeline instead of hardcoded mock output.

### The env gate

```
ANALYSIS_ENGINE=orchestrator
```

Set in `.env.server` on `oreochiserver`. Not committed. When absent, the legacy mock path runs. This flag is read only in `runtime.module.ts` — the domain layer never reads env vars directly.

### Key design: same output shape, new engine

The orchestrator produces an `IntakeEvaluation` with 12 sections. That evaluation is then mapped to an `IntakeAnalysisDraft` via `evaluationToLegacyDraft()`. Everything downstream — accept, revise, reject, regen, Gate 1, Gate 2 — reads from the draft and is completely unchanged. The evaluation record lives alongside the draft as additional detail, accessible via its own read API.

### clarification_required routing

When the orchestrator determines it needs more info, it returns a `ClarificationRequiredResult` with `PendingClarificationQuestion[]`. The service stores these as `pendingClarification` on the intake record and transitions to `clarification_required`. When the requester answers and resubmits, their answers are stored as `priorClarifications` and the intake moves back to `submitted` for a fresh run.

### Section regeneration (step 7)

`regenerateAnalysisDraft` routes through the orchestrator when present, using the reviewer's guidance as `discoveryNotes`. It re-runs the full evaluation (not just one section — single-section regen is a known deferred item).

### Tests at completion

388/388 passing. 10 new tests in `tests/generate-evaluation-service.test.mjs`.

---

## TASK-0021 — Web UI: Evaluation Review Experience

**Commits:** `f8f9d24`, `5b9a6f1` (gap-fill)

### What this task was

The evaluation data was being stored but invisible to reviewers. TASK-0021 added the API read layer and built the Evaluation tab in the web UI.

### API additions

Three new read-only endpoints on the intake controller:

- `GET /intakes/:id/evaluations` — list all evaluations for an intake (version history)
- `GET /intakes/:id/evaluations/latest` — the one reviewers care about
- `GET /intakes/:id/evaluations/:evaluationId` — fetch a specific evaluation by ID

All three are read-only. No state changes. DTOs are in `apps/api/src/modules/intake/dto/evaluation.dto.ts`.

### UI additions

**`EvaluationPanel.tsx`** — the top-level component rendered in the Evaluation tab. Shows:
- Quality score (overall + 5 dimensions: completeness, feasibility, risk, clarity, actionability)
- Readiness band (ready / needs_clarification / not_ready)
- All 12 sections in collapsible cards
- Agent provenance per section (provider, model, latency, confidence %, token counts)
- "Steer + Regenerate" form that pre-fills guidance from any section

**`EvaluationSectionCard.tsx`** — one card per section, with typed renderers for all 12 section kinds. A `FallbackRenderer` catches any unknown kind safely.

**`page.tsx`** — the Evaluation tab is loaded in parallel with the intake (slow evaluation fetch doesn't block the page). Refreshes after `mock_draft`, `regen_draft`, and `resubmit` actions.

**ClarificationPanel polish** (gap-fill in `5b9a6f1`):
- Required/optional question grouping with section headers
- Prior answers shown above the new form
- Per-field inline validation (error shows on blur, not on load)
- Submit disabled until all required fields are filled
- Success banner replaces the form after resubmit
- Error banner if the API call rejects

### Tests at completion

398/398 passing. 8 new tests in `tests/evaluation-api-read.test.mjs`.

---

## TASK-0022 — ClarificationPanel Review Fixes + Test Infrastructure

**Commits:** `d0cf9f7`, `0cfa8cd` (docs)

### What this task was

A full `/review` pass on the TASK-0021 diff surfaced a batch of real issues. This task applied them all.

### The fixes

**Double-submit race.** Between a click and React re-rendering the button as disabled, a second click could fire a second API call. Fixed with `submittingRef = useRef(false)` — set synchronously at the top of `handleResubmit`, cleared in `finally`.

**Stale answers on refresh.** If the parent re-fetches and `questions` prop changes (different IDs), old answers keyed by old IDs would silently drop on submit. Fixed with a `useEffect` that wipes `answers`, `touched`, `resubmitError`, and `submitted` when the `questions` reference changes.

**Accessibility.** Required textareas were invisible to screen readers. Added `aria-required`, `aria-invalid`, `aria-describedby` (linking to the error `<p>`), and `htmlFor` on labels.

**Stable keys.** `priorClarifications.map((pc, i) => key={i})` replaced with `key={pc.question}`.

**Gate discriminator.** `approveGate()` in the API client previously sent no gate identifier — the server auto-inferred which gate to advance. Changed to pass `gate: "gate_1" | "gate_2"` explicitly. The server validates the requested gate matches the open state and rejects mismatches. This prevents the (theoretical) bug where clicking "Approve Gate 2" would advance Gate 1 if Gate 1 happened to be open.

**DRY refactor.** `ClarificationPanel` extracted from `page.tsx` into `src/components/ClarificationPanel.tsx`. A `QuestionField` sub-component defined *outside* the parent handles both required and optional question rendering — no remount issue. This also enables unit testing.

**useCallback.** The inline `onResubmit` arrow in `OverviewTab` is now `handleResubmitPanel` declared with `useCallback([onAction])` so `ClarificationPanel` gets a stable prop reference.

### Test infrastructure (new)

Vitest + `@testing-library/react` added to `apps/web`. 10 tests for `ClarificationPanel` covering all the above fixes. Run with `npm test` inside `apps/web` or `npx vitest run` from the web directory.

```
vitest run → 10/10 pass
```

---

## TASK-0023 — Provisioning + Integrations Plan

**Commit:** `6bbed1b`
**Status:** PLANNING — nothing built yet

### What this covers

Three areas for the next phase of work:

1. **Live provisioning** — turn the existing dry-run distribution preview into real Monday items and GitHub repos
2. **Email intake input** — accept intake requests arriving via email
3. **Google Chat integration** — outbound notifications + inbound `/intake` command

The full planning doc is at `docs/ai/tasks/TASK-0023-provisioning-and-integrations-plan.md`. Each phase has a list of decisions (API tokens, board IDs, org names, etc.) that must be answered before code can be written.

### Phase order

```
Phase 1  Monday live provisioning      ← needs Monday token + board/column mapping
Phase 2  GitHub live provisioning      ← needs GitHub org + PAT
Phase 2.5 Retry + partial success UI   ← after Phase 1 + 2
Phase 3  Email intake parser           ← needs email address + delivery mechanism
Phase 4a Google Chat notifications     ← needs space webhook URL + GCP project
Phase 4b Google Chat inbound intake    ← after Phase 4a + GCP app setup
```

Phases 1 and 3 can start in parallel once their blockers are answered.

---

## Current System State

### Full end-to-end flow (mock path — always works)

1. Submit an intake from the web form
2. Generate mock AI draft (routes through orchestrator if `ANALYSIS_ENGINE=orchestrator` is set)
3. Evaluation tab shows the 12-section evaluation packet
4. AI Draft tab: accept / revise / reject / regen with guidance (up to 5 regens, loop works after rejection)
5. Clarification Q&A cycle when the AI needs more info
6. Gate 1 approval (Intake Owner role)
7. Gate 2 approval (DevOps Lead role)
8. Generate distribution preview (dry-run, no external writes)

### What does NOT exist yet

| Missing | Notes |
|---|---|
| Live Monday provisioning | Planned in TASK-0023 Phase 1 |
| Live GitHub provisioning | Planned in TASK-0023 Phase 2 |
| Retry / partial success UI | Planned in TASK-0023 Phase 2.5 |
| Email intake input | Planned in TASK-0023 Phase 3 |
| Google Chat notifications | Planned in TASK-0023 Phase 4a |
| Google Chat inbound intake | Planned in TASK-0023 Phase 4b |
| Post-distribution lifecycle (`in_progress`, `blocked`, `completed`) | Spec exists in `docs/product/post-distribution-lifecycle.md`, nothing built |
| Admin failure dashboard | Spec exists in `docs/product/failure-and-recovery.md`, nothing built |
| Background job queue | All current operations are synchronous. Acceptable for now. |

---

## Key Files

| File | Role |
|---|---|
| `src/application/intake-workflow-service.ts` | All state transitions, evaluation routing, approval logic, provisioning guards |
| `src/application/evaluation-orchestrator.ts` | 3-stage, 12-agent AI pipeline |
| `src/application/agents/mock/` | 12 mock agents used when orchestrator runs without real API keys |
| `apps/api/src/runtime/runtime.module.ts` | Wires orchestrator; reads `ANALYSIS_ENGINE` env flag |
| `apps/api/src/modules/intake/intake.controller.ts` | All REST endpoints; evaluation read routes added in TASK-0021 |
| `apps/web/src/app/intakes/[id]/page.tsx` | Main intake detail page — tabs, actions |
| `apps/web/src/components/ClarificationPanel.tsx` | Clarification Q&A form (extracted in TASK-0022) |
| `apps/web/src/components/EvaluationPanel.tsx` | 12-section evaluation viewer |
| `apps/web/src/components/EvaluationSectionCard.tsx` | Per-section card renderers |
| `apps/web/src/lib/api-client.ts` | All web → API calls |
| `apps/web/vitest.config.ts` | Vitest setup (added TASK-0022) |
| `docs/ai/tasks/TASK-0023-provisioning-and-integrations-plan.md` | Next phase planning doc |

---

## Things Worth Knowing

**The OpenAI API key never goes in git.** Lives only in `.env.server` on `oreochiserver` at `/home/oreo/intake-os/.env.server`.

**Tailscale Funnel is live.** The app is accessible at `https://oreochiserver.tail0a3a58.ts.net/` for demo sharing. Caddy proxies `:8080` → `api:3000` for `/api/*` and `web:3001` for everything else.

**The database is Prisma + SQLite on the server.** Schema is in `prisma/schema.prisma`. Migrations run on deploy.

**Two GitHub remotes:**
- `origin` → `https://github.com/Dusty043/intake-os.git`
- `simple-biz` → `https://github.com/Simple-biz/intake-os.git`

Push to both: `git push origin main && git push simple-biz main`.

**Required reading before touching:**
- Approval logic or state transitions → `docs/product/workflow-state-machine.md`
- AI evaluation or orchestration → `docs/product/ai-orchestration.md`
- Provisioning or distribution → `docs/product/distribution-rules.md`
- Failure handling → `docs/product/failure-and-recovery.md`
- Permissions or roles → `docs/product/permissions-and-ownership.md`
