# TASK-0069 Intake form validation UX + dead SOURCES field cleanup

## Request

Task 2 of the plan in `docs/superpowers/plans/2026-07-16-live-streaming-verification-and-ui-qol.md`:
fix the intake form's client-side validation drift against the backend, add length
affordances, and remove the dead `SOURCES` field.

## Context Read

- [x] `docs/ai/tasks/TASK-0066-live-streaming-verification-and-ui-qol-plan.md`
- [x] `apps/web/src/app/intakes/new/page.tsx`
- [x] `apps/api/src/common/validation-constants.ts` (canonical length limits)
- [x] `src/domain/types.ts` (canonical `ProjectType` enum)

## Plan

1. Add a shared frontend validation module mirroring the backend's length constants, plus
   a shared `PROJECT_TYPES` constant, both with drift-guard parity tests against the
   backend/domain source of truth.
2. Wire the intake form to use these: min-length check on description (with inline error,
   not just a post-submit banner), `maxLength` + live counters on title/requester/
   department/description, per-field inline errors instead of a single top banner.
3. Delete the dead `SOURCES` array — no backend `source` field exists to receive it.

## Changes

- `apps/web/src/lib/intake-form-validation.ts` (new): `validateIntakeForm`,
  `isIntakeFormDirty`, and re-exported `MIN_INTAKE_DESCRIPTION_LENGTH` /
  `MAX_INTAKE_TITLE_LENGTH` / `MAX_INTAKE_DESCRIPTION_LENGTH` /
  `MAX_INTAKE_REQUESTER_LENGTH` / `MAX_INTAKE_DEPARTMENT_LENGTH` constants.
- `apps/web/src/lib/project-types.ts` (new): `PROJECT_TYPES` constant (id/label pairs)
  built from the same 10-value enum as `src/domain/types.ts`.
- `apps/web/src/lib/__tests__/intake-form-validation-parity.test.ts` and
  `project-types-parity.test.ts` (new): drift guards — fail if the frontend constants
  and the backend/domain source of truth ever diverge.
- `apps/web/src/app/intakes/new/page.tsx`: imports `PROJECT_TYPES` instead of a
  hardcoded inline array; renders a `N/max` counter next to each bounded field; calls
  `validateIntakeForm` on submit and renders per-field inline errors (replacing the
  single top-of-form `ErrorBanner` for client-side validation failures — the banner is
  still used for API-level errors); deleted the unused `SOURCES` array (no backend field
  receives it).

## Commands Run

```bash
npm run build:core   # clean
npm test             # 795/795 (repo-root backend suite)
npm --prefix apps/web run test  # 34/34 (vitest, includes new intake-form-validation +
                                  # parity test files)
npm --prefix apps/web run typecheck  # clean
```

## Test Results

- `intake-form-validation.test.ts`: min-length rejection, max-length rejection per field,
  required-field rejection, valid-input passes.
- `intake-form-validation-parity.test.ts` / `project-types-parity.test.ts`: assert the
  frontend constants match the backend `validation-constants.ts` values and the domain
  `ProjectType` enum, respectively — fails loudly if either drifts again.
- `apps/web/src/app/intakes/new/__tests__/page.test.tsx`: renders inline error for a
  9-character description, renders live counters, does not render a `SOURCES`/source
  dropdown control.
- Live browser verification (this session, against a disposable local Postgres +
  `AI_PROVIDER=mock` API): typed a 9-character description, submitted — the browser's
  native `required` validation focused the empty Requester field first; after filling
  Requester and resubmitting, the inline error "Description must be at least 20
  characters." rendered directly under the textarea. Project Type dropdown options
  matched the canonical 10-value enum exactly (Internal Tool, Dashboard, API Service,
  Client Portal, SaaS Platform, AI Workflow Tool, Data Pipeline, Automation Script,
  Reporting Automation, Discovery / Research) — no drift, no dead `SOURCES` control
  present.

## Decisions

- Per-field inline errors replace the top banner only for client-side validation
  failures; the top `ErrorBanner` is retained for server/API-level errors (e.g. a 500
  or network failure), since those aren't attributable to a single field.
- `SOURCES` deleted outright rather than wired up — confirmed with the user during
  TASK-0066 planning: no backend `source` field exists yet, and only "Manual" is
  meaningful until email/Chat intake sources are built. No migration or backend change
  needed since nothing consumed it.

## Open Questions

None new.

## Handoff

Item 2 of TASK-0066's plan is complete. Frontend constants now single-source from the
backend/domain registries via parity tests, so classifier/validation drift (the same
class of bug as Q-classifier fixed in TASK-0065) will fail CI on the frontend side too,
not just silently diverge.
