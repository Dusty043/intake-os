# TASK-0018P — Evaluation Orchestrator Patch: Confidence Scale + Demo Output Cleanup

## Status

Planned

## Depends On

Completed:

```text
TASK-0018 — In-memory Evaluation Orchestrator
Commit: 1bec4f6
Tests: 352/352 passing
```

---

# Goal

Patch two small issues found during manual demo inspection before persisting the evaluation shape in TASK-0019.

This patch should be completed before any Prisma schema changes.

---

# Patch Items

## 1. Normalize Confidence Scale Documentation and Validation

Current demo output shows agent confidence as decimal values:

```text
conf=0.8
conf=0.75
conf=0.85
```

This is the preferred internal shape.

Decision:

```text
Agent confidence uses 0–1 scale.
QualityScore dimensions use 0–100 scale.
```

Keep these separate.

Correct:

```text
confidence = 0.8
qualityScore.overall = 87
qualityScore.dimensions.completeness = 90
```

Incorrect:

```text
confidence = 80
```

unless explicitly converted for UI display later.

---

# Required Code Changes

Update domain comments/types/docs/tests to clarify:

```ts
confidence: number; // 0–1
```

Affected areas may include:

```text
src/application/intake-evaluation.ts
src/application/agents/agent-contract.ts
src/application/evaluation-orchestrator.ts
tests/evaluation-orchestrator.test.mjs
tests/intake-evaluation-domain.test.mjs
docs/ai/tasks/TASK-0018-evaluation-orchestrator.md
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/requirements-trace.md
```

Validation should reject:

```text
confidence < 0
confidence > 1
```

Quality scores should still reject:

```text
score < 0
score > 100
```

Do not change `QualityScore`.

---

# 2. Fix Demo Output Formatting

Current demo output has a small formatting issue:

```text
latency=0msconf=0.8
```

Change to:

```text
latency=0ms conf=0.8
```

or:

```text
latency=0ms | conf=0.8
```

Affected file:

```text
scripts/demo-evaluation-orchestrator.mjs
```

---

# 3. Optional QA Rationale Check

The demo showed:

```text
overall: 87
readinessBand: usable
feasibility: 51
```

This is acceptable, but the quality review section should explain why feasibility is low.

Add or verify that `MockCriticQAAgent` emits a weakness, warning, or required revision when feasibility is low.

Example rationale:

```text
Feasibility reduced because the request includes multi-tenant SaaS scope, auth, onboarding flows, AWS deployment, and observability requirements.
```

Do not overfit this to the demo only. Keep the rule generic.

Suggested behavior:

```text
If feasibility < 60, include a weakness explaining the main feasibility drivers.
```

---

# Non-Goals

This patch must not:

```text
change workflow behavior
change API behavior
change Prisma schema
change UI
change provider routing
change evaluation section shapes
change QualityScore scale
```

---

# Acceptance Criteria

```text
1. Agent confidence is documented as 0–1.
2. Validators reject confidence above 1.
3. QualityScore remains 0–100.
4. Demo output spacing is fixed.
5. Quality review explains low feasibility when feasibility is below 60.
6. Existing tests still pass.
7. Existing demos still pass.
8. No Prisma/API/UI/workflow changes.
```

---

# Verification

Run:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:evaluation-orchestrator
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:guided-regen
```

---

# Expected Final Report

```text
TASK-0018P done.

Files modified:
- src/application/intake-evaluation.ts
- src/application/agents/agent-contract.ts
- src/application/evaluation-orchestrator.ts
- scripts/demo-evaluation-orchestrator.mjs
- tests/docs as needed

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- demo:evaluation-orchestrator: pass

Behavior:
- no workflow change
- no Prisma change
- no API change
- no UI change
```

---

# Agent Execution Prompt

```text
You are working on Project Intake OS.

Implement TASK-0018P: Evaluation Orchestrator Patch.

Context:
- TASK-0018 is complete.
- demo:evaluation-orchestrator shows confidence as decimal values like 0.8.
- Before TASK-0019 persistence, we need the confidence scale documented and validated consistently.

Implement:
1. Treat agent confidence as 0–1 everywhere.
2. Keep QualityScore dimensions and overall as 0–100.
3. Update validators/tests/docs to reject confidence > 1.
4. Fix demo output formatting from latency=0msconf=0.8 to latency=0ms conf=0.8 or latency=0ms | conf=0.8.
5. Ensure MockCriticQAAgent explains low feasibility when feasibility < 60.
6. Do not change Prisma/API/UI/workflow behavior.

Verification:
Run:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:evaluation-orchestrator
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:guided-regen

Return:
- commit hash
- files modified
- verification results
- behavior notes
```

---

# TASK-0019 — Prisma Persistence for IntakeEvaluation and EvaluationSection

## Status

Planned

## Governed Checkpoint

This task changes the Prisma schema.

Implementation requires explicit confirmation before running schema changes against the server database.

TASK-0019 should be additive only.

---

# Depends On

Completed:

```text
TASK-0015 — AI Provider Router
TASK-0016 — Evaluation Domain Foundation
TASK-0017 — 12 Mock Evaluation Agents
TASK-0018 — In-memory Evaluation Orchestrator
TASK-0018P — Confidence scale/demo cleanup
```

Current baseline after TASK-0018:

```text
352/352 tests passing
all builds clean
existing demos unchanged
no evaluation persistence yet
```

---

# Goal

Persist the new `IntakeEvaluation` aggregate, its typed sections, and per-agent run metadata in Prisma/Postgres.

This task adds persistence only.

It does not wire the orchestrator into the live intake workflow yet.

That behavior change belongs to TASK-0020.

---

# Core Rule

TASK-0019 stores evaluation objects.

It must not make the app use them yet.

Existing legacy draft behavior remains the source of the live review flow until TASK-0020.

Current flow remains:

```text
generate analysis draft
→ review draft
→ reviewed package
→ approvals
→ distribution preview
```

TASK-0019 only prepares the database and store layer for:

```text
IntakeEvaluation
EvaluationSection
AgentRun
```

---

# Non-Goals

TASK-0019 must not:

```text
replace generateMockAnalysisDraft
replace regenerateAnalysisDraft
change approval gates
change ReviewedProjectPackage behavior
change distribution preview
add new API routes
add frontend UI
route clarification_required into workflow state
persist orchestrator output from live endpoints
enable section regeneration
call real LLM providers
remove legacy analysis draft storage
remove latestAnalysisDraft compatibility fields
```

---

# Existing Deployment Constraint

The server currently uses schema-first Prisma deployment.

TASK-0012 uses:

```text
prisma db push
```

on container startup rather than migration files.

For TASK-0019:

```text
Update Prisma schema.
Run prisma generate.
Use db push in server runtime.
Do not introduce migration files unless intentionally changing deployment strategy.
```

Do not bind Postgres to a host port.

Container Postgres remains internal-only because the server has native Postgres.

---

# Prisma Models

Modify:

```text
apps/api/prisma/schema.prisma
```

Exact relation names should match the current schema style.

Add models equivalent to the following.

## IntakeEvaluation

```prisma
model IntakeEvaluation {
  id                String              @id
  intakeId          String
  depth             String
  status            String
  qualityScore      Json?
  evaluationVersion Int                 @default(1)

  createdAt         DateTime
  updatedAt         DateTime            @updatedAt

  createdById       String
  createdByName     String?
  createdByEmail    String?
  createdByRole     String

  sections          EvaluationSection[]
  agentRuns         AgentRun[]

  intake            ProjectIntake       @relation(fields: [intakeId], references: [id], onDelete: Cascade)

  @@index([intakeId])
  @@index([status])
  @@index([depth])
  @@index([createdAt])
}
```

Notes:

```text
Do not require createdById to reference AuthUser.
dev_headers mode may produce actors that do not exist in AuthUser.
Store actor as a snapshot.
```

---

## EvaluationSection

```prisma
model EvaluationSection {
  id              String            @id
  evaluationId    String
  sectionKind     String
  content         Json
  provenance      Json?
  version         Int               @default(1)
  supersededById  String?
  createdAt       DateTime          @default(now())

  evaluation      IntakeEvaluation  @relation(fields: [evaluationId], references: [id], onDelete: Cascade)

  @@index([evaluationId])
  @@index([sectionKind])
  @@index([supersededById])
}
```

Notes:

```text
content stores the typed section payload as JSON.
provenance stores EvaluationSectionProvenance as JSON.
supersededById enables future section regeneration in TASK-0020.
```

Do not make `supersededById` a required self-relation yet unless Prisma schema style makes it easy.

A plain nullable string is acceptable for this task.

---

## AgentRun

```prisma
model AgentRun {
  id                String            @id
  evaluationId      String
  sectionId         String?
  agentRole         String
  provider          String
  model             String?

  inputTokens       Int?
  outputTokens      Int?
  totalTokens       Int?
  latencyMs         Int?
  estimatedCostUsd  Decimal?

  finishReason      String?
  status            String
  errorMessage      String?

  startedAt         DateTime?
  completedAt       DateTime?
  createdAt         DateTime          @default(now())

  evaluation        IntakeEvaluation  @relation(fields: [evaluationId], references: [id], onDelete: Cascade)

  @@index([evaluationId])
  @@index([sectionId])
  @@index([agentRole])
  @@index([provider])
  @@index([status])
}
```

For TASK-0019, `AgentRun` rows may be derived from section provenance.

Each section can produce one successful `AgentRun` row.

Future TASK-0020/TASK-0022 may create richer failed/skipped run rows.

---

## ProjectIntake Relation

Add relation field to the existing `ProjectIntake` model:

```prisma
evaluations IntakeEvaluation[]
```

Do not remove or rename existing analysis draft fields.

---

# Domain Persistence Types

Add or extend domain persistence types.

Suggested file:

```text
src/application/evaluation-persistence.ts
```

Types:

```ts
export interface AgentRunRecord {
  id: string;
  evaluationId: string;
  sectionId?: string;
  agentRole: EvaluationSectionKind;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  finishReason?: string;
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface EvaluationPersistenceBundle {
  evaluation: IntakeEvaluation;
  agentRuns?: AgentRunRecord[];
}
```

Helper:

```ts
export function agentRunsFromEvaluation(
  evaluation: IntakeEvaluation,
): AgentRunRecord[];
```

For each section, derive:

```text
id = RUN-{section.id}
evaluationId = evaluation.id
sectionId = section.id
agentRole = section.kind
provider/model/tokens/latency/cost from section.provenance
status = success
createdAt = section.provenance.generatedAt
completedAt = section.provenance.generatedAt
```

This keeps TASK-0019 useful without changing the orchestrator output shape.

---

# Store Interface Changes

Find the existing store interface, likely around:

```text
src/application/types.ts
```

or similar.

Add methods:

```ts
saveEvaluation(bundle: EvaluationPersistenceBundle): Promise<void>;

getEvaluation(
  intakeId: string,
  evaluationId: string,
): Promise<IntakeEvaluation | undefined>;

listEvaluationsForIntake(
  intakeId: string,
): Promise<IntakeEvaluation[]>;

getLatestEvaluationForIntake(
  intakeId: string,
): Promise<IntakeEvaluation | undefined>;

listAgentRuns(
  evaluationId: string,
): Promise<AgentRunRecord[]>;
```

Optional:

```ts
getEvaluationById(evaluationId: string): Promise<IntakeEvaluation | undefined>;
```

Rules:

```text
saveEvaluation should validate the IntakeEvaluation before writing.
getEvaluation should validate after reading.
list methods should return newest first unless stated otherwise.
```

---

# In-Memory Store

Modify the in-memory store used by tests.

Likely file:

```text
src/application/in-memory-project-intake-store.ts
```

or similar.

Add:

```text
evaluations map
agentRuns map
saveEvaluation
getEvaluation
listEvaluationsForIntake
getLatestEvaluationForIntake
listAgentRuns
```

Behavior:

```text
saveEvaluation stores evaluation snapshot by id.
agentRuns are stored by evaluationId.
listEvaluationsForIntake returns newest first.
getLatestEvaluationForIntake returns newest by createdAt.
```

Validate on write/read.

---

# Prisma Store

Modify Prisma-backed store.

Likely files:

```text
apps/api/src/persistence/prisma-project-intake-store.ts
```

or current equivalent.

Add mappers:

```ts
toPrismaEvaluationCreateInput(bundle)
fromPrismaEvaluation(record)
toPrismaAgentRunCreateInput(run)
fromPrismaAgentRun(record)
```

Use a transaction:

```text
create/update IntakeEvaluation
create/update EvaluationSection rows
create/update AgentRun rows
```

Recommended `saveEvaluation` behavior:

```text
Upsert evaluation by id.
Upsert sections by id.
Upsert agent runs by id.
Do not delete legacy analysis drafts.
Do not modify intake workflow state.
```

If Prisma upsert becomes too noisy, delete/recreate child rows for the same evaluation ID inside a transaction.

But do not delete evaluations belonging to the same intake.

---

# JSON Handling

Persist:

```text
qualityScore as Json
section.content as Json
section.provenance as Json
```

On read:

```text
reconstruct IntakeEvaluation
validateIntakeEvaluation(evaluation)
return typed object
```

Do not trust database JSON blindly.

Validation on read is important because these objects will eventually power the reviewer UI.

---

# Decimal Handling

`estimatedCostUsd` is nullable.

When reading Prisma Decimal:

```text
convert to number
```

or keep it as null if missing.

Do not crash if Decimal is absent.

If cost tracking env is missing, value should remain:

```text
null
```

---

# Tests

Add:

```text
tests/evaluation-persistence-memory.test.mjs
tests/evaluation-persistence-prisma-mapping.test.mjs
```

If Prisma integration tests already exist and are safe:

```text
tests/evaluation-persistence-prisma-store.test.mjs
```

Keep tests deterministic.

No live provider calls.

No external API calls.

---

# Required Test Cases

## Schema/Mapper Tests

```text
AgentRunRecord can be derived from evaluation sections.
derived agent runs preserve provider/model/tokens/latency/cost.
evaluation validates before persistence.
evaluation validates after read mapping.
Prisma mapper preserves all section kinds.
Prisma mapper preserves qualityScore.
Prisma mapper preserves section provenance.
Decimal cost maps safely to number/null.
```

## In-Memory Store Tests

```text
saveEvaluation stores evaluation.
getEvaluation returns saved evaluation by intakeId + evaluationId.
getEvaluation returns undefined for wrong intake.
listEvaluationsForIntake returns all evaluations newest first.
getLatestEvaluationForIntake returns newest evaluation.
listAgentRuns returns generated agent runs.
saving a second evaluation for same intake does not delete first evaluation.
saved evaluation maps to valid legacy draft.
```

## Prisma Store Tests

If current test setup supports Prisma safely:

```text
saveEvaluation writes evaluation, sections, and agent runs.
getEvaluation reconstructs valid IntakeEvaluation.
listEvaluationsForIntake returns newest first.
listAgentRuns returns persisted runs.
cascade delete works when intake is deleted, if current test setup allows.
```

If Prisma integration test setup is heavy, cover Prisma mappers without DB first and leave full DB smoke for TASK-0020.

---

# API/Runtime Wiring

Do not expose new API routes in TASK-0019.

However, the Prisma store implementation may need to satisfy the updated store interface for NestJS compile.

If the workflow service constructor uses a narrower interface, avoid forcing unrelated runtime changes.

No controller should call evaluation persistence yet.

---

# Server Runtime

After schema update:

```bash
npm run prisma:generate
npm run api:build
```

Server check:

```bash
npm run server:build
npm run server:up
npm run server:health
```

Because deployment uses `db push`, the server should apply additive schema changes on startup.

Do not require Postgres host port binding.

---

# Files to Add

```text
src/application/evaluation-persistence.ts

tests/evaluation-persistence-memory.test.mjs
tests/evaluation-persistence-prisma-mapping.test.mjs

docs/ai/tasks/TASK-0019-prisma-evaluation-persistence.md
```

Optional if needed:

```text
tests/evaluation-persistence-prisma-store.test.mjs
```

---

# Files to Modify

```text
apps/api/prisma/schema.prisma
src/application/types.ts
src/application/in-memory-project-intake-store.ts
apps/api/src/persistence/prisma-project-intake-store.ts
src/index.ts
README.md
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
docs/ai/requirements-trace.md
package.json if test scripts require updates
```

Adjust paths to match the current repo.

---

# Acceptance Criteria

TASK-0019 is complete when:

```text
1. Prisma schema includes IntakeEvaluation.
2. Prisma schema includes EvaluationSection.
3. Prisma schema includes AgentRun.
4. ProjectIntake has additive evaluations relation.
5. Existing legacy analysis draft fields remain untouched.
6. saveEvaluation store method exists.
7. getEvaluation store method exists.
8. listEvaluationsForIntake store method exists.
9. getLatestEvaluationForIntake store method exists.
10. listAgentRuns store method exists.
11. In-memory store supports evaluation persistence.
12. Prisma store supports evaluation persistence or mapper coverage exists if full DB test is deferred.
13. Evaluation JSON content is validated on write.
14. Evaluation JSON content is validated on read.
15. Section provenance is persisted.
16. QualityScore is persisted.
17. AgentRun metadata is persisted.
18. Multiple evaluations can exist for one intake.
19. Latest evaluation can be retrieved deterministically.
20. No live workflow behavior changes.
21. No new API routes.
22. No UI changes.
23. No provider calls.
24. Existing 352 tests still pass.
25. New persistence tests pass.
26. API build passes.
27. Web build passes.
28. Prisma generate passes.
29. Server build/up/health passes if tested.
```

---

# Verification

Run local verification:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:evaluation-orchestrator
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:guided-regen
```

Server verification after confirmation:

```bash
npm run server:build
npm run server:up
npm run server:health
```

Optional DB inspection:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
```

Expected new tables:

```text
IntakeEvaluation
EvaluationSection
AgentRun
```

Exact table names may be lowercase/quoted depending on Prisma/Postgres naming.

---

# Governed Confirmation Before Implementation

Before implementing TASK-0019, confirm:

```text
Proceed with additive Prisma schema change for IntakeEvaluation, EvaluationSection, and AgentRun.
Keep legacy analysis draft fields.
Use schema-first prisma db push deployment.
Do not wire evaluation persistence into live workflow yet.
```

---

# Expected Final Report

```text
TASK-0019 done.

Commit:
- <hash>

Files added:
- src/application/evaluation-persistence.ts
- evaluation persistence tests
- docs/ai/tasks/TASK-0019-prisma-evaluation-persistence.md

Files modified:
- apps/api/prisma/schema.prisma
- store interfaces
- in-memory store
- Prisma store
- src/index.ts
- README/docs/logs

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- demo:evaluation-orchestrator: pass
- existing demos: pass
- server health: pass if tested

Behavior:
- no workflow change
- no API change
- no UI change
- legacy draft storage untouched
- evaluations can now be saved/read by store layer
```

---

# Agent Execution Prompt

```text
You are working on Project Intake OS.

Implement TASK-0019: Prisma Persistence for IntakeEvaluation and EvaluationSection.

First implement TASK-0018P if it has not already been implemented:
- confidence is 0–1
- quality scores are 0–100
- demo output spacing fixed
- low feasibility gets a readable QA rationale

Context:
- TASK-0015 through TASK-0018 are complete.
- Current tests are 352/352 passing.
- The EvaluationOrchestrator produces valid in-memory IntakeEvaluation objects.
- The app still uses legacy IntakeAnalysisDraft for live workflow.
- TASK-0019 is additive persistence only.

Goal:
Add Prisma/store persistence for IntakeEvaluation, EvaluationSection, and AgentRun without changing workflow/API/UI behavior.

Implement:
1. Add Prisma models IntakeEvaluation, EvaluationSection, AgentRun.
2. Add ProjectIntake.evaluations relation.
3. Keep existing analysis draft fields untouched.
4. Add evaluation persistence domain types/helpers.
5. Add AgentRunRecord and agentRunsFromEvaluation.
6. Extend store interface with saveEvaluation/getEvaluation/listEvaluationsForIntake/getLatestEvaluationForIntake/listAgentRuns.
7. Implement in-memory store evaluation persistence.
8. Implement Prisma store evaluation persistence/mappers.
9. Validate IntakeEvaluation on write.
10. Validate IntakeEvaluation on read.
11. Persist qualityScore JSON.
12. Persist section content JSON.
13. Persist section provenance JSON.
14. Persist agent run metadata.
15. Add tests.
16. Update docs/logs.

Rules:
- This is a governed additive schema change.
- No workflow service behavior changes.
- No API routes.
- No UI changes.
- No live provider calls.
- No approval rule changes.
- No distribution changes.
- Do not remove legacy analysis draft storage.
- Do not bind Postgres to host port.
- Use schema-first prisma db push deployment unless the project has already changed migration strategy.

Verification:
Run:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:evaluation-orchestrator
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:guided-regen

If server runtime is available:
npm run server:build
npm run server:up
npm run server:health

Return:
- commit hash
- files added
- files modified
- verification results
- schema change summary
- behavior notes
- next recommended task
```
