# Handoff: TASK-0020 → Current State

**Written:** 2026-06-17
**For:** anyone picking up this codebase cold

---

## What TASK-0020 Was

TASK-0020 wired the `EvaluationOrchestrator` — a 3-stage, 12-agent AI pipeline — into the live intake workflow, replacing the legacy mock analysis path. It was the step that made AI evaluation real.

Before TASK-0020, pressing "Generate Mock AI Draft" called a hardcoded mock provider. After TASK-0020, setting `ANALYSIS_ENGINE=orchestrator` routes that same button through the real orchestrator, which runs scoping, deep analysis, and synthesis agents, then maps the result back into the same `IntakeAnalysisDraft` shape the rest of the system already knew how to handle.

---

## What Was Built

### Core wiring (`intake-workflow-service.ts`)

The `IntakeWorkflowService` gained an optional `orchestrator?: EvaluationOrchestrator` option. When it is present, all evaluation calls route through it. When it is absent, the service falls back to the legacy mock `analysisProvider`. This means the domain layer has no knowledge of the env flag — the flag lives entirely in `runtime.module.ts`.

Key methods added:

- `generateEvaluation(id, actor)` — the new canonical path. Calls `orchestrator.orchestrate()`, handles the two result shapes: `draft_ready` (success) and `clarification_required`.
- `generateMockAnalysisDraft` — unchanged public interface, now delegates to `generateEvaluation` when the orchestrator is injected.
- `regenerateAnalysisDraft` — extended to route through the orchestrator when present, using `discoveryNotes: [guidance]` to steer the re-run.

### `clarification_required` routing

When the orchestrator determines it needs more information, it returns a `ClarificationRequiredResult` with a list of `PendingClarificationQuestion` objects. The service stores these on the intake record as `pendingClarification` and transitions the status to `clarification_required`. When the requester answers and resubmits, answers are stored as `priorClarifications` and the intake is moved back to `submitted` for a fresh evaluation run.

### Evaluation persistence

Each orchestrator run produces an `IntakeEvaluation` record with 12 `EvaluationSection` entries and associated `AgentRun` provenance rows. These are stored in the database via Prisma and are independent of the `IntakeAnalysisDraft`. The draft is derived from the evaluation via `evaluationToLegacyDraft()` — the approval and review flow reads from the draft, not directly from the evaluation.

### Environment gate

```
ANALYSIS_ENGINE=orchestrator
```

Set in `.env.server` on `oreochiserver` at `/home/oreo/intake-os/.env.server`. This file is not committed. When the flag is absent or any other value, the service uses the legacy mock path. The default on the server is currently the mock path unless this flag is explicitly set.

### Tests (at completion of TASK-0020)

388/388 passing. 10 new tests in `tests/generate-evaluation-service.test.mjs` covering:
- happy path: evaluation → draft → `intake_review`
- `clarification_required` routing and audit
- orchestrator-not-configured guard
- regen supersedes previous draft
- `EVALUATION_REGENERATED` audit event

---

## What Was Built Afterward (TASK-0021 + TASK-0022)

These are not part of TASK-0020 but are important context:

**TASK-0021** added the Evaluation tab in the web UI. The 12-section evaluation packet is now visible to reviewers at `GET /intakes/:id/evaluations/latest`. The tab shows quality scores, agent provenance, section-by-section content, and a "steer + regenerate" form.

**TASK-0022** (review fixes) extracted `ClarificationPanel` to its own component, added Vitest tests, fixed the approval gate discriminator (`approveGate()` now explicitly passes `"gate_1"` or `"gate_2"` so the server validates intent), and stabilized the `onResubmit` callback.

---

## Current System State (as of this handoff)

### What works end-to-end (mock path, always available)

1. Submit intake
2. Generate mock AI draft
3. Review draft (accept / revise / reject / regen with guidance)
4. Gate 1 approval
5. Gate 2 approval
6. Generate distribution preview (dry-run only — no external writes yet)
7. Clarification Q&A cycle

### What works only with `ANALYSIS_ENGINE=orchestrator`

- Real 12-agent evaluation instead of hardcoded mock
- Evaluation tab shows real agent outputs and provenance
- Clarification questions are AI-generated based on the actual intake content

### What does NOT exist yet

- **Live provisioning** — the "Provision Now" button does not exist. The distribution preview is dry-run only. No Monday items or GitHub repos are created. See `TASK-0023-provisioning-and-integrations-plan.md` for the plan.
- **Email intake** — no email parsing or inbound webhook.
- **Google Chat** — no outbound notifications, no `/intake` command.
- **Background job queue** — provisioning, when built, will run synchronously in v1. A job queue is a later upgrade.
- **Post-distribution lifecycle** — `in_progress`, `blocked`, `completed` lifecycle states are defined in the spec but not implemented.
- **Admin failure dashboard** — defined in `failure-and-recovery.md` but not built.

---

## Key Files

| File | Role |
|---|---|
| `src/application/intake-workflow-service.ts` | Core workflow service — all state transitions, evaluation, approval, provisioning guards |
| `src/application/evaluation-orchestrator.ts` | 3-stage AI orchestrator |
| `src/application/agents/mock/` | 12 mock agents used when orchestrator runs without real AI keys |
| `apps/api/src/runtime/runtime.module.ts` | Wires orchestrator into the service; reads `ANALYSIS_ENGINE` env flag |
| `apps/web/src/app/intakes/[id]/page.tsx` | Main intake detail page — tabs, actions, ClarificationPanel, EvaluationPanel |
| `apps/web/src/components/ClarificationPanel.tsx` | Clarification Q&A form component |
| `apps/web/src/components/EvaluationPanel.tsx` | 12-section evaluation viewer |
| `apps/web/src/lib/api-client.ts` | All web → API calls |
| `docs/ai/tasks/TASK-0023-provisioning-and-integrations-plan.md` | Planning doc for the next phase of work |

---

## Open Questions Deferred from TASK-0020

These were intentionally left for later:

1. **Section regeneration granularity** — currently "regen" re-runs the full orchestrator with guidance. Running just the single relevant agent is not implemented.
2. **Partial evaluation on clarification** — when `clarification_required` is returned, the partial `clarification_questions` and `intake_brief` sections are not persisted. If you want the UI to show "here's what we figured out so far," this needs to be stored.
3. **`priorClarifications` on the orchestrator re-run** — answers are passed back to the orchestrator via `priorClarifications` on the intake record. The orchestrator currently receives them but agent-level use is not deeply tested with real AI calls.

---

## What to Read Before Changing Anything

Per `CLAUDE.md` — required reading before modifying these areas:

- **Approval logic or state transitions** → `docs/product/workflow-state-machine.md`
- **AI evaluation, clarification, or orchestration** → `docs/product/ai-orchestration.md`
- **Provisioning or distribution** → `docs/product/distribution-rules.md`
- **Failure handling or retries** → `docs/product/failure-and-recovery.md`
- **Post-distribution lifecycle** → `docs/product/post-distribution-lifecycle.md`
