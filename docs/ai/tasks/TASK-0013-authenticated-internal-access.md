# TASK-0013 — Authenticated Internal Access & Role Resolution

## Status

Complete

---

## Goal

Replace the temporary actor-header auth shim with real authenticated internal access.

Introduced:
- `AUTH_MODE=dev_headers|google`
- Google OAuth/OIDC login flow
- Server-side `AuthUser` + `AuthSession` Prisma models
- HttpOnly session cookie (`intake_os_session`)
- Environment-based role resolver
- `@CurrentActor()` NestJS decorator
- Global `AuthGuard` with dual-mode support
- Frontend `/login` page, `AuthProvider`, `UserMenu`
- All existing tests and demos preserved in `dev_headers` mode

---

## Files Added

**Backend:**
- `apps/api/src/modules/auth/auth.types.ts` — `AuthenticatedActor` and `AuthProvider` types
- `apps/api/src/modules/auth/role-resolver.ts` — pure function role mapping from env
- `apps/api/src/modules/auth/session.service.ts` — session create/validate/revoke, `hashToken`
- `apps/api/src/modules/auth/google-auth.service.ts` — Google OAuth URL + token exchange
- `apps/api/src/modules/auth/auth.service.ts` — orchestrates login, getMe, logout
- `apps/api/src/modules/auth/auth.guard.ts` — global NestJS guard (dual mode)
- `apps/api/src/modules/auth/auth.decorators.ts` — `@Public()`, `@CurrentActor()`
- `apps/api/src/modules/auth/auth.controller.ts` — `/auth/google/start`, `/auth/google/callback`, `/auth/me`, `/auth/logout`, `/auth/config`
- `apps/api/src/modules/auth/auth.module.ts`

**Frontend:**
- `apps/web/src/lib/auth-client.ts` — `getAuthMe`, `logout`, `getGoogleLoginUrl`
- `apps/web/src/components/AuthProvider.tsx` — auth context + `useAuth` hook
- `apps/web/src/components/UserMenu.tsx` — signed-in user display + logout
- `apps/web/src/components/AuthGate.tsx` — redirects to `/login` if unauthenticated in google mode
- `apps/web/src/components/ClientLayout.tsx` — routes login page around AppShell
- `apps/web/src/app/login/page.tsx` — login page with Google sign-in button

**Tests:**
- `tests/auth-role-resolution.test.mjs` — 11 passing
- `tests/auth-actor-resolution.test.mjs` — unit + API integration stubs
- `tests/auth-session.test.mjs` — 8 passing (token hashing unit tests)

---

## Files Modified

- `apps/api/prisma/schema.prisma` — added `AuthUser`, `AuthSession`
- `apps/api/src/main.ts` — cookie-parser, CORS with credentials
- `apps/api/src/app.module.ts` — imported `AuthModule`
- `apps/api/src/modules/intake/intake.controller.ts` — uses `@CurrentActor()` instead of header bag
- `apps/api/src/modules/health/health.controller.ts` — marked `@Public()`
- `apps/api/src/modules/bitrix24/bitrix24.controller.ts` — marked `@Public()` (webhook endpoint)
- `apps/web/src/lib/api-client.ts` — `credentials: include`, conditional actor headers
- `apps/web/src/components/AppShell.tsx` — shows `UserMenu` in google mode, `ActorSelector` in dev mode
- `apps/web/src/app/layout.tsx` — wraps with `AuthProvider` + `ClientLayout`
- `apps/web/.env.local.example` — added `NEXT_PUBLIC_AUTH_MODE`
- `apps/web/.env.local` — set `NEXT_PUBLIC_AUTH_MODE=dev_headers`
- `Dockerfile.web` — added `NEXT_PUBLIC_AUTH_MODE` build arg
- `docker-compose.server.yml` — passes `NEXT_PUBLIC_AUTH_MODE` to web build
- `.env.example` — full auth env block
- `.env.server.example` — full auth env block with google defaults
- `package.json` — no new scripts (auth is built into existing check/build/demo flow)

---

## Auth Architecture

### Mode: dev_headers

- All existing tests, demos, seed, and smoke scripts work unchanged.
- Actor identity comes from `x-actor-id`, `x-actor-role`, `x-actor-name` headers.
- No session required. No database lookup on intake routes.
- Frontend actor selector visible.

### Mode: google

- All intake routes require a valid `intake_os_session` cookie.
- Health and `/auth/*` routes are public (`@Public()` decorator).
- Login flow: `/auth/google/start` → Google → `/auth/google/callback` → set cookie → `/intakes`.
- Session token: 32-byte random, SHA-256 hashed before Postgres storage.
- Actor headers ignored; role resolved from `AuthUser.role` in DB.
- Frontend actor selector hidden; `UserMenu` shows name/email/role/logout.
- Route protection: `AuthGate` redirects to `/login` if unauthenticated.

### Role Resolution

Priority order:
1. `AUTH_ADMIN_EMAILS`
2. `AUTH_INTAKE_OWNER_EMAILS`
3. `AUTH_DEVOPS_LEAD_EMAILS`
4. `AUTH_DEVELOPER_EMAILS`
5. `AUTH_ALLOWED_EMAILS` (if set, overrides domain check)
6. `AUTH_ALLOWED_DOMAINS` (domain match → `AUTH_DEFAULT_ROLE`)
7. If no restrictions configured → `AUTH_DEFAULT_ROLE` for all
8. Otherwise → null (login rejected)

---

## Verification Results

```
npm run check             → PASS (73/73 core tests + 19 new auth tests)
npm run api:build         → PASS
npm run web:build         → PASS
npm run prisma:generate   → PASS
npm run demo:mvp          → PASS
npm run demo:analysis     → PASS
npm run demo:analysis-review → PASS
npm run demo:review-guard    → PASS
npm run demo:reviewed-distribution → PASS
auth-role-resolution.test → 11/11 PASS
auth-session.test (unit)  → 8/8 PASS
```

Manual auth verification (requires Google OAuth keys and `AUTH_MODE=google`):
- See `.env.server.example` for required vars
- `AUTH_PUBLIC_BASE_URL` must match browser-visible URL
- Register callback: `AUTH_PUBLIC_BASE_URL + /api/auth/google/callback`

---

## Known Limitations

- Role mapping is env-var based; no role management UI yet.
- `AuthSession` cleanup (expired session GC) not yet implemented.
- `Bitrix24` webhook endpoint is `@Public()` — webhook secret auth is a future task.
- Google OAuth requires real credentials and a registered callback URL to test end-to-end.

---

## Handoff

TASK-0014 (guided AI draft regeneration) can now attribute steering guidance to a real authenticated person. The `AuthenticatedActor` shape flows through `@CurrentActor()` into the workflow service via the `toDomainActor` bridge in `intake.controller.ts`.

Next: TASK-0014 → Guided AI Draft Regeneration
