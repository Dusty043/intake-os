# Tailnet Access Notes

The server hosts multiple unrelated projects, and Tailscale Serve only allows one proxy
rule per port — a previous attempt to use Serve here (`tailscale serve --https=443
http://127.0.0.1:8080`) got silently overwritten by another project's Serve rule on the
same box, with no record of when. As of 2026-07-08, intake-os no longer depends on Serve:
the `local-proxy` container's host port binding was changed from `127.0.0.1:8080` (loopback
only, SSH-tunnel access) to `${PROXY_PORT:-8080}:8080` (all interfaces), so it's directly
reachable at `oreochiserver:${PROXY_PORT:-8080}` over the tailnet without any Serve rule.

## What's exposed

Only the `local-proxy` container's port is bound to all interfaces. `api` (3000), `web`
(3001 — also reserved for Uptime Kuma), and `postgres` (5432) have no host port binding at
all and stay reachable only from other containers on the compose network.

## Access

```
http://oreochiserver:8080          (or the tailscale IP directly)
```

No SSH tunnel, no Tailscale Serve rule needed. Tailscale's own tailnet-only routing is the
access control — this is not exposed to the public internet unless a Funnel is separately
configured (see `tailscale-funnel-notes.md`), which this project does not use.

## Changing the port

Set `PROXY_PORT` in `.env.server` if `8080` collides with another project's port on this
box, then `docker compose -f docker-compose.server.yml --env-file .env.server up -d
local-proxy`.

## Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-07-08 | Switched from SSH-tunnel/Serve to direct port binding | User requested every project on the box be reachable via `oreochiserver:[port]`; Serve's one-rule-per-port limit made per-project Serve rules impractical with multiple projects sharing the host. |
