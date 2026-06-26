# TASK-DISCOVERY-PHASE5: NestJS DiscoveryModule

**Date:** 2026-06-26
**Phase:** Discovery Engine Phase 5
**Status:** Complete

## Objective

Wire the Discovery Engine into the NestJS API as a proper `@Module`, exposing all 10 endpoints via an HTTP controller. The module must follow existing NestJS patterns in the codebase.

## Files Added

- `apps/api/src/modules/discovery/discovery.module.ts`
  - `@Module({ controllers: [DiscoveryHttpController], providers: [...] })`
  - `useFactory` creates `InMemoryDiscoverySessionStore`, all 7 mock agents, `DiscoveryOrchestrator` (8-arg), and `DiscoveryController`
  - Token: `"DISCOVERY_CONTROLLER"`

- `apps/api/src/modules/discovery/discovery.controller.ts`
  - `@ApiTags("discovery")`, `@Controller("discovery")`
  - 10 routes: POST /discovery, GET /discovery, GET /discovery/:id, POST /:id/message, POST /:id/solutions, POST /:id/clarifications/answer, POST /:id/direction, POST /:id/proposal, POST /:id/manifest, POST /:id/send-to-evaluation
  - Uses `@CurrentActor()` for userId extraction; delegates all calls to `DiscoveryController`

## Files Modified

- `apps/api/src/app.module.ts` — added `DiscoveryModule` to `imports`

## Pattern

Follows `apps/api/src/modules/intake/intake.module.ts` pattern exactly. All agents wired inline in `useFactory` — no separate DI tokens for each agent. This matches the mock-first phase where no live providers exist.

## Checks

- `npx tsc -p apps/api/tsconfig.json --noEmit` — clean
