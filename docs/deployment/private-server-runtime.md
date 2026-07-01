# Private Server Runtime

## Overview

Project Intake OS can be run on a private server without a domain, HTTPS, or public internet exposure. This document covers the complete setup.

The deployment uses Docker Compose with:

- **postgres** — persistent named volume
- **api** — NestJS + Prisma (migrations on startup)
- **web** — Next.js UI (internal container port only)
- **local-proxy** — Caddy routing `/api/*` to API and everything else to web

Default access is through an SSH tunnel or Tailscale Serve. Public access via Tailscale Funnel is an optional temporary demo mode only.

---

## Architecture

```
Server
│
├── postgres          (Docker, 127.0.0.1:5432 for maintenance only)
│
├── api               (Docker internal, not bound to host)
│   └── NestJS + Prisma
│
├── web               (Docker internal, NEVER binds host port 3001)
│   └── Next.js UI
│
├── local-proxy       (Docker, 127.0.0.1:8080 — single host entrypoint)
│   ├── /api/*  → api:3000
│   └── /*      → web:3001
│
└── backups/          (timestamped SQL dumps)
```

### Why port 8080 and not 3001?

Uptime Kuma already runs on host port `3001` on this server. Project Intake OS must never bind host port `3001`. The local proxy binds `127.0.0.1:8080` as the single entrypoint.

```
Host ports:
  3001  →  Uptime Kuma (reserved — do not use)
  8080  →  Project Intake OS local proxy
  5432  →  Postgres (127.0.0.1 only, for server-local maintenance)

Docker internal:
  web:3001   api:3000   postgres:5432
```

---

## First Server Setup

### 1. Clone the repo

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

### 2. Configure environment

```bash
cp .env.server.example .env.server
nano .env.server
```

Change `POSTGRES_PASSWORD` and the `DATABASE_URL` password to match. Do not commit `.env.server`.

### 3. Build and start

```bash
# Using npm scripts (requires Node on the server):
npm run server:build
npm run server:up
npm run server:ps

# Or using Docker directly:
docker compose -f docker-compose.server.yml --env-file .env.server build
docker compose -f docker-compose.server.yml --env-file .env.server up -d
docker compose -f docker-compose.server.yml --env-file .env.server ps
```

### 4. Healthcheck

```bash
# Using npm:
npm run server:health

# Or directly:
bash deploy/healthcheck-server.sh
```

Checks: web through proxy, API liveness, DB readiness, OpenAPI (non-fatal if disabled).

---

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `production` | |
| `API_HOST` | `0.0.0.0` | |
| `PORT` | `3000` | Internal only — `apps/api/src/main.ts` reads `PORT`, not `API_PORT` |
| `WEB_PORT` | `3001` | Internal only — never publish to host |
| `PROXY_PORT` | `8080` | Host-bound to 127.0.0.1 |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` | Baked into web build — rebuild if changed |
| `SWAGGER_ENABLED` | `true` | Disable before any real public deployment |
| `POSTGRES_USER` | `intake_os` | |
| `POSTGRES_PASSWORD` | *(change this)* | |
| `POSTGRES_DB` | `intake_os` | |
| `POSTGRES_PORT` | `5432` | Host-bound to 127.0.0.1 |
| `DATABASE_URL` | *full URL* | Uses Docker service name `postgres` |

---

## Seed Demo Data

Run inside the API container after the stack is up:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo:server
```

Seeds 6 demo intakes. Idempotent: deletes demo records before recreating.

---

## Runtime Smoke Test

Run inside the API container using the internal Docker DNS name:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 \
  api npm run smoke:runtime
```

Tests all governance phases: create, submit, AI draft, human review, Gate 1, Gate 2, distribution preview.

---

## Accessing the UI

### Mode A — SSH Tunnel (default)

From your laptop:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Open in browser:

```
http://localhost:8080/intakes
```

No domain, no HTTPS, no public exposure required.

### Mode B — Tailscale Serve (optional, private)

After SSH tunnel works, expose only the local proxy via your tailnet:

```bash
tailscale serve --https=443 http://127.0.0.1:8080
tailscale serve status
```

Access from any tailnet device at the HTTPS URL shown. See `deploy/tailscale-serve-notes.md` for the log.

### Mode C — Tailscale Funnel (optional, temporary demo)

Public access for demos only. Requires basic auth in Caddy. See `deploy/tailscale-funnel-notes.md`.

**Turn Funnel off after the demo.**

---

## Backup and Restore

### Backup

```bash
# Using npm:
npm run server:backup

# Or directly:
bash deploy/backup-postgres.sh
```

Creates `backups/intake_os_YYYYMMDD_HHMMSS.sql`.

### Restore

```bash
bash deploy/restore-postgres.sh backups/intake_os_YYYYMMDD_HHMMSS.sql
```

Requires typing `RESTORE` to confirm.

---

## Useful Commands

```bash
# Stack status
docker compose -f docker-compose.server.yml --env-file .env.server ps

# Follow all logs
docker compose -f docker-compose.server.yml --env-file .env.server logs -f

# Follow API logs only
docker compose -f docker-compose.server.yml --env-file .env.server logs -f api

# Stop stack
docker compose -f docker-compose.server.yml --env-file .env.server down

# Restart a service
docker compose -f docker-compose.server.yml --env-file .env.server restart api
```

---

## Troubleshooting

### Port 3001 conflict

```
bind: address already in use
```

Uptime Kuma owns host port 3001. The compose file uses `expose:` for the web container (no host binding). If you see this error, something else published `3001:3001` — check for old `docker-compose.yml` running with `ports:`.

### Web loads but API calls fail

Check `NEXT_PUBLIC_API_BASE_URL=/api` in `.env.server`. If changed, rebuild the web image:

```bash
npm run server:build
npm run server:up
```

Verify routing:

```bash
curl -fsS http://localhost:8080/api/health
curl -fsS http://localhost:8080/api/health/db
```

### Smoke fails inside API container

The smoke script needs the API URL via the internal Docker DNS name, not the proxy:

```bash
-e API_BASE_URL=http://api:3000
```

### Cannot reach the app from laptop

Use an SSH tunnel. The proxy is bound to `127.0.0.1:8080` — it is not directly reachable from outside the server.

---

## Security Notes

- This app uses actor header shims (`x-actor-id`, `x-actor-role`) instead of real authentication.
- Do not expose this app publicly until real authentication is implemented.
- The local proxy binds to `127.0.0.1` only by default.
- Tailscale Funnel requires basic auth in Caddy and should be turned off after demos.
- `.env.server` must never be committed. It is git-ignored.
- Postgres is bound to `127.0.0.1` only — not reachable from outside the server.

---

## Known Limitations

- No domain — SSH tunnel or Tailscale is required for access.
- No HTTPS on the server itself — Tailscale Serve provides HTTPS if needed.
- Actor selector is a dev auth shim — no real user authentication.
- No real AI provider — mock analysis drafts only.
- No live Monday or GitHub writes — all distribution actions are dry runs.
