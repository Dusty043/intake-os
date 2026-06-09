# TASK-0001 Bootstrap Domain Core

## Request

Start building the Project Intake OS from the uploaded repository.

## Context Read

- `AGENTS.md`
- `BUILD_GUIDE.md`
- `docs/product/product-overview.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/project-type-registry.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/repository-and-naming.md`
- `docs/product/requirements-trace.md`

Missing expected context:

- `docs/ai/PROJECT_MEMORY.md` did not exist before this task.
- `docs/ai/KNOWN_CONSTRAINTS.md` did not exist before this task.
- `docs/ai/OPEN_QUESTIONS.md` did not exist before this task.
- `docs/ai/MEMORY_INDEX.md` did not exist before this task.
- `docs/product/distribution-rules.md` was referenced by docs but not present in the uploaded repository.

## Plan

1. Create the missing durable AI memory structure.
2. Add minimal TypeScript package scaffolding with no external runtime dependency.
3. Implement the first domain slice from product specs: workflow, approvals, permissions, project types, repository naming.
4. Add automated tests around implemented product rules.
5. Update build log, memory index, decision record, and requirements trace.

## Changes

- Added `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, and `README.md`.
- Added `src/domain/types.ts`.
- Added `src/domain/workflow.ts`.
- Added `src/domain/permissions.ts`.
- Added `src/domain/project-type-registry.ts`.
- Added `src/domain/repository-naming.ts`.
- Added `src/index.ts` exports.
- Added tests under `tests/`.
- Added `scripts/update-ai-index.mjs`.
- Added `docs/ai/` project memory files and ADR.
- Updated `docs/product/requirements-trace.md` for implemented/tested foundation requirements.

## Commands Run

```bash
npm run typecheck
npm test   # initially failed because Node was invoked against the tests directory instead of test files
npm run check
npm run ai:index
# package verification in a clean unzip
npm run check
```

## Test Results

`npm run check` passed after implementation fixes. The packaged zip was also verified from a clean unzip with `npm run check`.

Coverage added for:

- valid workflow transitions
- invalid workflow transitions
- Gate 2 blocked before Gate 1
- provisioning blocked before approvals and validated distribution package
- archived requests blocked from approval/provisioning
- project type defaults
- highest governance type selection
- optional GitHub requirement resolution
- role permission guards
- audit visibility helpers
- repository slug generation
- collision detection
- manual repo override reason requirement
- default labels
- generated README handoff sections

## Decisions

- Used framework-neutral TypeScript domain modules before selecting UI/API/database framework.
- Avoided third-party dependencies for the first build slice.
- Treated missing `distribution-rules.md` as a documented gap rather than inventing live distribution behavior.

## Open Questions

- Which monolith framework should wrap the domain core?
- Should the missing distribution rules file be recreated from appendices before package/provisioning implementation?
- What are the approved GitHub org, repo privacy default, and Monday board schema?

## Handoff

The repository is ready for the next implementation slice. Recommended next task: persistence/API scaffolding around request lifecycle and audit events, or restore `docs/product/distribution-rules.md` before implementing distribution package generation.
