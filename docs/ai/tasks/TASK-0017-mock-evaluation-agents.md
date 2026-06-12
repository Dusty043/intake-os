# TASK-0017: Mock Agent Implementations — All 12 Evaluation Agents

## Status

**COMPLETE**

## Depends On

TASK-0016 — Domain Foundation: Evaluation Aggregate + Agent Contracts

## Goal

Implement all 12 deterministic mock evaluation agents, one per `EvaluationSectionKind`, using heuristic text analysis on the intake record. No real AI calls, no orchestrator.

## Files Created

| File | Purpose |
|------|---------|
| `src/application/agents/mock/mock-agent-helpers.ts` | Shared deterministic helpers: text normalization, keyword detection, complexity/story-point inference, tech stack inference, integration/data-store detection |
| `src/application/agents/mock/mock-intake-analyst-agent.ts` | `intake_brief` — extracts goals, constraints, success criteria from intake |
| `src/application/agents/mock/mock-clarification-questions-agent.ts` | `clarification_questions` — detects missing info, flags blocking |
| `src/application/agents/mock/mock-project-classifier-agent.ts` | `classification` — infers project type, recommended depth, signals |
| `src/application/agents/mock/mock-solutions-architect-agent.ts` | `architecture` — recommends tech stack, integration points, data stores |
| `src/application/agents/mock/mock-low-code-path-agent.ts` | `low_code_path` — evaluates low-code/Monday-native viability |
| `src/application/agents/mock/mock-custom-build-agent.ts` | `custom_build` — detects backend/frontend/integration/infra needs |
| `src/application/agents/mock/mock-risk-security-agent.ts` | `risk_security` — identifies typed risks, data sensitivity, security review flag |
| `src/application/agents/mock/mock-cost-effort-agent.ts` | `cost_effort` — estimates story points, complexity, cost drivers |
| `src/application/agents/mock/mock-work-breakdown-agent.ts` | `work_breakdown` — generates subtasks with acceptance criteria, milestones, dependencies |
| `src/application/agents/mock/mock-distribution-planner-agent.ts` | `distribution_plan` — plans Monday/GitHub distribution, always `dryRunOnly: true` |
| `src/application/agents/mock/mock-final-synthesis-agent.ts` | `synthesis` — merges prior sections into executive summary and approval readiness |
| `src/application/agents/mock/mock-critic-qa-agent.ts` | `quality_review` — scores 6 quality dimensions, generates reviewer warnings |
| `src/application/agents/mock/index.ts` | Factory: `createAllMockEvaluationAgents()`, `createMockEvaluationAgentsForDepth(depth)`, `runMockEvaluationAgentsSequentiallyForTest()` |
| `tests/mock-evaluation-agents.test.mjs` | Agent-level tests (per-agent behavior, role correctness, output shape) |
| `tests/mock-evaluation-agent-factory.test.mjs` | Factory tests + round-trip: pipeline → evaluationToLegacyDraft → validateIntakeAnalysisDraft |

## Files Modified

| File | Change |
|------|--------|
| `src/index.ts` | Added `export * from "./application/agents/mock/index.js"` |

## Key Design Decisions

### Helpers (mock-agent-helpers.ts)
- Ports key heuristics from `intake-analysis.ts` (`inferComplexity`, `estimateStoryPoints`, `inferTechStack`) without duplicating business logic
- `inferProjectTypeFromText` / `inferDepthFromText` for classification
- `detectIntegrationPoints` / `detectDataStores` for architecture
- `slugify` for deterministic GitHub repo names
- `buildDeterministicWarnings` for warnings from thin intake

### Agent Contract Compliance
- Every agent implements `EvaluationAgent<TContent>` with `readonly role` and `async run(ctx, opts)`
- All outputs are `AgentOutput<TypedContent>` — no `any`, no untyped returns
- Mock agents never call AI providers, never set governance fields

### MockClarificationQuestionsAgent
- Sets `isClarificationBlocking: true` on output when content is blocking
- Blocks when: description < 30 chars, no business goal signal, or title < 5 chars

### MockCriticQAAgent
- Baseline 70 per dimension
- Deducts for blocking clarification (−20 to −30)
- Adds for: sections present, subtask count, architecture, risks, acceptance criteria
- `readinessBand` derived from `qualityBandFromScore(overall)` (validated by TASK-0016 contract)

### MockDistributionPlannerAgent
- `dryRunOnly: true` hardcoded — never generates live write instructions
- Reads `custom_build` from `ctx.sections` to determine GitHub requirement

### `runMockEvaluationAgentsSequentiallyForTest`
- Sequential, routing-table-ordered, context-accumulating
- **Not** the real orchestrator — TASK-0018 builds that
- Used for integration tests and round-trip validation

## Tests

307/307 passing (`npm test`)  
`npm run build` clean  
`npm run api:build` clean  
`npm run web:build` clean  
`npm run demo:analysis` unchanged

## Round-Trip Validation

Full-depth pipeline → `evaluationToLegacyDraft` → `validateIntakeAnalysisDraft` passes with `valid: true`.

## Follow-up: TASK-0018

Implement the evaluation orchestrator: 3-stage pipeline (Stage 1 serial, Stage 2 parallel, Stage 3 serial), depth routing, clarification blocking, quality gating, NestJS service integration.
