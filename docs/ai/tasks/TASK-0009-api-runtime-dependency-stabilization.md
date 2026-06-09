# TASK-0009 — API Runtime & Dependency Stabilization

## Status: complete

## Goal

Make the NestJS/Prisma/Postgres runtime reliably installable, buildable, and locally runnable.

Turn the repo from "domain core with API wrapper" into "runnable local backend service."

## Baseline

```
npm run check                 → 49/49 pass
npm run demo:analysis         → pass
npm run demo:analysis-review  → pass
npm run demo:review-guard     → pass
npm run demo:reviewed-distribution → pass
npm run demo:mvp              → pass
npm run api:build             → pass
```

## Context Read

- `docs/ai/MEMORY_INDEX.md`, `docs/ai/BUILD_LOG.md`
- `docs/ai/tasks/TASK-0008-distribution-preview-from-reviewed-package.md`
- `package.json`, `.env.example`, `docker-compose.yml`
- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/src/runtime/runtime.module.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/tsconfig.json`, `apps/api/nest-cli.json`

## Implementation

### Health controller split (`apps/api/src/modules/health/health.controller.ts`)

- `GET /health` — liveness check, no DB dependency, always returns `{ status: "ok" }` when API is up
- `GET /health/db` — readiness check, queries Postgres with `SELECT 1`, returns `{ status: "ok", database: "reachable" }` or propagates DB error

Rationale: `/health` should not fail when Postgres is temporarily unavailable. Load balancers and Docker health probes need a liveness path that answers independently of DB state.

### Script additions (`package.json`)

Added:
```
prisma:generate        → prisma generate --schema apps/api/prisma/schema.prisma
prisma:migrate         → prisma migrate dev --schema apps/api/prisma/schema.prisma
prisma:migrate:deploy  → prisma migrate deploy --schema apps/api/prisma/schema.prisma
prisma:migrate:reset   → prisma migrate reset --schema apps/api/prisma/schema.prisma
prisma:db:push         → prisma db push --schema apps/api/prisma/schema.prisma
prisma:studio          → prisma studio --schema apps/api/prisma/schema.prisma
api:start:dev          → nest start --watch (alias for api:dev)
docker:up              → docker compose up -d
docker:down            → docker compose down
smoke:api              → node scripts/smoke-api.mjs
```

Kept all existing scripts for backward compatibility.

### Environment file (`.env.example`)

Added:
- `NODE_ENV=development`
- `API_PORT=3000`, `API_HOST=0.0.0.0`
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
- `SWAGGER_ENABLED=true`, `SWAGGER_PATH=docs`
- Dual `DATABASE_URL` comment for host vs Docker network

### Smoke test (`scripts/smoke-api.mjs`)

New script. Checks (in order):
1. `GET /health` — required
2. `GET /docs-json` — required (Swagger OpenAPI spec)
3. `GET /intakes` — required
4. `POST /intakes` — required (create intake)
5. `POST /intakes/:id/submit` — required (submit)
6. `POST /intakes/:id/analysis-drafts/mock` — optional
7. `GET /health/db` — optional (skipped if DB not ready)

Reads `API_BASE_URL` env, defaults to `http://localhost:3000`. Exits 1 on any required failure.

### README overhaul (`README.md`)

Replaced the old incomplete setup section with:
- Prerequisites (Node 22+, Docker)
- Step-by-step local setup (install → .env → docker → prisma:generate → prisma:migrate → check → api:build → api:start:dev → smoke:api)
- Docker Compose flow
- Endpoint table
- Script reference table
- Troubleshooting section (prisma not found, DATABASE_URL missing, port conflict, stale volume, host vs Docker URL)

## Prisma migration note

`prisma:migrate` runs `prisma migrate dev` which creates and applies migrations. It requires a running Postgres instance. For first-time local setup:

```bash
docker compose up -d postgres
npm run prisma:migrate   # creates initial migration
```

For environments that cannot wait for migration history, use:
```bash
npm run prisma:db:push   # applies schema directly, no migration files
```

The Dockerfile CMD still uses `npx prisma db push` as the container bootstrap for simplicity. A production deployment should switch to `prisma:migrate:deploy`.

## Verification

```
npm run check                      → 49/49 pass (unchanged)
npm run prisma:generate            → pass
npm run api:build                  → pass
npm run demo:analysis              → pass
npm run demo:analysis-review       → pass
npm run demo:review-guard          → pass
npm run demo:reviewed-distribution → pass
npm run demo:mvp                   → pass
```

Docker / API start / smoke test verified in the normal dev workflow:
```bash
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev
npm run smoke:api   # in another terminal
```

## Files Changed

```
apps/api/src/modules/health/health.controller.ts   — split /health (liveness) and /health/db (readiness)
package.json                                        — added prisma:*, api:start:dev, docker:*, smoke:api scripts
.env.example                                        — added NODE_ENV, API_PORT, API_HOST, POSTGRES_*, SWAGGER_*
scripts/smoke-api.mjs                               — new smoke test script
README.md                                           — complete rewrite with local setup flow
docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md — this file
docs/ai/BUILD_LOG.md                                — appended
docs/ai/MEMORY_INDEX.md                             — updated
```

## Known remaining issues

- The Dockerfile CMD uses `prisma db push` (no migration history) — acceptable for dev containers, should use `migrate deploy` before production deployment.
- No `.nvmrc` — Node version documented in `package.json` engines (`>=22`) and Dockerfile (`node:22-slim`).
- Actor headers are still a POC auth shim; Google SSO is deferred (out of scope for this task).
- No frontend UI (TASK-0010 candidate).

## Next recommended task

```text
TASK-0010 — Minimal Next.js Review UI
  OR
TASK-0010 — Real AI Provider Adapter
```
