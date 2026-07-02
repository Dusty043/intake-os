# TASK-0041 — Land Hardening Pass on Main, Baseline Production Migrations, Self-Healing Cron

**Date:** 2026-07-02
**Status:** implemented (logged retroactively — done live against oreochiserver, doc update deferred to this later pass)

## Context

Follow-up to TASK-0040 (hardening pass). Two things surfaced while checking
whether that pass's Slice E fix (`Dockerfile.api`: `prisma db push` →
`prisma migrate deploy`) had actually reached the live server.

### 1. PR #2 never reached `main`

PR #1 (`feature/scheduled-retry-backoff` → `main`) merged at 18:29:41. PR #2
(hardening pass, `feature/hardening-pass-truth-sync` → `feature/scheduled-retry-backoff`)
merged 2 minutes later — but into the *feature* branch, which had already been
merged to `main`. The hardening-pass commit sat on
`feature/scheduled-retry-backoff` only; `main` (what oreochiserver tracks)
never got it.

### 2. Production outage, ~24h, discovered mid-investigation

While checking migration state, found `api` and `postgres` exited on
oreochiserver (`web`/`local-proxy` still up). Logs showed a graceful `postgres`
shutdown and a `SIGKILL` on `api` at the same second (2026-06-30 20:01 UTC) —
a manual stop, not a host reboot (`RestartCount=0`, no reboot evidence).
`restart: unless-stopped` (already set on every service) deliberately does not
restart something that was explicitly stopped, so nothing brought it back.
Data was intact (16 intakes, confirmed post-recovery) — this was a stopped
container, not a lost one.

### 3. Empty migration history on the live database

`_prisma_migrations` had 0 rows despite the repo (once TASK-0040's `.gitignore`
fix landed) having 6 tracked migrations. Production had always been deployed
via `db push`, which doesn't write migration history. Verified via direct
column/enum inspection that production's actual schema already matched
`schema.prisma` exactly (all TASK-0040 "drift" columns already present) — so
this was purely a bookkeeping gap, not a real drift. But shipping the
Slice E `migrate deploy` change as-is would have made the *next* deploy
crash-loop: `migrate deploy` against an empty history tries to run all 6
migrations from scratch against a schema that already has every object in
them → `CREATE TABLE`/`CREATE TYPE` "already exists" errors.

## Decision

All steps confirmed with the user before running (production DB schema state
+ deployment config — both explicitly gated in `CLAUDE.md`'s Safety Rules).

1. Recovered `api`/`postgres` (`docker compose up -d` — safe, no config
   change, just restoring already-defined services).
2. Opened and merged PR #3 (`feature/scheduled-retry-backoff` → `main`) to
   actually land the hardening pass. The merge itself required explicit
   user go-ahead — the auto-mode classifier blocked a self-merge to `main`
   without visible review.
3. Rebuilt the `api` image from `main` (picks up the now-tracked migration
   files, previously baked-empty due to the `.gitignore` bug).
4. Baselined production's migration history: `prisma migrate resolve
   --applied <name>` for all 6 migrations, run via a throwaway `docker
   compose run --rm` container against the new image (metadata-only, no SQL
   executed, doesn't touch the live `api` container). Verified `prisma
   migrate status` reported clean before touching the running service.
5. Deployed the new `api` image. Confirmed via logs: "No pending migrations
   to apply", clean Nest boot, `RestartCount=0`, data still intact (16
   intakes), `/intakes` returns 200 through the proxy.
6. Added a cron-based reconciler on oreochiserver (`*/5 * * * *` +
   `@reboot`, matching an existing convention already on that host for
   another project) running `docker compose up -d` — idempotent, closes the
   exact gap that caused the outage (`restart: unless-stopped` doesn't help
   when something was manually stopped and the daemon never restarted).
   Confirmed idempotent against the live stack (ran once, zero containers
   recreated, uptimes unchanged) before relying on it.

## Not Changed

- `restart: unless-stopped` policy itself — left as-is; it's correct for
  crash recovery, the cron addition covers the gap it doesn't (manual
  stop + no daemon restart).
- No application code changed in this task — this was entirely
  deploy/ops (git merge, image rebuild, migration bookkeeping, cron).

## Follow-ups

- None blocking. The cron job's log (`~/intake-os/self-heal.log` on the
  server) is worth an occasional glance if the outage pattern recurs — it
  would indicate something is repeatedly stopping these containers, not
  just a one-off from an earlier session's manual work.
