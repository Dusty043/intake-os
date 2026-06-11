# Tailscale Serve — Private Access Notes

Tailscale Serve exposes the local proxy to devices on your tailnet only.

## Prerequisites

- SSH tunnel access is working first (verify before using Serve).
- Tailscale is installed and authenticated on the server.
- Local proxy is running on `127.0.0.1:8080`.

## What to expose

Only expose the local proxy:

```
127.0.0.1:8080
```

Do not expose raw API (3000), raw web (3001), or Postgres (5432).

## Enable Serve

```bash
tailscale status
tailscale serve --https=443 http://127.0.0.1:8080
tailscale serve status
```

Access from any tailnet device at the HTTPS URL shown by `tailscale serve status`.

## Disable Serve

```bash
tailscale serve reset
tailscale serve status
```

## Log

| Date | Action | URL | Notes |
|------|--------|-----|-------|
|      |        |     |       |

Update this table when Serve is enabled or disabled.
