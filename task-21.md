# TASK-0021 — Web UI: Evaluation Review Experience

## Status

Planned

## Depends On

Completed:

```text
TASK-0015 — AI Provider Router
TASK-0016 — Evaluation Domain Foundation
TASK-0017 — 12 Mock Evaluation Agents
TASK-0018 — In-memory Evaluation Orchestrator
TASK-0019 — Prisma Evaluation Persistence
TASK-0020 — EvaluationOrchestrator wired into live intake workflow
```

Current baseline:

```text
TASK-0020 complete
390/390 tests passing
EvaluationOrchestrator live behind ANALYSIS_ENGINE=orchestrator
Legacy review flow preserved
ClarificationPanel already exists
POST :id/resubmit already exists
regenerateAnalysisDraft routes through orchestrator when injected
```

---

# Goal

Expose the stored multi-agent `IntakeEvaluation` in the web UI so reviewers can see the actual reasoning behind the generated legacy analysis draft.

TASK-0021 should make the evaluation packet readable, reviewable, and operationally useful.

The user should be able to inspect:

```text
evaluation status
quality score
readiness band
section outputs
agent provenance
agent confidence
warnings
cost/token metadata where present
clarification questions and prior answers
```

The existing governance flow must remain intact:

```text
Evaluation
→ mapped legacy IntakeAnalysisDraft
→ human accepts/revises/rejects
→ ReviewedProjectPackage
→ approval gates
→ distribution preview
```

---

# Core Product Rule

The evaluation UI explains the draft.

It does not replace human review.

Correct:

```text
Reviewer reads evaluation sections
→ reviewer accepts/revises/rejects mapped draft
→ reviewed package is created only by human action
```

Incorrect:

```text
Evaluation ready_for_review
→ auto-create ReviewedProjectPackage
```

No auto-approval.

No gate bypass.

---

# Important Scope Decision

TASK-0020 currently routes `regenerateAnalysisDraft` through the full orchestrator when injected.

It does not implement true single-section regeneration yet.

Therefore TASK-0021 should not pretend section-only regeneration exists.

Recommended TASK-0021 behavior:

```text
Read-only evaluation sections
Full analysis regeneration with guidance using existing regenerateAnalysisDraft path
Section-specific guidance helper that feeds full regeneration, clearly labeled
```

Do not add a fake “regenerate only this section” UI unless a real backend route exists.

True section-level regeneration can be a later task once the product decision is made:

```text
full orchestrator regen vs single-agent section regen
```

---

# Non-Goals

TASK-0021 must not:

```text
change approval rules
change workflow state machine
auto-create ReviewedProjectPackage
execute GitHub/Monday writes
wire real multi-agent provider calls
remove legacy draft compatibility
remove existing draft review UI
change EvaluationOrchestrator behavior
change Prisma schema unless absolutely required
introduce n8n
```

---

# User Experience Target

On an intake detail page, reviewers should see:

```text
Overview
AI Draft / Review Packet
Evaluation
Clarification
Approvals
Distribution
Audit
```

The exact tab structure can follow the current UI, but the evaluation should be visible as a first-class panel.

Recommended experience:

```text
Evaluation Summary
Quality Score
Section tabs/cards
Agent provenance footer
Warnings
Legacy draft linkage
Regenerate analysis with guidance
```

---

# API Surface

TASK-0021 should add read-only evaluation API routes.

Existing frontend likely receives the intake record but not full evaluation sections. Add explicit evaluation read endpoints.

## Route 1 — List evaluations for intake

```http
GET /intakes/:id/evaluations
```

Returns evaluations for the intake, newest first.

Response shape:

```ts
{
  evaluations: EvaluationSummaryDto[];
}
```

`EvaluationSummaryDto`:

```ts
{
  id: string;
  intakeId: string;
  depth: EvaluationDepth;
  status: IntakeEvaluationStatus;
  evaluationVersion: number;
  createdAt: string;
  createdBy: {
    id: string;
    name?: string;
    email?: string;
    role: string;
  };
  qualityScore?: QualityScore;
  sectionKinds: EvaluationSectionKind[];
}
```

---

## Route 2 — Get latest evaluation for intake

```http
GET /intakes/:id/evaluations/latest
```

Returns:

```ts
{
  evaluation: IntakeEvaluationDto | null;
  agentRuns?: AgentRunDto[];
}
```

Use this route for the intake detail page.

---

## Route 3 — Get evaluation by ID

```http
GET /intakes/:id/evaluations/:evaluationId
```

Returns:

```ts
{
  evaluation: IntakeEvaluationDto;
  agentRuns?: AgentRunDto[];
}
```

Validation:

```text
evaluation must belong to the intake
actor must be allowed to view the intake
```

---

# API Authorization

Use the existing auth infrastructure.

All evaluation routes should require authenticated access.

Use:

```text
@CurrentActor()
```

Do not use request body identity.

Suggested permission:

```text
view_intake
```

or whatever the current intake read permission is.

Do not create new broad admin-only rules unless existing policy requires it.

---

# API DTOs

Add DTO/type conversion helpers.

Do not leak raw Prisma rows.

Recommended files:

```text
apps/api/src/modules/intake/dto/evaluation.dto.ts
```

or current DTO pattern.

DTOs:

```ts
EvaluationSummaryDto
IntakeEvaluationDto
EvaluationSectionDto
EvaluationSectionProvenanceDto
QualityScoreDto
AgentRunDto
```

The DTO may preserve section content as typed JSON.

For the web client, that can be:

```ts
content: EvaluationSectionContent
```

or:

```ts
content: unknown
```

with frontend section renderers narrowing by `kind`.

Preferred:

```text
Use discriminated rendering by section.kind.
Avoid raw JSON dump as the primary UI.
```

---

# Web Client API

Modify:

```text
apps/web/src/lib/api-client.ts
```

Add:

```ts
listEvaluationsForIntake(intakeId: string): Promise<EvaluationSummary[]>

getLatestEvaluationForIntake(
  intakeId: string,
): Promise<{ evaluation: IntakeEvaluation | null; agentRuns?: AgentRun[] }>

getEvaluation(
  intakeId: string,
  evaluationId: string,
): Promise<{ evaluation: IntakeEvaluation; agentRuns?: AgentRun[] }>
```

All calls should preserve:

```ts
credentials: "include"
```

and existing dev header behavior in `dev_headers` mode.

---

# Web Types

Modify:

```text
apps/web/src/lib/types.ts
```

Add or mirror:

```ts
export type EvaluationDepth = "light" | "standard" | "full";

export type EvaluationSectionKind =
  | "intake_brief"
  | "clarification_questions"
  | "classification"
  | "architecture"
  | "low_code_path"
  | "custom_build"
  | "risk_security"
  | "cost_effort"
  | "work_breakdown"
  | "distribution_plan"
  | "synthesis"
  | "quality_review";

export type IntakeEvaluationStatus =
  | "generating"
  | "clarification_required"
  | "ready_for_review"
  | "accepted"
  | "rejected"
  | "needs_revision"
  | "not_ready";
```

Also add:

```ts
QualityScore
EvaluationSectionProvenance
EvaluationSection
IntakeEvaluation
AgentRun
```

Do not duplicate too much domain logic in the frontend.

Keep frontend types display-focused.

---

# UI Components

Add new components under:

```text
apps/web/src/components/
```

Recommended components:

```text
EvaluationPanel.tsx
EvaluationSummaryCard.tsx
EvaluationSectionCard.tsx
EvaluationSectionTabs.tsx
QualityScoreBadge.tsx
QualityScoreBreakdown.tsx
AgentProvenanceFooter.tsx
EvaluationWarnings.tsx
EvaluationEmptyState.tsx
EvaluationRegenerateForm.tsx
```

Existing component to enhance:

```text
ClarificationPanel
```

If the project colocates components differently, follow the existing pattern.

---

# EvaluationPanel

Main container.

Props:

```ts
type EvaluationPanelProps = {
  intake: ProjectIntakeRecord;
  evaluation: IntakeEvaluation | null;
  agentRuns?: AgentRun[];
  canRegenerateAnalysis: boolean;
  onRegenerateAnalysis?: (guidance: string) => Promise<void>;
};
```

Behavior:

```text
If no evaluation exists, show an empty state.
If evaluation exists, show summary, quality, sections, provenance.
If intake is clarification_required, emphasize clarification panel over section review.
If latest legacy draft is evaluation-backed, show linkage.
```

Empty state copy:

```text
No evaluation has been generated for this intake yet.
Generate analysis to create the evaluation packet.
```

---

# EvaluationSummaryCard

Shows:

```text
Evaluation ID
Depth
Status
Version
Created at
Created by
Section count
Quality readiness band
Overall quality score
```

Also show a subtle note:

```text
This evaluation was mapped into the current AI draft for human review.
```

Only show that note when the latest draft has evaluation metadata or when the latest evaluation exists.

---

# QualityScoreBadge

Shows:

```text
overall score
readiness band
```

Bands:

```text
ready
usable
needs_revision
not_ready
```

Suggested display:

```text
87 · usable
```

Do not use color as the only signal.

Also render text labels.

---

# QualityScoreBreakdown

Displays six dimensions:

```text
completeness
consistency
specificity
feasibility
risk coverage
handoff readiness
```

Each should show:

```text
dimension name
numeric score
simple bar or text value
```

No charting library required.

Use simple CSS bars if desired.

---

# EvaluationSectionTabs

Show sections in stable pipeline order:

```text
Summary
Intake Brief
Clarification
Classification
Architecture
Low-Code Path
Custom Build
Risk & Security
Cost & Effort
Work Breakdown
Distribution Plan
Synthesis
Quality Review
```

Only show tabs for sections present in the evaluation.

The `Summary` tab can combine:

```text
synthesis
quality score
key warnings
```

---

# EvaluationSectionCard

Render each section by kind.

Do not show raw JSON as the main view.

Each section should have a human-readable renderer.

Fallback renderer:

```text
Unknown section kind
Show pretty JSON
```

The fallback is only for safety.

---

# Section Renderers

Implement display helpers for each section kind.

## intake_brief

Show:

```text
title
normalized summary
stated goals
success criteria
known constraints
```

## clarification_questions

Show:

```text
blocking status
missing fields
questions
```

If answers exist in `priorClarifications`, show answered state where possible.

## classification

Show:

```text
project type
subtype
confidence
recommended depth
signals
reasoning
```

Confidence should display as percentage:

```text
0.85 → 85%
```

Do not change stored confidence scale.

## architecture

Show:

```text
recommendation
architecture style
tech stack
integration points
data stores
deployment notes
assumptions
```

## low_code_path

Show:

```text
viable / not viable
recommended tools
fit reasoning
limitations
when to reject low-code
```

Include a small note:

```text
This evaluates whether the requested downstream project could use a low-code path. It does not mean Project Intake OS should use n8n.
```

## custom_build

Show:

```text
required / not required
rationale
backend needs
frontend needs
integration needs
infrastructure needs
```

## risk_security

Show:

```text
security review required
data sensitivity
risk list grouped by severity/category
mitigations
```

## cost_effort

Show:

```text
story points
engineering days if present
complexity
infra cost signal
cost drivers
cost assumptions
```

## work_breakdown

Show:

```text
subtasks
acceptance criteria
estimated hours
suggested owner role
milestones
dependencies
```

This section should be very readable because it will likely become the bridge to GitHub/Monday later.

## distribution_plan

Show:

```text
dryRunOnly badge
Monday required/suggested board/group/item
GitHub required/repository/labels
issue breakdown suggested
distribution notes
```

Make it clear:

```text
This is a plan only. No downstream systems were modified.
```

## synthesis

Show:

```text
executive summary
recommended path
key decisions
review notes
approval readiness summary
```

This is the main review packet.

## quality_review

Show:

```text
quality score
strengths
weaknesses
required revisions
reviewer warnings
```

---

# AgentProvenanceFooter

Every section card should show provenance in a compact footer:

```text
agent role
provider
model
generated at
latency
confidence
tokens
estimated cost
warnings
version
```

Rules:

```text
confidence stored as 0–1; display as percent
quality score stored as 0–100; display as score
estimatedCostUsd may be null
tokens may be missing for mock provider
```

Example:

```text
mock · mock-deterministic · 0ms · 85% confidence · v1
```

---

# EvaluationRegenerateForm

TASK-0021 should support full analysis regeneration using the existing `regenerateAnalysisDraft` flow.

Label it clearly:

```text
Regenerate analysis with guidance
```

Helper text:

```text
This reruns the evaluation pipeline and creates a new reviewable draft. It does not approve the intake.
```

Do not label this as:

```text
Regenerate this section
```

unless true section-level backend support exists.

Suggested props:

```ts
type EvaluationRegenerateFormProps = {
  disabled: boolean;
  reason?: string;
  defaultGuidance?: string;
  onSubmit: (guidance: string) => Promise<void>;
};
```

Validation:

```text
guidance min 10 chars
guidance max 4000 chars
```

Use existing backend validation too.

---

# Section-Specific Guidance Helper

Each section card may have a button:

```text
Use this section as guidance
```

Behavior:

```text
Opens the full EvaluationRegenerateForm
Prefills guidance with section-specific context
Calls existing full regeneration endpoint
```

Example prefilled guidance:

```text
Please improve the work_breakdown section. Make the subtasks more implementation-ready, include clearer acceptance criteria, and preserve the current project scope.
```

Important label:

```text
This reruns the full evaluation, not only this section.
```

This avoids misleading reviewers.

---

# ClarificationPanel Enhancements

TASK-0020 already added ClarificationPanel.

TASK-0021 should polish it.

Enhancements:

```text
show pending questions grouped by required/optional
show missing fields
show prior clarification answers after resubmit
disable submit until required answers are non-empty
show inline validation errors
show loading state while resubmitting
show success/error state
```

Do not change clarification workflow rules unless necessary.

Existing flow remains:

```text
clarification_required
→ user answers questions
→ POST :id/resubmit
→ state returns to submitted
→ generate analysis again
```

---

# Intake Detail Page Integration

Modify:

```text
apps/web/src/app/intakes/[id]/page.tsx
```

In zsh, quote this path:

```bash
git add 'apps/web/src/app/intakes/[id]/page.tsx'
```

Behavior:

```text
fetch intake record
fetch latest evaluation
render EvaluationPanel where the AI draft/review context lives
keep existing review buttons intact
keep existing draft accept/reject/revise flow intact
show clarification UI when intake state is clarification_required
```

Suggested tab order:

```text
Overview
AI Draft
Evaluation
Reviewed Package
Approvals
Distribution
Audit
Debug
```

The current UI structure may differ. Preserve existing navigation where possible.

---

# Loading and Error States

Evaluation panel should handle:

```text
loading evaluation
evaluation not found
evaluation fetch 403/404
evaluation belongs to older draft
no latest evaluation yet
evaluation exists but no latestAnalysisDraft
agentRuns missing
malformed/unknown section kind
```

Do not crash the detail page because one evaluation section is malformed.

Show a safe fallback.

---

# Review Flow Compatibility

The existing draft review controls must remain attached to the mapped legacy draft.

Keep:

```text
accept draft
reject draft
revise draft
regenerate draft/analysis
Gate 1 guard
Gate 2 guard
distribution preview
```

TASK-0021 must not move the acceptance action directly onto the `IntakeEvaluation`.

The human still accepts a draft/review packet, which creates `ReviewedProjectPackage`.

---

# Audit Trail

If the current audit UI exists, optionally improve display for new events:

```text
EVALUATION_GENERATED
CLARIFICATION_REQUIRED
EVALUATION_REGENERATED
```

Show useful metadata:

```text
evaluationId
evaluationVersion
quality score
question count
previousDraftId
newDraftId
```

Do not make audit UI work a blocker unless current rendering is unreadable.

---

# API Tests

Add tests for evaluation read routes.

Suggested file:

```text
tests/evaluation-api-read.test.mjs
```

Required cases:

```text
GET latest evaluation returns null when no evaluation exists
GET latest evaluation returns persisted evaluation
GET evaluation by ID returns sections and quality score
GET evaluation by ID rejects wrong intake/evaluation pairing
GET evaluations list returns newest first
unauthenticated request is rejected in google/auth mode if existing API tests cover auth
authorized dev_headers request works in dev mode
agent runs are included or fetchable
```

No live provider calls.

---

# Web / UI Tests

If the repo has component tests, add:

```text
EvaluationPanel renders empty state
EvaluationPanel renders quality score
EvaluationSectionCard renders synthesis
EvaluationSectionCard renders work breakdown
EvaluationSectionCard renders distribution dry-run notice
AgentProvenanceFooter displays confidence as percentage
ClarificationPanel disables submit for empty required answers
EvaluationRegenerateForm validates guidance length
```

If the repo does not have component tests, rely on:

```text
npm run web:build
manual browser validation
```

Do not add a heavy frontend test framework in this task unless one already exists.

---

# Demo / Manual Verification

Add optional script only if useful:

```text
scripts/demo-evaluation-api-read.mjs
```

Not required.

Manual browser demo is more valuable for this task.

Manual checklist:

```text
1. Open intake detail page with an evaluation-backed draft.
2. Confirm Evaluation tab appears.
3. Confirm quality score appears.
4. Confirm all available sections render without raw JSON as primary UI.
5. Confirm synthesis is readable.
6. Confirm work breakdown is readable.
7. Confirm provenance appears on section cards.
8. Confirm confidence displays as percent.
9. Confirm dryRunOnly distribution notice is clear.
10. Confirm accept/reject/revise draft still works.
11. Confirm generate/regenerate analysis still works.
12. Create thin intake.
13. Confirm clarification_required UI appears.
14. Submit answers.
15. Confirm intake returns to submitted.
16. Generate evaluation again.
```

---

# Files to Add

Likely files:

```text
apps/web/src/components/EvaluationPanel.tsx
apps/web/src/components/EvaluationSummaryCard.tsx
apps/web/src/components/EvaluationSectionCard.tsx
apps/web/src/components/EvaluationSectionTabs.tsx
apps/web/src/components/QualityScoreBadge.tsx
apps/web/src/components/QualityScoreBreakdown.tsx
apps/web/src/components/AgentProvenanceFooter.tsx
apps/web/src/components/EvaluationWarnings.tsx
apps/web/src/components/EvaluationEmptyState.tsx
apps/web/src/components/EvaluationRegenerateForm.tsx

apps/api/src/modules/intake/dto/evaluation.dto.ts

tests/evaluation-api-read.test.mjs

docs/ai/tasks/TASK-0021-web-evaluation-review-experience.md
```

Optional:

```text
apps/web/src/components/evaluation-section-renderers.tsx
apps/web/src/lib/evaluation-formatters.ts
```

---

# Files to Modify

Likely files:

```text
apps/api/src/modules/intake/intake.controller.ts
apps/web/src/lib/api-client.ts
apps/web/src/lib/types.ts
apps/web/src/app/intakes/[id]/page.tsx
apps/web/src/components/ClarificationPanel.tsx if currently separate
src/application/types.ts if DTO support needs source metadata
src/index.ts if export needed
package.json if tests/scripts added
README.md
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
docs/ai/requirements-trace.md
```

Do not modify:

```text
Prisma schema unless unavoidable
EvaluationOrchestrator behavior
approval gate rules
distribution execution behavior
```

---

# Acceptance Criteria

TASK-0021 is complete when:

```text
1. API can return latest evaluation for an intake.
2. API can return evaluation by ID.
3. API can list evaluations for an intake.
4. Evaluation routes require auth.
5. Evaluation DTOs do not expose raw Prisma rows.
6. Web client can fetch latest evaluation.
7. Web types include evaluation models.
8. Intake detail page renders EvaluationPanel.
9. EvaluationPanel handles no-evaluation state.
10. EvaluationPanel renders quality score.
11. EvaluationPanel renders readiness band.
12. EvaluationPanel renders section tabs/cards.
13. Synthesis section is readable.
14. Work breakdown section is readable.
15. Risk/security section is readable.
16. Distribution plan clearly says dry-run only.
17. Agent provenance is visible.
18. Confidence displays as percentage.
19. Mock token/cost absence does not break UI.
20. ClarificationPanel remains working.
21. Prior clarification answers are visible if available.
22. Regenerate analysis with guidance remains available where allowed.
23. UI does not claim true section-only regeneration unless backend supports it.
24. Existing accept/reject/revise flow still works.
25. Existing approval gates still work.
26. Existing distribution preview still works.
27. No workflow behavior changes.
28. No Prisma schema changes unless explicitly required.
29. No real multi-agent provider calls.
30. Existing 390 tests still pass.
31. New API tests pass.
32. Web build passes.
33. API build passes.
34. Prisma generate passes.
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

Server validation:

```bash
ssh -i ~/.ssh/oreochiserver oreo@100.75.210.83
cd /home/oreo/intake-os
docker compose -f docker-compose.server.yml --env-file .env.server up -d --build
bash deploy/healthcheck-server.sh
```

Browser validation through the configured access path:

```text
open intake detail
generate/evaluate
inspect Evaluation tab
accept draft
verify gates/distribution still behave
test clarification_required flow
```

---

# Expected Final Report

```text
TASK-0021 done.

Commit:
- <hash>

Files added:
- EvaluationPanel and child components
- evaluation DTOs
- evaluation API read tests
- task doc

Files modified:
- intake controller
- web api client
- web types
- intake detail page
- ClarificationPanel if enhanced
- docs/logs

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- existing demos: pass
- server health: pass if tested
- browser validation: pass if tested

Behavior:
- evaluation sections visible in UI
- quality score visible
- provenance visible
- clarification UI polished
- existing review/approval flow preserved
- no section-only regeneration claim
```

---

# Agent Execution Prompt

```text
You are working on Project Intake OS.

Implement TASK-0021: Web UI — Evaluation Review Experience.

Context:
- TASK-0020 is complete.
- EvaluationOrchestrator is now wired into the live intake workflow behind ANALYSIS_ENGINE=orchestrator.
- Successful evaluations persist as IntakeEvaluation + AgentRuns.
- Evaluations map to legacy IntakeAnalysisDraft for existing review flow.
- ClarificationPanel and POST :id/resubmit already exist.
- regenerateAnalysisDraft currently reruns the full orchestrator when injected.
- Current baseline is 390/390 tests passing.
- Do not change governance rules.

Goal:
Expose stored IntakeEvaluation data in the API and web UI so reviewers can inspect the 12-agent evaluation packet behind the mapped legacy draft.

Implement:
1. Read-only evaluation API routes:
   - GET /intakes/:id/evaluations
   - GET /intakes/:id/evaluations/latest
   - GET /intakes/:id/evaluations/:evaluationId
2. Evaluation DTOs.
3. Web API client methods.
4. Web evaluation types.
5. EvaluationPanel.
6. EvaluationSummaryCard.
7. QualityScoreBadge and QualityScoreBreakdown.
8. EvaluationSectionCard and section renderers.
9. AgentProvenanceFooter.
10. Evaluation empty/loading/error states.
11. ClarificationPanel polish.
12. Full analysis regeneration form using existing regenerateAnalysisDraft path.
13. Section-specific guidance helper only if clearly labeled as full regeneration.
14. API tests for evaluation read routes.
15. Docs/log updates.

Rules:
- Do not add true section-only regeneration unless a real backend route already exists.
- Do not claim a section-only regen happened when full orchestrator regen is used.
- Do not change approval gates.
- Do not auto-create ReviewedProjectPackage.
- Do not remove legacy draft review flow.
- Do not change Prisma schema unless unavoidable.
- Do not call real multi-agent LLM providers.
- Keep confidence stored as 0–1 and displayed as percent.
- Keep quality scores as 0–100.
- In zsh, quote apps/web/src/app/intakes/[id]/page.tsx when adding/committing.

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
- files added
- files modified
- verification results
- browser validation notes
- known limitations
- next recommended task
```
