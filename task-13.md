# TASK-0013 — Authenticated Internal Access & Role Resolution

## Status

Planned

## Goal

Replace the temporary actor-header auth shim with real authenticated internal access.

The system currently trusts request headers:

```text
x-actor-id
x-actor-role
x-actor-name
```

That was useful for early workflow development, UI demos, and smoke tests, but it is not safe for broader access.

TASK-0013 introduces authenticated user identity, role resolution, server-side session handling, and protected API routes while preserving the dev-header mode for local tests and automation.

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
TASK-0012  Private server runtime deployment           planned / in progress
```

TASK-0013 should be implemented before:

```text
TASK-0014  Guided AI draft regeneration
TASK-0015  Real AI provider adapter
TASK-0016  GitHub integration
TASK-0017  Monday distribution
```

Reason:

```text
Guided regeneration and future live integrations need real actor attribution.
```

---

# Problem

The current dev actor system allows the client to choose a role.

That means a request can say:

```http
x-actor-role: admin
```

and the backend will treat the request as an admin actor.

This is acceptable only while:

```text
local development
private smoke tests
seed/demo verification
early UI development
```

It is not acceptable for:

```text
Tailscale Funnel demos
public-ish sharing
real reviewers
real AI guidance attribution
live provisioning integrations
```

TASK-0013 fixes that by making the API resolve actor identity from an authenticated session.

---

# Target Governance Model

Before TASK-0013:

```text
Browser chooses actor
→ sends actor headers
→ API trusts headers
→ workflow service checks role
```

After TASK-0013:

```text
User signs in
→ API verifies session
→ API resolves actor identity and role
→ workflow service checks role
```

The workflow service should still receive an actor, but the actor must come from trusted backend auth context.

---

# Auth Provider

Initial provider:

```text
Google Workspace / Google OAuth OIDC
```

This should be implemented as the first real auth provider because the app is intended for internal company access.

Do not build a full custom username/password system.

Do not build a full RBAC admin UI in this task.

---

# Auth Modes

Add explicit auth modes.

Recommended config:

```dotenv
AUTH_MODE=dev_headers
```

Supported values:

```text
dev_headers
google
```

## Mode: dev_headers

Used for:

```text
local development
existing tests
existing demo scripts
seed/smoke scripts
Claude/Codex implementation loops
```

Behavior:

```text
API accepts x-actor-id, x-actor-role, x-actor-name
same behavior as current system
should not be used for public access
```

## Mode: google

Used for:

```text
private server runtime
real user testing
Tailscale Serve
Tailscale Funnel demo mode
future production
```

Behavior:

```text
API ignores actor headers
API requires authenticated session
API resolves actor from session user
API derives role server-side
```

Important:

```text
In google mode, actor headers must not grant permissions.
```

If actor headers are sent in google mode, they should be ignored.

Optional: log a warning in debug logs.

---

# Product Rules

1. Users must sign in before accessing protected API routes.
2. The backend, not the frontend, resolves actor identity.
3. The backend, not the frontend, resolves actor role.
4. Actor headers remain available only in `AUTH_MODE=dev_headers`.
5. Actor headers are ignored in `AUTH_MODE=google`.
6. The UI actor selector becomes dev-only.
7. Authenticated users should see their name, email, and role in the UI.
8. Logout must clear the session.
9. Health endpoints remain unauthenticated.
10. Swagger/OpenAPI may remain enabled for private server demos but should be disabled or protected before broader exposure.
11. Existing tests and demo scripts must continue to work in dev auth mode.
12. No live AI/Monday/GitHub integration should be added in this task.
13. No n8n should be introduced.

---

# Role Model

Use the current role model unless intentionally changed elsewhere.

Expected roles:

```text
request_creator
intake_owner
devops_lead
admin
developer
```

Do not introduce `devops_reviewer` in this task.

TASK-0014 should use `devops_lead`.

---

# Role Resolution

Use environment-based role mapping for this task.

Do not build a role-management UI yet.

Recommended env vars:

```dotenv
AUTH_ALLOWED_DOMAINS=simple.biz
AUTH_ALLOWED_EMAILS=

AUTH_ADMIN_EMAILS=
AUTH_INTAKE_OWNER_EMAILS=
AUTH_DEVOPS_LEAD_EMAILS=
AUTH_DEVELOPER_EMAILS=

AUTH_DEFAULT_ROLE=request_creator
```

Role precedence:

```text
admin
intake_owner
devops_lead
developer
request_creator
```

Example behavior:

```text
If email is in AUTH_ADMIN_EMAILS:
  role = admin

Else if email is in AUTH_INTAKE_OWNER_EMAILS:
  role = intake_owner

Else if email is in AUTH_DEVOPS_LEAD_EMAILS:
  role = devops_lead

Else if email is in AUTH_DEVELOPER_EMAILS:
  role = developer

Else if email domain is allowed:
  role = request_creator

Else:
  reject login
```

Explicit email allowlist should override domain restriction if configured.

Normalize emails:

```text
trim
lowercase
```

---

# Authenticated Actor Shape

Add or standardize:

```typescript
export type AuthenticatedActor = {
  id: string;
  email: string;
  name: string;
  role: ActorRole;
  authProvider: "google" | "dev_headers";
  authSubject?: string;
};
```

`id` should be stable.

Recommended:

```text
For Google users:
  id = provider subject or internal user id

For dev headers:
  id = x-actor-id
```

The service layer should receive this trusted actor object, or a compatible actor shape.

---

# Session Strategy

Use a server-side session cookie.

Recommended:

```text
HttpOnly cookie
random session token
hashed token stored in Postgres
session expiry
logout revokes session
```

This is preferable to storing user identity in localStorage.

Cookie name:

```text
intake_os_session
```

Recommended session length:

```text
8 hours or 24 hours
```

Suggested env vars:

```dotenv
AUTH_SESSION_COOKIE_NAME=intake_os_session
AUTH_SESSION_TTL_HOURS=8
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
```

Notes:

```text
For SSH tunnel / localhost HTTP, AUTH_COOKIE_SECURE=false is acceptable.
For HTTPS/Tailscale Serve/Funnel, AUTH_COOKIE_SECURE=true is preferred.
```

Do not store session tokens in localStorage.

---

# Prisma Models

Add Prisma models if using server-side sessions.

Recommended:

```prisma
model AuthUser {
  id              String        @id @default(cuid())
  provider        String
  providerSubject String
  email           String        @unique
  displayName     String
  role            String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  lastLoginAt     DateTime?

  sessions        AuthSession[]

  @@unique([provider, providerSubject])
}

model AuthSession {
  id          String    @id @default(cuid())
  userId      String
  tokenHash   String    @unique
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?

  user        AuthUser  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

If the codebase already has a user/session model pattern, follow the existing pattern instead.

---

# Auth Module

Add a NestJS auth module.

Recommended files:

```text
apps/api/src/modules/auth/auth.module.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.guard.ts
apps/api/src/modules/auth/auth.decorators.ts
apps/api/src/modules/auth/role-resolver.ts
apps/api/src/modules/auth/session.service.ts
apps/api/src/modules/auth/google-auth.service.ts
```

Adjust paths to match current API structure.

---

# API Endpoints

Add:

```http
GET  /auth/google/start
GET  /auth/google/callback
GET  /auth/me
POST /auth/logout
```

Optional:

```http
GET /auth/config
```

## GET /auth/google/start

Starts Google auth.

Behavior:

```text
generate state
set short-lived state cookie
redirect to Google auth URL
```

## GET /auth/google/callback

Handles provider callback.

Behavior:

```text
validate state
exchange auth code
verify identity token
resolve allowed user
resolve role
create/update AuthUser
create AuthSession
set HttpOnly session cookie
redirect back to web app
```

Recommended redirect after login:

```text
/intakes
```

Configurable:

```dotenv
AUTH_LOGIN_SUCCESS_REDIRECT=/intakes
AUTH_LOGIN_FAILURE_REDIRECT=/login?error=auth_failed
```

## GET /auth/me

Returns current authenticated user.

Response:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_id",
    "email": "person@simple.biz",
    "name": "Person Name",
    "role": "intake_owner"
  },
  "authMode": "google"
}
```

If unauthenticated:

```json
{
  "authenticated": false,
  "authMode": "google"
}
```

Status can be either:

```text
200 with authenticated=false
```

or:

```text
401
```

Prefer `200` for `/auth/me` so the UI can bootstrap cleanly.

## POST /auth/logout

Behavior:

```text
revoke session
clear cookie
return success
```

Response:

```json
{
  "ok": true
}
```

---

# Public Routes

The following routes should remain public:

```text
GET /health
GET /health/db
GET /auth/google/start
GET /auth/google/callback
GET /auth/me
POST /auth/logout
```

`/auth/me` may be public in the sense that it can return unauthenticated state.

Swagger/OpenAPI:

```text
May remain public in private server mode.
Should be disabled or protected before public exposure.
```

---

# Protected Routes

Protect intake workflow routes in `AUTH_MODE=google`.

Examples:

```text
GET  /intakes
GET  /intakes/:id
POST /intakes
POST /intakes/:id/submit
POST /intakes/:id/analysis-drafts/mock
POST /intakes/:id/analysis-drafts/:draftId/accept
POST /intakes/:id/analysis-drafts/:draftId/reject
POST /intakes/:id/analysis-drafts/:draftId/revise
POST /intakes/:id/approvals
POST /intakes/:id/rejections
POST /intakes/:id/provisioning-plan
GET  /intakes/:id/audit
```

Future TASK-0014 route:

```http
POST /intakes/:id/analysis-drafts/:draftId/regenerate
```

should also be protected.

---

# Actor Resolution in Controllers

Current controller likely does something like:

```typescript
const actorId = req.headers["x-actor-id"];
const actorRole = req.headers["x-actor-role"];
const actorName = req.headers["x-actor-name"];
```

Replace with a centralized actor resolver.

Recommended pattern:

```typescript
const actor = getAuthenticatedActor(req);
```

or:

```typescript
@CurrentActor() actor: AuthenticatedActor
```

In `AUTH_MODE=dev_headers`:

```text
CurrentActor comes from headers.
```

In `AUTH_MODE=google`:

```text
CurrentActor comes from session.
```

This keeps controller methods clean and prevents per-endpoint auth drift.

---

# Service Layer Integration

Do not move business permission logic into the UI.

Do not remove existing domain permission checks.

Instead, change the source of actor identity.

Existing service methods can either:

```text
continue accepting actorId, actorRole, actorName
```

or be gradually refactored to:

```typescript
actor: AuthenticatedActor
```

Preferred eventual direction:

```typescript
recordApproval(
  intakeId: string,
  actor: AuthenticatedActor,
  input: ApprovalInput
)
```

For TASK-0013, avoid an oversized refactor if it risks breaking the stable workflow spine.

Acceptable bridge:

```typescript
workflowService.recordApproval(
  intakeId,
  actor.id,
  actor.role,
  input
)
```

---

# Dev Header Mode

Preserve compatibility with:

```text
tests
demo scripts
seed scripts
runtime smoke scripts
local UI actor selector
```

In `AUTH_MODE=dev_headers`, the actor selector still works.

In `AUTH_MODE=google`, the actor selector should be hidden or disabled.

Recommended UI copy in dev mode:

```text
Dev actor selector controls temporary API permission headers.
```

Recommended UI copy in google mode:

```text
Signed in as <name> · <role>
```

---

# Frontend Changes

Update the Next.js app.

## Auth Bootstrap

On app load, call:

```http
GET /api/auth/me
```

or whatever `NEXT_PUBLIC_API_BASE_URL` resolves to.

In server/proxy mode:

```text
NEXT_PUBLIC_API_BASE_URL=/api
```

So the browser calls:

```http
/api/auth/me
```

## Login Page

Add:

```text
/login
```

Behavior:

```text
shows app name
shows auth mode
shows "Sign in with Google"
links to /api/auth/google/start
shows auth errors from query params
```

## User Menu

Replace production actor selector with:

```text
display name
email
role badge
logout button
```

## Dev Mode Actor Selector

Only show actor selector when:

```text
authMode = dev_headers
```

or when frontend env explicitly enables it:

```dotenv
NEXT_PUBLIC_SHOW_DEV_ACTOR_SELECTOR=true
```

In `AUTH_MODE=google`, the selector must not control real permissions.

## Route Protection

If `/auth/me` says unauthenticated:

```text
redirect to /login
```

or show a login required screen.

Keep `/login` public.

---

# API Client Changes

Update frontend API client to include cookies:

```typescript
fetch(url, {
  credentials: "include",
  ...
})
```

When using same-origin `/api`, this should work cleanly.

In dev header mode, continue attaching actor headers.

In google mode, do not attach actor headers.

---

# CORS and Proxy

Preferred server runtime uses same-origin proxy:

```text
/browser
  /api/* → NestJS API
  /*     → Next.js web
```

This avoids most cookie/CORS issues.

For local dev without proxy, if frontend and API run on different ports, configure CORS carefully:

```text
allowed web origins
credentials enabled
```

Recommended env:

```dotenv
WEB_ORIGIN=http://localhost:3001,http://localhost:8080
```

If the actual local web port differs, update accordingly.

---

# Server Runtime Integration

TASK-0012 uses Project Intake OS proxy port:

```text
127.0.0.1:8080
```

because host port `3001` is already used by Uptime Kuma.

TASK-0013 should continue that model.

Server auth callback should be configurable:

```dotenv
AUTH_PUBLIC_BASE_URL=http://localhost:8080
AUTH_GOOGLE_CALLBACK_PATH=/api/auth/google/callback
```

Effective callback:

```text
AUTH_PUBLIC_BASE_URL + AUTH_GOOGLE_CALLBACK_PATH
```

For SSH tunnel mode, browser-visible app URL is:

```text
http://localhost:8080
```

For Tailscale Serve/Funnel, use the browser-visible HTTPS URL as `AUTH_PUBLIC_BASE_URL`.

Do not hardcode server IP or domain.

---

# Environment Variables

Add to `.env.example` and `.env.server.example`:

```dotenv
# Auth
AUTH_MODE=dev_headers

# Google auth, required when AUTH_MODE=google
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=

# Browser-visible public base URL.
# SSH tunnel example:
# AUTH_PUBLIC_BASE_URL=http://localhost:8080
AUTH_PUBLIC_BASE_URL=http://localhost:8080

AUTH_GOOGLE_CALLBACK_PATH=/api/auth/google/callback

AUTH_LOGIN_SUCCESS_REDIRECT=/intakes
AUTH_LOGIN_FAILURE_REDIRECT=/login?error=auth_failed

# Session
AUTH_SESSION_COOKIE_NAME=intake_os_session
AUTH_SESSION_TTL_HOURS=8
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax

# Access control
AUTH_ALLOWED_DOMAINS=
AUTH_ALLOWED_EMAILS=
AUTH_ADMIN_EMAILS=
AUTH_INTAKE_OWNER_EMAILS=
AUTH_DEVOPS_LEAD_EMAILS=
AUTH_DEVELOPER_EMAILS=
AUTH_DEFAULT_ROLE=request_creator

# Local dev CORS if not using same-origin proxy
WEB_ORIGIN=http://localhost:3001,http://localhost:8080
```

Recommended server default after setup:

```dotenv
AUTH_MODE=google
AUTH_PUBLIC_BASE_URL=http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=/api
```

For local automated test/demo mode:

```dotenv
AUTH_MODE=dev_headers
```

---

# Tailscale Notes

Tailscale Serve/Funnel should expose only the local proxy:

```text
127.0.0.1:8080
```

not:

```text
3000
3001
5432
```

When using Tailscale Serve or Funnel, update:

```dotenv
AUTH_PUBLIC_BASE_URL=<browser-visible tailscale URL>
```

Then configure the auth provider callback to match:

```text
<AUTH_PUBLIC_BASE_URL>/api/auth/google/callback
```

If Funnel is used before full production hardening, keep the following posture:

```text
demo data only
auth enabled
basic auth optional but recommended as an extra layer
turn Funnel off after demo
```

---

# Uptime Kuma Note

The server already uses host port `3001` for Uptime Kuma.

TASK-0013 must not change that.

Project Intake OS continues to use:

```text
host 127.0.0.1:8080 → local proxy
```

The Next.js web app may use `3001` internally in Docker only.

Do not expose Project Intake OS web directly on host `3001`.

---

# API Error Behavior

Unauthenticated protected route:

```http
401 Unauthorized
```

Response:

```json
{
  "message": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

Authenticated but unauthorized workflow action:

```http
403 Forbidden
```

Response:

```json
{
  "message": "Actor does not have permission to perform this action.",
  "code": "FORBIDDEN"
}
```

Login denied because user is not allowed:

```http
403 Forbidden
```

or redirect to failure page with:

```text
/login?error=not_allowed
```

UI should render a readable message.

---

# Audit Considerations

Do not create noisy audit events for every page load.

Recommended auth audit events:

```text
auth_login_succeeded
auth_login_rejected
auth_logout
```

Optional. If implemented, keep them separate from intake audit trail unless the event relates to a specific intake.

For intake workflow events, actor metadata should now come from authenticated actor context:

```text
actorId
actorName
actorEmail
actorRole
```

Do not rely on client-provided actor display name in google mode.

---

# Security Requirements

1. Session cookie must be HttpOnly.
2. Session token must not be stored in localStorage.
3. Session token stored in DB must be hashed.
4. Logout revokes the server-side session.
5. Expired sessions are rejected.
6. Actor headers are ignored in google mode.
7. Unknown or unallowed users cannot log in.
8. Role mapping is server-side.
9. API permissions remain enforced server-side.
10. Health endpoints remain safe to expose locally.
11. No real customer data should be used until auth is verified.
12. Auth secrets must not be committed.

---

# Migration Requirements

If adding Prisma models:

```bash
npm run prisma:migrate
```

or equivalent migration generation.

Add migration for:

```text
AuthUser
AuthSession
```

Ensure:

```bash
npm run prisma:generate
```

passes.

Server deploy should run:

```bash
npm run prisma:migrate:deploy
```

inside the API container as TASK-0012 already expects.

---

# Tests

Add tests for auth logic.

Recommended files:

```text
tests/auth-role-resolution.test.mjs
tests/auth-actor-resolution.test.mjs
tests/auth-session.test.mjs
```

Minimum cases:

```text
role resolver assigns admin from AUTH_ADMIN_EMAILS
role resolver assigns intake_owner from AUTH_INTAKE_OWNER_EMAILS
role resolver assigns devops_lead from AUTH_DEVOPS_LEAD_EMAILS
role resolver assigns developer from AUTH_DEVELOPER_EMAILS
allowed domain user defaults to request_creator
unknown domain user is rejected
role precedence is deterministic
dev_headers mode resolves actor from headers
google mode ignores actor headers
protected route rejects unauthenticated request
health route remains public
expired session is rejected
logout revokes session
auth/me returns authenticated user when session is valid
auth/me returns unauthenticated state without session
```

If OAuth callback is hard to test end-to-end, isolate it with provider mocks.

Do not require real Google login for unit tests.

---

# Existing Test Compatibility

Existing tests and demos should still pass in:

```dotenv
AUTH_MODE=dev_headers
```

Do not break:

```text
npm run check
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run smoke:api
npm run smoke:runtime
npm run seed:demo
```

If any scripts need explicit env, document it.

---

# Demo / Manual Verification

Add a small manual auth checklist to README.

Flow:

```text
1. Set AUTH_MODE=google.
2. Set Google client ID/secret.
3. Set AUTH_PUBLIC_BASE_URL to browser-visible app URL.
4. Start server stack.
5. Open /login.
6. Sign in with allowed Google account.
7. Confirm redirect to /intakes.
8. Confirm user menu shows name/email/role.
9. Confirm actor selector is hidden.
10. Confirm request_creator cannot approve Gate 1.
11. Confirm intake_owner can approve Gate 1 when workflow state allows.
12. Confirm logout clears session.
13. Confirm protected routes require login.
```

---

# Files to Add

```text
apps/api/src/modules/auth/auth.module.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.guard.ts
apps/api/src/modules/auth/auth.decorators.ts
apps/api/src/modules/auth/role-resolver.ts
apps/api/src/modules/auth/session.service.ts
apps/api/src/modules/auth/google-auth.service.ts

tests/auth-role-resolution.test.mjs
tests/auth-actor-resolution.test.mjs
tests/auth-session.test.mjs

docs/ai/tasks/TASK-0013-authenticated-internal-access.md
```

Optional frontend files depending on current structure:

```text
apps/web/src/app/login/page.tsx
apps/web/src/components/UserMenu.tsx
apps/web/src/components/AuthGate.tsx
apps/web/src/lib/auth-client.ts
```

---

# Files to Modify

```text
package.json
README.md
.env.example
.env.server.example
apps/api/prisma/schema.prisma
apps/api/src/main.ts
apps/api/src/app.module.ts
apps/api/src/modules/intake/intake.controller.ts
apps/web/src/lib/api-client.ts
apps/web/src/components/AppShell.tsx
apps/web/src/components/ActorSelector.tsx
apps/web/src/app/layout.tsx
apps/web/src/app/intakes/page.tsx
apps/web/src/app/intakes/[id]/page.tsx
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/SEQUENCE_LOG.md
```

Adjust exact paths to match repo.

---

# Package Dependencies

Add only what is needed.

Likely API dependencies:

```text
google-auth-library or OIDC client package
cookie-parser or existing Nest cookie middleware
```

Optional:

```text
jose
```

Do not add a heavy full auth framework unless it clearly simplifies the implementation.

Do not introduce NextAuth unless intentionally choosing to move auth ownership to the Next.js app. Backend-owned auth is preferred because backend owns workflow permissions.

---

# Implementation Order

## Step 1 — Read current auth/header code

Inspect:

```text
apps/api/src/modules/intake/intake.controller.ts
src/domain/permissions.ts
src/application/intake-workflow-service.ts
apps/web/src/lib/api-client.ts
apps/web/src/components/ActorSelector.tsx
```

Identify where actor headers are read and attached.

## Step 2 — Add auth config

Add env vars to:

```text
.env.example
.env.server.example
```

Add config parsing if the project has a config module.

## Step 3 — Add role resolver

Implement role mapping from env.

Test this first.

## Step 4 — Add session models

Add Prisma models if using server-side sessions.

Generate Prisma client and migration.

## Step 5 — Add auth service/module

Implement:

```text
session creation
session lookup
session revocation
Google login start/callback
auth/me
logout
```

## Step 6 — Add auth guard/current actor resolver

Implement:

```text
AUTH_MODE=dev_headers
AUTH_MODE=google
```

Centralize actor resolution.

## Step 7 — Protect intake routes

Apply guard to intake routes.

Keep public routes public.

## Step 8 — Update frontend

Add:

```text
/login
auth bootstrap
user menu
logout
dev-only actor selector
credentials: include
```

## Step 9 — Preserve demos/smokes

Ensure existing scripts still work in `AUTH_MODE=dev_headers`.

## Step 10 — Docs and logs

Update README, task doc, build log, memory index, and sequence log.

---

# Acceptance Criteria

TASK-0013 is complete when:

```text
1. AUTH_MODE exists and supports dev_headers and google.
2. dev_headers mode preserves existing actor-header behavior.
3. google mode ignores actor headers.
4. Google login flow exists.
5. /auth/me exists.
6. /auth/logout exists.
7. Authenticated session cookie is HttpOnly.
8. Session token is not stored in localStorage.
9. Server-side role resolver exists.
10. Allowed domain/email login works.
11. Unknown/unallowed user is rejected.
12. admin role can be resolved from env.
13. intake_owner role can be resolved from env.
14. devops_lead role can be resolved from env.
15. developer role can be resolved from env.
16. default allowed user becomes request_creator.
17. Protected intake routes require auth in google mode.
18. Health routes remain public.
19. UI has /login page.
20. UI shows signed-in user and role.
21. UI hides/disables actor selector in google mode.
22. UI keeps actor selector in dev_headers mode.
23. Logout clears session.
24. Existing tests pass.
25. Existing demos pass in dev_headers mode.
26. API build passes.
27. Web build passes.
28. Prisma generate passes.
29. README documents auth setup.
30. Server docs explain AUTH_PUBLIC_BASE_URL and callback config.
31. Uptime Kuma host port 3001 remains untouched.
32. No live AI provider is added.
33. No live Monday/GitHub writes are added.
34. No n8n is introduced.
```

---

# Verification

Run baseline:

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

Run auth tests:

```bash
npm run check
```

or targeted test command if available.

Run server mode after TASK-0012:

```bash
cp .env.server.example .env.server
# edit AUTH_MODE=google and Google/client role env vars
npm run server:build
npm run server:up
npm run server:health
```

Manual browser auth check:

```text
http://localhost:8080/login
```

or through SSH tunnel:

```bash
ssh -L 8080:localhost:8080 oreo@SERVER_IP
```

Then open:

```text
http://localhost:8080/login
```

Verify:

```text
login works
/auth/me returns current user
/intakes loads after login
logout works
actor selector is hidden in google mode
role permissions still behave correctly
```

---

# Expected Final Report

When complete, report:

```text
TASK-0013 done.

Commit:
- <hash>

Files added:
- auth module files
- login page
- auth tests
- task doc

Files modified:
- package.json
- env examples
- Prisma schema
- API controller/auth wiring
- web app shell/api client
- README
- AI logs

Verification:
- npm run check: pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- existing demos: pass
- auth tests: pass
- manual login: pass
- logout: pass
- protected route check: pass

Known limitations:
- role mapping is env-based
- no role management UI yet
- no production domain yet
- no live AI/Monday/GitHub integrations yet
```

---

# Agent Execution Prompt

Use this with Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0013: Authenticated Internal Access & Role Resolution.

Context:
- TASK-0005 through TASK-0008 completed backend governance.
- TASK-0009 stabilized the API runtime.
- TASK-0010 added the Next.js UI with a temporary actor selector.
- TASK-0011 added seeded demo data and runtime smoke tests.
- TASK-0012 adds private server runtime on local proxy port 8080.
- The app currently trusts x-actor-* headers.
- The server already uses host port 3001 for Uptime Kuma.
- Project Intake OS must continue to use 127.0.0.1:8080 through the local proxy.

Goal:
Replace the actor-header auth shim with real authenticated internal access, while preserving dev_headers mode for tests, demos, and local workflow.

Implement:
1. AUTH_MODE=dev_headers|google.
2. Google OAuth/OIDC login flow.
3. Server-side session cookie.
4. AuthUser/AuthSession persistence or equivalent secure server-side session handling.
5. /auth/google/start.
6. /auth/google/callback.
7. /auth/me.
8. /auth/logout.
9. Role resolver from env email/domain mappings.
10. CurrentActor resolver/decorator/guard.
11. Protected intake routes in google mode.
12. dev_headers behavior preserved in dev_headers mode.
13. actor headers ignored in google mode.
14. UI /login page.
15. UI user menu with name/email/role.
16. Actor selector hidden or disabled in google mode.
17. API client uses credentials: include.
18. Env examples updated.
19. README and AI logs updated.
20. Tests for role resolution, actor resolution, session behavior.

Rules:
- Backend is the source of truth for identity and role.
- Do not trust client-supplied actor headers in google mode.
- Do not store session token in localStorage.
- Use HttpOnly cookie.
- Keep health endpoints public.
- Do not break existing demos/smokes in dev_headers mode.
- Do not bind Project Intake OS to host port 3001.
- Do not introduce n8n.
- Do not implement real AI provider.
- Do not implement live Monday/GitHub writes.
- Do not build role-management UI yet.

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

Manual:
- set AUTH_MODE=google
- configure Google auth env vars
- start server stack
- open http://localhost:8080/login through SSH tunnel or local server browser
- sign in
- verify /auth/me
- verify /intakes loads
- verify actor selector is hidden
- verify user menu shows role
- verify logout
- verify protected routes reject unauthenticated requests

Return:
- commit hash
- files added
- files modified
- verification results
- manual auth notes
- known limitations
- next recommended task
```

---

# Human Dev Notes

TASK-0013 is not about fancy enterprise auth.

It is about replacing this:

```text
The browser says "trust me, I am admin."
```

with this:

```text
The backend knows who signed in and what role they have.
```

Keep the implementation simple:

```text
Google login
server-side role mapping
HttpOnly session
backend actor resolver
dev mode preserved
```

After this task, TASK-0014 guided regeneration becomes much safer because reviewer guidance can be attributed to a real authenticated person.

Correct sequence:

```text
TASK-0012 — private server runtime
TASK-0013 — auth
TASK-0014 — guided AI draft regeneration
TASK-0015 — real AI provider adapter
```
