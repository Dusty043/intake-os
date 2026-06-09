# TASK-0008 — Generate Distribution Preview from Reviewed Project Package

## Status: complete

## Goal

Make the `ReviewedProjectPackage` the authoritative source for distribution preview / dry-run provisioning.

Priority:
1. `reviewedProjectPackage` → use it, it is authoritative
2. No AI analysis drafts → preserve existing no-AI/manual path
3. AI drafts exist but no reviewed package → block distribution preview

## Context Read

- `docs/ai/MEMORY_INDEX.md`, `docs/ai/BUILD_LOG.md`
- `docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md`
- `docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md`
- `src/application/intake-workflow-service.ts`
- `src/application/provisioning-plan.ts`
- `src/application/types.ts`

## Baseline

```
npm run check                 → 44/44 pass
npm run demo:analysis         → pass
npm run demo:analysis-review  → pass
npm run demo:review-guard     → pass
npm run demo:mvp              → pass
```

## Implementation

### Types (`src/application/types.ts`)

Added:
- `DistributionSourceType` — `"reviewed_project_package" | "manual_discovery" | "legacy_intake_record"`
- `ProvisioningPlanSource` — `{ type, sourceId, reviewedBy?, reviewedAt? }`
- `source: ProvisioningPlanSource` field added to `ProvisioningPlan`

### Provisioning plan (`src/application/provisioning-plan.ts`)

Added `resolveDistributionSource(intake)`:
- If `reviewedProjectPackage` exists → returns `reviewed_project_package` source
- If no analysis drafts → returns `manual_discovery` or `legacy_intake_record`
- If AI drafts exist but no package → throws `ValidationError`

Updated `buildDryRunProvisioningPlan`:
- Calls `resolveDistributionSource` to determine source
- When source is `reviewed_project_package`:
  - Uses `reviewedProjectPackage.projectType` as `effectiveProjectType`
  - Uses `reviewedProjectPackage.subtasks` for GitHub issue titles
  - Includes `estimatedStoryPoints` and `brief` in handoff doc action payload
  - Uses `infrastructureRequirements` to detect GitHub need
- Added `buildIssueTitlesFromPackage(pkg)` helper
- Returns plan with `source` field

### Workflow service (`src/application/intake-workflow-service.ts`)

Updated `generateProvisioningPlan`:
- Calls `resolveDistributionSource` to get source metadata
- Passes `sourceType` and `sourceId` into `PROVISIONING_PLAN_GENERATED` audit event metadata

## Tests Added

File: `tests/distribution-preview-source.test.mjs` (5 tests)

1. Source is `reviewed_project_package` when draft was accepted
2. Human-revised story points and subtask titles are used (not raw AI draft)
3. Blocks preview if AI drafts exist but no reviewed package
4. No-AI/manual path still produces `manual_discovery` or `legacy_intake_record` source
5. Audit event includes `sourceType` and `sourceId`

## Demo

File: `scripts/demo-reviewed-package-distribution-preview.mjs`
Script: `demo:reviewed-distribution`

Shows:
- AI draft generated (34 SP estimated)
- Human revises to 8 SP with specific subtasks
- Gate 1 and Gate 2 approved
- Distribution preview generated with `source.type = reviewed_project_package`
- Handoff doc action carries human-revised story points
- GitHub issues created from reviewed subtask titles

## Verification

```
npm run check                   → 49/49 pass (44 original + 5 new)
npm run demo:analysis           → pass
npm run demo:analysis-review    → pass
npm run demo:review-guard       → pass
npm run demo:reviewed-distribution → pass
npm run demo:mvp                → pass
```

## Files Changed

```
src/application/types.ts                                          — DistributionSourceType, ProvisioningPlanSource, source on ProvisioningPlan
src/application/provisioning-plan.ts                             — resolveDistributionSource, buildIssueTitlesFromPackage, source in plan
src/application/intake-workflow-service.ts                       — source resolution + audit metadata
tests/distribution-preview-source.test.mjs                       — new, 5 tests
scripts/demo-reviewed-package-distribution-preview.mjs           — new demo
package.json                                                      — added demo:reviewed-distribution
docs/ai/tasks/TASK-0008-distribution-preview-from-reviewed-package.md — this file
docs/ai/BUILD_LOG.md                                              — appended
docs/ai/MEMORY_INDEX.md                                           — updated
```

## Product Boundary Now Complete

```
AI drafts       → generated, immutable
Human reviews   → required before approval (TASK-0007)
Workflow approves → Gate 1 then Gate 2
Distribution preview → uses ReviewedProjectPackage (TASK-0008)
System distributes → provisioning plan after both gates
```
