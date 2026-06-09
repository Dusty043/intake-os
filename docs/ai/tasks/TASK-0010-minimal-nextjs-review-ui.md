# TASK-0010 — Minimal Next.js Review UI

## Status: complete

## Goal

Build the first browser-operable interface for Project Intake OS.

Make the backend governance workflow visible and operable from a browser:
- List intakes
- Create intake
- Submit intake
- Generate mock AI analysis draft
- Accept / reject / revise draft into reviewed project package
- Approve Gate 1 (Intake Owner/Admin)
- Approve Gate 2 (DevOps Lead/Admin)
- Generate distribution preview
- View audit trail
- Debug JSON panel
- Actor selector (dev auth shim)

## Baseline

```
npm run check                 → 49/49 pass
npm run api:build             → pass
npm run prisma:generate       → pass
npm run demo:*                → all 5 pass
```

## Architecture

```
apps/web/               Next.js 15 App Router + TypeScript + Tailwind CSS v3
  src/
    app/
      layout.tsx         RootLayout → ActorProvider → AppShell
      page.tsx           redirect /intakes
      intakes/
        page.tsx         Intake list (client component)
        new/page.tsx     Create intake form (client component)
        [id]/page.tsx    Intake detail with 7 tabs (client component)
    components/
      ActorProvider.tsx  React context for actor state + localStorage
      AppShell.tsx       Dark sidebar + main canvas shell
      ActorSelector.tsx  Dropdown in sidebar; persists to localStorage
      StatusBadge.tsx    Backend status → label + color badge
      WorkflowStepper.tsx 6-step workflow visual (derived from backend state)
      ErrorBanner.tsx    API error display
      DebugJsonPanel.tsx Collapsible JSON display
    lib/
      types.ts           Frontend type definitions matching backend shape
      api-client.ts      Typed fetch wrappers, attaches actor headers
      actors.ts          Preconfigured actors (Request Creator → Admin)
      status.ts          Status→label/variant mapping + computed badges
      formatting.ts      Date, project type, truncation utilities
```

## Design

- Dark navy sidebar (#0f172a), light canvas (#f8f9ff)
- Indigo/violet primary palette
- AI draft: violet treatment
- Reviewed package: emerald/green treatment
- Distribution preview: indigo with "Dry-run only" notice
- Card-based layout, Inter typography, Tailwind utility classes

## Actor Selector

5 preconfigured actors:
- Request Creator (request_creator)
- Intake Owner (intake_owner)
- DevOps Lead (devops_lead)
- Admin (admin)
- Developer (developer)

Persisted to localStorage. Injects `x-actor-id`, `x-actor-role`, `x-actor-name` headers on every API call.

## Pages and Tabs

### `/intakes`
- Table with ID, Title, Project Type, Status, Requester, Created, Updated
- Links to intake detail
- Create Intake button → `/intakes/new`
- Refresh button
- Loading / empty / error states

### `/intakes/new`
- Workflow preview banner
- Form: title, project type, requester, department, description
- Redirects to `/intakes/:id` after create

### `/intakes/[id]`

Tab navigation via `?tab=` query param.

**Overview**: Summary card, Required Actions card (context-aware buttons), Latest Activity card
**AI Draft**: AI analysis metrics + brief + subtasks + Accept/Revise/Reject controls
**Reviewed Package**: Human-reviewed artifact with emerald styling, all fields
**Approvals**: Gate 1 card + Gate 2 card, context-aware approve/reject controls
**Distribution**: Source metadata, dry-run actions list (expandable payloads)
**Audit Trail**: Full event table with timestamps, actors, transitions, metadata
**Debug**: Actor info + API URL + full intake JSON + audit JSON (collapsible)

## Governance Enforced in UI

The UI surfaces backend governance errors rather than hiding them:
- "Gate 1 requires a reviewed project package" — shown in UI when Gate 1 button would fail
- "Gate 2 requires Gate 1 approval" — Gate 2 disabled with message
- "Distribution preview requires Gate 2 approval" — shown when plan not available
- Backend error messages are always surfaced via ErrorBanner

The UI never makes workflow decisions — it delegates to the backend and renders the result.

## Scripts Added

Root `package.json`:
```
web:dev    → npm --prefix apps/web run dev    (port 3001)
web:build  → npm --prefix apps/web run build
web:start  → npm --prefix apps/web run start
```

## Environment

`apps/web/.env.local.example`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Root `.env.example` updated:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Verification

```
npm run check         → 49/49 pass (unchanged)
npm run api:build     → pass
npm run web:build     → pass (6 routes: /, /intakes, /intakes/new, /intakes/[id], /_not-found)
npm run prisma:generate → pass
npm run demo:analysis → pass
npm run demo:analysis-review → pass
npm run demo:review-guard → pass
npm run demo:reviewed-distribution → pass
npm run demo:mvp → pass
```

API smoke test / browser walkthrough requires running stack:
```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate   # or prisma:db:push
npm run api:start:dev
# in another terminal:
npm run web:dev
# Open http://localhost:3001
```

## Files Created

```
apps/web/
  package.json
  next.config.ts
  tsconfig.json
  postcss.config.mjs
  tailwind.config.ts
  .env.local.example
  src/app/layout.tsx
  src/app/page.tsx
  src/app/globals.css
  src/app/intakes/page.tsx
  src/app/intakes/new/page.tsx
  src/app/intakes/[id]/page.tsx
  src/components/ActorProvider.tsx
  src/components/AppShell.tsx
  src/components/ActorSelector.tsx
  src/components/StatusBadge.tsx
  src/components/WorkflowStepper.tsx
  src/components/ErrorBanner.tsx
  src/components/DebugJsonPanel.tsx
  src/lib/types.ts
  src/lib/api-client.ts
  src/lib/actors.ts
  src/lib/status.ts
  src/lib/formatting.ts
```

## Files Modified

```
package.json            — added web:dev, web:build, web:start scripts
.env.example            — added NEXT_PUBLIC_API_BASE_URL
README.md               — added web section (see below)
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md
```

## Known Limitations

- Actor selector is a dev auth shim; no Google SSO yet
- No live AI/Monday/GitHub integrations (intentional)
- No live execute/provision button (intentional; TASK-0010 is preview-only)
- Mobile layout is usable but not optimized
- No frontend-side tests (not required for TASK-0010)
- The Revise Draft form uses a JSON textarea (Option A per spec); a structured form editor is TASK-0011+

## Next Recommended Task

```
TASK-0011 — Real AI Provider Adapter
  OR
TASK-0011 — Structured Revise Draft Form
  OR
TASK-0011 — Prisma Migration + Production Hardening
```
