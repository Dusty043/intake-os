# TASK-0012 — Private Server Runtime Deployment

## Status

Planned

## Goal

Make Project Intake OS run cleanly on a private server without requiring a domain, HTTPS, Google SSO, or public production exposure.

This task creates a repeatable server runtime for:

```text
Postgres
NestJS API
Next.js web UI
local reverse proxy
seeded demo data
runtime smoke tests
backup/restore scripts
healthcheck script
private access through SSH tunnel or Tailscale
```

This is a **server runtime baseline**, not a public production launch.

---

# Current Project State

Completed:

```text
TASK-0005  Mock AI analysis draft                     ✅
TASK-0006  Human review lifecycle                     ✅
TASK-0007  Reviewed package required before Gate 1     ✅
TASK-0008  Distribution preview uses reviewed package  ✅
TASK-0009  API runtime stabilization                   ✅
TASK-0010  Minimal Next.js review UI                  ✅
TASK-0011  Seeded demo data + runtime smoke            ✅
```

The project currently has:

```text
governed backend
stable API runtime
minimal browser UI
demo seed data
full runtime smoke script
```

TASK-0012 moves this from local/dev runtime into a repeatable private server runtime.

---

# Important Server Constraint

The server already has Uptime Kuma running on host port `3001`.

Therefore:

```text
Host port 3001 is reserved for Uptime Kuma.
Project Intake OS must not bind host port 3001.
```

Correct Project Intake OS host port:

```text
127.0.0.1:8080 → Project Intake OS local proxy
```

The Next.js web container may still listen on port `3001` **inside Docker**, but it must not publish `3001` to the host.

Correct:

```yaml
web:
  expose:
    - "3001"
```

Incorrect:

```yaml
web:
  ports:
    - "3001:3001"
```

Final host port allocation:

```text
Host ports:
3001  → Uptime Kuma
8080  → Project Intake OS local proxy
5432  → optional localhost Postgres maintenance only

Docker internal ports:
web:3001
api:3000
postgres:5432
local-proxy:8080
```

---

# Deployment Philosophy

Keep it boring and inspectable.

Correct:

```text
git pull
docker compose build
docker compose up -d
healthcheck passes
seed demo data
runtime smoke passes
open browser privately
```

Incorrect:

```text
public production exposure
domain-first deployment
Kubernetes
Terraform
cloud orchestration
real auth
real AI
live Monday/GitHub writes
```

The server should become a stable private demo/staging box.

---

# Security Context

The app still uses temporary actor headers:

```text
x-actor-id
x-actor-role
x-actor-name
```

Because of that, the app must **not** be openly exposed to the public internet.

Default posture:

```text
localhost-bound services
private access only
SSH tunnel or Tailscale Serve
Tailscale Funnel only as optional temporary demo mode
```

Public exposure is deferred until real auth exists.

---

# Runtime Shape

Target server layout:

```text
server
│
├── postgres
│   └── persistent named volume
│
├── api
│   └── NestJS + Prisma
│
├── web
│   └── Next.js UI
│
├── local-proxy
│   ├── /       → web:3001
│   └── /api/*  → api:3000
│
├── backups/
│
└── deploy scripts
```

The browser should normally access only the proxy.

Server-local proxy URL:

```text
http://127.0.0.1:8080
```

Laptop access through SSH tunnel:

```text
http://localhost:8080
```

---

# Access Modes

## Mode A — SSH Tunnel

Default and safest.

Server binds app/proxy ports to localhost.

From laptop:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Then open:

```text
http://localhost:8080/intakes
```

This requires:

```text
no domain
no HTTPS
no public app ports
```

This is the default verification mode for TASK-0012.

---

## Mode B — Tailscale Serve

Optional private access through tailnet.

Expose only the local proxy:

```text
127.0.0.1:8080
```

Do not expose:

```text
raw API on 3000
raw web on 3001
Postgres on 5432
```

Use this for private access from your own devices.

---

## Mode C — Tailscale Funnel

Optional temporary public demo mode.

Rules:

```text
Funnel must expose only the local proxy.
Funnel must not expose raw API.
Funnel must not expose raw web directly.
Use demo data only.
Use basic auth in the proxy.
Turn Funnel off after demo.
```

Funnel is not a replacement for real app authentication.

---

# Server-First Rule

TASK-0012 should first prove:

```text
Docker stack works on server
proxy works on server
seed script works on server
runtime smoke works on server
browser access works through SSH tunnel
```

Only after that should Tailscale Serve/Funnel be tested.

Do not jump straight to Funnel.

---

# Files to Add

```text
Dockerfile.api
Dockerfile.web
docker-compose.server.yml
.env.server.example

deploy/
  Caddyfile.server
  deploy-server.sh
  healthcheck-server.sh
  backup-postgres.sh
  restore-postgres.sh
  tailscale-serve-notes.md
  tailscale-funnel-notes.md

docs/deployment/
  private-server-runtime.md

docs/ai/tasks/
  TASK-0012-private-server-runtime-deployment.md
```

Files to modify:

```text
package.json
README.md
.gitignore
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

---

# Environment File

Add:

```text
.env.server.example
```

Suggested contents:

```dotenv
NODE_ENV=production

# API
API_HOST=0.0.0.0
API_PORT=3000

# Web
# Internal container port only.
# Do not publish host port 3001 because Uptime Kuma already uses it.
WEB_PORT=3001

# Local proxy
# Host access should go through 127.0.0.1:8080.
PROXY_PORT=8080

# Browser-facing API path.
# In server/proxy mode, the browser calls the API through /api.
NEXT_PUBLIC_API_BASE_URL=/api

# Swagger
# Keep true for private demos.
# Disable before any real public deployment.
SWAGGER_ENABLED=true
SWAGGER_PATH=docs

# Postgres
POSTGRES_USER=intake_os
POSTGRES_PASSWORD=change_me_server_password
POSTGRES_DB=intake_os
POSTGRES_PORT=5432

# API container talks to Postgres by Docker service name.
DATABASE_URL=postgresql://intake_os:change_me_server_password@postgres:5432/intake_os?schema=public
```

Important:

```text
NEXT_PUBLIC_API_BASE_URL is baked into the Next.js build.
If this value changes, rebuild the web image.
```

For the server/proxy setup, use:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api
```

Do not use this for server proxy mode:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

That value is only suitable for local dev or SSH tunneling raw API/web separately.

---

# API Dockerfile

Add:

```text
Dockerfile.api
```

Requirements:

```text
install dependencies
generate Prisma client
build API
include Prisma schema/migrations
include scripts for seed/smoke
run migrations on container startup or deploy
start compiled NestJS API
```

Suggested shape:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run api:build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/scripts ./scripts

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:migrate:deploy && npm run api:start"]
```

Adjust command names if the actual package scripts differ.

The API image must support these commands inside the container:

```bash
npm run seed:demo
npm run smoke:runtime
```

---

# Web Dockerfile

Add:

```text
Dockerfile.web
```

Requirements:

```text
build Next.js app
receive NEXT_PUBLIC_API_BASE_URL at build time
serve production web app on internal container port 3001
do not publish host port 3001
```

Suggested shape:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run web:build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.* ./apps/web/

EXPOSE 3001

CMD ["npm", "run", "web:start"]
```

If the project uses Next standalone output, a smaller image is fine, but not required for this task.

---

# Local Proxy

Add:

```text
deploy/Caddyfile.server
```

Purpose:

```text
single local entrypoint
/api routes to API
everything else routes to web
avoids host port 3001 conflict with Uptime Kuma
gives SSH/Tailscale/Funnel one clean target
```

Initial Caddyfile:

```caddyfile
:8080 {
  handle_path /api/* {
    reverse_proxy api:3000
  }

  handle {
    reverse_proxy web:3001
  }
}
```

For Funnel/demo mode, use basic auth:

```caddyfile
:8080 {
  basicauth {
    demo REPLACE_WITH_HASHED_PASSWORD
  }

  handle_path /api/* {
    reverse_proxy api:3000
  }

  handle {
    reverse_proxy web:3001
  }
}
```

Generate password hash:

```bash
docker run --rm caddy:2 caddy hash-password --plaintext 'change-this-password'
```

Do not commit real demo passwords.

Recommended pattern:

```text
deploy/Caddyfile.server          default private/local proxy, no basic auth
deploy/Caddyfile.funnel.example  example with basic auth for Funnel mode
```

If only one Caddyfile is used, keep basic auth commented/documented rather than committing real credentials.

---

# Server Compose

Add:

```text
docker-compose.server.yml
```

Recommended default:

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    env_file:
      - .env.server
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    volumes:
      - intake_os_postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    restart: unless-stopped
    env_file:
      - .env.server
    depends_on:
      postgres:
        condition: service_healthy
    expose:
      - "3000"

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
      args:
        NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
    restart: unless-stopped
    env_file:
      - .env.server
    depends_on:
      - api
    expose:
      - "3001"

  local-proxy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "127.0.0.1:${PROXY_PORT:-8080}:8080"
    volumes:
      - ./deploy/Caddyfile.server:/etc/caddy/Caddyfile:ro
    depends_on:
      - api
      - web

volumes:
  intake_os_postgres_data:
```

Important:

```text
Only local-proxy is bound to the host by default.
It binds to 127.0.0.1:8080.
API and web are only available inside Docker network.
Postgres is bound to 127.0.0.1 only for local/server maintenance.
Host port 3001 is never used by Project Intake OS.
```

Do not bind web/API publicly by default.

---

# Package Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "server:build": "docker compose -f docker-compose.server.yml --env-file .env.server build",
    "server:up": "docker compose -f docker-compose.server.yml --env-file .env.server up -d",
    "server:down": "docker compose -f docker-compose.server.yml --env-file .env.server down",
    "server:ps": "docker compose -f docker-compose.server.yml --env-file .env.server ps",
    "server:logs": "docker compose -f docker-compose.server.yml --env-file .env.server logs -f",
    "server:health": "bash deploy/healthcheck-server.sh",
    "server:deploy": "bash deploy/deploy-server.sh",
    "server:backup": "bash deploy/backup-postgres.sh"
  }
}
```

Only add scripts that work with the current project scripts.

If the server does not have Node/npm installed, the README should also include Docker-native equivalents.

---

# Deploy Script

Add:

```text
deploy/deploy-server.sh
```

Suggested:

```bash
#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ ! -f .env.server ]; then
  echo ".env.server not found. Copy .env.server.example first."
  exit 1
fi

echo "Pulling latest code..."
git pull origin main

echo "Building server images..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server build

echo "Starting server stack..."
docker compose -f "$COMPOSE_FILE" --env-file .env.server up -d

echo "Stack status:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server ps

echo "Recent API logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 api

echo "Recent web logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 web

echo "Recent proxy logs:"
docker compose -f "$COMPOSE_FILE" --env-file .env.server logs --tail=80 local-proxy
```

Make executable:

```bash
chmod +x deploy/deploy-server.sh
```

---

# Healthcheck Script

Add:

```text
deploy/healthcheck-server.sh
```

Suggested:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "Checking web through proxy..."
curl -fsS "$BASE_URL" > /dev/null
echo "Web OK"

echo "Checking API liveness through proxy..."
curl -fsS "$BASE_URL/api/health"
echo

echo "Checking API database readiness through proxy..."
curl -fsS "$BASE_URL/api/health/db"
echo

echo "Checking OpenAPI through proxy if enabled..."
if curl -fsS "$BASE_URL/api/docs-json" > /dev/null; then
  echo "OpenAPI OK"
else
  echo "OpenAPI unavailable or disabled"
fi
```

Make executable:

```bash
chmod +x deploy/healthcheck-server.sh
```

Healthcheck should use the proxy, not raw API/web ports.

Correct:

```text
http://localhost:8080
http://localhost:8080/api/health
http://localhost:8080/api/health/db
```

Avoid relying on:

```text
http://localhost:3001
```

because that belongs to Uptime Kuma.

---

# Backup Script

Add:

```text
deploy/backup-postgres.sh
```

Suggested:

```bash
#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ -f .env.server ]; then
  set -a
  . ./.env.server
  set +a
else
  echo ".env.server not found"
  exit 1
fi

mkdir -p backups

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="backups/intake_os_${TIMESTAMP}.sql"

docker compose -f "$COMPOSE_FILE" --env-file .env.server exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"

echo "Backup written to $BACKUP_FILE"
```

Make executable:

```bash
chmod +x deploy/backup-postgres.sh
```

---

# Restore Script

Add:

```text
deploy/restore-postgres.sh
```

Suggested:

```bash
#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.server.yml"

if [ $# -ne 1 ]; then
  echo "Usage: deploy/restore-postgres.sh backups/intake_os_YYYYMMDD_HHMMSS.sql"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -f .env.server ]; then
  set -a
  . ./.env.server
  set +a
else
  echo ".env.server not found"
  exit 1
fi

echo "This will restore $BACKUP_FILE into $POSTGRES_DB."
echo "This may overwrite or duplicate data depending on dump contents."
read -r -p "Continue? Type RESTORE: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file .env.server exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Restore complete."
```

Make executable:

```bash
chmod +x deploy/restore-postgres.sh
```

---

# Git Ignore Updates

Update `.gitignore`:

```gitignore
.env.server
backups/
*.sql
*.dump
```

Ensure web build cache is ignored:

```gitignore
apps/web/.next/
```

---

# Server Setup Flow

Once repo is cloned on the server:

```bash
cd ~/intake-os
git pull

cp .env.server.example .env.server
nano .env.server
```

Then:

```bash
npm run server:build
npm run server:up
npm run server:ps
npm run server:health
```

If Node/npm is not installed on the server, use Docker directly:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server build
docker compose -f docker-compose.server.yml --env-file .env.server up -d
docker compose -f docker-compose.server.yml --env-file .env.server ps
bash deploy/healthcheck-server.sh
```

---

# Clone Repo on Server

First-time setup:

```bash
cd ~
git clone https://github.com/Dusty043/intake-os.git
cd intake-os
```

If already cloned:

```bash
cd ~/intake-os
git pull
```

Confirm:

```bash
pwd
ls -la
git log --oneline -5
git status
```

Expected files:

```text
package.json
README.md
apps/
src/
scripts/
docker-compose.yml
```

---

# Seed Demo Data on Server

Run inside API container:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo
```

Expected:

```text
6 demo intakes seeded
demo requester records replaced
real records untouched
```

---

# Runtime Smoke on Server

Run:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 \
  api npm run smoke:runtime
```

Expected checks:

```text
health
DB readiness
OpenAPI if enabled
create intake
submit intake
generate mock AI draft
accept draft
Gate 1 approval
Gate 2 approval
generate distribution preview
source.type = reviewed_project_package
all actions dryRun = true
audit events present
```

The smoke test should use internal Docker DNS:

```text
http://api:3000
```

not the host proxy.

---

# Browser Access Through SSH Tunnel

From laptop:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Open:

```text
http://localhost:8080/intakes
```

Verify:

```text
UI loads
seeded intakes visible
intake detail pages load
actor selector works
AI draft panel works
reviewed package panel works
approvals visible
distribution preview visible
audit trail visible
debug JSON visible
```

Do not use:

```text
http://localhost:3001
```

because that is Uptime Kuma.

---

# Optional Tailscale Serve

After SSH tunnel works, test Tailscale Serve.

Expose only:

```text
127.0.0.1:8080
```

Do not expose:

```text
3000
3001
5432
```

Recommended note file:

```text
deploy/tailscale-serve-notes.md
```

Document:

```text
actual serve command used
actual ts.net URL
date enabled
date disabled if temporary
```

Example flow:

```bash
tailscale status
tailscale serve --https=443 http://127.0.0.1:8080
tailscale serve status
```

---

# Optional Tailscale Funnel Demo Mode

Only after server runtime and Serve are verified.

Rules:

```text
Funnel exposes only local-proxy on 127.0.0.1:8080.
Basic auth must be enabled in Caddy.
Demo data only.
No real internal/customer data.
Turn Funnel off after demo.
```

Recommended note file:

```text
deploy/tailscale-funnel-notes.md
```

Document:

```text
how to enable
how to check status
how to disable/reset
who the public URL was shared with
when it was disabled
```

Example flow:

```bash
tailscale funnel --https=443 http://127.0.0.1:8080
tailscale funnel status
```

After demo:

```bash
tailscale funnel reset
```

Funnel is optional. It is not the default server runtime.

---

# README Updates

Add section:

```text
Private Server Runtime
```

Include:

```text
why no domain is required
why SSH tunnel is default
why host port 3001 is reserved for Uptime Kuma
why Project Intake OS uses proxy port 8080
how to create .env.server
how to build/start stack
how to healthcheck
how to seed demo data
how to run runtime smoke
how to access UI
backup/restore commands
Tailscale Serve option
Tailscale Funnel warning
known limitations
```

Include explicit warning:

```text
Do not expose this app publicly until real authentication is implemented.
```

---

# Deployment Docs

Add:

```text
docs/deployment/private-server-runtime.md
```

Include:

```text
overview
architecture diagram
first server setup
env config
Docker Compose services
local proxy explanation
Uptime Kuma port 3001 note
why Intake OS uses 8080
SSH tunnel instructions
Tailscale Serve instructions
Tailscale Funnel demo mode
seed demo flow
runtime smoke flow
backup and restore
troubleshooting
security notes
```

---

# AI Docs Updates

Add:

```text
docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md
```

Update:

```text
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

Record:

```text
server-first deployment baseline
no-domain decision
Uptime Kuma owns host port 3001
Project Intake OS proxy uses host port 8080
local proxy architecture
/api frontend base URL
SSH tunnel default
Tailscale Serve optional
Tailscale Funnel temporary demo only
public exposure deferred until real auth/domain/HTTPS
```

---

# Troubleshooting Notes

## Repo is not on server

Symptoms:

```text
grep: package.json: No such file or directory
ls: cannot access 'deploy': No such file or directory
```

Fix:

```bash
cd ~
git clone https://github.com/Dusty043/intake-os.git
cd intake-os
```

## Port 3001 conflict

Symptoms:

```text
bind: address already in use
port is already allocated
```

Likely cause:

```text
Uptime Kuma already uses host port 3001.
```

Fix:

```text
Do not publish web:3001 to host.
Use local-proxy on 127.0.0.1:8080.
```

Correct compose:

```yaml
web:
  expose:
    - "3001"

local-proxy:
  ports:
    - "127.0.0.1:8080:8080"
```

## Web loads but API calls fail

Check:

```text
NEXT_PUBLIC_API_BASE_URL=/api
```

Then rebuild web image:

```bash
npm run server:build
npm run server:up
```

Check proxy health:

```bash
curl -fsS http://localhost:8080/api/health
curl -fsS http://localhost:8080/api/health/db
```

## Smoke fails inside API container

Use internal API URL:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 \
  api npm run smoke:runtime
```

## Cannot access from laptop

Use SSH tunnel:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Then open:

```text
http://localhost:8080/intakes
```

Do not open server IP directly unless ports are intentionally exposed and firewall-restricted.

---

# Implementation Order

## Step 1 — Clone repo on server

```bash
cd ~
git clone https://github.com/Dusty043/intake-os.git
cd intake-os
```

If already cloned:

```bash
cd ~/intake-os
git pull
```

## Step 2 — Verify baseline

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
```

## Step 3 — Add server files

Add:

```text
Dockerfile.api
Dockerfile.web
docker-compose.server.yml
.env.server.example
deploy/Caddyfile.server
deploy/deploy-server.sh
deploy/healthcheck-server.sh
deploy/backup-postgres.sh
deploy/restore-postgres.sh
docs/deployment/private-server-runtime.md
```

## Step 4 — Add package scripts

Add:

```text
server:build
server:up
server:down
server:ps
server:logs
server:health
server:deploy
server:backup
```

## Step 5 — Update docs/logs

Update:

```text
README.md
.gitignore
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

## Step 6 — Build server stack

```bash
cp .env.server.example .env.server
npm run server:build
npm run server:up
npm run server:ps
npm run server:health
```

## Step 7 — Seed and smoke

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo

docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 \
  api npm run smoke:runtime
```

## Step 8 — Browser verification

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Open:

```text
http://localhost:8080/intakes
```

## Step 9 — Optional Tailscale

After everything works:

```text
Test Tailscale Serve.
Only then test Funnel if needed.
```

---

# Acceptance Criteria

TASK-0012 is complete when:

```text
1. Repo can be cloned on the server.
2. .env.server.example exists.
3. .env.server is ignored by git.
4. Dockerfile.api exists.
5. Dockerfile.web exists.
6. docker-compose.server.yml exists.
7. Server compose starts postgres, api, web, and local-proxy.
8. Local proxy routes /api/* to API.
9. Local proxy routes everything else to web.
10. Web app is built with NEXT_PUBLIC_API_BASE_URL=/api.
11. API/web are not publicly bound by default.
12. Project Intake OS does not bind host port 3001.
13. Host port 3001 remains available for Uptime Kuma.
14. local-proxy binds to 127.0.0.1:8080 by default.
15. Postgres uses persistent named volume.
16. API migrations run on startup or documented deploy step.
17. Healthcheck verifies web, API health, DB health, and OpenAPI if enabled.
18. Seed demo data works inside API container.
19. Runtime smoke works inside API container.
20. Browser UI works through SSH tunnel on localhost:8080.
21. Backup script creates timestamped SQL dump.
22. Restore script requires explicit confirmation.
23. README documents server setup.
24. Deployment doc exists.
25. Uptime Kuma port conflict is documented.
26. Tailscale Serve is documented as optional private mode.
27. Tailscale Funnel is documented as optional temporary public demo mode.
28. Funnel does not expose raw API.
29. Funnel mode requires basic auth if used.
30. Existing tests still pass.
31. Existing API build still passes.
32. Existing web build still passes.
33. Existing demos still pass.
34. No real AI provider is added.
35. No live Monday/GitHub writes are added.
36. No n8n is introduced.
```

---

# Final Verification Commands

Offline/project verification:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
```

Server verification:

```bash
cp .env.server.example .env.server
npm run server:build
npm run server:up
npm run server:ps
npm run server:health
```

Seed:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo
```

Runtime smoke:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 \
  api npm run smoke:runtime
```

SSH browser check:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Open:

```text
http://localhost:8080/intakes
```

Port conflict check:

```bash
ss -tulpn | grep -E ':3001|:8080'
```

Expected:

```text
3001 used by Uptime Kuma
8080 used by Project Intake OS local proxy
```

---

# Expected Final Report

When done, report:

```text
TASK-0012 done.

Commit:
- <hash>

Files added:
- Dockerfile.api
- Dockerfile.web
- docker-compose.server.yml
- .env.server.example
- deploy/Caddyfile.server
- deploy/deploy-server.sh
- deploy/healthcheck-server.sh
- deploy/backup-postgres.sh
- deploy/restore-postgres.sh
- deploy/tailscale-serve-notes.md
- deploy/tailscale-funnel-notes.md
- docs/deployment/private-server-runtime.md
- docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md

Files modified:
- package.json
- README.md
- .gitignore
- docs/ai/BUILD_LOG.md
- docs/ai/MEMORY_INDEX.md
- docs/ai/SEQUENCE_LOG.md

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- demos: pass
- npm run server:build: pass
- npm run server:up: pass
- npm run server:health: pass
- seed:demo inside API container: pass
- smoke:runtime inside API container: pass
- browser through SSH tunnel on localhost:8080: pass
- host port 3001 remains reserved for Uptime Kuma: pass

Known limitations:
- no domain
- no HTTPS
- actor selector remains dev auth shim
- Tailscale Funnel is optional demo mode only
- no real AI/Monday/GitHub integrations yet
```

---

# Agent Execution Prompt

Use this with Claude Code/Codex:

```text
You are working on Project Intake OS.

Implement TASK-0012: Private Server Runtime Deployment.

Context:
- TASK-0005 through TASK-0008 completed backend governance.
- TASK-0009 stabilized the API runtime.
- TASK-0010 added the Next.js UI.
- TASK-0011 added seeded demo data and runtime smoke tests.
- The user does not have a domain yet.
- The app still uses actor headers as a dev auth shim.
- The server already runs Uptime Kuma on host port 3001.
- Therefore, the server runtime must be private by default and must not bind host port 3001.

Goal:
Make the app run cleanly on a private server with Docker Compose:
- Postgres
- NestJS API
- Next.js web
- local reverse proxy on host 127.0.0.1:8080
- persistent DB volume
- seed demo support
- runtime smoke support
- backup/restore
- healthcheck
- SSH tunnel access by default
- optional Tailscale Serve/Funnel notes

Implementation:
1. Add Dockerfile.api.
2. Add Dockerfile.web.
3. Add docker-compose.server.yml.
4. Add .env.server.example.
5. Add deploy/Caddyfile.server.
6. Add deploy/deploy-server.sh.
7. Add deploy/healthcheck-server.sh.
8. Add deploy/backup-postgres.sh.
9. Add deploy/restore-postgres.sh.
10. Add deploy/tailscale-serve-notes.md.
11. Add deploy/tailscale-funnel-notes.md.
12. Add package.json server scripts.
13. Update .gitignore for .env.server and backups.
14. Add docs/deployment/private-server-runtime.md.
15. Add docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md.
16. Update README and AI logs.

Rules:
- No domain required.
- No HTTPS required.
- Host port 3001 is reserved for Uptime Kuma.
- Project Intake OS must not bind host port 3001.
- Web may listen on 3001 inside Docker only.
- Do not publish web:3001 to host.
- Do not expose raw API publicly.
- Do not expose raw web publicly.
- Bind local-proxy to 127.0.0.1:8080 by default.
- Route /api/* through the proxy to the API.
- Route everything else through the proxy to the web app.
- Build web with NEXT_PUBLIC_API_BASE_URL=/api.
- Postgres must use persistent named volume.
- Tailscale Funnel is optional demo mode only.
- Funnel must expose only the local proxy.
- Funnel mode should require basic auth if used.
- Do not implement Google SSO.
- Do not implement real AI provider.
- Do not implement live Monday/GitHub writes.
- Do not introduce n8n.
- Do not break local development.

Verification:
Run:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution

Then, if Docker is available:
cp .env.server.example .env.server
npm run server:build
npm run server:up
npm run server:ps
npm run server:health

Then:
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo

docker compose -f docker-compose.server.yml --env-file .env.server exec -e API_BASE_URL=http://api:3000 api npm run smoke:runtime

Manual:
ssh -L 8080:localhost:8080 oreo@SERVER_IP
open http://localhost:8080/intakes

Port check:
ss -tulpn | grep -E ':3001|:8080'

Expected:
- 3001 remains Uptime Kuma
- 8080 is Project Intake OS proxy

Return:
- commit hash
- files added
- files modified
- verification results
- server runtime notes
- Uptime Kuma port note
- known limitations
- next recommended task
```

---

# Human Dev Notes

This task is about making the server boring.

The best result is not fancy. The best result is:

```text
clone repo
copy env
build containers
start stack
seed demo
run smoke
open UI through tunnel
backup works
Uptime Kuma remains untouched on 3001
```

Do not fight port `3001`.

Let Uptime Kuma keep it.

Project Intake OS should use:

```text
localhost:8080
```

The order is:

```text
server runtime
then private access
then optional public demo
then real auth/domain later
```

After TASK-0012, the next clean choices are:

```text
TASK-0013 — Real AI provider adapter
```

or:

```text
TASK-0013 — Google SSO / internal auth
```

If the app needs to be shown publicly to others soon, auth should probably come before real AI.
