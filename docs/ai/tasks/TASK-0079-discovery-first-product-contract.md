# TASK-0079 — Discovery-first product contract

**Status:** Complete
**GitHub:** https://github.com/Dusty043/intake-os/issues/42

## Request

Make Discovery the sole user-facing entry point and define Phase 0 ZIP export as unapproved planning material rather than external distribution.

## Context read

- `BUILD_GUIDE.md`
- required repository memory files
- relevant workflow, AI, distribution, permissions, failure, cost, lifecycle, and requirements product specs

## Plan

1. Record the new boundary in product specs and an ADR.
2. Preserve approval guards for external distribution while exempting local packet export.
3. Update requirements trace, build log, and memory index.

## Handoff

Implemented the Discovery-first contract across the product overview, workflow,
AI orchestration, distribution, permissions, failure recovery, cost governance,
lifecycle, project-type, input-strategy, and requirements-trace specifications.
ADR-0004 records that Phase 0 ZIP export is unapproved planning material and is
not external distribution. External approval and provisioning guards remain in
force for the hidden compatibility model.

## Verification

- Product behavior is traced by P0-001 through P0-008.
- Documentation and source diffs pass `git diff --check`.

## Follow-up

Durable job recovery remains deferred until restart-safe packet generation is
required.
