# TASK-0029 — Rate Limiting

**Status:** COMPLETE  
**Priority:** HIGH — required before email and Chat intake sources go live  
**Estimated effort:** 1–2 hours  
**Blocked on:** nothing

---

## Problem

No endpoint in the API has rate limiting. This is acceptable while the only intake source is the internal web UI (which requires auth). It becomes a serious problem the moment any public-facing or unauthenticated intake source is activated:

- **Email intake (TASK-0025):** `POST /intake-sources/email` receives webhooks from external email services. An attacker who knows the URL can flood it, creating hundreds of draft intakes or exhausting AI evaluation budget.
- **Google Chat intake (TASK-0026):** `POST /intake-sources/chat` receives slash command events from Google's infrastructure. If JWT verification is bypassed or the service URL is discovered, same problem.
- **AI evaluation trigger:** `POST /intakes/:id/generate-evaluation` kicks off an OpenAI/Anthropic call. No throttle means a single user or script can burn through the entire AI budget.
- **Intake submission:** `POST /intakes` creates records. No throttle means a flood of draft creation.

NestJS ships `@nestjs/throttler` out of the box. This is a 1–2 hour task.

---

## Acceptance Criteria

- [ ] `@nestjs/throttler` installed and wired in `AppModule` (or `RuntimeModule`)
- [ ] Global default rate limit: 60 requests per minute per IP
- [ ] Intake submission (`POST /intakes`) limited to 10 per minute per IP
- [ ] AI evaluation trigger (`POST /intakes/:id/generate-evaluation`) limited to 5 per minute per IP
- [ ] Analysis draft regeneration (`POST /intakes/:id/regenerate-analysis-draft`) limited to 5 per minute per IP
- [ ] Mock analysis draft (`POST /intakes/:id/generate-mock-analysis-draft`) limited to 10 per minute per IP
- [ ] Email intake webhook (`POST /intake-sources/email`, when built in TASK-0025) limited to 100 per minute per IP
- [ ] Chat intake webhook (`POST /intake-sources/chat`, when built in TASK-0026) limited to 100 per minute per IP
- [ ] Rate limit exceeded returns `HTTP 429` with a `Retry-After` header
- [ ] Internal server health/status endpoints are excluded from rate limiting (`@SkipThrottle()`)
- [ ] Rate limit config values are environment-variable overridable (not hardcoded)
- [ ] Unit tests confirm throttler is configured

---

## What to Build

### 1. Install the package

```bash
npm install @nestjs/throttler
```

### 2. Create rate limit config

**New file:** `apps/api/src/config/rate-limit.config.ts`

```typescript
export interface RateLimitTier {
  ttl: number;    // seconds
  limit: number;  // requests per ttl
}

export interface RateLimitConfig {
  global: RateLimitTier;
  intakeSubmit: RateLimitTier;
  aiEvaluation: RateLimitTier;
  draftRegeneration: RateLimitTier;
  inboundWebhook: RateLimitTier;
}

export function loadRateLimitConfig(): RateLimitConfig {
  return {
    global: {
      ttl: parseInt(process.env.RATE_LIMIT_GLOBAL_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_GLOBAL_LIMIT ?? "60"),
    },
    intakeSubmit: {
      ttl: parseInt(process.env.RATE_LIMIT_INTAKE_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_INTAKE_LIMIT ?? "10"),
    },
    aiEvaluation: {
      ttl: parseInt(process.env.RATE_LIMIT_AI_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_AI_LIMIT ?? "5"),
    },
    draftRegeneration: {
      ttl: parseInt(process.env.RATE_LIMIT_REGEN_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_REGEN_LIMIT ?? "5"),
    },
    inboundWebhook: {
      ttl: parseInt(process.env.RATE_LIMIT_WEBHOOK_TTL ?? "60"),
      limit: parseInt(process.env.RATE_LIMIT_WEBHOOK_LIMIT ?? "100"),
    },
  };
}
```

### 3. Wire ThrottlerModule in AppModule (or RuntimeModule)

```typescript
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { loadRateLimitConfig } from "./config/rate-limit.config.js";

const rlConfig = loadRateLimitConfig();

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "global",
        ttl: rlConfig.global.ttl * 1000,  // ThrottlerModule expects ms
        limit: rlConfig.global.limit,
      },
    ]),
    // ... rest of imports
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 4. Apply per-route throttlers

Use the `@Throttle()` decorator on specific controller actions that need tighter limits:

```typescript
import { Throttle, SkipThrottle } from "@nestjs/throttler";

// In IntakeController:
@Post()
@Throttle({ default: { ttl: 60_000, limit: 10 } })
async createIntake(@Body() dto: CreateIntakeDto) { ... }

@Post(":id/generate-evaluation")
@Throttle({ default: { ttl: 60_000, limit: 5 } })
async generateEvaluation(@Param("id") id: string) { ... }

@Post(":id/regenerate-analysis-draft")
@Throttle({ default: { ttl: 60_000, limit: 5 } })
async regenerateAnalysisDraft(...) { ... }
```

Use `@SkipThrottle()` on:
- `GET /health`
- `GET /` (root/ping if any)

### 5. Future: webhook routes (TASK-0025 / TASK-0026)

When `IntakeSourcesController` is built:

```typescript
@Post("email")
@Throttle({ default: { ttl: 60_000, limit: 100 } })
async handleEmailWebhook(@Body() body: unknown) { ... }

@Post("chat")
@Throttle({ default: { ttl: 60_000, limit: 100 } })
async handleChatWebhook(@Body() body: unknown) { ... }
```

---

## Environment Variables (add to `.env.server` documentation)

```bash
# Rate limiting (optional — defaults are safe)
RATE_LIMIT_GLOBAL_TTL=60
RATE_LIMIT_GLOBAL_LIMIT=60
RATE_LIMIT_INTAKE_TTL=60
RATE_LIMIT_INTAKE_LIMIT=10
RATE_LIMIT_AI_TTL=60
RATE_LIMIT_AI_LIMIT=5
RATE_LIMIT_REGEN_TTL=60
RATE_LIMIT_REGEN_LIMIT=5
RATE_LIMIT_WEBHOOK_TTL=60
RATE_LIMIT_WEBHOOK_LIMIT=100
```

---

## Files to Create / Change

| File | Change |
|---|---|
| `apps/api/src/config/rate-limit.config.ts` | NEW — rate limit config loader |
| `apps/api/src/app.module.ts` (or `runtime.module.ts`) | ADD ThrottlerModule + APP_GUARD |
| `apps/api/src/modules/intake/intake.controller.ts` | ADD @Throttle() to submission + AI endpoints |
| `apps/api/package.json` | ADD @nestjs/throttler dependency |
| `tests/rate-limiting.test.mjs` | NEW — smoke tests |
| `docs/integrations/INTEGRATION-SETUP-GUIDE.md` | ADD env var section for rate limits |

---

## Tests Required

```
tests/rate-limiting.test.mjs
```

These are integration tests against the running server (or using NestJS testing utilities):

| Test | Description |
|---|---|
| 11th intake submission in 60s returns 429 | POST /intakes 11 times → last returns 429 |
| 6th AI evaluation trigger in 60s returns 429 | POST .../generate-evaluation 6 times → last returns 429 |
| 429 includes Retry-After header | Response has `Retry-After` header |
| Health endpoint not rate-limited | 100 requests to /health all succeed |
| Rate limit resets after TTL | After TTL, requests succeed again |

---

## Rate Limit Tiers (Summary)

| Endpoint | Limit | Window |
|---|---|---|
| All endpoints (global default) | 60 req | 60 sec |
| `POST /intakes` | 10 req | 60 sec |
| `POST /intakes/:id/generate-evaluation` | 5 req | 60 sec |
| `POST /intakes/:id/regenerate-analysis-draft` | 5 req | 60 sec |
| `POST /intakes/:id/generate-mock-analysis-draft` | 10 req | 60 sec |
| `POST /intake-sources/email` (TASK-0025) | 100 req | 60 sec |
| `POST /intake-sources/chat` (TASK-0026) | 100 req | 60 sec |
| `GET /health` | unlimited | — |

---

## What NOT to Change

- Do not modify any business logic, state transitions, or product behavior.
- Do not add auth changes — this is purely a transport-layer concern.
- Rate limits are per-IP. If behind a reverse proxy, confirm `trust proxy` is set correctly in NestJS/Express so the real client IP is used, not the proxy IP.

---

## Notes on Proxy Configuration

If the server runs behind an nginx reverse proxy (which oreochiserver likely does), Express/NestJS must be configured to trust the proxy's `X-Forwarded-For` header for per-IP throttling to work correctly:

```typescript
// In main.ts
const app = await NestFactory.create(AppModule);
app.set("trust proxy", 1);
```

Without this, all requests appear to come from `127.0.0.1` and share a single rate limit bucket — effectively rate-limiting the proxy, not the client.

---

## Open Questions

| ID | Question | Owner |
|---|---|---|
| Q-RL-1 | Is the server behind nginx? Does nginx already do IP rate limiting? | DevOps |
| Q-RL-2 | Should authenticated users (by session) get a higher limit than unauthenticated requests? | Product |
| Q-RL-3 | Should email webhook limits be per-service (identified by HMAC header) rather than per-IP? | Engineering |
