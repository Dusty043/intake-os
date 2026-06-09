# TASK-0003 — Dockerized NestJS API with Prisma/Postgres/Swagger

## Goal

Convert the Iteration 2 no-AI MVP foundation into a Dockerized NestJS API backed by Prisma/Postgres and documented with Swagger.

## Scope Completed

- Added real NestJS app bootstrap in `apps/api/src/main.ts`.
- Added Swagger/OpenAPI setup at `/docs`.
- Added health endpoint at `/health`.
- Added HTTP controllers for:
  - intakes
  - discovery
  - approvals/rejections
  - dry-run provisioning plans
  - provisioning-ready marker
  - audit trail
  - Bitrix24 preview/create intake seam
- Added POC actor header handling:
  - `x-actor-id`
  - `x-actor-role`
  - `x-actor-name`
- Added Nest exception filter mapping domain/application errors to HTTP responses.
- Added Prisma-backed `ProjectIntakeStore` adapter.
- Updated Prisma schema with `recordSnapshot` persistence plus queryable top-level intake/audit fields.
- Updated Dockerfile and Docker Compose for API + Postgres.
- Updated API/deployment docs.
- Added `docs/ai/SEQUENCE_LOG.md` with the agreed sequence roadmap.

## Out of Scope

- AI evaluation/agent layer.
- Live GitHub/Monday/Bitrix24 writes.
- SSO/RBAC.
- Queue workers and retry orchestration.
- Production-grade Prisma migration review.
- Next.js dashboard.

## Commands Run

```bash
npm run check
npm run demo:mvp
```

## Result

Core verification still passes with 24 tests. The no-AI lifecycle demo still reaches an approved intake with a ready dry-run provisioning plan.

The NestJS/Prisma API source is implemented, but full API build/runtime verification requires package installation:

```bash
npm install
npm run api:build
npm run api:docker:up
```

Package fetching was unavailable in the execution environment, so those dependency-backed commands were not verified here.
