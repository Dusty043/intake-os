# Handoff: TASK-0023D — Monday Adapter (Waiting on Credentials)

**Written:** 2026-06-17
**Status:** BLOCKED — needs Monday credentials and board config before any code can be written
**Spec:** [TASK-0023D-monday-adapter.md](./TASK-0023D-monday-adapter.md)

---

## What This Handoff Is For

The code architecture for Monday provisioning is fully designed and spec'd. Everything
else in the app — approval gates, distribution plan, execution framework, retry
mechanism — is working. The only missing piece is credentials and board configuration.

This document is for whoever has access to Monday: get these five things, drop them
into `.env.server` on oreochiserver, and the adapter can be implemented and deployed.

---

## What You Need to Get

### 1. API Token

Go to your Monday profile → **Developers → API**. Generate a personal API token
or (preferred) a service account token scoped to the board.

**Required permission:** the token must be able to call `create_item` on the target board.

```
MONDAY_API_TOKEN=...
```

### 2. Board ID

Open the target Monday board in your browser. The board ID is in the URL:
```
https://simple-biz.monday.com/boards/1234567890
                                       ^^^^^^^^^^
                                       this is MONDAY_BOARD_ID
```

```
MONDAY_BOARD_ID=1234567890
```

### 3. Group ID

Groups are the sections within a board (e.g. "New Projects", "In Review"). Run the
following query in [Monday's API Playground](https://developer.monday.com/api-reference/playground)
to list all groups on your board:

```graphql
{
  boards(ids: [YOUR_BOARD_ID]) {
    groups {
      id
      title
    }
  }
}
```

Pick the group where new intake projects should land.

```
MONDAY_GROUP_ID=new_group
```

### 4. Column Mapping

New items need their columns pre-filled. Run this query to list all columns on the board:

```graphql
{
  boards(ids: [YOUR_BOARD_ID]) {
    columns {
      id
      title
      type
    }
  }
}
```

Then decide which Monday column maps to which intake field. Minimum useful set:

| What to populate | Monday column type | Notes |
|---|---|---|
| Project title | `name` (item name) | Set automatically, no column ID needed |
| Project type | `status` or `text` | e.g. "Internal Dashboard", "API Service" |
| Requester | `text` or `person` | Who submitted the request |
| Story points | `numbers` | Estimated effort |
| Department | `text` | Optional |
| Intake OS link | `link` | Deep link back to the intake review page |

Build a JSON object mapping column IDs to intake fields. Example:

```json
{
  "status_col_xyz": "projectType",
  "text_col_abc": "requester",
  "numbers_col_def": "estimatedStoryPoints",
  "text_col_ghi": "department",
  "link_col_jkl": "intakeUrl"
}
```

```
MONDAY_COLUMN_MAP_JSON={"status_col_xyz":"projectType","text_col_abc":"requester",...}
```

### 5. API Version (probably fine as default)

Default is `2026-04` (current stable). Only change this if you have a reason to:

```
MONDAY_API_VERSION=2026-04
```

---

## Where to Put Them

SSH into oreochiserver and add to `/home/oreo/intake-os/.env.server`:

```bash
ssh oreo@100.75.210.83
nano /home/oreo/intake-os/.env.server
```

Add:
```
MONDAY_API_TOKEN=...
MONDAY_BOARD_ID=...
MONDAY_GROUP_ID=...
MONDAY_COLUMN_MAP_JSON=...
MONDAY_API_VERSION=2026-04
PROVISIONING_TARGETS=monday
```

**Do not commit `.env.server` to git.** These are production secrets.

---

## How to Validate the Config

Once the vars are in `.env.server`, before implementing or deploying, run the
smoke script (which will be written as part of TASK-0023D):

```bash
cd /home/oreo/intake-os
PROVISIONING_VALIDATE_MONDAY=true npm run dev:api
```

This will verify:
- Board exists and token can read it
- Group ID is valid on that board
- Every column ID in `MONDAY_COLUMN_MAP_JSON` exists on the board
- Token has write permission to create items

Any misconfiguration prints a clear error and prevents startup. Fix before deploying.

---

## What Gets Built Once You Have the Config

The adapter is a single file: `src/application/provisioning/monday-executor.ts`.

It slots into the existing registry without any workflow changes. The full execution
path (approve → execute → Monday item created → externalId stored → retry if failed)
is already wired. The Monday executor is the only missing piece.

Specifically it will:

1. Call `POST https://api.monday.com/v2` with the `create_item` mutation
2. Send `Idempotency-Key: intake:{intakeId}:distribution-plan:{planId}:target:monday:item` — this key is stable across retries so Monday never creates a duplicate item
3. Return the Monday item's `id` (stored as `externalId`) and `url` (stored as `externalUrl`)
4. Classify errors as retryable or not — auth/config errors are permanent, rate limits are transient
5. Inspect `body.errors` even on HTTP 200 (Monday returns app errors this way)

The whole thing is probably 150–200 lines. Once the creds are in `.env.server`, it's
a two-hour implementation and a PR.

---

## Questions to Answer Before Starting

These are in `docs/ai/tasks/TASK-0023-provisioning-and-integrations-plan.md` as
Q-PROV-001 through Q-PROV-004. Summary:

- [ ] Which board receives new project intake items? (board ID)
- [ ] Which group within that board? (group ID)
- [ ] Which columns map to which intake fields? (column mapping JSON)
- [ ] Should subtasks from the distribution package become Monday subitems? (optional in v1)
- [ ] Is Monday the only provisioning target for v1, or should GitHub also be enabled at the same time?

---

## Nothing Else Is Blocked

The rest of the provisioning arc is working:
- Approval gates: working
- Distribution plan generation: working
- Dry-run preview UI: working
- Execute distribution (mock): working
- Retry failed targets: working (TASK-0023C, committed `62e3aad`)

Monday adapter is the first real external write. GitHub adapter (TASK-0023E) follows
the same pattern but needs a different set of credentials (PAT, org name).
