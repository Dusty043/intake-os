# TASK-0019: Prisma Persistence for IntakeEvaluation

## Status

**COMPLETE**

## Depends On

- TASK-0015 — AI Provider Router
- TASK-0016 — Evaluation Domain Foundation
- TASK-0017 — 12 Mock Evaluation Agents
- TASK-0018 — In-memory Evaluation Orchestrator
- TASK-0018P — Confidence scale / demo cleanup

## Goal

Persist the `IntakeEvaluation` aggregate, its typed sections, and per-agent run metadata in Prisma/Postgres. Adds persistence layer only — does not wire orchestrator into live intake workflow.

## Files Added

- `src/application/evaluation-persistence.ts` — `AgentRunRecord`, `EvaluationPersistenceBundle`, `agentRunsFromEvaluation()`, structural row interfaces, mapper functions (`fromEvaluationRow`, `fromSectionRow`, `fromAgentRunRow`).
- `tests/evaluation-persistence-memory.test.mjs` — 11 in-memory store tests.
- `tests/evaluation-persistence-prisma-mapping.test.mjs` — 16 mapper tests (no DB required).
- `docs/ai/tasks/TASK-0019-prisma-evaluation-persistence.md` — this file.

## Files Modified

- `apps/api/prisma/schema.prisma` — added `IntakeEvaluation`, `EvaluationSection`, `AgentRun` models; added `evaluations IntakeEvaluation[]` to `ProjectIntake`.
- `src/application/types.ts` — extended `ProjectIntakeStore` with 6 evaluation methods.
- `src/application/in-memory-store.ts` — implemented all evaluation store methods.
- `apps/api/src/persistence/prisma-project-intake-store.ts` — implemented evaluation persistence using `$transaction` with delete/recreate for sections and runs.
- `src/index.ts` — added `evaluation-persistence.ts` export.
- `docs/ai/BUILD_LOG.md` — appended task entry.
- `docs/ai/MEMORY_INDEX.md` — added task entries for 0018P and 0019.

## Architecture Notes

- Agent confidence is 0–1. QualityScore dimensions/overall are 0–100. These are separate.
- `agentRunsFromEvaluation()` derives one AgentRun per section from provenance. Future tasks can add richer failed/skipped run rows.
- `saveEvaluation` uses Prisma `$transaction` with upsert for the evaluation + delete/recreate for sections and runs. This is idempotent within a single evaluation ID.
- Mapper functions use structural interfaces (not Prisma client types) so they can be tested without a database.
- `fromEvaluationRow()` calls `validateIntakeEvaluation()` on every read — ensures the persisted JSON is trusted before use.
- `estimatedCostUsd` maps through `Decimal.toNumber()` on read; stored as `Decimal?` in Prisma.
- `createdByEmail` in the Prisma model is always `null` for now — `Actor` does not include email in the domain type.

## Deployment Notes

Schema deployment uses `prisma db push` (schema-first, not migration files). No Postgres host port binding.

## Non-Goals

- No new API routes
- No UI changes
- No provider calls
- Legacy analysis draft storage untouched (`analysisDrafts`, `latestAnalysisDraft` fields remain)
- No workflow behavior changes (orchestrator not wired to live flow — TASK-0020)

## Verification

```bash
npm run build:core    # clean
npm run api:build     # clean
npm run prisma:generate  # clean
npm test              # 379/379 pass (+27 new tests)
npm run demo:evaluation-orchestrator  # pass
npm run demo:mvp / demo:analysis / demo:analysis-review / demo:review-guard / demo:reviewed-distribution / demo:guided-regen  # all pass
```

## Follow-up

- TASK-0020 — Wire EvaluationOrchestrator into live intake workflow (replaces `generateMockAnalysisDraft`).
- TASK-0022 — Richer AgentRun logging for failed/skipped runs.
