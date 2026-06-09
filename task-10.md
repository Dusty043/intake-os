# TASK-0010 — Minimal Next.js Review UI

## Status

Planned

## Purpose

TASK-0010 creates the first browser-operable interface for Project Intake OS.

The backend governance spine is already complete:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ Distribution preview uses ReviewedProjectPackage
→ System distributes later
```

TASK-0009 stabilized the backend runtime:

```text
49/49 tests passing
api:build passing
prisma:generate passing
all demos passing
health endpoints available
Swagger available
smoke API script available
README/local setup available
```

TASK-0010 makes this workflow visible and usable from a minimal Next.js UI.

The UI should be implementation-friendly, not over-designed. It should follow the Stitch visual direction while preserving backend workflow truth.

---

# Core Product Rule

The frontend is a control panel.

The backend remains the source of truth.

Correct pattern:

```text
User clicks action
→ Next.js calls NestJS API
→ Backend validates actor, permissions, state, and guards
→ Backend returns updated intake
→ UI renders backend state
```

Incorrect pattern:

```text
Frontend decides workflow validity
→ frontend mutates status locally
→ backend catches up later
```

The UI may hide or disable buttons for convenience, but it must never replace backend governance.

---

# Design Direction

Use the Stitch design direction as the visual baseline.

Keep:

```text
dark fixed left sidebar
light main canvas
card-based layouts
Inter/Geist typography
Material Symbols icons
indigo/violet primary color
violet AI draft treatment
green reviewed package treatment
dry-run distribution preview panel
audit trail table/timeline
actor selector in app shell
```

Primary visual feeling:

```text
internal operations control panel
calm
structured
technical but usable
governance-focused
not a generic project management dashboard
```

Avoid:

```text
overly playful styling
heavy dashboard analytics
complex charts
live provisioning language
production execution buttons
AI output that appears final
frontend-only workflow decisions
```

---

# Design Token Direction

Use these as implementation guidance, not necessarily exact Tailwind config requirements.

## Colors

Core:

```text
Background: #f8f9ff or #f8fafc
Surface: #ffffff
Surface subtle: #eff4ff
Surface container: #e5eeff
Sidebar: #0f172a
Primary: #3525cd
Primary container: #4f46e5
Primary fixed/light: #e2dfff
Text primary: #0b1c30
Text secondary: #464555
Border: #c7c4d8
Danger: #ba1a1a
Danger container: #ffdad6
Success: #16a34a
Success container: #dcfce7
Warning: amber/yellow
AI draft: violet/indigo treatment
Reviewed package: green/emerald treatment
Distribution preview: indigo/teal/dry-run treatment
```

## Typography

Preferred:

```text
Inter for headings/body
Geist for mono/meta/labels if easy
System fallback acceptable
```

Suggested scale:

```text
Page title: 24px / 32px / semibold
Section title: 18px / 28px / semibold
Card title: 16px / 24px / semibold
Body: 14px / 20px
Small/meta: 12px / 18px
Label caps: 11px / 16px / uppercase / letter-spaced
Mono: 13px / 20px
```

## Layout

```text
Sidebar width: 240px
Desktop page margin: 32px
Mobile page margin: 16px
Gutter: 24px
Content max width: 1280px
Card radius: 12px
Button radius: 8px
```

---

# Product Model to Represent

The UI must represent these backend concepts:

```text
ProjectIntakeRecord
IntakeAnalysisDraft
ReviewedProjectPackage
Approval records
ProvisioningPlan
ProvisioningPlan.source
ProvisioningPlan.actions
AuditEvent
Actor
```

The UI must visibly distinguish:

```text
AI-generated draft
vs
human-reviewed project package
vs
approval state
vs
distribution preview
```

---

# Backend Endpoints

The UI should call the existing NestJS API.

Expected endpoints:

```http
GET  /health
GET  /health/db

GET  /intakes
GET  /intakes/:id

POST /intakes
POST /intakes/:id/submit

POST /intakes/:id/discovery
POST /intakes/:id/analysis-drafts/mock
POST /intakes/:id/analysis-drafts/:draftId/accept
POST /intakes/:id/analysis-drafts/:draftId/reject
POST /intakes/:id/analysis-drafts/:draftId/revise

POST /intakes/:id/approvals
POST /intakes/:id/rejections

POST /intakes/:id/provisioning-plan
POST /intakes/:id/provisioning-ready

GET  /intakes/:id/audit
```

If actual routes differ in the current code, use the actual routes and update the docs.

---

# Actor Header Shim

Google SSO is out of scope.

The UI must include a dev actor selector that controls these headers:

```text
x-actor-id
x-actor-role
x-actor-name
```

Recommended actors:

```ts
type UiActor = {
  id: string;
  name: string;
  role:
    | "request_creator"
    | "intake_owner"
    | "devops_lead"
    | "admin"
    | "developer";
};
```

Default actor:

```text
Request Creator
```

Preconfigured actors:

```text
Request Creator
- id: actor_request_creator
- name: Request Creator
- role: request_creator

Intake Owner
- id: actor_intake_owner
- name: Intake Owner
- role: intake_owner

DevOps Lead
- id: actor_devops_lead
- name: DevOps Lead
- role: devops_lead

Admin
- id: actor_admin
- name: Admin
- role: admin

Developer
- id: actor_developer
- name: Developer
- role: developer
```

Actor selection should persist in `localStorage`.

The actor selector should appear in the app shell, preferably at the bottom of the sidebar or top-right header.

---

# Routes

Implement:

```text
/
  Redirect or link to /intakes

/intakes
  Intake list

/intakes/new
  Create intake form

/intakes/[id]
  Intake detail page with tabs/panels
```

Tabs for `/intakes/[id]`:

```text
Overview
AI Draft
Reviewed Package
Approvals
Distribution
Audit Trail
Debug
```

Implementation options:

```text
Option A: query param tabs, e.g. /intakes/[id]?tab=draft
Option B: local state tabs on the detail page
```

For TASK-0010, either is acceptable. Query param tabs are preferred because they are linkable.

---

# Global App Shell

Create a shared shell used by all web pages.

Recommended component:

```text
AppShell
```

Shell includes:

```text
fixed dark left sidebar
top header
main content canvas
actor selector
refresh affordance where relevant
```

Sidebar items:

```text
Project Intake OS
Operational Control

Intakes
Create Intake
Reports (Soon)
Settings (Soon)

Actor selector / role selector
```

Reports and Settings should be visibly disabled or labeled “Soon.”

Sidebar should use a dark navy background, similar to:

```text
#0f172a
```

Main content should use a light background and white/surface cards.

---

# Suggested Frontend Structure

Use Next.js App Router with TypeScript.

Recommended structure:

```text
apps/web/
├── package.json
├── next.config.js
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── intakes/
│   │       ├── page.tsx
│   │       ├── new/
│   │       │   └── page.tsx
│   │       └── [id]/
│   │           └── page.tsx
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── ActorSelector.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── WorkflowStepper.tsx
│   │   ├── Card.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── LoadingState.tsx
│   │   ├── EmptyState.tsx
│   │   ├── IntakeTable.tsx
│   │   ├── IntakeSummaryPanel.tsx
│   │   ├── WorkflowActionsPanel.tsx
│   │   ├── AnalysisDraftPanel.tsx
│   │   ├── AnalysisDraftReviewControls.tsx
│   │   ├── ReviseDraftForm.tsx
│   │   ├── ReviewedPackagePanel.tsx
│   │   ├── ApprovalPanel.tsx
│   │   ├── DistributionPreviewPanel.tsx
│   │   ├── AuditTrail.tsx
│   │   └── DebugJsonPanel.tsx
│   └── lib/
│       ├── api-client.ts
│       ├── actors.ts
│       ├── status.ts
│       ├── formatting.ts
│       └── types.ts
```

If simpler implementation is faster, combine small components. Do not over-engineer.

---

# Package Scripts

Add root scripts:

```json
{
  "scripts": {
    "web:dev": "npm --prefix apps/web run dev",
    "web:build": "npm --prefix apps/web run build",
    "web:start": "npm --prefix apps/web run start"
  }
}
```

If the repo uses npm workspaces, use the appropriate workspace syntax.

`npm run web:build` must pass.

---

# Environment Variables

Update `.env.example`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

If the API is served under a prefix, document the correct value.

Optional web-specific example:

```text
apps/web/.env.local.example
```

containing:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

# Frontend API Client

Add:

```text
apps/web/src/lib/api-client.ts
```

Requirements:

```text
uses NEXT_PUBLIC_API_BASE_URL
attaches actor headers
handles JSON request/response
throws readable errors
supports all workflow actions needed by UI
```

Required methods:

```ts
listIntakes(actor: UiActor): Promise<ProjectIntakeRecord[]>;

getIntake(id: string, actor: UiActor): Promise<ProjectIntakeRecord>;

createIntake(
  input: CreateIntakeInput,
  actor: UiActor
): Promise<ProjectIntakeRecord>;

submitIntake(
  id: string,
  actor: UiActor
): Promise<ProjectIntakeRecord>;

generateMockAnalysisDraft(
  id: string,
  actor: UiActor
): Promise<ProjectIntakeRecord>;

acceptAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  reviewerNotes?: string
): Promise<ProjectIntakeRecord>;

rejectAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  reason: string
): Promise<ProjectIntakeRecord>;

reviseAnalysisDraft(
  id: string,
  draftId: string,
  actor: UiActor,
  input: ReviseAnalysisDraftInput
): Promise<ProjectIntakeRecord>;

approveGate(
  id: string,
  gate: string,
  actor: UiActor,
  notes?: string
): Promise<ProjectIntakeRecord>;

rejectGate(
  id: string,
  gate: string,
  actor: UiActor,
  reason: string
): Promise<ProjectIntakeRecord>;

generateProvisioningPlan(
  id: string,
  actor: UiActor
): Promise<ProjectIntakeRecord>;

getAuditTrail(
  id: string,
  actor: UiActor
): Promise<AuditEvent[]>;
```

Use actual backend DTO shape.

If gate values are currently strings like `intake` / `devops`, use those. Do not invent `gate_1` / `gate_2` unless mapped correctly.

---

# Error Handling

The API client should turn failed HTTP responses into user-readable messages.

Expected behavior:

```text
If response has message field, show it.
If response has error field, show it.
Else show status code and generic text.
```

UI must surface backend governance errors, especially:

```text
Gate 1 approval requires a reviewed project package.
Gate 2 approval requires Gate 1 approval.
Distribution preview requires approved intake.
Selected actor does not have permission.
Invalid workflow transition.
Missing analysis draft.
```

Do not swallow errors in console only.

---

# Frontend Types

Add:

```text
apps/web/src/lib/types.ts
```

Minimum types:

```ts
export type ActorRole =
  | "request_creator"
  | "intake_owner"
  | "devops_lead"
  | "admin"
  | "developer";

export type UiActor = {
  id: string;
  name: string;
  role: ActorRole;
};

export type ProjectIntakeRecord = {
  id: string;
  title: string;
  description?: string;
  requester?: string;
  projectType?: string;
  source?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  analysisDrafts?: IntakeAnalysisDraft[];
  latestAnalysisDraft?: IntakeAnalysisDraft;
  reviewedProjectPackage?: ReviewedProjectPackage;
  provisioningPlan?: ProvisioningPlan;
  approvals?: unknown[];
  [key: string]: unknown;
};

export type IntakeAnalysisDraft = {
  id: string;
  intakeId?: string;
  reviewStatus?: string;
  provider?: string;
  model?: string;
  projectType?: string;
  complexity?: string;
  estimatedStoryPoints?: number;
  confidence?: number;
  recommendedTechStack?: string[];
  infrastructureRequirements?: string[];
  brief?: {
    problem?: string;
    solution?: string;
    scope?: string[];
    outOfScope?: string[];
  };
  subtasks?: Array<{
    title: string;
    description?: string;
    storyPoints?: number;
  }>;
  assignmentRecommendation?: unknown;
  missingInformation?: string[];
  warnings?: string[];
  createdAt?: string;
  generatedAt?: string;
  [key: string]: unknown;
};

export type ReviewedProjectPackage = {
  id: string;
  sourceDraftId?: string;
  intakeId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewDecision?: "accepted" | "revised" | string;
  reviewerNotes?: string;
  projectType?: string;
  complexity?: string;
  estimatedStoryPoints?: number;
  recommendedTechStack?: string[];
  infrastructureRequirements?: string[];
  brief?: {
    problem?: string;
    solution?: string;
    scope?: string[];
    outOfScope?: string[];
  };
  subtasks?: Array<{
    title: string;
    description?: string;
    storyPoints?: number;
  }>;
  assignmentRecommendation?: unknown;
  missingInformation?: string[];
  [key: string]: unknown;
};

export type ProvisioningPlan = {
  id: string;
  intakeId?: string;
  status?: string;
  source?: {
    type?: string;
    sourceId?: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  actions?: ProvisioningPlanAction[];
  createdAt?: string;
  [key: string]: unknown;
};

export type ProvisioningPlanAction = {
  id?: string;
  provider?: string;
  action?: string;
  name?: string;
  dryRun?: boolean;
  idempotencyKey?: string;
  payload?: unknown;
  [key: string]: unknown;
};

export type AuditEvent = {
  id?: string;
  intakeId?: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  action?: string;
  event?: string;
  metadata?: unknown;
  createdAt?: string;
  timestamp?: string;
  [key: string]: unknown;
};
```

Keep types flexible enough to match the current backend without blocking build.

A future task can introduce a shared package.

---

# Status Mapping

Add:

```text
apps/web/src/lib/status.ts
```

Map backend statuses to UI labels and badge variants.

Recommended UI labels:

```text
draft → Draft
submitted → Submitted
evaluating → AI Draft Running
intake_review → Review In Progress
devops_review → Gate 1 Approved
approved → Approved
provisioning → Provisioning
distributed → Distributed
provisioning_failed → Failed
archived → Archived
```

Also derive computed display states:

```text
AI Draft Available
Reviewed
Distribution Preview Ready
```

Rules:

```text
If latestAnalysisDraft exists and no reviewedProjectPackage:
  show AI Draft Available or Review In Progress

If reviewedProjectPackage exists:
  show Reviewed

If provisioningPlan exists:
  show Distribution Preview Ready
```

Do not change backend status values.

---

# Workflow Stepper

Implement a visual stepper on the intake detail page.

Steps:

```text
1. Submitted
2. AI Draft
3. Reviewed
4. Gate 1
5. Gate 2
6. Distribution Preview
```

Step state should be derived from backend data:

```text
Submitted complete if status is not draft
AI Draft complete if latestAnalysisDraft exists
Reviewed complete if reviewedProjectPackage exists
Gate 1 complete if status is devops_review or later, or approval record indicates Gate 1
Gate 2 complete if status is approved or later, or approval record indicates Gate 2
Distribution Preview complete if provisioningPlan exists
```

If exact approval records are hard to inspect, use status as fallback.

Stepper should clearly show:

```text
completed
current
blocked/pending
```

---

# Page: `/intakes`

## Purpose

Show all intake requests.

## Layout

Use the Stitch-style table inside a white/surface card.

Header:

```text
Active Intakes
Manage and track project requests.
```

Actions:

```text
Create Intake
Refresh
```

Optional but not required:

```text
Filter button, non-functional or disabled
```

Table columns:

```text
ID
Title
Project Type
Status
Requester
Created
Last Activity
```

Rows should link to `/intakes/[id]`.

Empty state:

```text
No intakes yet.
Create the first project intake to begin the review workflow.
```

Loading state:

```text
Loading intakes…
```

Error state:

```text
Unable to load intakes.
[backend/API error]
```

---

# Page: `/intakes/new`

## Purpose

Create a new intake.

## Layout

Use the Stitch-style centered form card.

Header helper card:

```text
New Intake Request
Use this form to initiate a new project intake. Include enough context for analysis and review.
```

Fields:

```text
Project Title
Project Type
Source / System
Requester
Detailed Description
```

Project type options should match or approximate backend project types.

Recommended labels:

```text
Web App
Internal Tool
Dashboard
API Service
AI Workflow Tool
Data Pipeline
Automation Script
Chrome Extension
Infrastructure Project
Discovery / Research
```

Source options:

```text
Manual
Email
Google Chat
Web Form
Client Request
Internal Request
Meeting Notes
```

Buttons:

```text
Cancel
Create Intake
```

After successful creation:

```text
redirect to /intakes/[id]
```

Include a small workflow preview:

```text
Submission → AI Draft → Human Review → Approval → Distribution Preview
```

---

# Page: `/intakes/[id]`

## Purpose

Operate a single intake through the workflow.

## Top Header

Show:

```text
breadcrumb: Intakes > [ID]
title
status badge
project type
requester
created/updated timestamps
refresh button
```

Then show workflow stepper.

Then show tabs:

```text
Overview
AI Draft
Reviewed Package
Approvals
Distribution
Audit Trail
Debug
```

---

# Detail Tab: Overview

## Layout

Use a 3-card grid similar to Stitch.

Cards:

```text
Summary
Required Actions
Latest Activity
```

## Summary Card

Show:

```text
Project type
Source
Requester
Status
Created
Updated
Description
```

## Required Actions Card

Show action buttons depending on current backend data.

Minimum buttons:

```text
Submit Intake
Generate Mock AI Draft
View AI Draft
Accept as Reviewed
Approve Gate 1
Approve Gate 2
Generate Distribution Preview
```

Rules:

```text
Buttons can be hidden/disabled if obviously not relevant.
Backend errors must still be shown if action fails.
```

Disabled helper examples:

```text
Gate 1 requires a reviewed project package.
Gate 2 requires Gate 1 approval.
Distribution preview requires Gate 2 approval.
```

## Latest Activity Card

Show recent audit events.

Fields:

```text
event
actor
timestamp
short detail
```

---

# Detail Tab: AI Draft

## Purpose

Show AI-generated analysis and provide review controls.

## Important visual rule

AI draft is not final.

Show a visible notice:

```text
This is an AI-generated draft. It must be accepted or revised by a human reviewer before approval.
```

## Layout

Use a bento/grid layout inspired by Stitch.

Left column:

```text
AI Analysis summary
Confidence score
Complexity
Story points
Detected/recommended tech stack
Missing information
Warnings
```

Main column:

```text
Generated brief
Problem statement
Proposed solution
Scope
Out of scope
Subtasks
Assignment recommendation
```

Action area:

```text
Accept as Reviewed
Revise Draft
Reject Draft
```

## Accept behavior

Calls:

```http
POST /intakes/:id/analysis-drafts/:draftId/accept
```

Payload:

```json
{
  "reviewerNotes": "Accepted as reviewed."
}
```

Use textarea for notes if practical.

## Reject behavior

Calls:

```http
POST /intakes/:id/analysis-drafts/:draftId/reject
```

Payload:

```json
{
  "reason": "..."
}
```

Must ask for reason.

## Revise behavior

Open an inline form or modal.

Minimum editable fields:

```text
estimated story points
problem
solution
scope
out of scope
subtasks
reviewer notes
```

For subtasks, acceptable implementation options:

```text
Option A: simple JSON textarea
Option B: small editable list
```

For TASK-0010, JSON textarea is acceptable if it validates and shows errors.

On save, call:

```http
POST /intakes/:id/analysis-drafts/:draftId/revise
```

Use backend DTO shape.

---

# Detail Tab: Reviewed Package

## Purpose

Show the human-reviewed artifact.

## Important visual rule

Reviewed package is the source of truth for approval/distribution.

Show a visible banner:

```text
Human Reviewed Package
This reviewed package is the source of truth for approval and distribution preview.
```

Use green/emerald visual styling.

Show:

```text
package ID
source draft ID
reviewed by
reviewed at
decision: accepted/revised
reviewer notes
project type
complexity
estimated story points
brief
scope
out of scope
subtasks
recommended tech stack
infrastructure requirements
assignment recommendation
missing information
```

If no reviewed package exists:

```text
No reviewed project package exists yet. Accept or revise an AI draft before Gate 1 approval.
```

Button/link:

```text
Go to AI Draft
```

---

# Detail Tab: Approvals

## Purpose

Show and operate Gate 1 and Gate 2.

## Layout

Use two stacked approval cards or a vertical timeline.

Gate 1:

```text
Gate 1: Intake Review
Required role: Intake Owner / Admin
Status
Approved by
Approved at
Notes
Approve button
Reject/request changes button optional
```

Gate 2:

```text
Gate 2: DevOps Review
Required role: DevOps Lead / Admin
Status
Approved by
Approved at
Notes
Approve button
Reject/request changes button optional
```

Show backend errors clearly.

Expected examples:

```text
Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package.
Actor does not have permission.
Invalid transition.
```

Important:

```text
Do not fake approval state locally.
Refresh record after each approval action.
```

---

# Detail Tab: Distribution

## Purpose

Show dry-run provisioning/distribution preview.

## Important visual rule

This is not live provisioning.

Show a visible notice:

```text
Dry-run preview only. No external systems have been modified.
```

## Generate button

```text
Generate Distribution Preview
```

Calls:

```http
POST /intakes/:id/provisioning-plan
```

## Source metadata

Show:

```text
source type
source ID
reviewed by
reviewed at
```

If source type is `reviewed_project_package`, label it:

```text
Reviewed Project Package
```

Do not call it “AI Generated Plan.”

## Actions list

Show each provisioning action as a card or table row.

Fields:

```text
provider
action/name
dry-run badge
idempotency key
payload summary
expand raw payload
```

Provider labels:

```text
GitHub
Monday
Docs
Chat
Other
```

No live execute button in TASK-0010.

If the Stitch design includes an execute/provision button, omit it or show it disabled with:

```text
Live provisioning is not implemented yet.
```

---

# Detail Tab: Audit Trail

## Purpose

Show governance history.

## Layout

Use Stitch-style table or compact timeline.

Columns:

```text
Timestamp
Actor
Event Key
Details / Metadata
```

Allow simple search/filter if quick, but not required.

Show metadata in compact JSON block.

Do not show raw sensitive payloads if present.

Empty state:

```text
No audit events recorded yet.
```

---

# Detail Tab: Debug

## Purpose

Developer inspection.

Show:

```text
selected actor
API base URL
full intake JSON
full audit JSON
```

Use collapsible/preformatted JSON blocks.

Clearly mark:

```text
Developer debug view
```

---

# Components

## AppShell

Props:

```ts
children
activeNav
```

Responsible for:

```text
sidebar
top bar
actor selector
main layout
```

## ActorSelector

Requirements:

```text
shows current actor
lets user switch actor
persists to localStorage
updates API client headers indirectly
```

## StatusBadge

Maps backend/computed status to label and color.

## WorkflowStepper

Displays the six-step workflow.

## ErrorBanner

Displays API/action errors.

## LoadingState

Simple loading text/spinner.

## EmptyState

Reusable empty state component.

## AnalysisDraftPanel

Displays latest draft and review actions.

## ReviewedPackagePanel

Displays reviewed package and source-of-truth banner.

## ApprovalPanel

Displays Gate 1 and Gate 2 approval controls.

## DistributionPreviewPanel

Displays provisioning plan source metadata and dry-run actions.

## AuditTrail

Displays event log.

## DebugJsonPanel

Displays JSON.

---

# UX Copy

Use explicit labels.

Preferred button labels:

```text
Create Intake
Submit Intake
Generate Mock AI Draft
Accept as Reviewed
Revise Draft
Reject Draft
Approve Gate 1
Approve Gate 2
Generate Distribution Preview
Refresh
```

Avoid:

```text
Run
Execute
Finalize
Process
Provision
Launch
```

unless clearly disabled/future.

Important explanatory copy:

AI Draft:

```text
This is an AI-generated draft. It must be accepted or revised by a human reviewer before approval.
```

Reviewed Package:

```text
This reviewed package is the source of truth for approval and distribution preview.
```

Distribution:

```text
Dry-run preview only. No external systems have been modified.
```

Actor selector:

```text
Selected actor controls temporary API permission headers.
```

---

# Loading States

Required loading messages:

```text
Loading intakes…
Loading intake…
Creating intake…
Submitting intake…
Generating mock AI draft…
Accepting draft…
Rejecting draft…
Saving reviewed package…
Approving Gate 1…
Approving Gate 2…
Generating distribution preview…
Loading audit trail…
```

---

# Empty States

Required empty states:

```text
No intakes yet.
No AI draft has been generated yet.
No reviewed project package exists yet.
No distribution preview has been generated yet.
No audit events recorded yet.
```

---

# Accessibility Requirements

Minimum:

```text
forms have labels
buttons have visible text
badges include text, not color only
focus states visible
error messages textual
tables have headers
interactive controls keyboard accessible
reasonable contrast
```

Do not rely only on icon/color.

---

# Responsiveness

Primary target:

```text
desktop/laptop
```

Secondary:

```text
tablet
```

Mobile:

```text
usable enough, not perfect
```

Responsive rules:

```text
sidebar can hide/collapse on small screens
cards stack vertically
tables can scroll horizontally
tabs can scroll horizontally
main actions remain accessible
```

---

# Out of Scope

Do not implement:

```text
Google SSO
real sessions/auth
role management UI
live OpenAI/Claude calls
live Monday item creation
live GitHub provisioning
Google Chat app
email ingestion
AWS deployment
frontend analytics dashboard
dark mode toggle
complex design system package
shared package refactor
n8n
```

---

# Implementation Order

## Step 1 — Read context

Read:

```text
README.md
docs/ai/MEMORY_INDEX.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md
apps/api/src/modules/intake/intake.controller.ts
scripts/smoke-api.mjs
src/application/types.ts
```

Also review the Stitch HTML/design export provided for TASK-0010 visual direction.

## Step 2 — Run baseline

Run:

```bash
npm run check
npm run api:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Record results in build log.

## Step 3 — Scaffold web app

Create:

```text
apps/web
```

Use:

```text
Next.js
TypeScript
App Router
plain CSS/Tailwind
minimal dependencies
```

Do not add a heavy UI framework.

## Step 4 — Add scripts

Add:

```bash
npm run web:dev
npm run web:build
npm run web:start
```

Verify:

```bash
npm run web:build
```

## Step 5 — Add global styles/tokens

Implement the core visual direction:

```text
dark sidebar
light canvas
indigo primary
surface cards
badge variants
Inter/System typography
```

Material Symbols are acceptable, but if adding external font/icon loading is inconvenient, use text/icons from available dependencies.

## Step 6 — Add actor selector

Implement:

```text
actors.ts
ActorSelector.tsx
localStorage persistence
header injection through API client
```

## Step 7 — Add API client

Implement all required API methods.

Ensure errors are readable.

## Step 8 — Build `/intakes`

Implement list page with table, status badges, refresh, create link.

## Step 9 — Build `/intakes/new`

Implement create form and redirect.

## Step 10 — Build `/intakes/[id]`

Implement:

```text
header
workflow stepper
tabs
overview
AI draft
reviewed package
approvals
distribution
audit trail
debug
```

## Step 11 — Wire workflow actions

Wire:

```text
submit
generate mock AI draft
accept draft
reject draft
revise draft
approve Gate 1
approve Gate 2
generate distribution preview
refresh
```

Refresh intake/audit state after successful actions.

## Step 12 — Add user feedback

Add:

```text
loading states
success/refresh states
error banners
empty states
disabled helper messages
```

## Step 13 — Update docs

Update:

```text
README.md
.env.example
docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

README must include:

```text
web setup
web scripts
NEXT_PUBLIC_API_BASE_URL
browser walkthrough
actor selector explanation
known limitations
```

## Step 14 — Final verification

Run:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Runtime/manual verification:

```text
1. Start Postgres.
2. Start API.
3. Start web.
4. Open /intakes.
5. Create intake.
6. Submit intake.
7. Generate mock AI draft.
8. Accept or revise draft.
9. Approve Gate 1 as Intake Owner/Admin.
10. Switch actor to DevOps Lead/Admin.
11. Approve Gate 2.
12. Generate distribution preview.
13. Confirm source type is Reviewed Project Package.
14. Confirm audit trail updates.
```

---

# Manual Browser Walkthrough

The final UI must support this exact walkthrough:

```text
1. Open /intakes.
2. Select Request Creator actor.
3. Create a new intake.
4. Open the intake detail page.
5. Submit the intake.
6. Switch to Intake Owner actor.
7. Generate mock AI analysis draft.
8. Open AI Draft tab.
9. Accept draft as reviewed or revise it.
10. Confirm Reviewed Package tab shows the reviewed artifact.
11. Approve Gate 1.
12. Switch to DevOps Lead actor.
13. Approve Gate 2.
14. Open Distribution tab.
15. Generate distribution preview.
16. Confirm preview source is Reviewed Project Package.
17. Open Audit Trail tab.
18. Confirm creation, submission, analysis, review, approval, and distribution preview events are visible.
```

---

# Tests and Verification

Required:

```bash
npm run web:build
```

Existing required:

```bash
npm run check
npm run api:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Optional, if easy:

```text
small tests for status helpers
small tests for API client header construction
```

Do not introduce a complex frontend test setup just for TASK-0010.

---

# Acceptance Criteria

TASK-0010 is complete when:

```text
1. Next.js app exists under apps/web.
2. Root web scripts exist: web:dev, web:build, web:start.
3. web:build passes.
4. User can list intakes.
5. User can create an intake.
6. User can open an intake detail page.
7. User can submit an intake.
8. User can generate a mock AI analysis draft.
9. User can accept an analysis draft.
10. User can reject an analysis draft.
11. User can revise an analysis draft.
12. Reviewed project package is visible and distinct from AI draft.
13. Gate 1 approval can be triggered from UI.
14. Gate 2 approval can be triggered from UI.
15. Backend errors are shown clearly.
16. User can generate distribution preview.
17. Distribution preview source metadata is visible.
18. Distribution preview is clearly labeled dry-run.
19. No live execute/provision button is active.
20. Audit trail is visible.
21. Debug JSON panel is available.
22. Actor selector controls API actor headers.
23. Existing backend tests pass.
24. Existing demos pass.
25. API build still passes.
26. README documents web setup and walkthrough.
27. .env.example includes web API base URL.
28. No business logic is moved into frontend.
29. No live external integrations are added.
30. No n8n is introduced.
```

---

# Expected Final Report

When done, report:

```text
Commit hash
Files changed
Dependencies added
Pages added
Components added
Scripts added/updated
Verification results
Manual browser walkthrough result
Known remaining issues
Next recommended task
```

Example:

```text
TASK-0010 done.

Verification:
- npm run check: 49/49 pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- all 5 demos: pass

Manual UI walkthrough:
- create intake: pass
- submit: pass
- generate mock draft: pass
- accept/revise: pass
- Gate 1: pass
- Gate 2: pass
- distribution preview: pass
- audit trail: pass

Known limitations:
- actor selector is a dev auth shim
- no Google SSO yet
- no live AI/Monday/GitHub integrations yet
```

---

# Agent Execution Prompt

Use this prompt for Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0010: Minimal Next.js Review UI.

Context:
- TASK-0005 through TASK-0008 completed the backend governance spine:
  AI drafts → Human reviews → Workflow approves → Distribution preview uses ReviewedProjectPackage.
- TASK-0009 stabilized the NestJS/Prisma API runtime.
- The goal now is a minimal Next.js UI that lets a human operate the workflow from the browser.
- Use the Stitch visual direction: dark 240px sidebar, light operational canvas, card-based UI, indigo/violet primary palette, AI draft violet treatment, reviewed package green treatment, audit table, dry-run distribution panel.
- Use Stitch for visual structure, but backend state for workflow truth.
- The frontend must be thin. The backend remains the source of truth.
- Actor headers remain the temporary auth shim.
- n8n is intentionally excluded.

Implement:
1. Create apps/web as a Next.js TypeScript App Router app.
2. Add root scripts: web:dev, web:build, web:start.
3. Add NEXT_PUBLIC_API_BASE_URL config.
4. Add AppShell with dark sidebar and actor selector.
5. Add frontend API client with actor headers and readable errors.
6. Add /intakes list page.
7. Add /intakes/new create form.
8. Add /intakes/[id] detail page with:
   - workflow stepper
   - Overview tab
   - AI Draft tab
   - Reviewed Package tab
   - Approvals tab
   - Distribution tab
   - Audit Trail tab
   - Debug tab
9. Wire actions to existing backend endpoints:
   - submit
   - generate mock AI draft
   - accept/reject/revise draft
   - approve Gate 1
   - approve Gate 2
   - generate provisioning plan
10. Show backend errors clearly.
11. Show loading and empty states.
12. Ensure reviewed package is visually distinct from AI draft.
13. Ensure distribution preview is labeled dry-run and sourced from ReviewedProjectPackage when present.
14. Update README, .env.example, task docs, and AI build logs.

Do not implement:
- Google SSO
- live AI provider calls
- n8n
- Monday live creation
- GitHub live provisioning
- active live execute/provision button
- deployment
- advanced dashboard analytics
- heavy UI framework unless already present

Verification:
Run:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp

Manual verification:
Start Postgres, API, and web. In the browser:
1. Open /intakes.
2. Select Request Creator.
3. Create an intake.
4. Submit it.
5. Switch to Intake Owner.
6. Generate mock AI analysis draft.
7. Accept or revise draft.
8. Confirm Reviewed Package tab.
9. Approve Gate 1.
10. Switch to DevOps Lead.
11. Approve Gate 2.
12. Generate distribution preview.
13. Confirm source type is Reviewed Project Package.
14. Confirm audit trail updates.

Return:
- files changed
- dependencies added
- UI pages/components added
- verification results
- manual browser verification notes
- known remaining issues
- next recommended task
```

---

# Human Dev Notes

This task makes the OS visible.

Do not chase polish before workflow clarity.

The UI should answer these questions instantly:

```text
What state is this intake in?
What did the AI draft?
Has a human reviewed it?
Are Gate 1 and Gate 2 complete?
What will distribution create?
Is it dry-run only?
What happened in the audit trail?
Who am I acting as?
```

Use the Stitch design as visual inspiration, but do not copy any product behavior that conflicts with the backend.

Especially avoid:

```text
AI Generated Plan
Execute Distribution Plan
Provision AWS Resources
Production target execution
```

For TASK-0010, distribution is preview-only.

Correct final mental model:

```text
The browser operates the OS.
The backend governs the OS.
The reviewed package is the source of truth.
```
