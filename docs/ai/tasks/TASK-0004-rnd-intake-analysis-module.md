# TASK-0004 — R&D Realignment for AI Intake Analysis Module

## Goal

Realign the current build from the no-AI workflow POC toward the full Project Intake OS R&D track, using the external project-intake automation brief as the first validation workflow.

## Context

The current repo already has:

- domain workflow foundation
- application workflow service
- in-memory tests/demo
- NestJS API source
- Prisma schema
- Swagger setup
- dry-run provisioning plan

The R&D scope now needs to validate:

- input triggers
- AI structured intake analysis
- Monday mapping
- roster-based assignment
- compliance posture
- distribution preview

## Deliverables Added

- `docs/rd/README.md`
- `docs/rd/rnd-decision-memo.md`
- `docs/rd/feasibility-analysis.md`
- `docs/rd/cost-estimate.md`
- `docs/product/input-trigger-strategy.md`
- `docs/product/intake-analysis-schema.md`
- `docs/product/distribution-rules.md`
- `docs/integrations/roster-api.md`
- `docs/integrations/monday-mapping.md`
- `docs/security/compliance-and-retention.md`

## Recommended Next Build Slice

TASK-0005 should add the AI analysis schema to shared code and storage:

- create `IntakeAnalysisDraft` schema in shared package or API module
- add Prisma model or JSON storage for AI evaluation drafts
- add `POST /intakes/:id/analysis-drafts/mock`
- add mock AI provider that returns schema-valid output
- add tests proving AI output is draft-only and cannot trigger approval/provisioning directly

## Explicitly Still Out of Scope

- live AI provider call
- live Monday creation
- live GitHub creation
- automatic developer assignment without human review
- storing unredacted sensitive data without retention decision
