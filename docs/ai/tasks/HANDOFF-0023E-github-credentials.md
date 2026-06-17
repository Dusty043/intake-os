# Handoff: TASK-0023E — GitHub Adapter (Waiting on Credentials)

**Written:** 2026-06-17
**Status:** BLOCKED — needs GitHub PAT and org config before any code can be written
**Spec:** [TASK-0023E-github-adapter.md](./TASK-0023E-github-adapter.md)

---

## What This Handoff Is For

The code architecture for GitHub provisioning is fully spec'd. When an intake is
approved and distributed, the app should automatically create a GitHub repo under
your org with a generated name, a README built from the intake package, standard
labels, and optionally one issue per subtask.

Everything except the real GitHub writes is already working (approval gates,
distribution plan, dry-run preview, retry logic). This document tells you what
decisions to make and what credentials to provide.

---

## Open Questions — Need Answers Before Any Code

| # | Question | Why it matters |
|---|---|---|
| Q-G-1 | **Which GitHub org** should repos be created under? | The org name goes in config. All provisioned repos will live here. Likely `Simple-biz` but confirm. |
| Q-G-2 | **Private repos by default?** | Almost certainly yes for internal work. Confirm the default so the adapter doesn't accidentally create public repos. |
| Q-G-3 | **PAT or fine-grained token?** | A fine-grained token scoped to just the org and specific permissions is safer for production. A classic PAT with `repo` scope is simpler to set up. Either works. |
| Q-G-4 | **Which team prefixes are approved?** | Repo names follow the pattern `{prefix}-{type}-{slug}`. Current examples in the code: `ds`, `ops`, `client`, `internal`. Confirm the canonical list. |
| Q-G-5 | **Create issues from subtasks in v1?** | One issue per subtask from the distribution package. Useful but optional. Default will be off (`GITHUB_CREATE_ISSUES=false`) unless you want it enabled from the start. |
| Q-G-6 | **Token owner account** — personal account or a dedicated service account? | Repos created by a personal token show that person as the creator in GitHub's audit log. A dedicated machine account (`intake-os-bot` or similar) is cleaner for production. |
| Q-G-7 | **Should the README include the OS deep link?** | The generated README will include the intake URL (`https://100.75.210.83/intakes/{id}`) for traceability. Fine unless repos will be shared with external parties. |

---

## What You Need to Get

### 1. Personal Access Token (PAT)

**Option A — Fine-grained PAT (recommended for production):**

Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.

Create a token with:
- Resource owner: `Simple-biz` (or your org)
- Repository access: `All repositories` or specific repos
- Repository permissions:
  - `Contents`: Read and write
  - `Issues`: Read and write
  - `Metadata`: Read
- Organization permissions:
  - `Members`: Read

**Option B — Classic PAT (simpler for now):**

Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).

Scopes needed: `repo` (full repo control, includes private repos).

The token owner must be an org member with permission to create repos.

```
GITHUB_PAT=ghp_...
```

### 2. Org Name

```
GITHUB_ORG=Simple-biz
```

### 3. Repo Visibility

```
GITHUB_REPO_VISIBILITY=private
```

### 4. Default Team Prefix

Used in repo slug generation when no prefix is specified in the provisioning plan:

```
GITHUB_DEFAULT_TEAM_PREFIX=ds
```

### 5. Issues Flag (optional, default off)

```
GITHUB_CREATE_ISSUES=false
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
GITHUB_PAT=ghp_...
GITHUB_ORG=Simple-biz
GITHUB_REPO_VISIBILITY=private
GITHUB_DEFAULT_TEAM_PREFIX=ds
GITHUB_CREATE_ISSUES=false
```

If you also have Monday configured, update the targets line:
```
PROVISIONING_TARGETS=monday,github
```

If GitHub only for now:
```
PROVISIONING_TARGETS=github
```

**Do not commit `.env.server` to git.** These are production secrets.

---

## How to Validate the Config

Once the vars are in `.env.server`, run the smoke script before deploying:

```bash
cd /home/oreo/intake-os
PROVISIONING_VALIDATE_GITHUB=true npm run dev:api
```

This will verify:
- Token is valid (`GET /user` succeeds)
- Org exists and token can see it
- Token owner is an org member with repo creation rights
- If `PROVISIONING_VALIDATE_GITHUB=true`: creates and immediately deletes a test repo to confirm write access

Any failure prints a clear error. Fix before going to production.

---

## What Gets Built Once You Have the Config

File: `src/application/provisioning/github-executor.ts`

It slots into the existing `ProvisioningRegistry` alongside (or instead of) the Monday adapter. No workflow changes needed.

What it does on each execution:

1. Generates the repo name from the distribution package using the existing `RepoNamingService` (already in the codebase)
2. Checks if the repo already exists (idempotency: if it was created by a previous run for this intake, returns it without re-creating)
3. Creates the repo under `GITHUB_ORG` with `GITHUB_REPO_VISIBILITY`
4. Writes `README.md` built from the intake distribution package
5. Creates standard labels: `intake-generated`, `needs-triage`, `blocked`, `in-progress`
6. Optionally creates one issue per subtask if `GITHUB_CREATE_ISSUES=true`
7. Stores `{org}/{repoName}` as `externalId` and the full GitHub URL as `externalUrl`
8. Classifies errors: auth/permission failures are permanent (`retryable: false`), rate limits and network errors are transient (`retryable: true`)

Uses `@octokit/rest` (the standard GitHub Node client). Roughly 200–250 lines.

---

## Repo Naming Examples

The naming service is already built and tested. Given these inputs:

| Team prefix | Project type | Title | Generated name |
|---|---|---|---|
| `ds` | `internal_dashboard` | "Client Throughput Dashboard" | `ds-dashboard-client-throughput` |
| `ops` | `api_service` | "Invoice Sync Service" | `ops-api-invoice-sync-service` |
| `ds` | `internal_tool` | "CRM Helper" | `ds-tool-crm-helper` |

If `ds-dashboard-client-throughput` is already taken: `ds-dashboard-client-throughput-2`.

---

## Nothing Else Is Blocked

The full provisioning arc — approve, plan, mark ready, execute, retry — is working with
mock executors. GitHub is a drop-in replacement for the mock GitHub executor. Once the
token and org are confirmed, implementation is straightforward.

Monday (TASK-0023D, see [HANDOFF-0023D-monday-credentials.md](./HANDOFF-0023D-monday-credentials.md))
is independent and can ship before or after GitHub. The two run in parallel when both
are enabled.
