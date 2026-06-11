# TASK-0012 — Private Server Runtime Deployment

## Status

Complete

## Goal

Make Project Intake OS run cleanly on a private server without requiring a domain, HTTPS, Google SSO, or public production exposure.

## Context

- TASK-0009 stabilized API runtime.
- TASK-0010 added Next.js UI.
- TASK-0011 added seeded demo data and runtime smoke test.
- The server already runs Uptime Kuma on host port 3001.
- The app still uses actor header shims — no real auth.

## Plan

1. Add `Dockerfile.api` (root) — production API image, `prisma migrate deploy` on start.
2. Add `Dockerfile.web` (root) — Next.js image, `NEXT_PUBLIC_API_BASE_URL` baked in at build.
3. Add `docker-compose.server.yml` — postgres, api, web, local-proxy (Caddy).
4. Add `.env.server.example`.
5. Add `deploy/` scripts: Caddyfile, deploy, healthcheck, backup, restore.
6. Add Tailscale Serve/Funnel notes.
7. Add `server:*` package scripts.
8. Add `seed:demo:server` script (no `--env-file=.env` for container use).
9. Update `.gitignore`.
10. Add `docs/deployment/private-server-runtime.md`.
11. Update README, BUILD_LOG, MEMORY_INDEX, SEQUENCE_LOG.

## Key Decisions

### Host port 3001 is reserved for Uptime Kuma

The web container uses `expose: ["3001"]` (Docker-internal only) not `ports: ["3001:3001"]`.
The local proxy (Caddy) binds `127.0.0.1:8080` as the single host entrypoint.

### NEXT_PUBLIC_API_BASE_URL=/api

Baked into the Next.js build at build time. The local proxy routes `/api/*` to the API container. If this value ever changes, the web image must be rebuilt.

### prisma migrate deploy (not db push)

The root `Dockerfile.api` uses `prisma migrate deploy` on container startup — the production-safe migration command that applies pending migrations without modifying the schema.

### seed:demo:server

Added a separate `seed:demo:server` npm script (`node scripts/seed-demo-data.mjs` without `--env-file=.env`) for use inside the Docker container where env vars come from docker-compose `env_file` and no `.env` file is present.

### SSH tunnel as default access mode

The proxy binds to `127.0.0.1:8080` — not accessible from outside the server without a tunnel.
Tailscale Serve is optional private mode. Tailscale Funnel is optional temporary demo mode only.

## Files Added

```
Dockerfile.api
Dockerfile.web
docker-compose.server.yml
.env.server.example
deploy/Caddyfile.server
deploy/Caddyfile.funnel.example
deploy/deploy-server.sh
deploy/healthcheck-server.sh
deploy/backup-postgres.sh
deploy/restore-postgres.sh
deploy/tailscale-serve-notes.md
deploy/tailscale-funnel-notes.md
docs/deployment/private-server-runtime.md
docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md
```

## Files Modified

```
package.json       — added server:* scripts and seed:demo:server
.gitignore         — added .env.server, backups/, *.sql, *.dump, apps/web/.next/
README.md          — added Private Server Runtime section
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

## Verification

Offline checks (no Docker required):

```bash
npm run check           # typecheck + unit tests
npm run api:build       # API build
npm run web:build       # Next.js build
npm run prisma:generate
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
```

Server checks (Docker required):

```bash
cp .env.server.example .env.server
npm run server:build
npm run server:up
npm run server:ps
npm run server:health
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo:server
docker compose -f docker-compose.server.yml --env-file .env.server exec \
  -e API_BASE_URL=http://api:3000 api npm run smoke:runtime
ssh -L 8080:localhost:8080 oreo@SERVER_IP
# open http://localhost:8080/intakes
```

## Known Limitations

- No domain — SSH tunnel or Tailscale is required.
- No HTTPS on server — Tailscale Serve handles HTTPS if needed.
- Actor selector remains a dev auth shim.
- Tailscale Funnel is optional demo mode only.
- No real AI/Monday/GitHub integrations.

## Handoff

The server runtime baseline is in place. The next clean choices are:

- TASK-0013 — Google SSO / internal authentication
- TASK-0013 — Real AI provider adapter

If the app needs public demos soon, auth should come before real AI.
