# Tailscale Funnel — Temporary Public Demo Mode Notes

Tailscale Funnel exposes the local proxy to the public internet temporarily.

**Warning:** This app uses actor header shims instead of real authentication.
Only use Funnel with demo data and basic auth enabled in Caddy. Turn it off after the demo.

## Prerequisites

1. SSH tunnel access works.
2. Tailscale Serve has been tested.
3. Local proxy is running on `127.0.0.1:8080`.
4. Basic auth is enabled in `deploy/Caddyfile.server` (use `Caddyfile.funnel.example` as a template).

## Enable Funnel with basic auth

Step 1 — generate password hash:

```bash
docker run --rm caddy:2 caddy hash-password --plaintext 'your-demo-password'
```

Step 2 — update Caddyfile with the hash (do not commit real passwords):

```bash
cp deploy/Caddyfile.server deploy/Caddyfile.server.bak
cp deploy/Caddyfile.funnel.example deploy/Caddyfile.server
# Edit deploy/Caddyfile.server and replace REPLACE_WITH_HASHED_PASSWORD
```

Step 3 — reload the proxy:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server restart local-proxy
```

Step 4 — enable Funnel:

```bash
tailscale funnel --https=443 http://127.0.0.1:8080
tailscale funnel status
```

Share the public URL. Ensure only demo data is visible.

## Disable Funnel after demo

```bash
tailscale funnel reset
cp deploy/Caddyfile.server.bak deploy/Caddyfile.server
docker compose -f docker-compose.server.yml --env-file .env.server restart local-proxy
```

## Log

| Date | Enabled | URL shared with | Date disabled |
|------|---------|-----------------|---------------|
|      |         |                 |               |

Update this table for every Funnel session.
