# TASK-0080 — Phase 0 generation pipeline

**Status:** Complete
**GitHub:** https://github.com/Dusty043/intake-os/issues/41

## Request

Automatically run a full, non-blocking evaluation after Discovery selects a direction above 80% confidence, with a forced low-confidence fallback.

## Plan

1. Freeze the Discovery snapshot and add explicit packet states.
2. Reuse the existing evaluation orchestrator at full depth.
3. Convert missing information into visible assumptions instead of blocking.
4. Make queueing idempotent and failed generation retryable.

## Handoff

Added the packet state machine, frozen Discovery source snapshots, strict
greater-than-80-percent automatic triggering, forced low-confidence generation,
idempotent in-process queueing, failed-run retry, non-blocking clarification
conversion, and full-depth evaluation. Phase 0 generation always receives the
configured full orchestrator at runtime; the distribution planner is excluded
from standard and full active evaluation routes.

## Verification

- `npm test`: 810 passed.
- `npm run typecheck`: passed.
- `npm run api:build`: passed.

## Follow-up

No durable job queue, restart recovery, production deployment, or real-provider
cost-bearing smoke test is included.
