# TASK-0007 — Require Reviewed Package Before Gate 1 Approval

## Status

Planned

## Purpose

TASK-0006 added the human review lifecycle for AI analysis drafts. The system can now accept, reject, or revise an AI-generated analysis draft into a `ReviewedProjectPackage`.

However, the reviewed package is not yet structurally required before Gate 1 approval.

TASK-0007 closes that governance gap.

The rule is:

```text
If an intake has generated AI analysis drafts, Gate 1 approval must require a reviewedProjectPackage.
```

This ensures the product boundary remains enforced:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ System distributes
```

AI output must never become approval input until a human has accepted or revised it.

---

# Current State

The repo currently supports:

```text
create intake
→ submit intake
→ generate mock AI analysis draft
→ human accepts/rejects/revises draft
→ reviewedProjectPackage may be created
→ approval gates
→ dry-run provisioning plan
```

Current verification:

```bash
npm run check
# 38/38 passing

npm run demo:analysis
# passing

npm run demo:analysis-review
# passing

npm run demo:mvp
# passing
```

TASK-0006 added:

* `ReviewedProjectPackage`
* `review_analysis_draft` permission
* `acceptAnalysisDraft`
* `rejectAnalysisDraft`
* `reviseAnalysisDraft`
* analysis review audit events
* API endpoints for accept/reject/revise
* review lifecycle tests
* review demo script

---

# Problem

After AI analysis draft generation, the intake may enter `intake_review`.

At that point, Gate 1 approval should not proceed unless the AI draft has been reviewed.

Without this guard, the system could allow:

```text
AI draft generated
→ no human-reviewed package
→ Gate 1 approval
```

That weakens the governance model.

---

# Product Rule

Gate 1 approval must be blocked when:

```text
approval gate is Gate 1 / intake approval
AND
the intake has one or more analysis drafts
AND
reviewedProjectPackage does not exist
```

Gate 1 approval may proceed when:

```text
the intake has no AI analysis drafts
```

or:

```text
the intake has AI analysis drafts
AND
reviewedProjectPackage exists
```

This preserves the no-AI/manual flow while enforcing review for AI-assisted intakes.

---

# Non-Negotiable Rules

1. Do not let AI drafts bypass human review.
2. Do not mutate generated AI draft content.
3. Do not require `reviewedProjectPackage` for intakes that have no AI analysis drafts.
4. Do not change Gate 2 behavior unless required for compatibility.
5. Do not implement live AI provider calls.
6. Do not implement Monday/GitHub live provisioning.
7. Do not introduce n8n.
8. Existing demos must continue to pass.
9. Existing tests must continue to pass.
10. Add tests for the new approval guard.

---

# Implementation Scope

## Primary Change

Update Gate 1 approval handling inside the workflow service.

Likely location:

```text
src/application/intake-workflow-service.ts
```

Find the method responsible for approval, likely:

```ts
recordApproval(...)
```

Add a guard before approving Gate 1.

Pseudo-logic:

```ts
const isGateOneApproval = input.gate === "intake";
const hasAnalysisDrafts = Boolean(intake.analysisDrafts?.length);
const hasReviewedPackage = Boolean(intake.reviewedProjectPackage);

if (isGateOneApproval && hasAnalysisDrafts && !hasReviewedPackage) {
  throw new Error(
    "Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package."
  );
}
```

Use the project’s actual gate enum/string values.

Do not make all approvals require `reviewedProjectPackage`.

Only require it when AI analysis drafts exist.

---

# Expected Behavior

## Case 1 — AI draft exists, no reviewed package

Flow:

```text
create intake
submit intake
generate mock AI analysis draft
attempt Gate 1 approval
```

Expected result:

```text
approval fails
status remains intake_review
no approval record is created
no provisioning plan is created
audit trail does not record approval success
```

Expected error message should be clear:

```text
Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package.
```

Exact wording can differ, but it must clearly explain the missing reviewed package.

---

## Case 2 — AI draft accepted

Flow:

```text
create intake
submit intake
generate mock AI analysis draft
accept analysis draft
attempt Gate 1 approval
```

Expected result:

```text
Gate 1 approval succeeds
intake moves to devops_review
reviewedProjectPackage exists
approval record is created
audit event is written
```

---

## Case 3 — AI draft revised

Flow:

```text
create intake
submit intake
generate mock AI analysis draft
revise draft into reviewed package
attempt Gate 1 approval
```

Expected result:

```text
Gate 1 approval succeeds
intake moves to devops_review
reviewedProjectPackage exists
reviewed package contains human-edited values
approval record is created
audit event is written
```

---

## Case 4 — No-AI/manual flow

Flow:

```text
create intake
submit intake
complete discovery or existing MVP path
attempt Gate 1 approval
```

Expected result:

```text
Gate 1 approval still succeeds
reviewedProjectPackage is not required
demo:mvp still passes
```

This is important. Do not break the existing no-AI workflow.

---

## Case 5 — Gate 2 unchanged

Flow:

```text
Gate 1 already approved
Gate 2 approval attempted
```

Expected result:

```text
Gate 2 behavior remains unchanged
existing approval tests continue to pass
```

---

# Tests Required

Add or update tests.

Suggested test file:

```text
tests/approval-reviewed-package-guard.test.mjs
```

Minimum test cases:

## Test 1 — blocks Gate 1 approval when AI draft is unreviewed

Assert:

```text
mock analysis draft exists
reviewedProjectPackage is missing
Gate 1 approval throws
intake remains intake_review
no approval record is created
no provisioning plan exists
```

## Test 2 — allows Gate 1 approval after accepting draft

Assert:

```text
draft accepted
reviewedProjectPackage exists
Gate 1 approval succeeds
status becomes devops_review
```

## Test 3 — allows Gate 1 approval after revising draft

Assert:

```text
draft superseded/revised
reviewedProjectPackage exists
Gate 1 approval succeeds
status becomes devops_review
```

## Test 4 — preserves no-AI approval path

Assert:

```text
no analysis drafts exist
reviewedProjectPackage missing
Gate 1 approval still succeeds through existing MVP path
```

## Test 5 — Gate 2 behavior remains unchanged

Assert:

```text
Gate 2 still requires Gate 1 completion
Gate 2 approval works after Gate 1
```

---

# Demo Update

Update an existing demo or add a new one.

Recommended new script:

```text
scripts/demo-reviewed-package-approval-guard.mjs
```

Recommended package script:

```json
{
  "scripts": {
    "demo:review-guard": "node scripts/demo-reviewed-package-approval-guard.mjs"
  }
}
```

Demo flow:

```text
1. Create intake.
2. Submit intake.
3. Generate mock AI analysis draft.
4. Try Gate 1 approval before review.
5. Show approval is blocked.
6. Accept or revise draft.
7. Try Gate 1 approval again.
8. Show approval succeeds.
9. Print final status and audit trail.
```

Expected console output should make the rule obvious:

```text
AI draft generated.
Gate 1 approval blocked before human review.
Draft accepted by reviewer.
Gate 1 approval succeeded after reviewed package was created.
```

---

# API Impact

No new API endpoints are required.

Existing approval endpoint should automatically enforce this rule because it calls the workflow service.

Likely endpoint:

```http
POST /intakes/:id/approvals
```

Expected API behavior:

When Gate 1 approval is attempted before AI draft review:

```http
400 Bad Request
```

or the project’s current equivalent error behavior.

Response should communicate:

```text
Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package.
```

No DTO changes are expected unless the approval route needs clearer error mapping.

---

# Persistence Impact

No schema migration should be required if `reviewedProjectPackage` already exists in the record snapshot / application record from TASK-0006.

Confirm both stores preserve this field:

```text
src/application/in-memory-store.ts
apps/api/src/persistence/prisma-project-intake-store.ts
```

If the Prisma adapter serializes/deserializes the full record snapshot, make sure `reviewedProjectPackage` survives round trips.

Do not over-normalize the reviewed package into separate relational tables in this task.

---

# Audit Impact

This task does not need a new audit event if failed approval attempts are not currently audited.

Required:

```text
successful Gate 1 approval still writes the existing approval audit event
blocked approval must not write a false approval success event
```

Optional:

```text
write APPROVAL_BLOCKED_MISSING_REVIEWED_PACKAGE
```

If adding this event, add tests and keep metadata minimal:

```text
intakeId
actorId
gate
reasonCode: missing_reviewed_package
```

Do not log raw inquiry text.

---

# Suggested File Touch List

Likely files:

```text
src/application/intake-workflow-service.ts
tests/approval-reviewed-package-guard.test.mjs
scripts/demo-reviewed-package-approval-guard.mjs
package.json
docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Possible files, only if needed:

```text
src/application/types.ts
src/domain/types.ts
apps/api/src/modules/intake/intake.controller.ts
apps/api/src/persistence/prisma-project-intake-store.ts
```

---

# Implementation Order

## Step 1 — Read Context

Read:

```text
docs/ai/MEMORY_INDEX.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md
src/application/intake-workflow-service.ts
src/application/intake-analysis.ts
src/application/types.ts
src/domain/permissions.ts
tests/analysis-review-lifecycle.test.mjs
```

## Step 2 — Run Baseline

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:mvp
```

Record baseline results in the build log.

## Step 3 — Add Approval Guard

In the approval workflow path, block Gate 1 approval when:

```text
analysisDrafts.length > 0
AND
reviewedProjectPackage is missing
```

Use a clear domain/application error.

## Step 4 — Add Tests

Add the test cases listed above.

Run:

```bash
npm run check
```

## Step 5 — Add Demo

Add:

```bash
npm run demo:review-guard
```

The demo should show the blocked-before-review and allowed-after-review behavior.

## Step 6 — Update Docs and Logs

Update:

```text
docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

## Step 7 — Final Verification

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:mvp
```

Optional if dependencies are installed:

```bash
npm run api:build
```

If `api:build` fails because Prisma CLI or dependencies are missing, document it honestly as an environment/dependency issue.

---

# Acceptance Criteria

TASK-0007 is complete when:

```text
1. Gate 1 approval is blocked if AI analysis drafts exist but reviewedProjectPackage is missing.
2. Gate 1 approval succeeds after accepting an analysis draft.
3. Gate 1 approval succeeds after revising an analysis draft.
4. Gate 1 approval still succeeds for no-AI/manual flow.
5. Gate 2 behavior remains unchanged.
6. Blocked approval does not create an approval record.
7. Blocked approval does not create a provisioning plan.
8. Existing TASK-0006 review behavior still passes.
9. Existing MVP demo still passes.
10. New tests pass.
11. Review guard demo passes.
12. Docs and build logs are updated.
```

---

# Agent Execution Prompt

Use this prompt for Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0007: Require Reviewed Package Before Gate 1 Approval.

Context:
- TASK-0006 added AI analysis review lifecycle.
- AI analysis drafts can now be accepted, rejected, or revised.
- A ReviewedProjectPackage is distinct from the generated AI draft.
- The remaining governance gap is that Gate 1 approval must require a ReviewedProjectPackage when AI drafts exist.
- No-AI/manual approval flows must continue to work.
- n8n is intentionally excluded from the architecture.

Implement:
1. Add a Gate 1 approval guard in the workflow service.
2. If analysisDrafts exist and reviewedProjectPackage is missing, block Gate 1 approval.
3. Preserve no-AI/manual approval behavior.
4. Preserve Gate 2 behavior.
5. Add tests for blocked approval, accepted draft approval, revised draft approval, no-AI approval, and unchanged Gate 2 behavior.
6. Add a demo script showing approval blocked before review and allowed after review.
7. Update task docs and AI build logs.

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
npm run demo:review-guard
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

This is a small task, but it is high leverage.

TASK-0006 made human review possible.

TASK-0007 makes human review mandatory for AI-assisted approval.

That means the OS now enforces the intended governance model:

```text
AI drafts.
Human reviews.
Workflow approves.
System distributes.
```

Do not broaden this task into frontend, live integrations, model provider work, or provisioning changes.
