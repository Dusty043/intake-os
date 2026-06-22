# TASK-0033 — Google OAuth Integration

**Status:** COMPLETE — 2026-06-23  
**Priority:** HIGH — production auth requirement  
**Estimated effort:** 1 hour (implementation already existed, task was activation + tests)  
**Blocked on:** `AUTH_GOOGLE_CLIENT_ID` + `AUTH_GOOGLE_CLIENT_SECRET` in `.env.server` on oreochiserver

---

## Summary

The full Google OAuth implementation was built as part of TASK-0027 (auth hardening). TASK-0033 activated it by:

1. Removing the `TODO (Q-AUTH-1)` hold in `src/auth-config-validator.ts` — the startup validator now hard-fails if `AUTH_MODE=google` is set without `AUTH_GOOGLE_CLIENT_ID`.
2. Fixed the env var name mismatch: the validator TODO referenced `GOOGLE_CLIENT_ID` but the service uses `AUTH_GOOGLE_CLIENT_ID` — aligned to `AUTH_GOOGLE_CLIENT_ID`.
3. Updated `tests/auth-config-validator.test.mjs` — tests that set `AUTH_MODE=google` now supply `AUTH_GOOGLE_CLIENT_ID`; added test for missing client ID.
4. Wrote `tests/google-oauth.test.mjs` — 23 new tests covering URL generation, state token format, role config from env, session TTL math, and the forbidden-user path.

---

## What Was Already Built (TASK-0027 scope)

| File | What it does |
|---|---|
| `apps/api/src/modules/auth/auth.controller.ts` | `GET /auth/google/start`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/config` |
| `apps/api/src/modules/auth/auth.service.ts` | `handleGoogleCallback()`, `getMe()`, `logout()` |
| `apps/api/src/modules/auth/google-auth.service.ts` | OAuth2Client wrapper — URL generation, code exchange, id_token verification |
| `apps/api/src/modules/auth/session.service.ts` | `createSession()`, `validateSession()`, `revokeSession()` with SHA-256 token hash |
| `apps/api/src/modules/auth/role-resolver.ts` | Email/domain → role mapping, `resolveRoleConfigFromEnv()` |
| `apps/api/src/modules/auth/auth.guard.ts` | Routes `dev_headers` vs `google` mode; reads session cookie in google mode |
| `apps/web/src/app/login/page.tsx` | Shows "Sign in with Google" button when `authMode=google` |
| `apps/web/src/components/AuthProvider.tsx` | Calls `GET /auth/me` on mount, hydrates auth context |
| `apps/web/src/lib/auth-client.ts` | `getAuthMe()`, `logout()`, `getGoogleLoginUrl()` |

---

## Environment Variables Required for Google Mode

| Variable | Purpose |
|---|---|
| `AUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID (required at startup if `AUTH_MODE=google`) |
| `AUTH_GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `AUTH_PUBLIC_BASE_URL` | Public base URL for redirect URI (e.g. `https://oreochiserver.tail0a3a58.ts.net`) |
| `AUTH_GOOGLE_CALLBACK_PATH` | Override callback path (default `/api/auth/google/callback`) |
| `AUTH_SESSION_COOKIE_NAME` | Cookie name (default `intake_os_session`) |
| `AUTH_SESSION_TTL_HOURS` | Session lifetime in hours (default `8`) |
| `AUTH_COOKIE_SECURE` | Set to `"true"` for HTTPS-only cookies |
| `AUTH_COOKIE_SAME_SITE` | `lax`, `strict`, or `none` (default `lax`) |
| `AUTH_ADMIN_EMAILS` | Comma-separated emails that get `admin` role |
| `AUTH_INTAKE_OWNER_EMAILS` | Comma-separated emails that get `intake_owner` role |
| `AUTH_DEVOPS_LEAD_EMAILS` | Comma-separated emails that get `devops_lead` role |
| `AUTH_DEVELOPER_EMAILS` | Comma-separated emails that get `developer` role |
| `AUTH_ALLOWED_EMAILS` | If set, only these emails are allowed (blocks all others) |
| `AUTH_ALLOWED_DOMAINS` | If set, only emails from these domains are allowed |
| `AUTH_DEFAULT_ROLE` | Role for allowed users not in a specific list (default `request_creator`) |
| `AUTH_LOGIN_SUCCESS_REDIRECT` | Post-login redirect (default `/intakes`) |
| `AUTH_LOGIN_FAILURE_REDIRECT` | Failure redirect (default `/login?error=auth_failed`) |

---

## Activation Checklist for oreochiserver

Before switching `AUTH_MODE=google` on oreochiserver:

1. Create a Google Cloud project with OAuth2 consent screen
2. Add authorized redirect URI: `https://oreochiserver.tail0a3a58.ts.net/api/auth/google/callback`
3. Add to `.env.server`:
   ```
   AUTH_MODE=google
   AUTH_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   AUTH_GOOGLE_CLIENT_SECRET=<your-client-secret>
   AUTH_PUBLIC_BASE_URL=https://oreochiserver.tail0a3a58.ts.net
   AUTH_COOKIE_SECURE=true
   AUTH_ADMIN_EMAILS=dustin@simple.biz
   AUTH_ALLOWED_DOMAINS=simple.biz
   ```
4. `docker compose -f docker-compose.server.yml up -d api` (must recreate, not restart)
5. Test: visit `/login`, click "Sign in with Google", confirm redirect to Google, confirm redirect back

---

## Changes in This Task

| File | Change |
|---|---|
| `src/auth-config-validator.ts` | Removed TODO; now hard-fails startup if `AUTH_MODE=google` + no `AUTH_GOOGLE_CLIENT_ID` |
| `tests/auth-config-validator.test.mjs` | Added `AUTH_GOOGLE_CLIENT_ID` to google-mode success tests; new test for missing client ID |
| `tests/google-oauth.test.mjs` | NEW — 23 tests: URL generation, state token, role env config, TTL math, forbidden path |

---

## Tests

```
node --test tests/auth-config-validator.test.mjs tests/google-oauth.test.mjs
```

30/30 pass. Full suite: 582/582 pass.

---

## Open Questions Resolved

- Q-AUTH-1: Resolved. `AUTH_GOOGLE_CLIENT_ID` is the correct env var name (matching `google-auth.service.ts`).
- Q-AUTH-2: `AUTH_SESSION_COOKIE_NAME` missing does not fail at startup — it defaults to `intake_os_session`. This is acceptable.

---

## Remaining Work

- Get `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_CLIENT_SECRET` from Google Cloud Console
- Switch oreochiserver to `AUTH_MODE=google` following the activation checklist above
- Integration/E2E test of the full browser login flow (blocked on real credentials)
