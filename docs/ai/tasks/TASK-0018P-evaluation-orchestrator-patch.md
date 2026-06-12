# TASK-0018P: Evaluation Orchestrator Patch

## Status

**COMPLETE**

## Depends On

- TASK-0018 — In-memory Evaluation Orchestrator (commit 1bec4f6)

## Goal

Patch small issues found during manual demo inspection before persisting the evaluation shape in TASK-0019.

## Changes

### 1. Confidence Scale Normalization

Agent confidence is now 0–1 everywhere (was validated against 0–100 incorrectly).

- `src/application/evaluation-orchestrator.ts` — confidence validation changed from `> 100` to `> 1`; error message updated to `"out of range [0, 1]"`.
- `src/application/agents/agent-contract.ts` — added JSDoc comment: `/** Agent's confidence in this output. Must be in [0, 1]. */`.
- `tests/evaluation-orchestrator.test.mjs` — renamed "rejects agent confidence above 100" → "rejects agent confidence above 1"; updated stub confidence values from `80`/`150`/`30` to `0.85`/`1.1`/`0.3`.

QualityScore dimensions and overall remain 0–100. The scales are separate concerns.

### 2. Demo Output Spacing

Fixed `scripts/demo-evaluation-orchestrator.mjs` section line from:
```
latency=0msconf=0.8
```
to:
```
latency=0ms | conf=0.8
```

### 3. MockCriticQAAgent Feasibility Weakness

`src/application/agents/mock/mock-critic-qa-agent.ts`:
- `buildWeaknesses()` now accepts `feasibility` and `riskSec` parameters.
- When `feasibility < 60`, adds a weakness explaining the drivers (blocking clarification, high-severity risk count).
- Example: `"Feasibility score is low (2 high-severity risks) — review scope, risks, and blocking items before proceeding"`.

## Verification

```bash
npm run check  # 352/352 pass
npm run demo:evaluation-orchestrator  # pass
```

## Non-Goals

No workflow, API, Prisma, UI, or QualityScore scale changes.
