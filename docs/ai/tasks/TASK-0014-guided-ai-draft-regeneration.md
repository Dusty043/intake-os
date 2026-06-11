# TASK-0014 — Guided AI Draft Regeneration

## Status

Complete

## Goal

Let `intake_owner` and `devops_reviewer` steer the AI toward a better draft by
submitting free-text guidance. The AI regenerates a new draft incorporating that
input. The human still has to accept or revise the result — steering is not
approval.

This keeps the governance boundary intact:

```
AI drafts → Human steers → AI regenerates → Human reviews → Workflow approves → System distributes
```

---

## Context

The current mock AI generates a draft once. Humans can accept, reject, or manually
revise it. There is no way to say "the AI got this wrong, try again with this in mind"
without either starting over or doing a full manual revision.

Guided regeneration fixes that gap. When real AI is wired (TASK-0015), the guidance
field becomes a natural prompt injection point. Until then, the mock provider can
demonstrate the flow deterministically.

---

## Product Rules

- Only `intake_owner` and `devops_reviewer` may submit guidance and trigger regeneration.
- `request_creator` may not steer (conflicts of interest — they shouldn't bias the technical analysis).
- `developer` may not steer.
- Regeneration is only allowed when a draft exists in `pending_review` state.
- Each regeneration produces a **new draft** in `pending_review`. The prior draft is
  superseded and preserved in the audit trail.
- A regeneration limit (default: 5 per intake) prevents infinite loops.
- Exceeding the limit returns a clear error. An admin can reset the counter if needed.
- Regeneration does not approve, modify Gate state, or touch the ReviewedProjectPackage.

---

## New Permission

Add to `src/domain/permissions.ts`:

```
steer_analysis_draft
```

Grant to: `intake_owner`, `devops_reviewer`, `admin`.

Deny to: `request_creator`, `developer`.

---

## New Service Method

Add to `IntakeWorkflowService`:

```typescript
regenerateAnalysisDraft(
  intakeId: string,
  actorId: string,
  actorRole: string,
  input: RegenerateAnalysisDraftInput
): Promise<ProjectIntakeRecord>
```

Input type:

```typescript
interface RegenerateAnalysisDraftInput {
  guidance: string;        // required, free text, min 10 chars
  requestedBy: string;     // actor display name for audit
}
```

Validation:
- `guidance` must be non-empty and at least 10 characters (prevent trivial steering).
- Actor must have `steer_analysis_draft` permission.
- Intake must be in `intake_review` state.
- A draft must exist in `pending_review` state.
- Regeneration count must be below the limit (default 5).

Behaviour:
1. Check permission and state guards.
2. Mark the current draft as `superseded` with a reason of `"regeneration_requested"`.
3. Call the mock (or real) AI provider with the original intake data + guidance text.
4. Persist the new draft in `pending_review` state.
5. Increment the regeneration counter on the intake record.
6. Emit an audit event: `analysis_draft_regenerated` with `guidance` (truncated to 500
   chars), `regenerationCount`, and `actorId`.
7. Return the updated intake record.

---

## New Types

Add to `src/application/types.ts`:

```typescript
interface RegenerateAnalysisDraftInput {
  guidance: string;
  requestedBy: string;
}
```

Add to `ProjectIntakeRecord`:

```typescript
analysisDraftRegenerationCount?: number;  // defaults to 0
```

Add audit event kind:

```
analysis_draft_regenerated
```

---

## Mock Provider Behaviour

The mock provider currently returns a fixed shape. When guidance is supplied, it should
incorporate a signal from the guidance text so the output is visibly different from the
prior draft. A simple approach: append a note to the `summary` field derived from the
guidance, and vary a numeric field (e.g. `estimatedStoryPoints`).

This makes the regeneration flow demonstrable without a real AI provider.

---

## API Endpoint

Add to `apps/api/src/modules/intake/intake.controller.ts`:

```
POST /intakes/:id/analysis-drafts/regenerate
```

Request body DTO:

```typescript
class RegenerateAnalysisDraftDto {
  @IsString()
  @MinLength(10)
  guidance: string;
}
```

Response: updated intake record (same shape as other draft endpoints).

Errors:
- `403` — actor lacks `steer_analysis_draft` permission
- `409` — no draft in `pending_review` state
- `409` — regeneration limit reached
- `422` — guidance too short

---

## Tests

Add `tests/guided-draft-regeneration.test.mjs`:

```
intake_owner can submit guidance and get a new draft
devops_reviewer can submit guidance and get a new draft
request_creator cannot steer draft regeneration
developer cannot steer draft regeneration
regeneration supersedes the previous draft
regeneration count increments on each call
regeneration is blocked after limit is reached
regeneration requires a draft in pending_review state
regeneration audit event includes guidance summary and count
guidance shorter than 10 chars is rejected
```

---

## Demo Script

Add `scripts/demo-guided-regeneration.mjs` and npm script `demo:guided-regen`.

Flow:

```
1. Submit intake
2. Generate initial mock draft
3. Intake owner submits guidance: "Focus on the payment retry logic, not the UI"
4. AI regenerates draft — show diff between v1 and v2
5. DevOps submits guidance: "Reduce scope to backend only, 2 sprints max"
6. AI regenerates draft — show v3
7. Intake owner accepts v3
8. Confirm ReviewedProjectPackage was created from v3
9. Gate 1 available
```

---

## Files to Add

```
src/application/types.ts                         (modify)
src/domain/permissions.ts                        (modify)
src/application/intake-workflow-service.ts       (modify)
tests/guided-draft-regeneration.test.mjs         (new)
scripts/demo-guided-regeneration.mjs             (new)
apps/api/src/modules/intake/dto/
  regenerate-analysis-draft.dto.ts               (new)
apps/api/src/modules/intake/intake.controller.ts (modify)
docs/ai/tasks/TASK-0014-guided-ai-draft-regeneration.md
```

---

## Acceptance Criteria

```
1. intake_owner and devops_reviewer can POST guidance and receive a new draft.
2. request_creator and developer are rejected with 403.
3. New draft is in pending_review state.
4. Prior draft is superseded and visible in audit trail.
5. Regeneration count on intake increments correctly.
6. Attempting regeneration after the limit returns a clear error.
7. Guidance shorter than 10 chars is rejected.
8. Mock provider visibly incorporates guidance into new draft output.
9. Audit event analysis_draft_regenerated is recorded with guidance summary.
10. All existing tests still pass.
11. New tests: 10/10 pass.
12. Demo script runs end-to-end showing v1 → guidance → v2 → guidance → v3 → accept.
```

---

## Sequence

Implement after:
- TASK-0013 — Auth (actor identity must be real before guidance is attributed to a person)

Can be implemented before:
- TASK-0015 — Real AI provider (mock works for the full flow)
- TASK-0016 — GitHub integration
- TASK-0017 — Monday distribution

When real AI is wired (TASK-0015), the `guidance` field maps directly onto the
regeneration prompt. No structural changes to this task's contract are needed.

---

## Handoff

The regeneration counter and superseded draft history give reviewers full visibility into
how many times the AI was steered before the accepted draft was produced. This becomes
a useful signal in the audit trail — a high regeneration count may indicate the intake
was underspecified or that the AI model needs a better prompt.
