# TASK-0009 — API Runtime & Dependency Stabilization

## Status

Planned

## Purpose

The Project Intake OS backend governance spine is now complete in the framework-neutral application/runtime path.

Current verified model:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ Distribution preview uses ReviewedProjectPackage
→ System distributes later
```

Current verification after TASK-0008:

```bash
npm run check
# 49/49 passing

npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
# all passing
```

The next step is to make the NestJS/Prisma/Postgres runtime reliably installable, buildable, and runnable.

TASK-0009 turns the repo from:

```text
domain/application core with API wrapper
```

into:

```text
runnable local backend service
```

This task should stabilize:

```text
dependency installation
package lock
Prisma generation
Prisma migrations
NestJS API build
Docker Compose runtime
Postgres connectivity
Swagger availability
health checks
basic API smoke tests
developer onboarding commands
```

---

# Product/Engineering Goal

After TASK-0009, a developer or agent should be able to clone the repo and run:

```bash
npm install
npm run check
npm run api:build
docker compose up
```

Then confirm:

```text
Postgres is running
NestJS API is running
Prisma can connect
Swagger is available
health endpoint works
basic intake endpoints work
```

This task is about **runtime confidence**, not new product features.

---

# Current State

The application core is trusted through:

```text
src/domain/
src/application/
tests/
scripts/
```

The NestJS API wrapper exists under:

```text
apps/api/
```

The Prisma schema exists under:

```text
apps/api/prisma/schema.prisma
```

Known historical issue:

```bash
npm run api:build
```

has previously failed in clean/unpacked environments because Prisma CLI/dependencies were not installed.

Example failure:

```text
prisma: not found
```

TASK-0009 should resolve this by making dependencies, scripts, generated client behavior, and local runtime expectations explicit and repeatable.

---

# Non-Negotiable Rules

1. Do not change the governance/product behavior implemented in TASK-0005 through TASK-0008.
2. Do not introduce n8n.
3. Do not implement live AI provider integration.
4. Do not implement live Monday API writes.
5. Do not implement live GitHub provisioning.
6. Do not implement frontend UI.
7. Do not implement Google SSO.
8. Do not weaken tests to make runtime pass.
9. Do not remove the in-memory runtime or demos.
10. Keep the domain/application layer framework-neutral.
11. API/NestJS should wrap the application layer, not absorb business logic.
12. Document every setup/runtime decision.

---

# Target Outcome

TASK-0009 is complete when the repo supports this local development loop:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run check
npm run api:build
docker compose up
```

And verifies:

```text
API starts successfully
Postgres starts successfully
Prisma connects successfully
health endpoint returns OK
Swagger/OpenAPI is visible
core intake endpoints are smoke-testable
existing 49 tests still pass
all existing demos still pass
```

---

# Scope

## In Scope

### Dependency stabilization

* Add or update `package-lock.json`.
* Ensure required runtime/build dependencies are present.
* Ensure Prisma CLI is available through npm scripts.
* Ensure NestJS build dependencies are installed and correctly referenced.
* Ensure Node/package manager version expectations are documented.

### Script stabilization

Review and stabilize root `package.json` scripts.

Expected script categories:

```json
{
  "scripts": {
    "check": "...",
    "demo:mvp": "...",
    "demo:analysis": "...",
    "demo:analysis-review": "...",
    "demo:review-guard": "...",
    "demo:reviewed-distribution": "...",
    "api:build": "...",
    "api:start": "...",
    "api:start:dev": "...",
    "prisma:generate": "...",
    "prisma:migrate": "...",
    "prisma:studio": "...",
    "docker:up": "...",
    "docker:down": "...",
    "smoke:api": "..."
  }
}
```

Exact names can differ, but the final README/docs must explain the real commands.

### Docker Compose stabilization

Ensure Docker Compose can run at least:

```text
Postgres
NestJS API
```

Optional but acceptable:

```text
Prisma migration/init container
```

Do not add unnecessary infrastructure like Redis unless the current runtime needs it.

### Prisma stabilization

* Ensure `prisma generate` works.
* Ensure schema path is correct.
* Ensure generated Prisma client imports resolve.
* Ensure local migrations are either present or a clear migration command is documented.
* Ensure `DATABASE_URL` is defined in `.env.example`.
* Ensure Prisma store can round-trip current application record fields.

### API build stabilization

* Ensure NestJS app compiles.
* Ensure controller DTOs compile.
* Ensure imports from `src/application` resolve correctly.
* Ensure Prisma persistence adapter compiles.
* Ensure Swagger setup compiles.
* Ensure no application-layer behavior is duplicated inside controllers.

### Health and smoke testing

Add or verify:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

or similar.

Add an API smoke test script or documented curl sequence.

Recommended script:

```bash
npm run smoke:api
```

It should verify at minimum:

```text
API responds
health endpoint works
Swagger endpoint responds
intake list endpoint responds
```

If practical, also test:

```text
create intake
submit intake
generate mock analysis draft
```

### Documentation

Update:

```text
README.md
.env.example
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md
```

Optional but recommended:

```text
docs/development/local-runtime.md
docs/development/api-smoke-tests.md
```

---

# Out of Scope

Do not implement:

```text
Next.js frontend
real AI provider calls
OpenAI/Claude integration
Monday live item creation
GitHub live repo creation
Google SSO
Google Chat app
email ingestion
AWS deployment
production CI/CD
Redis/queue workers
n8n
```

This task is about making the backend runtime reliable.

---

# Runtime Architecture Target

The target runtime shape is:

```text
Developer machine
    ↓
docker compose up
    ↓
Postgres container
NestJS API process/container
    ↓
Prisma client
    ↓
Project Intake OS application services
```

The architecture boundary remains:

```text
NestJS controller
    ↓
Application service
    ↓
ProjectIntakeStore interface
    ↓
PrismaProjectIntakeStore
    ↓
Postgres
```

The in-memory path remains:

```text
Tests/demos
    ↓
Application service
    ↓
InMemoryProjectIntakeStore
```

Do not collapse these boundaries.

---

# Recommended File Touch List

Likely files:

```text
package.json
package-lock.json
.env.example
docker-compose.yml
README.md
apps/api/package.json
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/modules/health/health.controller.ts
apps/api/src/modules/intake/intake.controller.ts
apps/api/src/persistence/prisma-project-intake-store.ts
apps/api/prisma/schema.prisma
scripts/smoke-api.mjs
docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Possible files:

```text
tsconfig.json
apps/api/tsconfig.json
apps/api/tsconfig.build.json
apps/api/src/prisma/prisma.service.ts
apps/api/prisma/migrations/*
docs/development/local-runtime.md
docs/development/api-smoke-tests.md
```

---

# Dependency Requirements

## Node version

Choose and document a supported Node version.

Recommended:

```text
Node.js 20 LTS or newer
```

Add one or more of:

```text
.nvmrc
.node-version
package.json engines
```

Suggested:

```json
{
  "engines": {
    "node": ">=20 <23",
    "npm": ">=10"
  }
}
```

Do not use unstable/nightly Node as the default.

---

## Package manager

Use npm unless the repo is already clearly set up for another package manager.

Expected outputs:

```text
package-lock.json committed
npm install works
npm ci works after lockfile exists
```

Do not introduce pnpm/yarn unless there is a strong reason.

---

## Prisma dependencies

Ensure these are correctly installed where scripts expect them:

```text
prisma
@prisma/client
```

`prisma` should normally be a dev dependency.

`@prisma/client` should normally be a runtime dependency.

Verify:

```bash
npm run prisma:generate
```

---

## NestJS dependencies

Ensure build/runtime dependencies are present, such as:

```text
@nestjs/common
@nestjs/core
@nestjs/platform-express
@nestjs/swagger
reflect-metadata
rxjs
class-validator
class-transformer
```

Ensure dev/build dependencies are present, such as:

```text
@nestjs/cli
@nestjs/testing
typescript
ts-node
ts-node-dev or tsx if used
```

Use the actual project conventions.

---

# Environment Variables

Create or update:

```text
.env.example
```

Minimum recommended values:

```dotenv
NODE_ENV=development

API_PORT=3000
API_HOST=0.0.0.0

DATABASE_URL=postgresql://intake_os:intake_os_password@localhost:5432/intake_os?schema=public

POSTGRES_USER=intake_os
POSTGRES_PASSWORD=intake_os_password
POSTGRES_DB=intake_os
POSTGRES_PORT=5432

SWAGGER_ENABLED=true
SWAGGER_PATH=docs
```

If Docker uses different hostnames internally, document both:

```text
Local host DATABASE_URL
Container DATABASE_URL
```

Example:

```dotenv
# For running API on host machine:
DATABASE_URL=postgresql://intake_os:intake_os_password@localhost:5432/intake_os?schema=public

# For running API inside Docker network:
# DATABASE_URL=postgresql://intake_os:intake_os_password@postgres:5432/intake_os?schema=public
```

Do not include real secrets.

---

# Docker Compose Requirements

The Compose setup should include Postgres.

Recommended service:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: intake_os
      POSTGRES_PASSWORD: intake_os_password
      POSTGRES_DB: intake_os
    ports:
      - "5432:5432"
    volumes:
      - intake_os_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U intake_os -d intake_os"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  intake_os_postgres_data:
```

If including the API service, ensure:

```text
API waits for Postgres health
DATABASE_URL uses postgres hostname
Prisma generate/migrate behavior is clear
ports expose API locally
```

Recommended API port:

```text
3000
```

Do not overcomplicate Compose with production concerns.

---

# Prisma Requirements

## Generate

This must work:

```bash
npm run prisma:generate
```

It should resolve to something like:

```bash
prisma generate --schema apps/api/prisma/schema.prisma
```

## Migrate

Add a clear command:

```bash
npm run prisma:migrate
```

For local dev, this may run:

```bash
prisma migrate dev --schema apps/api/prisma/schema.prisma
```

If the project intentionally avoids migrations for now and uses `db push`, document why.

Preferred:

```text
Use migrations if schema is stable enough.
Use db push only as temporary bootstrap if needed.
```

## Studio

Optional but useful:

```bash
npm run prisma:studio
```

---

# API Requirements

## Build

This must pass:

```bash
npm run api:build
```

The command should compile the NestJS API.

Expected:

```text
no TypeScript errors
no unresolved imports
no missing Prisma client
no missing DTO imports
```

## Start

Provide a dev command:

```bash
npm run api:start:dev
```

or:

```bash
npm run api:dev
```

Provide a production-ish start command if build output exists:

```bash
npm run api:start
```

## Swagger

Swagger should be available when the API is running.

Recommended path:

```text
/docs
```

or:

```text
/api/docs
```

Document exact URL:

```text
http://localhost:3000/docs
```

## Health

Add or verify:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

Optional database-aware endpoint:

```http
GET /health/db
```

If database-aware health is added, it should verify Prisma can query Postgres.

Do not make basic `/health` fail just because DB is not ready unless that is the intended behavior.

---

# API Smoke Test Requirements

Add:

```text
scripts/smoke-api.mjs
```

Package script:

```json
{
  "scripts": {
    "smoke:api": "node scripts/smoke-api.mjs"
  }
}
```

Recommended smoke behavior:

```text
1. Read API_BASE_URL from env, default http://localhost:3000.
2. GET /health.
3. GET Swagger docs endpoint or OpenAPI JSON endpoint.
4. GET /intakes.
5. Optionally POST /intakes with a sample payload.
6. Optionally submit generated intake.
7. Print clear pass/fail output.
```

The script should fail with non-zero exit code if required checks fail.

Do not require external APIs.

Do not require AI keys.

Do not require Monday/GitHub credentials.

---

# Application Behavior Preservation

All existing behavior must remain unchanged.

Run:

```bash
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Expected:

```text
49/49 tests passing
all demos passing
```

If adding smoke tests increases the test count, update expected count in docs/logs.

---

# API Endpoint Compatibility

Verify the NestJS API exposes the current core use cases.

Expected endpoints, based on current project shape:

```http
GET  /intakes
GET  /intakes/:id

POST /intakes
POST /intakes/:id/submit

POST /intakes/:id/discovery
POST /intakes/:id/analysis-drafts/mock
POST /intakes/:id/analysis-drafts/:draftId/accept
POST /intakes/:id/analysis-drafts/:draftId/reject
POST /intakes/:id/analysis-drafts/:draftId/revise

POST /intakes/:id/approvals
POST /intakes/:id/rejections

POST /intakes/:id/provisioning-plan
POST /intakes/:id/provisioning-ready

GET  /intakes/:id/audit
```

If actual route names differ, document the actual routes.

Actor headers remain the auth shim:

```text
x-actor-id
x-actor-role
x-actor-name
```

Do not implement Google SSO in this task.

---

# Persistence Verification

The Prisma-backed store should preserve the fields introduced in recent tasks:

```text
analysisDrafts
latestAnalysisDraft
reviewedProjectPackage
provisioningPlan.source
provisioningPlan.actions
audit metadata sourceType/sourceId
```

At minimum, verify round-trip behavior for:

```text
create intake
generate analysis draft
accept/revise draft
approve gates
generate provisioning plan
read intake back
read audit trail
```

If full API smoke test does not cover all of this, add focused unit/integration coverage where practical.

---

# Error Handling Requirements

Do not let runtime errors leak as confusing stack traces in normal API responses.

At minimum, API errors for known application rule violations should produce clear 4xx responses.

Examples:

```text
missing reviewed package before Gate 1
unreviewed AI-assisted intake before distribution preview
invalid transition
unauthorized actor
missing intake
missing draft
```

This does not need a full global error model if the project does not have one yet, but errors should be understandable during smoke testing.

---

# Logging Requirements

Keep logging simple.

Expected:

```text
API startup log includes port
Swagger path log if enabled
Prisma connection errors are visible
smoke test output is readable
```

Do not add complex logging frameworks unless already present.

---

# Documentation Requirements

## README

Update README with:

```text
Prerequisites
Install
Environment setup
Run tests
Run demos
Run Prisma generate/migrate
Run API locally
Run with Docker Compose
Open Swagger
Run smoke test
Troubleshooting
```

## Troubleshooting section

Include known fixes:

```text
prisma: not found
DATABASE_URL missing
Postgres port already in use
Prisma client not generated
Docker volume stale
API cannot connect to database
```

## AI build logs

Update:

```text
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Add the task file:

```text
docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md
```

---

# Suggested README Command Flow

The README should support this flow:

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.example .env

# 3. Start database
docker compose up -d postgres

# 4. Generate Prisma client
npm run prisma:generate

# 5. Apply schema
npm run prisma:migrate

# 6. Run checks
npm run check

# 7. Build API
npm run api:build

# 8. Start API
npm run api:start:dev

# 9. Smoke test API in another terminal
npm run smoke:api
```

If actual scripts differ, update this flow.

---

# Tests Required

This task may not need many new domain tests, but it should add runtime verification.

Minimum:

## 1. Existing checks remain green

```bash
npm run check
```

Expected:

```text
49/49 passing
```

or updated count if new tests are added.

## 2. API build passes

```bash
npm run api:build
```

Expected:

```text
NestJS API compiles
```

## 3. Prisma generate passes

```bash
npm run prisma:generate
```

Expected:

```text
Prisma client generated
```

## 4. Docker Compose starts Postgres

```bash
docker compose up -d postgres
docker compose ps
```

Expected:

```text
postgres service healthy/running
```

## 5. API starts

```bash
npm run api:start:dev
```

Expected:

```text
API listening on configured port
```

## 6. Smoke test passes

```bash
npm run smoke:api
```

Expected:

```text
health OK
Swagger/OpenAPI OK
intakes endpoint OK
optional create/submit OK
```

---

# Optional Tests

If feasible, add a focused API smoke test that creates a full AI-assisted intake flow through HTTP:

```text
create intake
submit
generate mock analysis draft
accept/revise draft
Gate 1 approve
Gate 2 approve
generate provisioning plan
verify source.type = reviewed_project_package
read audit trail
```

This can be either:

```text
scripts/smoke-api.mjs
```

or:

```text
tests/api-smoke.test.mjs
```

Avoid adding brittle tests that require external services.

---

# Acceptance Criteria

TASK-0009 is complete when:

```text
1. package-lock.json exists and dependency installation is reproducible.
2. npm install works from clean clone.
3. npm run check passes.
4. npm run prisma:generate passes.
5. npm run api:build passes.
6. Docker Compose can start Postgres.
7. API can start locally.
8. Health endpoint responds.
9. Swagger/OpenAPI is available.
10. API smoke test script exists and passes.
11. Prisma-backed API runtime can access Postgres.
12. Existing demos still pass.
13. README explains local runtime setup.
14. .env.example is complete and contains no real secrets.
15. AI build logs and memory index are updated.
16. No new product behavior bypasses governance rules.
```

---

# Recommended Final Verification Command List

Run this final sequence before marking complete:

```bash
npm install
npm run prisma:generate
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
npm run api:build
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev
npm run smoke:api
docker compose down
```

If `api:start:dev` is a long-running command, run `smoke:api` in another terminal.

---

# Expected Final Report

When TASK-0009 is done, report:

```text
Commit hash
Files changed
Dependencies added/updated
Scripts added/updated
Runtime commands verified
Docker Compose status
Prisma status
API build status
Smoke test result
Existing test/demo result
Known remaining issues
```

Example:

```text
TASK-0009 done.

Verification:
- npm install: pass
- npm run prisma:generate: pass
- npm run check: 49/49 pass
- npm run api:build: pass
- docker compose up -d postgres: pass
- npm run prisma:migrate: pass
- npm run api:start:dev: pass
- npm run smoke:api: pass

Known issues:
- API still uses actor headers as auth shim.
- No frontend yet.
- No live AI/Monday/GitHub integrations yet.
```

---

# Agent Execution Prompt

Use this prompt for Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0009: API Runtime & Dependency Stabilization.

Context:
- TASK-0005 through TASK-0008 completed the backend governance spine.
- Current verified behavior is: AI drafts → Human reviews → Workflow approves → Distribution preview uses ReviewedProjectPackage.
- The framework-neutral application core is trusted through tests and demos.
- The remaining issue is runtime readiness: dependencies, Prisma, NestJS API build, Docker Compose, Swagger, health checks, and API smoke testing.
- n8n is intentionally excluded from the architecture.

Implement:
1. Stabilize npm dependencies and commit package-lock.json.
2. Ensure Prisma CLI and @prisma/client are correctly configured.
3. Add/verify prisma:generate and prisma:migrate scripts.
4. Make npm run api:build pass.
5. Make NestJS API start locally.
6. Ensure Docker Compose starts Postgres.
7. Add/verify .env.example.
8. Add/verify health endpoint.
9. Ensure Swagger/OpenAPI is available.
10. Add npm run smoke:api to validate API runtime.
11. Update README with local setup/run instructions.
12. Update task docs and AI build logs.

Do not implement:
- live AI provider integration
- Google SSO
- n8n
- Monday live creation
- GitHub live provisioning
- frontend UI
- AWS deployment
- Redis or queue workers unless already required

Verification:
Run:
npm install
npm run prisma:generate
npm run check
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
npm run api:build
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev
npm run smoke:api
docker compose down

If any command fails, fix the underlying issue if in scope. If failure is environment-specific, document the exact cause and workaround.

Return:
- files changed
- dependencies changed
- scripts added/updated
- verification results
- known remaining issues
- next recommended task
```

---

# Human Dev Notes

TASK-0009 is not about adding product capability.

It is about making the product core runnable.

Do not let this task drift into frontend, AI provider work, Google SSO, Monday, GitHub, or deployment.

The project has a strong domain/application core. Preserve that boundary.

The goal is simple:

```text
A clean clone can install, build, run Postgres, run the NestJS API, open Swagger, and pass smoke tests.
```

Once this is done, the project is ready for either:

```text
TASK-0010 — Minimal Next.js Review UI
```

or:

```text
TASK-0010 — Real AI Provider Adapter
```

depending on whether the next priority is demo UX or model integration.
