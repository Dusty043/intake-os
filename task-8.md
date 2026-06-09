# TASK-0008 — Generate Distribution Preview from Reviewed Project Package

## Status

Planned

## Purpose

TASK-0006 introduced the `ReviewedProjectPackage` as a distinct human-reviewed artifact.

TASK-0007 enforced that AI-assisted intakes cannot pass Gate 1 approval unless an AI analysis draft has been accepted or revised into a `ReviewedProjectPackage`.

TASK-0008 makes the reviewed package authoritative for downstream distribution.

The product rule is:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ Distribution preview uses the reviewed package
→ System distributes
```

Once a human-reviewed package exists, Monday/GitHub provisioning previews must use that package as the trusted source of truth.

---

# Current State

The repo currently supports:

```text
create intake
→ submit intake
→ generate mock AI analysis draft
→ accept/reject/revise draft
→ reviewedProjectPackage created
→ Gate 1 approval
→ Gate 2 approval
→ dry-run provisioning plan
```

Current verification:

```bash
npm run check
# 44/44 passing

npm run demo:analysis
# passing

npm run demo:analysis-review
# passing

npm run demo:review-guard
# passing

npm run demo:mvp
# passing
```

TASK-0007 added a guard preventing Gate 1 approval when an AI analysis draft exists but no `reviewedProjectPackage` exists.

---

# Problem

The approval workflow now correctly enforces human review for AI-assisted intakes.

However, the downstream dry-run provisioning/distribution preview may still rely on older intake/discovery fields instead of the final reviewed project package.

That creates a possible mismatch:

```text
AI draft says one thing
→ human reviewer revises it
→ approval succeeds
→ distribution preview still uses stale or raw intake data
```

TASK-0008 closes that gap.

---

# Product Rule

When generating a provisioning/distribution preview:

```text
If reviewedProjectPackage exists:
  use reviewedProjectPackage as the authoritative source

Else if no AI analysis drafts exist:
  preserve the existing no-AI/manual flow

Else if AI analysis drafts exist but reviewedProjectPackage is missing:
  block distribution preview
```

Distribution preview must never use an unreviewed AI draft as the source of truth.

---

# Non-Negotiable Rules

1. Do not use raw AI draft output for downstream preview if a reviewed package exists.
2. Do not mutate generated AI draft content.
3. Do not break the no-AI/manual MVP flow.
4. Do not implement live Monday API writes.
5. Do not implement live GitHub API writes.
6. Do not implement real AI provider calls.
7. Do not introduce n8n.
8. Do not build frontend UI in this task.
9. Existing demos must continue to pass.
10. New behavior must be covered by tests.

---

# Implementation Scope

## Primary Change

Update dry-run provisioning/distribution preview generation so it can resolve its source payload from the intake record.

Likely files:

```text
src/application/provisioning-plan.ts
src/application/intake-workflow-service.ts
src/application/types.ts
```

The provisioning plan generator should prefer:

```text
reviewedProjectPackage
```

when available.

The generator should preserve the older no-AI/manual path when no AI analysis drafts exist.

---

# Source Resolution Rules

Add a source-resolution step before provisioning plan generation.

Recommended logic:

```ts
function resolveDistributionSource(intake: ProjectIntakeRecord): DistributionSource {
  const hasReviewedPackage = Boolean(intake.reviewedProjectPackage);
  const hasAnalysisDrafts = Boolean(intake.analysisDrafts?.length);

  if (hasReviewedPackage) {
    return {
      type: "reviewed_project_package",
      sourceId: intake.reviewedProjectPackage.id,
      package: intake.reviewedProjectPackage,
    };
  }

  if (!hasAnalysisDrafts) {
    return {
      type: "manual_discovery",
      sourceId: intake.discovery?.id ?? intake.id,
      intake,
    };
  }

  throw new Error(
    "Cannot generate distribution preview for an AI-assisted intake until an analysis draft has been accepted or revised into a reviewed project package."
  );
}
```

Exact implementation can differ, but behavior must match.

---

# Suggested Types

Add or update types in:

```text
src/application/types.ts
```

Recommended type:

```ts
export type DistributionSourceType =
  | "reviewed_project_package"
  | "manual_discovery"
  | "legacy_intake_record";
```

Recommended provisioning metadata:

```ts
export type ProvisioningPlanSource = {
  type: DistributionSourceType;
  sourceId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sourceVersion?: string;
};
```

Add source metadata to the provisioning plan:

```ts
export type ProvisioningPlan = {
  id: string;
  intakeId: string;
  status: string;
  source: ProvisioningPlanSource;
  actions: ProvisioningPlanAction[];
  createdAt: string;
};
```

Adapt names to the existing project types if they already differ.

---

# Expected Behavior

## Case 1 — Reviewed package exists

Flow:

```text
create intake
submit intake
generate mock AI analysis draft
revise draft into reviewed package
Gate 1 approval
Gate 2 approval
generate provisioning plan
```

Expected result:

```text
provisioning plan is generated
plan source is reviewed_project_package
plan sourceId is reviewedProjectPackage.id
plan output uses reviewed package fields
```

---

## Case 2 — Human revision overrides AI draft

Flow:

```text
AI draft estimates 13 SP
human reviewer revises package to 8 SP
Gate 1 approval
Gate 2 approval
generate provisioning plan
```

Expected result:

```text
distribution preview uses 8 SP
raw AI estimate is ignored
reviewed package values are authoritative
```

This is the most important behavioral test.

---

## Case 3 — Accepted draft becomes reviewed package

Flow:

```text
generate mock AI analysis draft
accept draft as-is
Gate 1 approval
Gate 2 approval
generate provisioning plan
```

Expected result:

```text
distribution preview uses reviewedProjectPackage
source is reviewed_project_package
sourceId points to reviewedProjectPackage.id
```

Even if the reviewed package mirrors the AI draft, the source must still be the reviewed artifact.

---

## Case 4 — AI draft exists but no reviewed package

Flow:

```text
generate mock AI analysis draft
attempt to generate provisioning plan
```

Expected result:

```text
provisioning plan generation fails
no provisioning plan is created
error explains that reviewed package is required
```

Note:

This may already be indirectly blocked by approval guards depending on current workflow state. Still, the provisioning preview layer should defend itself.

---

## Case 5 — No-AI/manual flow

Flow:

```text
create intake
submit intake
complete discovery or existing MVP path
Gate 1 approval
Gate 2 approval
generate provisioning plan
```

Expected result:

```text
existing demo:mvp still passes
reviewedProjectPackage is not required
plan source is manual_discovery or legacy_intake_record
```

Do not break the no-AI path.

---

# Provisioning Plan Content Expectations

When using `reviewedProjectPackage`, generated preview actions should derive from reviewed fields.

Use:

```text
reviewedProjectPackage.projectType
reviewedProjectPackage.estimatedStoryPoints
reviewedProjectPackage.recommendedTechStack
reviewedProjectPackage.infrastructureRequirements
reviewedProjectPackage.brief
reviewedProjectPackage.subtasks
reviewedProjectPackage.assignmentRecommendation
```

Do not derive action content from:

```text
latestAnalysisDraft
raw AI draft
unreviewed analysisDrafts
raw inquiry text
```

unless explicitly needed as fallback for no-AI/manual flows.

---

# Recommended Preview Metadata

Every generated dry-run plan should make the source visible.

Example output shape:

```json
{
  "id": "plan_123",
  "intakeId": "intake_123",
  "status": "draft",
  "source": {
    "type": "reviewed_project_package",
    "sourceId": "reviewed_pkg_123",
    "reviewedBy": "user_intake_owner",
    "reviewedAt": "2026-06-10T00:00:00.000Z"
  },
  "actions": []
}
```

This becomes important later when live Monday/GitHub provisioning exists.

The system should be able to answer:

```text
What reviewed artifact caused this downstream output?
```

---

# API Impact

No new endpoint is required unless the current API exposes a separate distribution preview route.

Existing provisioning preview endpoint should automatically use the new source-resolution behavior.

Likely endpoint:

```http
POST /intakes/:id/provisioning-plan
```

Expected API behavior:

If `reviewedProjectPackage` exists:

```text
200 OK
provisioning plan generated from reviewed package
```

If AI drafts exist but no reviewed package exists:

```text
400 Bad Request
clear error explaining reviewed package is required
```

If no AI drafts exist:

```text
existing behavior preserved
```

---

# Persistence Impact

Confirm the provisioning plan source metadata is persisted.

Update both:

```text
src/application/in-memory-store.ts
apps/api/src/persistence/prisma-project-intake-store.ts
```

if needed.

If the Prisma adapter stores a full record snapshot, ensure the new plan source metadata survives round trips.

Avoid unnecessary schema over-normalization in this task.

A small JSON/source field is acceptable if that matches the existing persistence approach.

---

# Audit Impact

When a provisioning plan is generated, the audit event metadata should include the source type.

Existing event can be extended:

```text
PROVISIONING_PLAN_GENERATED
```

Recommended metadata:

```json
{
  "sourceType": "reviewed_project_package",
  "sourceId": "reviewed_pkg_123"
}
```

For no-AI/manual flow:

```json
{
  "sourceType": "manual_discovery",
  "sourceId": "discovery_123"
}
```

Do not log raw inquiry text in audit metadata.

Optional blocked event:

```text
PROVISIONING_PLAN_BLOCKED_MISSING_REVIEWED_PACKAGE
```

This is optional unless the project already logs blocked actions.

---

# Tests Required

Add test file:

```text
tests/distribution-preview-source.test.mjs
```

Minimum tests:

## Test 1 — Uses reviewed package after accepted draft

Assert:

```text
analysis draft accepted
reviewedProjectPackage exists
provisioning plan generated
plan source type is reviewed_project_package
plan source ID equals reviewedProjectPackage.id
```

## Test 2 — Uses revised package values over AI draft values

Assert:

```text
AI draft has original values
human revision changes story points and/or subtasks
provisioning plan uses revised values
raw AI draft values are not used
```

Recommended concrete proof:

```text
AI draft estimatedStoryPoints = 13
reviewedProjectPackage estimatedStoryPoints = 8
provisioning preview references 8
```

## Test 3 — Blocks preview for unreviewed AI draft

Assert:

```text
AI analysis draft exists
reviewedProjectPackage missing
generateProvisioningPlan throws
no provisioning plan saved
```

## Test 4 — Preserves no-AI/manual path

Assert:

```text
no analysis drafts exist
reviewedProjectPackage missing
existing MVP provisioning plan generation still succeeds
source type is manual_discovery or legacy_intake_record
```

## Test 5 — Audit records source type

Assert:

```text
audit event for provisioning plan generation includes sourceType and sourceId
```

---

# Demo Update

Add a new demo:

```text
scripts/demo-reviewed-package-distribution-preview.mjs
```

Add package script:

```json
{
  "scripts": {
    "demo:reviewed-distribution": "node scripts/demo-reviewed-package-distribution-preview.mjs"
  }
}
```

Demo flow:

```text
1. Create intake.
2. Submit intake.
3. Generate mock AI analysis draft.
4. Revise draft into reviewed project package.
5. Approve Gate 1.
6. Approve Gate 2.
7. Generate provisioning plan.
8. Print source metadata.
9. Print selected preview fields proving reviewed package values were used.
```

Expected console output should make this obvious:

```text
AI draft generated.
Human revised the package.
Gate approvals completed.
Distribution preview generated from reviewed_project_package.
Reviewed package story points used: 8.
```

---

# Suggested File Touch List

Likely files:

```text
src/application/provisioning-plan.ts
src/application/intake-workflow-service.ts
src/application/types.ts
tests/distribution-preview-source.test.mjs
scripts/demo-reviewed-package-distribution-preview.mjs
package.json
docs/ai/tasks/TASK-0008-distribution-preview-from-reviewed-package.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Possible files, only if needed:

```text
src/application/in-memory-store.ts
apps/api/prisma/schema.prisma
apps/api/src/persistence/prisma-project-intake-store.ts
apps/api/src/modules/intake/intake.controller.ts
docs/product/distribution-rules.md
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
docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md
src/application/intake-workflow-service.ts
src/application/intake-analysis.ts
src/application/provisioning-plan.ts
src/application/types.ts
tests/analysis-review-lifecycle.test.mjs
tests/approval-reviewed-package-guard.test.mjs
```

## Step 2 — Run Baseline

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:mvp
```

Record baseline results in the build log.

## Step 3 — Add Distribution Source Metadata

Add source metadata types to the provisioning plan.

Recommended:

```text
source.type
source.sourceId
source.reviewedBy
source.reviewedAt
```

Use project naming conventions already present in the codebase.

## Step 4 — Add Source Resolution

Add source resolution logic before provisioning plan creation.

Priority:

```text
1. reviewedProjectPackage
2. no-AI/manual discovery path
3. block unreviewed AI-assisted path
```

## Step 5 — Update Provisioning Plan Generation

Ensure generated preview actions use reviewed package fields when present.

At minimum, prove reviewed values flow into one or more actions.

Recommended fields to use:

```text
estimatedStoryPoints
subtasks
brief
recommendedTechStack
infrastructureRequirements
```

## Step 6 — Add Tests

Add `tests/distribution-preview-source.test.mjs`.

Run:

```bash
npm run check
```

## Step 7 — Add Demo

Add:

```bash
npm run demo:reviewed-distribution
```

Demo should clearly show that reviewed package values drive the preview.

## Step 8 — Update Docs and Logs

Update:

```text
docs/ai/tasks/TASK-0008-distribution-preview-from-reviewed-package.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Optionally update:

```text
docs/product/distribution-rules.md
```

Add this rule:

```text
Distribution preview and future live provisioning must use reviewedProjectPackage when present.
Unreviewed AI drafts are never valid distribution sources.
```

## Step 9 — Final Verification

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Optional if dependencies are installed:

```bash
npm run api:build
```

If `api:build` fails because dependencies or Prisma CLI are missing, document it honestly as an environment/dependency issue.

---

# Acceptance Criteria

TASK-0008 is complete when:

```text
1. Provisioning/distribution preview uses reviewedProjectPackage when present.
2. Provisioning/distribution preview includes source metadata.
3. Human-revised values override original AI draft values.
4. Unreviewed AI-assisted intakes cannot generate distribution preview.
5. No-AI/manual flow still generates distribution preview.
6. Existing TASK-0006 and TASK-0007 behavior still passes.
7. Existing MVP demo still passes.
8. New distribution source tests pass.
9. New reviewed-distribution demo passes.
10. Docs and build logs are updated.
```

---

# Agent Execution Prompt

Use this prompt for Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0008: Generate Distribution Preview from Reviewed Project Package.

Context:
- TASK-0006 added AI analysis review lifecycle.
- TASK-0007 requires a ReviewedProjectPackage before Gate 1 approval when AI analysis drafts exist.
- The remaining gap is that downstream provisioning/distribution preview must use ReviewedProjectPackage as the authoritative source when it exists.
- No-AI/manual flows must continue to work.
- n8n is intentionally excluded from the architecture.

Implement:
1. Add source metadata to provisioning/distribution preview.
2. Resolve distribution source in this priority:
   a. reviewedProjectPackage
   b. no-AI/manual discovery path
   c. block unreviewed AI-assisted path
3. Ensure preview actions use reviewed package values when reviewedProjectPackage exists.
4. Add tests proving accepted/revised package values drive preview.
5. Add tests proving unreviewed AI-assisted preview is blocked.
6. Preserve no-AI/manual MVP behavior.
7. Add a demo script showing reviewed package values in distribution preview.
8. Update task docs and AI build logs.

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
npm run demo:reviewed-distribution
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

TASK-0008 is the final backend governance link between human review and downstream automation.

TASK-0006 made human review possible.

TASK-0007 made human review mandatory before approval.

TASK-0008 makes human-reviewed output authoritative for distribution.

After this task, the backend spine should fully enforce:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ Distribution preview uses reviewed package
→ System distributes later
```

Do not broaden this task into live integrations or frontend work.
