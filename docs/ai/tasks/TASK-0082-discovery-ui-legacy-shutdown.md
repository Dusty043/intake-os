# TASK-0082 — Discovery UI and legacy shutdown

**Status:** Complete
**GitHub:** https://github.com/Dusty043/intake-os/issues/44

## Request

Make Discovery the primary workspace, add packet progress/preview/download, and disable legacy downstream mutations.

## Plan

1. Remove Intake creation and provisioning from primary navigation.
2. Add a dense in-session packet workspace with accessible states.
3. Disable provisioning executors and return HTTP 410 for mutation routes.
4. Verify responsive UI, ownership, endpoint shutdown, and builds.

## Handoff

The root and legacy create route now lead to Discovery; primary navigation no
longer exposes Intakes or Create Intake. Discovery streams packet states and
shows a document tree, plain-text preview, warnings, assumptions, and download.
Legacy manifest/distribution/provisioning mutations return 410 and provisioning
executors are absent from runtime registration. Legacy records and read-only
history remain available for compatibility.

## Verification

- Web tests: 33 passed.
- Web production build: passed.
- Browser check confirmed `/` redirects to `/discovery`, the Discovery-only
  primary navigation, Phase 0 branding, and packet-state column.
- A live end-to-end generation was not run because local Postgres on port 5433
  was unavailable; API and ownership behavior are covered by automated tests.

## Test server deployment

Deployed commit `a19b3e2` from `feat/different-direction` to
`/home/oreo/intake-os` on `oreochiserver` on 2026-07-31. Rebuilt and started the
existing `docker-compose.server.yml` stack without changing `.env.server` or the
Postgres volume. The repository healthcheck passed for web, API, database, and
OpenAPI; `/discovery` returned HTTP 200 over the Tailscale address. Runtime logs
confirmed the full Phase 0 orchestrator is active and provisioning executors are
disabled. No cost-bearing packet generation was triggered.

The server already had an unrelated local modification to `docker-compose.yml`.
It is preserved and is not used by the server stack.

### Live truncation follow-up

The first real packet attempt exposed a recurring `custom_build` truncation:
`gpt-5.6-sol` consumed the agent's 6,000 completion-token allowance before
closing its otherwise bounded JSON. The agent now reserves 16,000 tokens while
retaining the six-item, concise-phrase output limits. Phase 0 failures persist
and stream a retry-safe message rather than raw partial provider output.
Regression coverage passes in `tests/phase-zero-packet.test.mjs`; the full core
suite passed 812/812 and the API build passed.
