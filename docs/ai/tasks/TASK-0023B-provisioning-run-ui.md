# TASK-0023B — Provisioning Run UI

**Status:** COMPLETE
**Date:** 2026-06-17
**Branch:** main

---

## Goal

Show execution readiness and run history in the Distribution tab. The execute button is gated behind governance. Run history shows per-target outcomes with external links.

---

## What Was Built

### New API client functions — `apps/web/src/lib/api-client.ts`

- `markReadyForProvisioning(id, actor)` — `POST /intakes/:id/provisioning-ready`
- `executeDistribution(id, actor)` — `POST /intakes/:id/distribution/execute`
- `listProvisioningRuns(id, actor)` — `GET /intakes/:id/distribution/runs`

### New UI types — `apps/web/src/lib/types.ts`

- `ProvisioningTargetResult` — per-target status, externalId, externalUrl, errorMessage
- `ProvisioningRun` — run status, targets, actor, timestamps

### Rewritten DistributionTab — `apps/web/src/app/intakes/[id]/page.tsx`

`DistributionTab` now takes `{ intake, actor, onIntakeUpdate }` instead of `onAction`.

**Status banners** — context-aware header depending on intake.status:
- `provisioning_failed` → red "Provisioning failed" banner
- `provisioning` → blue "Provisioning in progress" banner
- `distributed` → green "Distribution complete" banner
- `ready_for_provisioning` → amber "Ready for execution" banner
- else → indigo "Dry-run preview only" banner

**Governance buttons** (appear in the plan card, conditionally):
- "Approve for Execution" — visible when plan is `draft` + valid + intake is `approved`; calls `markReadyForProvisioning`
- "Execute Distribution" — visible only when plan is `ready_for_provisioning` + intake is `approved`; calls `executeDistribution`; green button with warning copy

**Run history panel** — loads on mount via `listProvisioningRuns`, updates after execution:
- Shows each `ProvisioningRun` with status badge, triggered-by, timestamp
- Per-target rows: status badge + target kind + external link (if available) + error message (if failed)
- `RunStatusBadge` maps `executing | completed | failed | partial_success | succeeded | skipped | pending` to appropriate color variants

**Plan metadata** — same Source/Validation/Source ID/Reviewed At grid; action badges now show "Approved" instead of "Dry Run" once plan is `ready_for_provisioning`

---

## Not built (out of scope for 23B)

- Retry button for failed targets (TASK-0023C)
- Provider-specific UI details (TASK-0023D/E)
- Real Monday/GitHub links (those will come when adapters are inserted)
