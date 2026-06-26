# TASK-DISCOVERY-PHASE4: Provisioning Manifest Generator

**Date:** 2026-06-26
**Phase:** Discovery Engine Phase 4
**Status:** Complete

## Objective

Add the provisioning manifest generator — the final transformation layer of the Discovery Engine that maps a `ProjectProposal + DiscoverySession → ProvisioningManifest`. This manifest describes recommended Monday structure, GitHub repo creation, and downstream action type without touching live systems.

## Files Added

- `src/application/discovery/agents/mock-manifest-generator-agent.ts`
  - Implements `IManifestGeneratorAgent`
  - `ACTION_BY_INTENT`: maps all 10 intent types to `recommendedAction`
  - `LABELS_BY_INTENT`: GitHub label sets per intent
  - `slugify()`: lowercase alphanumeric + hyphens for repo names
  - `monday.projectsPortfolio`: set only for `create_project` actions
  - `github.createRepo`: true for project-level intents
  - `readyForLiveAdapter: false` always (mock implementation)

- `tests/discovery-phase-4.test.mjs` (14 tests)
  - Manifest shape tests (5)
  - Intent → recommendedAction routing tests (3)
  - `orchestrator.generateManifest` tests (3)
  - Controller proxy test (1)
  - E2E Phase 1–4 happy path (1)

## Files Modified

- `src/application/discovery/agents/discovery-agent-contract.ts` — added `IManifestGeneratorAgent` interface
- `src/application/discovery/discovery-orchestrator.ts` — added 8th constructor arg, `generateManifest()` method with auto-compose guard
- `src/application/discovery/discovery-controller.ts` — added `generateManifest()` proxy
- `src/application/discovery/index.ts` — barrel export
- `src/application/api-composition-root.ts` — wired `MockManifestGeneratorAgent`
- `tests/discovery-phase-1.test.mjs`, `tests/discovery-phase-2.test.mjs`, `tests/discovery-phase-3.test.mjs` — updated `makeOrchestrator()` to 8-arg form

## Design Decisions

- `generateManifest` auto-composes proposal if `session.proposal === null` — convenience for callers; avoids needing an explicit compose step
- Manifest is stored on the session (`session.manifest`) for retrieval but never written to any external system
- `readyForLiveAdapter: false` acts as a feature flag — when live Monday/GitHub adapters are wired, this becomes the gate

## Test Results

14 new tests, 0 failures. All prior tests continued passing.
