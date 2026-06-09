# Project Intake OS — TASK-0006 Handoff

## Task Name

TASK-0006 — Analysis Review Lifecycle

## Current Project State

The repo already has the first AI seam implemented.

Verified current behavior:

```bash
npm run check
# 28/28 tests passing

npm run demo:analysis
# Generates a mock AI analysis draft and moves intake into intake_review

npm run demo:mvp
# Still reaches approved intake + dry-run provisioning plan
```

Current foundation includes:

* domain workflow state machine
* role/permission guards
* approval gates
* audit trail behavior
* dry-run provisioning plan
* mock AI analysis draft generator
* draft validation
* no-n8n architecture decision
* NestJS API source wrapper
* Prisma schema source
* in-memory test/demo store

Known constraint:

```bash
npm run api:build
```

may still fail in a clean unzip if dependencies are not installed, because Prisma CLI is missing from the local environment. The core/application test suite is currently the trusted verification path.

---

# Product Goal

The system can now generate an AI analysis draft, but there is no first-class review lifecycle yet.

TASK-0006 should make the distinction explicit:

```text
AI-generated draft
≠
human-reviewed project package
```

AI should continue to produce suggestions only. A human reviewer must accept, reject, or revise the draft before it becomes the project package used for approval/distribution.

---

# Non-Negotiable Product Rules

1. AI output must remain draft-only.
2. AI output must never approve an intake.
3. AI output must never trigger provisioning.
4. AI output must never create Monday/GitHub resources.
5. Generated drafts should be preserved immutably.
6. Human-reviewed output should be stored separately from the generated draft.
7. All review actions must write audit events.
8. Existing MVP/demo behavior must continue to pass.
9. Do not introduce n8n.
10. Do not implement live OpenAI/Claude/Monday/GitHub integrations in this task.

---

# Target Workflow

Current flow:

```text
create intake
→ submit intake
→ generate mock AI analysis draft
→ intake_review
```

TASK-0006 adds:

```text
intake_review
→ accept analysis draft
or
→ reject analysis draft
or
→ revise analysis draft into reviewed package
```

After review, the intake remains governed by the existing approval gates.

Target full flow after this task:

```text
create intake
→ submit intake
→ generate mock AI analysis draft
→ human reviews draft
→ reviewed package exists
→ Gate 1 approval
→ Gate 2 approval
→ distribution preview/provisioning plan
```

---

# Implementation Scope

## Add Review Actions

Implement application-level methods:

```ts
acceptAnalysisDraft(params)
rejectAnalysisDraft(params)
reviseAnalysisDraft(params)
```

Recommended method signatures may look like:

```ts
acceptAnalysisDraft(input: {
  intakeId: string;
  draftId: string;
  actor: Actor;
  reviewerNotes?: string;
}): Promise<ProjectIntakeRecord>;

rejectAnalysisDraft(input: {
  intakeId: string;
  draftId: string;
  actor: Actor;
  reason: string;
}): Promise<ProjectIntakeRecord>;

reviseAnalysisDraft(input: {
  intakeId: string;
  draftId: string;
  actor: Actor;
  reviewedPackage: ReviewedProjectPackageInput;
  reviewerNotes?: string;
}): Promise<ProjectIntakeRecord>;
```

Exact names can differ, but behavior must remain clear.

---

# Data Model Direction

## Keep Generated Draft Immutable

Do not mutate the original analysis draft content when a human edits/reviews it.

Instead, add a separate reviewed package field.

Suggested additions to `ProjectIntakeRecord`:

```ts
analysisDrafts?: IntakeAnalysisDraft[];
latestAnalysisDraft?: IntakeAnalysisDraft;
reviewedProjectPackage?: ReviewedProjectPackage;
```

Suggested new type:

```ts
type ReviewedProjectPackage = {
  id: string;
  sourceDraftId: string;
  intakeId: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewDecision: "accepted" | "revised";
  reviewerNotes?: string;
  projectType: ProjectType;
  complexity: "low" | "medium" | "high";
  estimatedStoryPoints: number;
  recommendedTechStack: string[];
  infrastructureRequirements: string[];
  brief: {
    problem: string;
    solution: string;
    scope: string[];
    outOfScope: string[];
  };
  subtasks: Array<{
    title: string;
    description: string;
    storyPoints: number;
  }>;
  assignmentRecommendation?: {
    recommendedDeveloperId?: string;
    recommendedDeveloperName?: string;
    reason: string;
    confidence: number;
  };
  missingInformation: string[];
};
```

If the draft is accepted as-is, copy the draft’s reviewed fields into the reviewed package.

If the draft is revised, store the human-edited package there.

---

# Review Status Rules

The draft already has a review status concept. Use or extend it.

Recommended statuses:

```ts
"pending_review"
"accepted"
"rejected"
"superseded"
```

Rules:

* A newly generated draft starts as `pending_review`.
* Accepting a draft marks it `accepted`.
* Rejecting a draft marks it `rejected`.
* Revising a draft marks the original draft `superseded` and creates a reviewed package.
* Only one draft can be the accepted source for the current reviewed package.
* Rejected drafts do not create reviewed packages.
* Superseded drafts remain visible in history.

---

# Permission Rules

Only appropriate reviewers should be able to review AI drafts.

Minimum allowed roles:

```text
intake_owner
devops_lead
admin
```

Recommended behavior:

* `request_creator` cannot accept/reject/revise analysis drafts.
* `developer` cannot accept/reject/revise analysis drafts unless explicitly allowed later.
* `intake_owner` can review during `intake_review`.
* `devops_lead` can review if needed, but should not bypass Gate 1/Gate 2 approval rules.
* `admin` can review.

Do not let review actions replace approval actions.

---

# Status Transition Rules

Do not overcomplicate workflow states in this task.

Recommended approach:

* Keep intake status as `intake_review` after draft review.
* Do not add a new request status unless needed.
* Use `reviewedProjectPackage` as the signal that review has happened.
* Gate 1 approval can later require `reviewedProjectPackage` if we choose.

Optional stricter rule for this task:

```text
Gate 1 approval requires reviewedProjectPackage to exist if an analysis draft exists.
```

If implemented, add tests proving this behavior.

---

# Audit Events

Add audit events for:

```text
ANALYSIS_DRAFT_ACCEPTED
ANALYSIS_DRAFT_REJECTED
ANALYSIS_DRAFT_REVISED
REVIEWED_PROJECT_PACKAGE_CREATED
```

Each audit event should include:

* intake ID
* actor ID
* actor role
* draft ID
* decision
* optional reviewer notes or reason
* timestamp

Do not log sensitive raw inquiry text in audit metadata.

---

# API Layer

Add NestJS controller endpoints.

Recommended routes:

```http
POST /intakes/:id/analysis-drafts/:draftId/accept
POST /intakes/:id/analysis-drafts/:draftId/reject
POST /intakes/:id/analysis-drafts/:draftId/revise
```

DTOs:

```text
AcceptAnalysisDraftDto
RejectAnalysisDraftDto
ReviseAnalysisDraftDto
```

Example payloads:

```json
{
  "reviewerNotes": "Looks accurate for MVP planning."
}
```

```json
{
  "reason": "Missing client compliance requirements and data source details."
}
```

```json
{
  "reviewerNotes": "Adjusted scope and story points.",
  "reviewedPackage": {
    "projectType": "internal_tool",
    "complexity": "medium",
    "estimatedStoryPoints": 13,
    "recommendedTechStack": ["Next.js", "NestJS", "Postgres"],
    "infrastructureRequirements": ["GitHub repo", "Postgres database"],
    "brief": {
      "problem": "...",
      "solution": "...",
      "scope": ["..."],
      "outOfScope": ["..."]
    },
    "subtasks": [
      {
        "title": "Set up project skeleton",
        "description": "Create baseline app structure.",
        "storyPoints": 2
      }
    ],
    "missingInformation": ["Final deadline"]
  }
}
```

Actor headers remain the current auth shim:

```text
x-actor-id
x-actor-role
x-actor-name
```

Do not implement Google SSO in this task.

---

# Persistence

Update both persistence paths if needed:

## In-memory store

Required for tests and demos.

## Prisma store

Update source code and Prisma schema if the field shape requires it.

Given the current hybrid JSON strategy, the simplest path is probably:

* store `reviewedProjectPackage` in the record snapshot JSON
* optionally add a top-level JSON column later if needed

Do not over-normalize yet unless absolutely necessary.

---

# Tests Required

Add a new test file:

```text
tests/analysis-review-lifecycle.test.mjs
```

Minimum tests:

## 1. Accept draft

Prove that:

```text
submitted intake
→ mock analysis draft generated
→ intake_owner accepts draft
→ reviewedProjectPackage exists
→ draft status is accepted
→ audit event exists
→ no approval is created
→ no provisioning plan is created
```

## 2. Reject draft

Prove that:

```text
draft can be rejected with reason
→ no reviewedProjectPackage exists
→ draft status is rejected
→ audit event exists
→ intake remains in intake_review
```

## 3. Revise draft

Prove that:

```text
reviewer submits edited package
→ original draft becomes superseded
→ reviewedProjectPackage exists
→ reviewed package contains human-edited values
→ generated draft remains preserved
```

## 4. Unauthorized reviewer blocked

Prove that:

```text
request_creator cannot accept/reject/revise draft
developer cannot accept/reject/revise draft
```

## 5. AI cannot bypass governance

Keep or extend the existing guard:

```text
analysis review does not approve intake
analysis review does not create provisioning plan
analysis review does not mark ready for provisioning
```

## 6. Existing flows still pass

After implementation:

```bash
npm run check
npm run demo:analysis
npm run demo:mvp
```

must still pass.

---

# Demo Script

Add or update:

```text
scripts/demo-analysis-review.mjs
```

Add package script:

```json
{
  "scripts": {
    "demo:analysis-review": "node scripts/demo-analysis-review.mjs"
  }
}
```

Demo flow:

```text
create intake
submit intake
generate mock analysis draft
accept or revise draft
print reviewed package summary
print audit trail
verify no approval/provisioning happened
```

Expected demo output should clearly show:

```text
AI draft generated
Human review completed
Reviewed package created
Approval status unchanged
Provisioning plan not created
```

---

# Documentation Updates

Update:

```text
docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

If there is no task file yet, create it.

Also update product docs if needed:

```text
docs/product/intake-analysis-schema.md
```

Add a short note:

```text
AI analysis output is not the final project package. It must be accepted or revised by a human reviewer before approval/distribution.
```

---

# Suggested File Touch List

Likely files to modify:

```text
src/application/intake-analysis.ts
src/application/intake-workflow-service.ts
src/application/types.ts
src/application/in-memory-store.ts
src/domain/permissions.ts
src/domain/types.ts
apps/api/src/modules/intake/intake.controller.ts
apps/api/src/modules/intake/dto/*
apps/api/prisma/schema.prisma
apps/api/src/persistence/prisma-project-intake-store.ts
tests/analysis-review-lifecycle.test.mjs
scripts/demo-analysis-review.mjs
package.json
docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Do not touch live integration code except where necessary for type compatibility.

---

# Implementation Order

## Step 1 — Read project context

Read:

```text
README.md
AGENTS.md
CLAUDE.md
docs/ai/MEMORY_INDEX.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/tasks/TASK-0005-rnd-intake-analysis-module.md
docs/ai/decisions/ADR-0003-os-owned-orchestration-no-n8n.md
src/application/intake-analysis.ts
src/application/intake-workflow-service.ts
src/domain/workflow.ts
src/domain/permissions.ts
tests/intake-analysis-draft.test.mjs
```

## Step 2 — Run baseline

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:mvp
```

Record results in build log.

## Step 3 — Add types

Add or update:

```text
ReviewedProjectPackage
AnalysisDraftReviewDecision
AnalysisDraftReviewStatus
```

Keep generated draft content immutable.

## Step 4 — Add workflow service methods

Implement:

```text
acceptAnalysisDraft
rejectAnalysisDraft
reviseAnalysisDraft
```

Each must:

```text
load intake
validate actor permission
validate intake status
validate draft exists
validate draft review status
update draft review status
create reviewed package if accepted/revised
write audit event
save intake
return updated intake
```

## Step 5 — Add tests

Write tests before or immediately after implementation.

Use the existing in-memory store pattern.

## Step 6 — Add API endpoints

Expose the three review actions in the NestJS controller.

Add DTOs.

Keep actor header pattern.

## Step 7 — Add demo

Create `demo:analysis-review`.

Make demo readable and deterministic.

## Step 8 — Update docs/logs

Update task file and memory logs.

## Step 9 — Run verification

Required:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:mvp
```

Optional if dependencies are installed:

```bash
npm run api:build
```

If `api:build` fails only because Prisma CLI is missing, document it as an environment/dependency issue, not a task failure.

## Step 10 — Package result

Create a new zip:

```text
project-intake-os-task-0006-analysis-review-build.zip
```

---

# Acceptance Criteria

TASK-0006 is done when:

```text
1. AI analysis drafts can be accepted.
2. AI analysis drafts can be rejected.
3. AI analysis drafts can be revised into a reviewed project package.
4. Generated draft history remains preserved.
5. Reviewed project package is distinct from AI draft.
6. Unauthorized roles cannot review drafts.
7. Review actions write audit events.
8. Review actions do not create approvals.
9. Review actions do not create provisioning plans.
10. Existing MVP/demo behavior still passes.
11. New demo:analysis-review passes.
12. Docs and build logs are updated.
```

---

# Agent Execution Prompt

Use this prompt when handing to Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0006: Analysis Review Lifecycle.

Context:
- The current repo already supports mock AI analysis draft generation.
- AI output must remain draft-only.
- Human review must create or decline a reviewed project package.
- Review must not approve an intake or trigger provisioning.
- n8n is intentionally excluded from the architecture.

Start by reading the project docs, AGENTS/CLAUDE instructions, current workflow service, analysis draft module, permissions, and existing tests.

Implement:
1. Accept analysis draft.
2. Reject analysis draft.
3. Revise analysis draft into a reviewed project package.
4. Audit events for all review actions.
5. API endpoints for accept/reject/revise.
6. In-memory and Prisma-compatible persistence updates as needed.
7. Tests for authorized review, unauthorized review, accepted draft, rejected draft, revised draft, and governance guardrails.
8. Demo script for the review flow.
9. Build log and memory index updates.

Do not implement:
- live AI provider integration
- Google SSO
- n8n
- Monday live creation
- GitHub live provisioning
- frontend UI
- AWS deployment

Verification:
Run:
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:mvp

If npm run api:build fails because dependencies or Prisma CLI are missing, document it honestly but do not treat it as proof the implementation is broken.

Return:
- files changed
- behavior added
- tests added
- verification results
- known remaining issues
```

---

# Human Dev Notes

This task is intentionally not glamorous, but it is very important.

It creates the product boundary between:

```text
AI suggestion
```

and

```text
human-reviewed project package
```

Without this, the app risks becoming “AI says thing → system acts,” which is not the OS design.

The correct pattern is:

```text
AI drafts
Human reviews
Workflow approves
System distributes
```

Preserve that pattern.
