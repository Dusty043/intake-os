# TASK-0044 — Service Tokens Provisioned

**Date:** 2026-07-02
**Status:** implemented

## Context

TASK-0042 built `AUTH_SERVICE_TOKENS` support but explicitly left provisioning
real tokens on the production deployment as a follow-up operator action. User
asked to move to token generation, one per canonical role.

## Decision

Generated one token per `UserRole` (`request_creator`, `intake_owner`,
`devops_lead`, `developer`, `admin`) via `openssl rand -hex 32` (32 bytes,
64 hex chars each). Named `svc-<role>` for audit attribution
(`createdBy.id` shows as `service:svc-<role>`). Added a single
`AUTH_SERVICE_TOKENS=...` line to the production environment configuration
and delivered the token values to the user directly — never committed to the
repo or written to any log file, per the "never log secrets" rule.

## Discovered mid-task: deployment was running a stale build

Restarting the API after adding the env var produced no
`[Auth] Service tokens configured` log line — the running deployment
predated the PRs that introduced the bearer-token code, so it didn't exist in
that build at all. Confirmed via user go-ahead before pulling latest `main`
and rebuilding — this is exactly the "changing production deployment config"
category `CLAUDE.md` gates on human confirmation.

## Steps (summary)

1. Generated 5 tokens, added `AUTH_SERVICE_TOKENS` to the production
   environment configuration.
2. Rebuilt the API service from latest `main` (brought in the missing PRs).
3. Confirmed the database migration baseline was unaffected — no new
   migrations, same set already baselined in TASK-0041.
4. Verified via startup log: `[Auth] Service tokens configured:
   svc-request-creator(request_creator), svc-intake-owner(intake_owner),
   svc-devops-lead(devops_lead), svc-developer(developer),
   svc-admin(admin)` — names and roles only, no token values logged.
5. Verified live through the deployed API:
   - Valid `svc-admin` token → `200`.
   - Invalid/unrecognized token → `401 {"code":"AUTH_REQUIRED"}`.
   - Valid `svc-request-creator` token → `200`, distinct identity from admin.
6. Confirmed no disruption: zero restarts beyond the single container
   recreate, existing data unchanged.

## Not Changed

- No application code — this task was entirely operational (secret
  generation + deploy).
- `AUTH_MODE` on the deployment remains `dev_headers` (unchanged) — service
  tokens work under either mode by design (TASK-0042), so this didn't
  require or trigger a Google OAuth activation.

## Follow-ups

- Token values were handed to the user directly in chat, not stored
  anywhere else by this agent. It's on the user to store them in a secrets
  manager/password manager and configure whichever scripts/CI need them
  (`SERVICE_TOKEN_REQUEST_CREATOR` / `SERVICE_TOKEN_INTAKE_OWNER` /
  `SERVICE_TOKEN_DEVOPS_LEAD` for `smoke-runtime-workflow.mjs`,
  `SERVICE_TOKEN` for `smoke-api.mjs`).
- If a token is ever suspected leaked, rotate by editing
  `AUTH_SERVICE_TOKENS` in the production environment configuration and
  restarting the API — no code change needed, no migration involved.
