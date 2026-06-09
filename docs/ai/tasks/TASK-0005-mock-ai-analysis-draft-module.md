# TASK-0005 — Mock AI Analysis Draft Module

## Goal

Add the first build slice of the AI intake analysis layer while keeping all output draft-only and review-gated.

## Scope

Implemented:

- `src/application/intake-analysis.ts`
- `IntakeAnalysisDraft` v1 contract
- deterministic mock analysis provider
- schema/version constants
- validation helper
- `ProjectIntakeRecord.analysisDrafts`
- `ProjectIntakeRecord.latestAnalysisDraft`
- `IntakeWorkflowService.generateMockAnalysisDraft()`
- framework-neutral controller method
- NestJS controller source endpoint `POST /intakes/:id/analysis-drafts/mock`
- API DTO for mock analysis draft generation
- Prisma JSON fields for `analysisDrafts` and `latestAnalysisDraft`
- `scripts/demo-analysis-draft.mjs`
- `npm run demo:analysis`
- tests proving draft-only behavior and approval/provisioning guards

## Out of Scope

- live OpenAI/Claude/provider call
- model bakeoff
- prompt registry
- human edit UI
- Next.js frontend
- roster API integration
- live Monday/GitHub writes
- automatic approval or provisioning from AI output

## Verification

Commands run:

```bash
npm run check
npm run demo:analysis
```

Result:

```text
28/28 tests passed.
```

The demo reaches `intake_review` with one mock analysis draft, zero approvals, no provisioning plan, and audit actions:

```text
INTAKE_CREATED
submit
generate_evaluation
ANALYSIS_DRAFT_GENERATED
success
```

## Follow-Up

Recommended next build slice:

```text
TASK-0006 — Analysis review acceptance/editing contract
```

Suggested scope:

- accept/reject/supersede analysis draft statuses;
- reviewer notes;
- preserve immutable generated draft;
- create edited human-reviewed project package;
- keep provisioning blocked until approval gates remain complete.
