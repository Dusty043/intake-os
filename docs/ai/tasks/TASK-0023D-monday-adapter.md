# TASK-0023D — Monday Provisioning Adapter

**Status:** SPEC READY — not started. Blocked on credentials (see below).
**Spec date:** 2026-06-17

---

## Goal

Wire `MondayProvisioningExecutor implements ProvisioningExecutor` into the existing
`ProvisioningRegistry`. The adapter is an edge executor — it does not touch the
workflow, state machine, or approval gates. It slots into the registry and the rest
falls out of the foundation built in TASK-0023A/C.

---

## Blocked On

```
MONDAY_API_TOKEN   — .env.server on oreochiserver, never committed
MONDAY_BOARD_ID    — which board receives new projects
MONDAY_GROUP_ID    — which group within that board
MONDAY_COLUMN_MAP_JSON — JSON map of { column_id: field_source }
```

Do not start implementing until these are confirmed.

---

## Idempotency — Two Separate Keys (CRITICAL DISTINCTION)

There are two different idempotency concepts. They must not be conflated.

### 1. Internal DB idempotency key (`ProvisioningTargetResult.idempotencyKey`)

Purpose: DB uniqueness per run/target.
Key format (from TASK-0023C):
```
initial:  {intakeId}:{planId}:monday_project_item
retry:    {intakeId}:{planId}:monday_project_item:retry:{retryRunId}
```
Consequence: a new DB row per attempt. This is correct — we want run history.

### 2. Monday mutation idempotency key (`Idempotency-Key` request header)

Purpose: Tell Monday's API "this is the same intended operation, do not create a
second item."

Monday caches the first response for 30 minutes and returns it on duplicate requests
with the same key. A new key on each retry attempt defeats this and creates duplicate
items. Monday explicitly warns against this.

Key format (provider-level, stable across retries for the same target intent):
```
intake:{intakeId}:distribution-plan:{planId}:target:monday:item
```

This key does NOT include the retry run ID. It identifies the logical intent
("create a Monday item for this project under this distribution plan"), not the
attempt number.

**Rule:** if we intentionally want a second Monday item (e.g. a new distribution
plan version), that requires a new planId — which produces a new key naturally.

---

## HTTP Client Requirements

```
POST https://api.monday.com/v2
Authorization: {MONDAY_API_TOKEN}
Content-Type: application/json
API-Version: {MONDAY_API_VERSION}    # default: 2026-04
Idempotency-Key: {providerIdempotencyKey}
```

Notes:
- All GraphQL operations go through the single `/v2` endpoint.
- `2026-04` is the current stable version. `2026-07` is RC — do not use in production.
- `MONDAY_API_VERSION` env var allows pinning without code changes.

---

## GraphQL Mutation Shape

```graphql
mutation CreateProjectItem(
  $boardId: ID!
  $groupId: String
  $itemName: String!
  $columnValues: JSON!
) {
  create_item(
    board_id: $boardId
    group_id: $groupId
    item_name: $itemName
    column_values: $columnValues
  ) {
    id
    name
    url
  }
}
```

Column values must be a JSON string keyed by Monday column ID. Format varies by type:
- Status: `{ "label": "In Progress" }`
- Date: `{ "date": "2026-06-17" }`
- Text: plain string
- Number: plain number as string

Column IDs must match the actual board schema. Wrong IDs or wrong formats error.

Mapping: use `MONDAY_COLUMN_MAP_JSON` env var to specify which intake fields map to
which Monday column IDs. Parsed at startup; validated against the board schema.

---

## Error Handling

Monday returns application errors in the `errors` array **even on HTTP 200**. The
adapter cannot treat `response.ok === true` as success. It must inspect the JSON body.

```typescript
if (body.errors?.length) {
  // classify from body.errors[0].extensions?.code
}
```

### Retryable vs non-retryable

| Condition | retryable |
|---|---|
| `401 Unauthorized` | false |
| `403 Forbidden` / missing permissions | false |
| `InvalidBoardIdException` | false |
| `InvalidColumnIdException` | false |
| `ColumnValueException` (bad value format) | false |
| `429 Too Many Requests` | true |
| `maxConcurrencyExceeded` in body | true |
| `423 Locked` (board locked) | true |
| `5xx` transport error | true |
| Network timeout | true |

Set `retryable: false` on the returned `ProvisioningTargetResult` for permanent errors.
Set `retryable: true` for transient errors. The retry guard in the service uses this field.

---

## Config Validation / Smoke Path

Before registering `MondayProvisioningExecutor`, the runtime module should:

1. Validate that required env vars are present.
2. If `PROVISIONING_VALIDATE_MONDAY=true`, run a smoke check:
   - Fetch board info → verify `MONDAY_BOARD_ID` exists and is accessible.
   - Verify `MONDAY_GROUP_ID` is a valid group on that board.
   - For each column ID in `MONDAY_COLUMN_MAP_JSON`, verify it exists on the board
     and the mapped type is compatible.
   - Verify token has write permission (`create_item` on the board).
   - Log warnings for any mismatches; fatal error if board/token is inaccessible.

This prevents silent misconfiguration where the executor is registered but will always
fail at runtime.

A standalone smoke script `scripts/validate-monday-config.ts` should also be provided
for running manually:
```bash
npx ts-node scripts/validate-monday-config.ts
```

---

## Acceptance Criteria

1. `MondayProvisioningExecutor implements ProvisioningExecutor` registered with `targetKind: "monday_project_item"`.
2. Runtime config validation: required Monday env vars checked at startup before executor is registered.
3. Calls `POST https://api.monday.com/v2`.
4. Sends `Authorization`, `Content-Type: application/json`, `API-Version`, and `Idempotency-Key` headers.
5. `MONDAY_API_VERSION` defaults to `2026-04`; env var overrides.
6. Uses `create_item` mutation returning `id`, `name`, `url`.
7. Stores Monday item ID in `externalId`.
8. Stores Monday item URL in `externalUrl`.
9. Parses `body.errors` array even when HTTP status is 200.
10. Returns `retryable: false` for auth/config/validation errors; `retryable: true` for rate-limit/transient errors.
11. Monday mutation `Idempotency-Key` is `intake:{intakeId}:distribution-plan:{planId}:target:monday:item` — stable across retries for the same target intent; does NOT include retry run ID.
12. `PROVISIONING_VALIDATE_MONDAY=true` triggers board/group/column smoke validation at startup.

---

## Files Expected

```
src/application/provisioning/monday-executor.ts     — MondayProvisioningExecutor
src/application/provisioning/monday-api-client.ts   — thin GraphQL HTTP client
src/application/provisioning/monday-config.ts       — env var schema + validation
scripts/validate-monday-config.ts                    — smoke test script
```

The runtime module (`apps/api/src/runtime/runtime.module.ts`) should only register
the Monday executor if `PROVISIONING_TARGETS` includes `"monday"` and required env
vars are present.

---

## Handoff Notes

- Do not merge DB idempotency key format with Monday mutation idempotency key format.
- Do not use `2026-07` API version in production code.
- Column format validation is a common source of silent failures — make it loud at startup.
- The `retryable` field on `ProvisioningTargetResult` is the only signal the retry
  service uses to decide which targets to re-run. Set it correctly.
