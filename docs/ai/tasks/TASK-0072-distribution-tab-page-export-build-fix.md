# TASK-0072 Fix production build break: DistributionTab exported from page.tsx

## Request

Redeploy to oreochiserver. The production `next build` failed during the deploy:

```
src/app/intakes/[id]/page.tsx
Type error: Page "src/app/intakes/[id]/page.tsx" does not match the required types of a
Next.js Page.
  "DistributionTab" is not a valid Page export field.
```

## Context Read

- [x] `docs/ai/tasks/TASK-0070-discovery-a11y-and-toast-audit.md` (introduced the
      `export function DistributionTab` in `page.tsx` to make it testable)
- [x] `apps/web/src/app/intakes/[id]/page.tsx`

## Root Cause

TASK-0070 exported `DistributionTab` directly from `apps/web/src/app/intakes/[id]/page.tsx`
so its new unit test (`DistributionTab.test.tsx`) could import it. Next.js's App Router
enforces that `page.tsx` files only export a small allow-list of fields (default export,
`metadata`, `generateMetadata`, `generateStaticParams`, etc.) — this check only runs
during `next build`'s type-checking pass, not `tsc --noEmit` or `vitest`, so
TASK-0069/0070/0071's verification (`npm run build:core`, `npm test`, `apps/web` vitest,
`apps/web` typecheck) never caught it. The gap: none of those commands actually run
`next build` itself.

## Plan

Move `DistributionTab` (and its private helpers `RunStatusBadge`/`ProvisioningRunPanel`,
only used by it) out of `page.tsx` into their own component file. `KV` (used by both
`DistributionTab` and 32 other places in `page.tsx`) needed to become a shared component
too, since `page.tsx` can no longer re-export it for `DistributionTab` to import.

## Changes

- `apps/web/src/components/KV.tsx` (new): the `KV` label/value helper, previously a
  private function in `page.tsx`.
- `apps/web/src/app/intakes/[id]/DistributionTab.tsx` (new): `DistributionTab` plus its
  private `RunStatusBadge`/`ProvisioningRunPanel` helpers, moved verbatim out of
  `page.tsx`. Imports `KV` from the new shared location.
- `apps/web/src/app/intakes/[id]/page.tsx`: removed the local `KV` definition (now
  imports it), removed `RunStatusBadge`/`ProvisioningRunPanel`/`DistributionTab`
  entirely (now imports `DistributionTab` from `./DistributionTab`). The page's only
  export is now its default export again.
- `apps/web/src/app/intakes/[id]/__tests__/DistributionTab.test.tsx`: import path
  changed from `../page` to `../DistributionTab`.

## Commands Run

```bash
npm run build:core        # clean
npm --prefix apps/web run build   # ✓ Compiled successfully — this is the check that was
                                   # missing before; confirms the fix
npm --prefix apps/web run test    # 34/34 pass
npm test                          # 795/795 pass (backend, unaffected)
npm --prefix apps/web run typecheck  # clean
```

## Test Results

`next build` now completes successfully and generates all 13 routes, including the
dynamic `/intakes/[id]` route. All existing tests still pass — no behavior change, pure
code relocation.

## Decisions

- Extracted only what was necessary to satisfy Next.js's page-export constraint
  (`DistributionTab` + its two private helpers + the shared `KV`), not a broader
  refactor of `page.tsx`'s other large inline tab components (`OverviewTab`,
  `ApprovalsTab`, etc.) — those don't export anything non-standard from `page.tsx`, so
  they don't hit this constraint. Scoped to the actual bug.

## Open Questions

- `npm run check`/`npm test` at the repo root and in `apps/web` do not run `next build`,
  so this class of bug (an export-shape violation that only `next build`'s type-checking
  surfaces) can recur if a future change re-introduces a non-page export from any
  `page.tsx`/`layout.tsx`. Worth considering whether `apps/web`'s `test` or a pre-deploy
  script should include `next build` — not changed here since it's a process question
  beyond this bug fix's scope.

## Handoff

Verified locally with the actual `next build` (not just `tsc`/`vitest`) before
redeploying. Server-side deploy proceeds next.
