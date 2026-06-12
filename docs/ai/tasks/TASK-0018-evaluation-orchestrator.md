# TASK-0018: Evaluation Orchestrator

## Status

**COMPLETE**

## Depends On

- TASK-0016 — Domain Foundation: Evaluation Aggregate + Agent Contracts
- TASK-0017 — 12 Mock Evaluation Agents

## Goal

Implement the in-memory evaluation orchestrator: a 3-stage pipeline that coordinates the 12 evaluation agents from TASK-0017, validates every agent output, assembles a valid `IntakeEvaluation`, handles clarification blocking, tracks per-agent provenance/timing, maps quality score to evaluation status, and wires into NestJS DI.

## Non-Goals (explicit exclusions)

- No Prisma schema changes
- No API route changes
- No UI changes
- No `IntakeWorkflowService` behavior changes
- No real LLM provider calls
- No evaluation persistence
- No clarification response workflow routing

## Files Created

| File | Purpose |
|------|---------|
| `src/application/evaluation-orchestrator.ts` | `EvaluationOrchestrator` class + all types: `EvaluationOrchestratorOptions`, `EvaluationOrchestrationOptions`, `ClarificationOutcome`, `EvaluationReadyResult`, `ClarificationRequiredResult`, `EvaluationOrchestrationResult`, `EvaluationOrchestrationError`, `AgentOutputValidationError`, `MissingEvaluationAgentError` |
| `tests/evaluation-orchestrator.test.mjs` | 45 orchestrator tests across 6 suites |
| `scripts/demo-evaluation-orchestrator.mjs` | 3-demo script: full pipeline, legacy draft round-trip, thin intake clarification_required |
| `docs/ai/tasks/TASK-0018-evaluation-orchestrator.md` | This file |

## Files Modified

| File | Change |
|------|--------|
| `src/index.ts` | Added `export * from "./application/evaluation-orchestrator.js"` |
| `package.json` | Added `demo:evaluation-orchestrator` npm script |
| `apps/api/src/runtime/runtime.module.ts` | Registered `EvaluationOrchestrator` as NestJS provider; exports it |

## Architecture

### Pipeline Stages

**Stage 1 — Serial intake understanding:**
1. `intake_brief` — always run
2. `clarification_questions` — only when in depth routing table (standard/full, not light)
   - If blocking (`isClarificationBlocking` or `content.isBlocking`): return `ClarificationRequiredResult` immediately, no Stage 2/3
3. `classification` — always run; may recommend depth upgrade

**Stage 2 — Parallel specialist analysis:**
- All Stage-2 kinds in the effective depth routing table run concurrently via `Promise.all`
- All receive the same frozen Stage-1 section snapshot
- Results are merged in routing-table order (not `Promise.all` resolution order)
- Stage-2 kinds: `architecture`, `low_code_path`, `custom_build`, `risk_security`, `cost_effort`, `work_breakdown`, `distribution_plan` (filtered by effective depth)

**Stage 3 — Serial synthesis and quality review:**
1. `synthesis` — reads all Stage 1 + Stage 2 sections
2. `quality_review` — reads synthesis + all prior sections

### Effective Depth Resolution

```
effectiveDepth = maxDepth(requestedDepth, classifier.recommendedDepth)
```

Only upgrades (light → standard/full, standard → full), never downgrades. Controlled by `allowDepthUpgrade` option (default: `true`).

### Construction Validation

At construction time, validates:
- No duplicate agent roles
- All 5 required agents present: `intake_brief`, `clarification_questions`, `classification`, `synthesis`, `quality_review`

Per-orchestration: validates all agents needed for effective depth exist.

### Agent Output Validation

Before every section is assembled, validates:
- `sectionKind` matches expected kind
- `confidence` is a number in `[0, 100]`
- `warnings` is an array
- `content` is a non-null object

### Quality Status Mapping

| readinessBand | IntakeEvaluationStatus |
|---|---|
| `ready` (≥90) | `ready_for_review` |
| `usable` (70–89) | `ready_for_review` |
| `needs_revision` (50–69) | `needs_revision` |
| `not_ready` (<50) | `not_ready` |

### Provenance

Every section includes:
- `provider`, `model`, `agentRole` from orchestration options
- `generatedAt` — timestamp captured once at `orchestrate()` entry
- `latencyMs` — wall-clock duration from `Date.now()` before/after `agent.run()`
- `confidence`, `warnings` from agent output
- `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd` from agent usage

## Key Design Decisions

### idFactory called once per section, evaluationId once per run

`evaluationId = idFactory("eval")` is called once at the start. Each section gets `idFactory("SECTION")`. This ensures a stable evaluationId across all sections and deterministic IDs when the factory is deterministic.

### Stage 2 frozen snapshot

Stage 2 agents all receive an immutable snapshot of Stage 1 sections (`{ ...sections }`). This guarantees that concurrent agents see identical context regardless of Promise scheduling order.

### allowDepthUpgrade defaults to true

The task spec requires classifiers can upgrade depth (e.g., a standard request classified as a saas_platform upgrades to full). Set `allowDepthUpgrade: false` to pin depth exactly — used in tests for routing table assertions.

### business_goal blocking behavior

`MockClarificationQuestionsAgent` blocks when description lacks any of: "goal", "outcome", "achieve", "result", "purpose", "why", "business". Intakes must include at least one of these for non-blocking runs.

### dryRunOnly invariant

`MockDistributionPlannerAgent` hardcodes `dryRunOnly: true`. The `validateEvaluationSection` enforcer verifies this. The orchestrator never overrides it.

## Tests

45 tests across 6 suites:
- Construction validation (6 tests)
- Clarification blocking (7 tests)
- Depth routing (8 tests)
- Quality gating (5 tests)
- Provenance (6 tests)
- Validation (5 tests)
- Integration (8 tests)

**352/352 tests passing.**

## Verification Results

```bash
npm run build:core    # clean
npm run typecheck     # clean
npm test              # 352/352 pass (was 307)
npm run api:build     # clean
npm run web:build     # clean
npm run prisma:generate  # clean
npm run demo:evaluation-orchestrator  # pass
npm run demo:analysis    # unchanged
npm run demo:guided-regen  # unchanged
```

## Sample Evaluation Output (full depth)

```
Depth: full
Status: ready_for_review
Sections: 12 (all in routing table order)
Quality: overall=87.0, readinessBand=usable
Legacy draft: valid=true, storyPoints=42
```

## Open Questions

- Should the orchestrator honor `classification.recommendedDepth` when it recommends a *shallower* depth than requested? Currently: NO — only upgrades. Confirm with product if there's ever a case to downgrade.
- Band → status mapping for `usable` is `ready_for_review`. Verify with `workflow-state-machine.md` spec if a distinct `usable` status should be added in a future task.

## Follow-up: TASK-0019

Persist `IntakeEvaluation` and `EvaluationSection` to Prisma. Add a migration, map the domain type to Prisma records, and add read/write methods to the store.
