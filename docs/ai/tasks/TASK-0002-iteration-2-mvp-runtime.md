# TASK-0002 — Iteration 2 MVP Runtime Foundation

## Goal

Add the first no-AI runtime layer around the domain foundation so a POC can create an intake, move it through discovery and approval, generate a dry-run provisioning plan, and inspect an audit trail.

## Scope Completed

- Added `src/application` workflow service layer.
- Added in-memory project intake store implementing persistence contracts.
- Added durable audit trail append/list behavior.
- Added dry-run provisioning plan generator.
- Added Bitrix24 payload normalization seam.
- Added NestJS-ready `apps/api` composition root and controller shell.
- Added Postgres-oriented Prisma schema draft.
- Added Docker Compose and API Dockerfile baseline.
- Added MVP demo script.
- Added tests for full lifecycle, permission failures, invalid provisioning plans, and Bitrix24 normalization.

## Out of Scope

- AI evaluation layer.
- Live GitHub/Monday/Bitrix24 writes.
- Real NestJS package installation and decorators.
- Real Postgres persistence adapter.
- SSO/RBAC.
- Queue workers and integration retry policy.

## Commands Run

```bash
npm run typecheck
npm test
npm run demo:mvp
```

## Result

Iteration 2 POC foundation is implemented and verified locally with 24 passing tests.
