# Local Runtime and Deployment Posture

## Decision

The POC stays portable before committing to Vercel or deeper AWS infrastructure.

Current target shape:

```text
apps/api       Dockerized NestJS modular monolith
Postgres       canonical system database
Prisma         persistence adapter and schema management
Swagger        temporary operator/demo UI
Next.js later  separate internal dashboard
```

## Local core verification

These commands verify the core workflow without external dependencies:

```bash
npm run check
npm run demo:mvp
```

## API dependency installation

When npm package installation is available:

```bash
npm install
npm run api:prisma:generate
npm run api:db:push
npm run api:build
```

## Docker Compose runtime

Start local Postgres + API:

```bash
npm run api:docker:up
```

Stop containers:

```bash
npm run api:docker:down
```

The compose stack defines:

```text
postgres  local Postgres 16
api       Node 22 NestJS API container
```

The API container runs:

```bash
npx prisma db push --schema apps/api/prisma/schema.prisma
node dist/apps/api/src/main.js
```

This is acceptable for the POC. A production-grade deployment should replace `db push` with reviewed Prisma migrations.

## URLs

```text
API health: http://localhost:3000/health
Swagger:    http://localhost:3000/docs
Postgres:   localhost:5432
```

## Environment contract

```text
DATABASE_URL=postgresql://intake_os:intake_os_dev@localhost:5432/intake_os?schema=public
NODE_ENV=development
PORT=3000
AI_LAYER_ENABLED=false
LIVE_PROVISIONING_ENABLED=false
```

Future integration variables remain disabled until live provisioning is explicitly approved:

```text
GITHUB_TOKEN=
MONDAY_API_TOKEN=
BITRIX24_WEBHOOK_URL=
```

## POC actor headers

The API does not include SSO yet. Use headers to simulate the actor:

```text
x-actor-id: user-devops
x-actor-role: devops_lead
x-actor-name: DevOps Lead
```

Missing headers default to `request_creator`, which intentionally cannot complete discovery, approve, or mark provisioning ready.

## Hosting stance

The API should be deployable to simple container hosting first and AWS/ECS later if internal access, secrets, networking, and integration needs justify it.

Vercel remains a good candidate for the future Next.js UI, not the initial home of the workflow engine.
