# TASK-0032 — Input Validation Hardening

**Status:** READY — no credentials required  
**Priority:** MEDIUM — required before email and Chat intake sources go live  
**Estimated effort:** 1–2 hours  
**Blocked on:** nothing

---

## Problem

The current DTOs use `@MinLength(1)` to prevent empty strings, but have no maximum length constraints. A malicious or broken client can POST:

- A 10 MB project description that gets passed to OpenAI/Anthropic (token cost + latency)
- A title with 100,000 characters that renders unusably in the UI
- A `reason` or `note` field with arbitrary binary content

When email and Chat intake are live, the attack surface expands: anyone who can send an email to the intake address or trigger the Chat webhook can attempt to flood these fields. The AI evaluation layer has no protection against abnormally large inputs.

Additionally, several DTOs have fields that accept strings where more constrained validation would be appropriate.

---

## Acceptance Criteria

- [ ] `CreateIntakeDto`: all text fields have `@MaxLength` constraints
- [ ] `RequestChangesDto`, `ApprovalDecisionDto`, `RejectAnalysisDraftDto`: `reason` and `comment` fields have `@MaxLength`
- [ ] `RegenerateAnalysisDraftDto`: `reason` field has `@MaxLength`
- [ ] All new intake source DTOs (email, chat — when built) include `@MaxLength` on all string fields
- [ ] API returns `HTTP 400` with a field-level validation error message when max length is exceeded
- [ ] `class-validator` pipe is confirmed to be globally registered (not just per-route)
- [ ] Unit tests confirm 400 is returned when max length is exceeded on key endpoints
- [ ] Length constants are defined as named constants, not magic numbers scattered in decorators

---

## What to Build

### 1. Define length constants

**New file:** `apps/api/src/common/validation-constants.ts`

```typescript
export const MAX_INTAKE_TITLE_LENGTH = 200;
export const MAX_INTAKE_DESCRIPTION_LENGTH = 5000;
export const MAX_REQUESTER_NAME_LENGTH = 100;
export const MAX_DEPARTMENT_NAME_LENGTH = 100;
export const MAX_REASON_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_NOTE_LENGTH = 500;
export const MAX_DISCOVERY_FIELD_LENGTH = 2000;
export const MAX_EXTERNAL_ID_LENGTH = 255;
export const MAX_URL_LENGTH = 2048;

// Email intake specific
export const MAX_EMAIL_SUBJECT_LENGTH = 500;
export const MAX_EMAIL_BODY_LENGTH = 50_000;    // generous for email bodies
export const MAX_EMAIL_FROM_LENGTH = 255;

// Chat intake specific
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;
```

### 2. Update `CreateIntakeDto`

[apps/api/src/modules/intake/dto/create-intake.dto.ts](../../apps/api/src/modules/intake/dto/create-intake.dto.ts)

```typescript
import {
  MAX_INTAKE_TITLE_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_DEPARTMENT_NAME_LENGTH,
} from "../../common/validation-constants.js";

export class CreateIntakeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_INTAKE_TITLE_LENGTH)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_INTAKE_DESCRIPTION_LENGTH)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REQUESTER_NAME_LENGTH)
  requester!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DEPARTMENT_NAME_LENGTH)
  department?: string;

  @IsIn(projectTypes)
  projectType!: ProjectType;
}
```

### 3. Update other DTOs

Apply `@MaxLength` to every string field in:

**`RequestChangesDto`:**
- `reason` → `@MaxLength(MAX_REASON_LENGTH)`

**`ApprovalDecisionDto`:**
- `comment` → `@MaxLength(MAX_COMMENT_LENGTH)`

**`RejectAnalysisDraftDto`:**
- `reason` → `@MaxLength(MAX_REASON_LENGTH)`

**`RegenerateAnalysisDraftDto`:**
- `reason` → `@MaxLength(MAX_REASON_LENGTH)`

**`LifecycleTransitionDto`** (new, from TASK-0031):
- `note` → `@MaxLength(MAX_NOTE_LENGTH)`
- `reason` → `@MaxLength(MAX_REASON_LENGTH)`

Also verify `DiscoveryRecord`-related DTOs (complete-discovery.dto.ts) have max lengths on all text fields.

### 4. Confirm global ValidationPipe

Check `apps/api/src/main.ts` for:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,         // strip unknown fields
    forbidNonWhitelisted: true, // 400 on unknown fields
    transform: true,         // coerce types
  }),
);
```

If it's missing `whitelist: true` or `forbidNonWhitelisted: true`, add them. These prevent fields not declared in the DTO from reaching the handler — important for intake sources that receive external payloads.

### 5. API error response format

Confirm that validation errors return a consistent format:

```json
{
  "statusCode": 400,
  "message": ["description must be shorter than or equal to 5000 characters"],
  "error": "Bad Request"
}
```

NestJS `ValidationPipe` produces this format by default. No custom error handling needed.

---

## Validation Constants Summary

| Field | Max Length | Rationale |
|---|---|---|
| `title` | 200 | Readable in Monday item name, GitHub repo description |
| `description` | 5,000 | ~5 printed pages; enough detail without flooding prompts |
| `requester` | 100 | Full name + suffix |
| `department` | 100 | Department name |
| `reason` / `comment` | 1,000 / 2,000 | Review comments, rejection reasons |
| `note` | 500 | Short operational notes |
| `email subject` | 500 | RFC 5321 practical limit |
| `email body` | 50,000 | Generous for email; AI truncates at evaluation |
| `chat message` | 10,000 | Slash command input via dialog |

These are not architectural limits — they're operational guardrails. If a real use case requires longer descriptions, adjust the constant and run a migration.

---

## Files to Create / Change

| File | Change |
|---|---|
| `apps/api/src/common/validation-constants.ts` | NEW — named length constants |
| `apps/api/src/modules/intake/dto/create-intake.dto.ts` | ADD @MaxLength |
| `apps/api/src/modules/intake/dto/request-changes.dto.ts` | ADD @MaxLength |
| `apps/api/src/modules/intake/dto/approval-decision.dto.ts` | ADD @MaxLength |
| `apps/api/src/modules/intake/dto/reject-analysis-draft.dto.ts` | ADD @MaxLength |
| `apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.ts` | ADD @MaxLength |
| `apps/api/src/modules/intake/dto/complete-discovery.dto.ts` | ADD @MaxLength on all string fields |
| `apps/api/src/main.ts` | VERIFY global ValidationPipe options |
| `tests/input-validation.test.mjs` | NEW — boundary tests |

---

## Tests Required

```
tests/input-validation.test.mjs
```

These are HTTP-layer tests against the running API (or NestJS testing utilities):

| Test | Description |
|---|---|
| title over 200 chars → 400 | POST /intakes with 201-char title → 400 |
| description over 5000 chars → 400 | POST /intakes with 5001-char description → 400 |
| description at 5000 chars → 201 | POST /intakes with exactly 5000-char description → succeeds |
| unknown field stripped | POST /intakes with extra field → succeeds, extra field not persisted |
| unknown field rejected (if forbidNonWhitelisted) | POST /intakes with extra field → 400 if strict mode |
| empty title → 400 | POST /intakes with title="" → 400 |
| reason over 1000 chars on request-changes → 400 | POST .../request-changes with long reason → 400 |

---

## What NOT to Change

- Do not change the minimum length constraints — `@MinLength(1)` is correct.
- Do not add `@Matches` regex validators at this stage — they are easier to get wrong than they are to add value. Length constraints are the 80% solution.
- Do not change any business logic, state transitions, or service code.
- Do not add client-side max length enforcement — the API is the boundary. The web form already has some HTML `maxlength` attributes; leave them as-is or sync them with these constants as a follow-up.

---

## Open Questions

| ID | Question | Owner |
|---|---|---|
| Q-VAL-1 | Should `forbidNonWhitelisted: true` be enabled globally? (This will 400 any request with extra fields.) | Engineering |
| Q-VAL-2 | Should description have a minimum useful length (e.g., `@MinLength(20)`)? | Product |
| Q-VAL-3 | When email intake is live, should abnormally large email bodies be truncated silently or rejected with a bounce? | Product |

---

## Handoff

Pure DTO changes. No database migrations, no service logic, no state machine changes. The risk of regression is low — validation errors are new (where they were previously missing). Existing valid requests are not affected. Run `npm run typecheck` and existing tests to verify no regressions.
