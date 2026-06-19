# TASK-0027 — Auth Hardening

**Status:** COMPLETE — 2026-06-19  
**Priority:** CRITICAL — production security gap  
**Estimated effort:** 1–2 hours  
**Blocked on:** nothing

---

## Problem

[apps/api/src/modules/auth/auth.guard.ts:38](../../apps/api/src/modules/auth/auth.guard.ts) defaults to `"dev_headers"` when `AUTH_MODE` is not set:

```typescript
const authMode = process.env.AUTH_MODE ?? "dev_headers";
```

In `dev_headers` mode, any HTTP client that sets the right request headers (`x-user-id`, `x-user-role`) gets authenticated as any role — including `admin` and `devops_lead`. There is no credential validation whatsoever.

This is a deliberate dev convenience that is catastrophically dangerous if the API ever reaches production without `AUTH_MODE=google` explicitly set. The current default makes a misconfigured production deploy silently insecure instead of loudly broken.

---

## Acceptance Criteria

- [ ] API startup throws a hard error and exits if `NODE_ENV=production` and `AUTH_MODE` is not explicitly set to a real auth mode (i.e. not `"dev_headers"`)
- [ ] API startup throws a hard error and exits if `NODE_ENV=production` and `AUTH_MODE=dev_headers` is explicitly set
- [ ] Startup log clearly states which auth mode is active (INFO level, visible in all environments)
- [ ] `AUTH_MODE=dev_headers` continues to work normally in development and test
- [ ] `AUTH_MODE=google` continues to work normally (no regression)
- [ ] A missing or invalid `GOOGLE_CLIENT_ID` when `AUTH_MODE=google` fails at startup with a clear message, not at request time
- [ ] Unit test: startup validation rejects `dev_headers` in production
- [ ] Unit test: startup validation accepts `dev_headers` in development
- [ ] Unit test: startup validation rejects unknown auth modes

---

## What to Build

### 1. Startup auth config validator

Create `apps/api/src/modules/auth/auth-config.validator.ts`:

```typescript
export type AuthMode = "dev_headers" | "google";

const validModes: AuthMode[] = ["dev_headers", "google"];

export function validateAuthConfig(): { mode: AuthMode } {
  const raw = process.env.AUTH_MODE;
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (!raw) {
    if (nodeEnv === "production") {
      throw new Error(
        "[AUTH] AUTH_MODE is not set. Production requires AUTH_MODE=google. " +
        "Set AUTH_MODE=dev_headers only for local development."
      );
    }
    // default to dev_headers in non-production
    return { mode: "dev_headers" };
  }

  if (!validModes.includes(raw as AuthMode)) {
    throw new Error(
      `[AUTH] Unknown AUTH_MODE="${raw}". Valid values: ${validModes.join(", ")}`
    );
  }

  if (raw === "dev_headers" && nodeEnv === "production") {
    throw new Error(
      "[AUTH] AUTH_MODE=dev_headers is not allowed in production. " +
      "Set AUTH_MODE=google and configure Google OAuth credentials."
    );
  }

  if (raw === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "[AUTH] AUTH_MODE=google requires GOOGLE_CLIENT_ID to be set."
      );
    }
  }

  return { mode: raw as AuthMode };
}
```

### 2. Call at module init

Call `validateAuthConfig()` inside `AuthModule.forRoot()` or in the NestJS `onModuleInit` lifecycle hook of `AuthService`, not lazily inside the guard. Fail before the first request reaches the system.

### 3. Update AuthGuard

Remove the inline `?? "dev_headers"` fallback from the guard. The guard should read from a `AuthConfigService` that has already been validated:

```typescript
// BEFORE (unsafe)
const authMode = process.env.AUTH_MODE ?? "dev_headers";

// AFTER (safe — config was validated at startup)
const authMode = this.authConfigService.mode;
```

### 4. Update auth.service.ts

[apps/api/src/modules/auth/auth.service.ts:38](../../apps/api/src/modules/auth/auth.service.ts) also has the same `?? "dev_headers"` fallback. Update it to use the same validated config.

### 5. Startup log

```
[AuthModule] Auth mode: dev_headers (development)
[AuthModule] Auth mode: google (production) — session cookie: intake_os_session
```

---

## Files to Change

| File | Change |
|---|---|
| `apps/api/src/modules/auth/auth-config.validator.ts` | NEW — startup validation logic |
| `apps/api/src/modules/auth/auth.guard.ts` | Remove `?? "dev_headers"` fallback, use validated config |
| `apps/api/src/modules/auth/auth.service.ts` | Same fallback fix |
| `apps/api/src/modules/auth/auth.module.ts` | Call validator at module init |
| `tests/auth-config-validator.test.mjs` | NEW — unit tests for validator |

---

## Tests Required

```
tests/auth-config-validator.test.mjs
```

| Test | Description |
|---|---|
| rejects missing AUTH_MODE in production | NODE_ENV=production + no AUTH_MODE → throws |
| rejects dev_headers in production | NODE_ENV=production + AUTH_MODE=dev_headers → throws |
| accepts dev_headers in development | NODE_ENV=development + no AUTH_MODE → returns dev_headers |
| accepts dev_headers in development explicit | NODE_ENV=development + AUTH_MODE=dev_headers → returns dev_headers |
| rejects unknown auth mode | AUTH_MODE=magic → throws |
| rejects google without GOOGLE_CLIENT_ID | AUTH_MODE=google + no GOOGLE_CLIENT_ID → throws |
| accepts google with GOOGLE_CLIENT_ID | AUTH_MODE=google + GOOGLE_CLIENT_ID set → returns google |

---

## What NOT to Change

- Do not modify any approval gate, state machine, or provisioning logic.
- Do not change how `dev_headers` works in dev/test — it must remain fully functional.
- Do not modify the Google auth flow (OAuth callback, session service) — only add the startup check.

---

## Open Questions

| ID | Question | Owner |
|---|---|---|
| Q-AUTH-1 | When Google Auth goes live, what `GOOGLE_CLIENT_ID` will be used? | Admin |
| Q-AUTH-2 | Should a missing `AUTH_SESSION_COOKIE_NAME` also fail at startup when `AUTH_MODE=google`? | Engineering |

---

## Handoff

Prerequisite for any public-facing deployment. Fix is small. The validator is a pure function — easy to test. The guard change is mechanical (inject config, remove env read). No database changes. No product behavior changes.
