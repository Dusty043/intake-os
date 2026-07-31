# TASK-0083 — Phase 0 quality repair

**Status:** In progress
**GitHub:** https://github.com/Dusty043/intake-os/issues/46

## Request

Improve low Phase 0 packet quality during generation instead of merely exposing
the critic score and warnings.

## Root cause

The live 46.5/100 packet was scored from an invalid review surface: the critic
received only the first 300 characters of each evaluation section. Its persisted
warnings explicitly reported that nearly every section ended mid-sentence. The
`repairing` packet state did not perform a repair pass.

## Plan

1. Give the critic complete schema-bounded evaluation sections.
2. For scores below 90, feed critic weaknesses and required revisions into one
   full-depth regeneration, then rescore.
3. Preserve the original downloadable packet if repair fails.
4. Allow a forced improvement pass for `ready_with_warnings`; keep `ready`
   immutable.
5. Add regression coverage, update product truth, and verify on oreochiserver.

## Current verification

- Focused Phase 0 tests: 9/9 passed.
- Full core suite: 816/816 passed.
- Full web suite: 34/34 passed.
- Core and web typechecks, API build, web production build, and
  `git diff --check` passed.

## Follow-up

Real-provider verification incurs AI cost and will be run once after deployment
against the existing 46.5 packet.
