# ADR-0004 — Discovery-first Phase 0 export

**Status:** Accepted
**Date:** 2026-07-31
**Tasks:** TASK-0079 through TASK-0082

## Context

The product previously treated Discovery as an optional pre-intake step, then routed a separate Intake record through evaluation, two approvals, and Monday/GitHub provisioning. That duplicated the user's mental model even though Discovery already held the richer source evidence.

## Decision

Discovery is the sole user-facing entry point. Selecting a direction above 80% confidence automatically freezes the available evidence and runs a full evaluation. A user may force the same run below the threshold after selecting a direction.

The result is an AI-generated Phase 0 planning packet containing the complete static 00–10 document tree. The ZIP is local export, not approval and not external distribution. It is downloadable without an approval gate and must identify its assumptions, confidence, quality warnings, and unapproved status.

The existing `ProjectIntake` aggregate remains an internal compatibility record. Monday/GitHub provisioning executors and mutation routes are disabled; approval guards remain intact for historical records and any future external distribution capability.

## Consequences

- Discovery evidence becomes the immutable input snapshot for packet generation.
- Clarification findings become assumptions or unresolved risks instead of blocking Phase 0 generation.
- Full evaluation no longer generates an active distribution-plan section.
- Packet documents use server-owned paths and deterministic composition from evaluated evidence.
- The current in-process background pattern can leave work active after a process restart; durable recovery is deferred.
