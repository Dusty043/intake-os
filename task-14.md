# TASK-0014 — Guided AI Draft Regeneration

## Status

Planned

## Depends On

Completed:

```text
TASK-0012 — Private Server Runtime Deployment
TASK-0013 — Authenticated Internal Access & Role Resolution
```

TASK-0013 is important because guided regeneration must be attributed to a real authenticated actor.

Do not accept reviewer identity from the request body.

Use the authenticated actor resolved by the backend.

---

# Goal

Let authorized reviewers steer the AI toward a better project analysis draft by submitting free-text guidance.

The system regenerates a new AI draft incorporating that guidance.

The regenerated draft is still only a draft. A human must still accept, reject, or manually revise it before a `ReviewedProjectPackage` can be created.

Governance remains:

```text
AI drafts
→ Human steers
→ AI regenerates
→ Human reviews
→ Workflow approves
→ System distributes
```

Guided regeneration is not approval.

---

# Current Context

The app currently supports:

```text
create intake
submit intake
generate mock AI draft
accept AI draft as reviewed package
reject AI draft
revise AI draft manually
Gate 1 approval
Gate 2 approval
distribution preview from reviewed package
audit trail
auth-backed actor resolution
```

The current AI draft flow is missing a middle path:

```text
"The AI draft is useful, but it misunderstood something. Try again with this guidance."
```

TASK-0014 adds that path.

Example guidance:

```text
Focus on the payment retry logic, not the UI.
```

or:

```text
Reduce scope to backend only, two sprints max.
```

Until TASK-0015 real AI provider exists, the mock AI provider should incorporate the guidance deterministically so the flow is demoable and testable.

---

# Product Rules

1. Only authorized reviewer roles can submit guidance.
2. `request_creator` cannot steer AI regeneration.
3. `developer` cannot steer AI regeneration.
4. `intake_owner`, `devops_lead`, and `admin` can steer AI regeneration.
5. Regeneration requires an existing reviewable AI draft.
6. Regeneration creates a new draft.
7. The prior draft is preserved and marked `superseded`.
8. Superseded drafts cannot be accepted, rejected, or manually revised.
9. Regeneration does not approve the intake.
10. Regeneration does not modify Gate 1 or Gate 2 state.
11. Regeneration does not create or modify a `ReviewedProjectPackage`.
12. Regeneration is blocked if a `ReviewedProjectPackage` already exists.
13. Regeneration is blocked once the per-intake regeneration limit is reached.
14. Default regeneration limit is `5`.
15. All regeneration attempts must be auditable.
16. Existing dev/auth mode behavior must remain compatible with tests and demos.

---

# Role Model

Use the existing role model from TASK-0013:

```text
request_creator
intake_owner
devops_lead
admin
developer
```

Do not introduce `devops_reviewer`.

Use:

```text
devops_lead
```

not:

```text
devops_reviewer
```

---

# New Permission

Modify:

```text
src/domain/permissions.ts
```

Add permission:

```text
steer_analysis_draft
```

Grant to:

```text
intake_owner
devops_lead
admin
```

Deny to:

```text
request_creator
developer
```

This permission should be checked server-side in the workflow service.

---

# API Endpoint

Add:

```http
POST /intakes/:id/analysis-drafts/:draftId/regenerate
```

Reason for including `draftId`:

```text
It prevents ambiguity if an intake has multiple historical AI drafts.
It makes draft lineage explicit.
It prevents accidentally regenerating from an already-superseded draft.
```

Request body:

```ts
class RegenerateAnalysisDraftDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  guidance: string;
}
```

Response:

```text
Updated ProjectIntakeRecord
```

Do not include:

```ts
requestedBy: string
```

The actor must come from:

```ts
@CurrentActor()
```

or the equivalent authenticated actor resolver introduced in TASK-0013.

---

# Controller Behavior

In:

```text
apps/api/src/modules/intake/intake.controller.ts
```

Add endpoint:

```ts
@Post(':id/analysis-drafts/:draftId/regenerate')
regenerateAnalysisDraft(
  @Param('id') intakeId: string,
  @Param('draftId') draftId: string,
  @CurrentActor() actor: AuthenticatedActor,
  @Body() body: RegenerateAnalysisDraftDto,
) {
  return this.workflowService.regenerateAnalysisDraft(
    intakeId,
    draftId,
    actor,
    body,
  );
}
```

Exact syntax may vary based on the current controller patterns.

Important:

```text
Do not read x-actor-* headers directly here.
Do not trust actor identity from the DTO.
```

In `AUTH_MODE=google`, actor headers are ignored by TASK-0013.

In `AUTH_MODE=dev_headers`, `@CurrentActor()` should still resolve the dev actor for tests and demos.

---

# Service Method

Add to `IntakeWorkflowService`:

```ts
regenerateAnalysisDraft(
  intakeId: string,
  draftId: string,
  actor: AuthenticatedActor,
  input: RegenerateAnalysisDraftInput,
): Promise<ProjectIntakeRecord>
```

Input type:

```ts
export interface RegenerateAnalysisDraftInput {
  guidance: string;
}
```

If the existing service layer still expects `actorId` and `actorRole` separately, bridge from `actor` inside the controller or service.

Preferred long-term shape:

```ts
actor: AuthenticatedActor
```

Acceptable short-term bridge:

```ts
actor.id
actor.role
actor.name
actor.email
```

---

# Validation Rules

Validate:

```text
guidance exists
guidance is at least 10 characters
guidance is no more than 4000 characters
actor has steer_analysis_draft permission
intake exists
intake is in intake_review state
target draft exists
target draft belongs to this intake
target draft is reviewable
target draft is not accepted
target draft is not rejected
target draft is not superseded
ReviewedProjectPackage does not already exist
analysisDraftRegenerationCount is below limit
```

If the current implementation uses a different status name for “pending review,” reuse the current status and document it clearly.

Do not introduce a large status refactor unless needed.

---

# Behavior

When regeneration is requested:

```text
1. Resolve actor from authenticated request.
2. Validate actor permission.
3. Validate guidance.
4. Load intake.
5. Validate intake state.
6. Validate target draft.
7. Validate no ReviewedProjectPackage exists.
8. Validate regeneration count below limit.
9. Mark the target draft as superseded.
10. Call analysis provider with:
    - original intake data
    - previous draft
    - reviewer guidance
    - actor metadata
11. Persist a new reviewable draft.
12. Link the new draft to the old draft.
13. Increment regeneration counter.
14. Emit audit event analysis_draft_regenerated.
15. Return updated ProjectIntakeRecord.
```

Regeneration should not:

```text
approve Gate 1
approve Gate 2
create ReviewedProjectPackage
generate distribution preview
call live integrations
modify requester-submitted original intake fields
```

---

# Draft Lineage

Add lineage fields where the current model supports them.

Recommended draft fields:

```ts
regeneratedFromDraftId?: string;
supersededByDraftId?: string;
supersededAt?: string;
supersededReason?: "regeneration_requested";
guidanceSummary?: string;
regenerationSequence?: number;
```

Minimum required lineage:

```text
old draft has supersededReason = regeneration_requested
old draft links to new draft where possible
new draft links to previous draft where possible
audit event includes previousDraftId and newDraftId
```

If the current data model only supports one active draft, add a small historical collection or metadata structure so previous drafts are not lost.

Do not delete prior drafts.

---

# Regeneration Counter

Add to `ProjectIntakeRecord`:

```ts
analysisDraftRegenerationCount?: number;
```

Default:

```text
0
```

Default limit:

```text
5
```

Recommended constant:

```ts
export const DEFAULT_ANALYSIS_DRAFT_REGENERATION_LIMIT = 5;
```

The counter should increment only after successful regeneration.

Failed validation should not increment the counter.

---

# Audit Event

Add audit event kind:

```text
analysis_draft_regenerated
```

Audit metadata should include:

```ts
{
  previousDraftId: string;
  newDraftId: string;
  guidanceSummary: string;
  regenerationCount: number;
  regenerationLimit: number;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  actorRole: string;
}
```

Guidance summary rules:

```text
trim whitespace
truncate to 500 characters
store bounded text in audit metadata
do not store unbounded guidance in audit metadata
```

The full guidance may be stored on draft metadata if useful, but audit metadata must stay bounded.

---

# Mock Provider Behavior

Modify the mock AI provider so regenerated output is visibly different.

The mock provider does not need real AI behavior.

It must be deterministic.

Minimum behavior:

```text
include a guidance-derived note in the summary or brief
change estimated story points in a predictable way
include guidanceSummary in draft metadata
```

Example generated note:

```text
Reviewer guidance incorporated: "Focus on the payment retry logic, not the UI."
```

Optional deterministic signals:

```text
If guidance mentions "backend", emphasize backend subtasks.
If guidance mentions "UI", move UI items out of scope.
If guidance mentions "reduce scope", lower story points.
If guidance mentions "payment" or "retry", include payment retry subtasks.
If guidance mentions "two sprints", constrain implementation plan.
```

Do not call a real AI provider in TASK-0014.

That belongs to TASK-0015.

---

# Review Guard Updates

Update existing accept/reject/revise guards so superseded drafts cannot be acted on.

Required behavior:

```text
accepted drafts cannot be regenerated
rejected drafts cannot be regenerated
superseded drafts cannot be regenerated
superseded drafts cannot be accepted
superseded drafts cannot be manually revised
superseded drafts cannot become ReviewedProjectPackage
```

Only the latest reviewable draft can be accepted or manually revised into a `ReviewedProjectPackage`.

---

# API Errors

Expected errors:

```text
403 — actor lacks steer_analysis_draft permission
409 — intake is not in intake_review state
409 — draft does not belong to intake
409 — draft is not reviewable
409 — draft has already been superseded
409 — reviewed project package already exists
409 — regeneration limit reached
422 — guidance too short
422 — guidance too long
```

Suggested messages:

```text
Only intake owners, DevOps leads, or admins can regenerate analysis drafts.
Analysis draft regeneration requires a reviewable draft.
This draft has already been superseded.
A reviewed project package already exists for this intake.
Analysis draft regeneration limit reached.
Guidance must be at least 10 characters.
Guidance must be 4000 characters or fewer.
```

Use existing error classes/patterns where possible.

---

# Frontend Requirement

Update the TASK-0010 UI minimally.

On the AI Draft area, add:

```text
Regenerate with Guidance
```

The action should open a small form:

```text
textarea
submit button
cancel button
```

Helper copy:

```text
Use guidance to ask the AI for a better draft. This does not approve the draft.
```

Show regeneration count:

```text
Regenerations used: 2 / 5
```

Disable or hide the action when:

```text
actor is not intake_owner, devops_lead, or admin
draft is not reviewable
draft is superseded
reviewed package already exists
regeneration limit reached
```

The frontend may hide controls for convenience, but the backend must enforce all rules.

---

# API Client Update

Add client method:

```ts
regenerateAnalysisDraft(
  intakeId: string,
  draftId: string,
  guidance: string,
): Promise<ProjectIntakeRecord>
```

It should call:

```http
POST /intakes/:id/analysis-drafts/:draftId/regenerate
```

In `AUTH_MODE=google`, rely on session cookie via:

```ts
credentials: "include"
```

In `AUTH_MODE=dev_headers`, existing dev actor headers should continue to work through the API client.

---

# Demo Script

Add:

```text
scripts/demo-guided-regeneration.mjs
```

Add npm script:

```json
"demo:guided-regen": "node scripts/demo-guided-regeneration.mjs"
```

Demo flow:

```text
1. Create intake.
2. Submit intake.
3. Generate initial mock draft v1.
4. Intake owner submits guidance:
   "Focus on the payment retry logic, not the UI."
5. System regenerates draft v2.
6. Show v1 → v2 difference.
7. DevOps lead submits guidance:
   "Reduce scope to backend only, two sprints max."
8. System regenerates draft v3.
9. Show v2 → v3 difference.
10. Intake owner accepts v3.
11. Confirm ReviewedProjectPackage was created from v3.
12. Confirm Gate 1 is available.
13. Confirm audit trail includes analysis_draft_regenerated events.
```

The demo should run in:

```text
AUTH_MODE=dev_headers
```

so it remains scriptable without real Google login.

---

# Tests

Add:

```text
tests/guided-draft-regeneration.test.mjs
```

Required cases:

```text
intake_owner can submit guidance and get a new draft
devops_lead can submit guidance and get a new draft
admin can submit guidance and get a new draft
request_creator cannot steer draft regeneration
developer cannot steer draft regeneration
guidance shorter than 10 chars is rejected
guidance longer than 4000 chars is rejected
regeneration requires a reviewable draft
regeneration is blocked if reviewedProjectPackage already exists
regeneration supersedes the previous draft
superseded draft cannot be accepted
superseded draft cannot be manually revised
new regenerated draft can be accepted
regeneration count increments on each successful call
failed regeneration does not increment count
regeneration is blocked after limit is reached
audit event includes previousDraftId, newDraftId, guidanceSummary, and count
mock provider visibly incorporates guidance into regenerated output
```

Minimum required:

```text
10 new tests
```

Recommended:

```text
18 new tests
```

---

# Persistence Notes

TASK-0012 currently uses schema-first `prisma db push` on container startup.

If TASK-0014 adds fields to Prisma schema, update:

```text
apps/api/prisma/schema.prisma
```

Then verify:

```bash
npm run prisma:generate
```

and server runtime startup with `prisma db push`.

If migration files are later introduced, update TASK-0012 deployment scripts accordingly. Do not switch the deployment strategy in this task unless explicitly required.

---

# Files to Modify

Likely files:

```text
src/application/types.ts
src/domain/permissions.ts
src/application/intake-workflow-service.ts
src/application/intake-analysis.ts
apps/api/prisma/schema.prisma
apps/api/src/modules/intake/intake.controller.ts
apps/api/src/modules/intake/dto/index.ts
apps/web/src/lib/api-client.ts
apps/web/src/components/AnalysisDraftPanel.tsx
apps/web/src/components/ReviewedPackagePanel.tsx
README.md
package.json
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

Adjust paths to match the repo.

---

# Files to Add

```text
tests/guided-draft-regeneration.test.mjs
scripts/demo-guided-regeneration.mjs
apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.ts
docs/ai/tasks/TASK-0014-guided-ai-draft-regeneration.md
```

Optional frontend file:

```text
apps/web/src/components/RegenerateDraftForm.tsx
```

---

# Acceptance Criteria

TASK-0014 is complete when:

```text
1. steer_analysis_draft permission exists.
2. intake_owner can regenerate a draft.
3. devops_lead can regenerate a draft.
4. admin can regenerate a draft.
5. request_creator is rejected.
6. developer is rejected.
7. Guidance shorter than 10 characters is rejected.
8. Guidance longer than 4000 characters is rejected.
9. Regeneration requires a reviewable draft.
10. Regeneration is blocked after ReviewedProjectPackage exists.
11. Regeneration creates a new draft.
12. Prior draft is marked superseded.
13. Draft lineage is visible through stored fields or audit metadata.
14. Superseded drafts cannot be accepted.
15. Superseded drafts cannot be manually revised.
16. Regeneration count increments only on successful regeneration.
17. Regeneration limit is enforced.
18. Mock provider visibly incorporates guidance.
19. Audit event analysis_draft_regenerated is recorded.
20. Audit event includes previousDraftId, newDraftId, guidanceSummary, and count.
21. UI exposes guided regeneration to authorized users.
22. UI labels regeneration as not approval.
23. Demo script shows v1 → v2 → v3 → accept.
24. ReviewedProjectPackage is created only after human acceptance/revision.
25. No approval gate is bypassed.
26. No distribution preview is created by regeneration.
27. All existing tests still pass.
28. Existing demos still pass.
29. New guided regeneration tests pass.
30. API build passes.
31. Web build passes.
32. Prisma generate passes.
```

---

# Verification

Run:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:guided-regen
```

If TASK-0012 server runtime is running:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run demo:guided-regen
```

Server check after schema changes:

```bash
npm run server:build
npm run server:up
npm run server:health
```

If auth mode is google on the server, script demos should either:

```text
run inside dev_headers mode
```

or use test/dev env overrides.

Do not require Google login for automated demo scripts.

---

# Sequence

Implemented after:

```text
TASK-0013 — Authenticated Internal Access & Role Resolution
```

Can be implemented before:

```text
TASK-0015 — Real AI provider adapter
TASK-0016 — GitHub integration
TASK-0017 — Monday distribution
```

When TASK-0015 real AI is implemented, the `guidance` field becomes reviewer-provided input to the AI adapter.

Important TASK-0015 note:

```text
Treat reviewer guidance as untrusted user-provided text.
Do not treat it as system instructions.
```

---

# Expected Final Report

When complete, report:

```text
TASK-0014 done.

Commit:
- <hash>

Files added:
- tests/guided-draft-regeneration.test.mjs
- scripts/demo-guided-regeneration.mjs
- apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.ts
- docs/ai/tasks/TASK-0014-guided-ai-draft-regeneration.md
- optional UI form component if added

Files modified:
- src/application/types.ts
- src/domain/permissions.ts
- src/application/intake-workflow-service.ts
- src/application/intake-analysis.ts
- apps/api/prisma/schema.prisma
- apps/api/src/modules/intake/intake.controller.ts
- apps/web API/client/components
- package.json
- README.md
- docs/ai logs

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- existing demos: pass
- npm run demo:guided-regen: pass
- server health after rebuild: pass, if tested

Behavior verified:
- intake_owner/devops_lead/admin can regenerate
- request_creator/developer cannot regenerate
- old draft superseded
- new draft reviewable
- superseded draft cannot be accepted
- count increments
- limit enforced
- reviewed package only created after human accept/revise
```

---

# Agent Execution Prompt

Use this with Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0014: Guided AI Draft Regeneration.

Context:
- TASK-0012 private server runtime is complete.
- TASK-0013 auth is complete.
- The API now supports AUTH_MODE=dev_headers|google.
- Authenticated actor identity should come from @CurrentActor() or the equivalent auth resolver.
- Do not accept reviewer identity from request body.
- Existing role names are request_creator, intake_owner, devops_lead, admin, developer.
- Existing workflow already supports mock AI draft generation, human accept/reject/revise, reviewed package, approval gates, distribution preview, and audit trail.

Goal:
Allow intake_owner, devops_lead, and admin to submit free-text guidance that regenerates a new AI draft. The previous draft must be preserved and marked superseded. The new draft remains pending review. Regeneration is not approval.

Implement:
1. Add steer_analysis_draft permission.
2. Grant to intake_owner, devops_lead, admin.
3. Deny request_creator and developer.
4. Add RegenerateAnalysisDraftInput.
5. Add DTO RegenerateAnalysisDraftDto with guidance min 10 and max 4000.
6. Add POST /intakes/:id/analysis-drafts/:draftId/regenerate.
7. Use @CurrentActor(); do not use requestedBy in DTO.
8. Add IntakeWorkflowService.regenerateAnalysisDraft.
9. Validate intake state, draft state, permissions, reviewed package absence, and regeneration limit.
10. Mark prior draft superseded.
11. Create new reviewable draft.
12. Link draft lineage through fields or audit metadata.
13. Add analysisDraftRegenerationCount, default 0.
14. Enforce default limit 5.
15. Add audit event analysis_draft_regenerated.
16. Update mock provider to visibly incorporate guidance deterministically.
17. Update accept/reject/revise guards so superseded drafts cannot be acted on.
18. Add UI form for "Regenerate with Guidance" on AI draft panel.
19. Show regeneration count in UI.
20. Add tests.
21. Add demo script demo:guided-regen.
22. Update README and AI docs/logs.

Rules:
- Use devops_lead, not devops_reviewer.
- Do not bypass human review.
- Do not create ReviewedProjectPackage during regeneration.
- Do not alter Gate 1 or Gate 2.
- Do not generate distribution preview during regeneration.
- Do not call real AI provider.
- Keep AUTH_MODE=dev_headers demos working.
- Keep AUTH_MODE=google actor attribution safe.
- Existing tests and demos must continue to pass.

Verification:
Run:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
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
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run demo:guided-regen

Return:
- commit hash
- files added
- files modified
- verification results
- behavior notes
- known limitations
- next recommended task
```

---

# Human Dev Notes

This task is the missing “conversation loop” between AI and reviewer.

But the boundary stays strict:

```text
AI can draft.
AI can regenerate.
Humans decide what becomes reviewed.
Only reviewed packages can move to approval.
Only approved packages can produce distribution preview.
```

The point is not to make the AI more powerful.

The point is to make human review less binary:

```text
accept
reject
revise manually
regenerate with guidance
```

After this, the app has a very clean governance loop and is ready for:

```text
TASK-0015 — Real AI Provider Adapter
```
