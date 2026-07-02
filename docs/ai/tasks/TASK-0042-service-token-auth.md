# TASK-0042 — Service Token Auth for Non-Human Callers

**Date:** 2026-07-02
**Status:** implemented

## Context

`AUTH_MODE` had exactly two values: `dev_headers` (trusts a client-supplied
`x-actor-role` header — no real identity check, forbidden in production) and
`google` (OAuth + session cookie, fully built but env-gated on credentials
that hadn't been set yet — see GAP-007).

Investigating a live-server outage (same session, prior task) surfaced a real
gap: `scripts/smoke-runtime-workflow.mjs`, `scripts/smoke-api.mjs`, and CI-style
callers authenticate today only via `x-actor-role`, which `dev_headers`
accepts and `google` rejects outright (`validateAuthConfig()` throws on
`AUTH_MODE=dev_headers` in production). Once Google auth is actually turned on
in production, none of the existing automation could talk to the API at all.

User confirmed the shape: add token auth as a second strategy alongside
Google, not a replacement — for scripts/service callers, not humans clicking
through a browser. `integrations/bitrix24` was explicitly called out as
out of scope (provisioned space, not active dev) and left untouched
(`@Public()`, unauthenticated, as before).

## Decision

Added `AUTH_SERVICE_TOKENS="name:token:role,..."` as a bearer-token strategy
checked in `AuthGuard` **before** the `AUTH_MODE`-specific branch, so it works
identically regardless of whether the server is running `dev_headers` or
`google`. Role is resolved only from this server-side config — never from a
client header — so a caller can't escalate itself by sending
`x-actor-role: admin` alongside a lower-privileged token (verified live, see
Testing).

An unrecognized bearer token is rejected outright (401) rather than silently
falling through to `dev_headers`/`google` — a caller that explicitly presents
a credential should get a clear failure on that credential, not a confusing
fallback path.

## Changes

- `apps/api/src/modules/auth/service-token-resolver.ts` (new) — parses
  `AUTH_SERVICE_TOKENS`, validates format and role, fails fast on either.
- `apps/api/src/modules/auth/auth.types.ts` — `AuthProvider` gains
  `"service_token"`.
- `apps/api/src/common/actor.ts` — exported `singleHeader` (was private) for
  reuse in the guard.
- `apps/api/src/modules/auth/auth.guard.ts` — checks `Authorization: Bearer`
  first; on match, sets `request.actor` with role from server config and
  id/name from `x-actor-id`/`x-actor-name` headers (cosmetic/audit only, not
  privilege-bearing).
- `apps/api/src/main.ts` — parses `AUTH_SERVICE_TOKENS` at bootstrap (fail
  fast on malformed config, not on first request); logs configured token
  names + roles at startup, never the token values; added a Swagger
  `bearerAuth` scheme for discoverability.
- `.env.example`, `.env.server.example` — documented `AUTH_SERVICE_TOKENS`.
  Also fixed a stale/actively-misleading comment in `.env.server.example`
  ("Set to dev_headers for seeding/smoke scripts") — `NODE_ENV=production` is
  set in that file, so `AUTH_MODE=dev_headers` would hard-crash startup per
  `validateAuthConfig()`. Replaced with a pointer to `AUTH_SERVICE_TOKENS`.
- `scripts/smoke-runtime-workflow.mjs`, `scripts/smoke-api.mjs` — prefer a
  `SERVICE_TOKEN_<ROLE>` / `SERVICE_TOKEN` env var (sends `Authorization:
  Bearer`) over `x-actor-role` when set; unchanged default behavior otherwise.
- `tests/service-token-resolver.test.mjs` (new) — parsing/validation unit
  tests (8 cases: empty, single, multi-entry, whitespace tolerance, malformed
  entry, invalid role, trailing-comma tolerance).
- `tests/auth-guard-dual-mode.test.mjs` (new) — proves service tokens are
  additive, not exclusive: under `AUTH_MODE=google`, a valid service token
  authenticates without ever calling `SessionService.validateSession`, and a
  request with no bearer token still validates via the real Google session
  cookie path (mocked) — both paths live on the same running instance. Same
  pair of checks for `AUTH_MODE=dev_headers`. Plus: an unrecognized bearer
  token is rejected even when a valid session cookie is also present on the
  same request, and a spoofed `x-actor-role` header alongside a
  lower-privileged token does not escalate role. Instantiates `AuthGuard`
  directly with a fake `Reflector`/mock `SessionService` — no Nest DI
  container or database needed.

## Testing

- `npm run typecheck` — clean.
- `npm test` — 752 tests, 747 pass, 5 fail (same pre-existing discovery
  workflow-status-default failures documented in `README.md`; baseline was
  738/5 before this task's 14 new tests — 8 resolver-parsing + 6 guard
  dual-mode).
- Live verification against a local API instance (`AUTH_MODE=dev_headers` +
  `AUTH_SERVICE_TOKENS` set, disposable Postgres container, torn down after):
  - Valid bearer token → 200, request succeeds.
  - Unknown bearer token → 401 `{"code":"AUTH_REQUIRED"}`.
  - No `Authorization` header at all → falls through to existing
    `dev_headers` behavior unaffected.
  - Created an intake via a bearer token mapped to `admin`; audit trail
    recorded `createdBy: {"id":"service:smoke-verify","role":"admin",
    "displayName":"My Script"}` — role from server config, display name from
    the `x-actor-name` header.
  - Second token mapped to `request_creator`, request also sent
    `x-actor-role: admin` — resulting actor role was still `request_creator`,
    confirming the header cannot escalate privilege.
  - Startup log confirmed: `[Auth] Service tokens configured:
    smoke-verify(admin), low-priv(request_creator)` — no token values logged.

## Not Changed

- `integrations/bitrix24` — left `@Public()`/unauthenticated per explicit
  user instruction (not active dev, provisioned space only).
- `/auth/me` — remains cookie/session-only by design (browser login-status
  check); does not reflect service-token identity. Not a gap — service
  callers know their own identity and don't need this endpoint.
- Google OAuth activation itself — still blocked on real
  `AUTH_GOOGLE_CLIENT_ID`/`AUTH_GOOGLE_CLIENT_SECRET` (GAP-007, unchanged).

## Follow-ups

- If this ever needs to serve external/multi-tenant callers rather than a
  handful of internal scripts, static tokens should be replaced with
  short-lived signed tokens — flagged as a tradeoff when proposed, not a
  surprise later.
- `AUTH_SERVICE_TOKENS` is not yet set on oreochiserver — no server-side
  action taken as part of this task (local-only verification). Generating
  and setting real tokens in `.env.server` is an operator action.
