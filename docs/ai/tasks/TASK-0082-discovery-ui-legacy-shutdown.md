# TASK-0082 — Discovery UI and legacy shutdown

**Status:** In progress  
**GitHub:** https://github.com/Dusty043/intake-os/issues/44

## Request

Make Discovery the primary workspace, add packet progress/preview/download, and disable legacy downstream mutations.

## Plan

1. Remove Intake creation and provisioning from primary navigation.
2. Add a dense in-session packet workspace with accessible states.
3. Disable provisioning executors and return HTTP 410 for mutation routes.
4. Verify responsive UI, ownership, endpoint shutdown, and builds.

## Handoff

Legacy records and read-only history remain available for compatibility.
