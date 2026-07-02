# Memory Index

Generated at: 2026-06-09T14:53:20.716Z

## Core Memory

- `docs/ai/PROJECT_MEMORY.md`
- `docs/ai/KNOWN_CONSTRAINTS.md`
- `docs/ai/OPEN_QUESTIONS.md`
- `docs/ai/BUILD_LOG.md`
- `docs/ai/DECISIONS_SUMMARY.md`
- `docs/ai/REQUIREMENTS_TRACE.md`

## Task Logs

- `docs/ai/tasks/TASK-0001-bootstrap-domain-core.md`
- `docs/ai/tasks/TASK-0002-iteration-2-mvp-runtime.md`
- `docs/ai/tasks/TASK-0003-dockerized-nestjs-api.md`
- `docs/ai/tasks/TASK-0004-rnd-intake-analysis-module.md`
- `docs/ai/tasks/TASK-0005-mock-ai-analysis-draft-module.md`
- `docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md`
- `docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md`
- `docs/ai/tasks/TASK-0008-distribution-preview-from-reviewed-package.md`
- `docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md`
- `docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md`
- `docs/ai/tasks/TASK-0011-end-to-end-runtime-smoke-and-seeded-demo-data.md`
- `docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md`
- `docs/ai/tasks/TASK-0013-authenticated-internal-access.md`
- `docs/ai/tasks/TASK-0014-guided-ai-draft-regeneration.md`
- `docs/ai/tasks/TASK-0015-ai-provider-router-and-adapters.md`
- `docs/ai/tasks/TASK-0016-domain-foundation-evaluation-aggregate-agent-contracts.md`
- `docs/ai/tasks/TASK-0017-mock-evaluation-agents.md`
- `docs/ai/tasks/TASK-0018-evaluation-orchestrator.md`
- `docs/ai/tasks/TASK-0018P-evaluation-orchestrator-patch.md`
- `docs/ai/tasks/TASK-0019-prisma-evaluation-persistence.md`
- `docs/ai/tasks/TASK-0014P-intake-review-reject-regen-loop.md`
- `docs/ai/tasks/TASK-0020-wire-evaluation-orchestrator.md`
- `docs/ai/tasks/TASK-0021-web-evaluation-review-experience.md`
- `docs/ai/tasks/TASK-0022-clarification-panel-review-fixes.md`
- `docs/ai/tasks/TASK-0023-provisioning-and-integrations-plan.md`
- `docs/ai/tasks/TASK-0023A-provisioning-execution-foundation.md`
- `docs/ai/tasks/TASK-0023B-provisioning-run-ui.md`
- `docs/ai/tasks/TASK-0023C-provisioning-retry.md`
- `docs/ai/tasks/TASK-0023D-monday-adapter.md`
- `docs/ai/tasks/TASK-0023E-github-adapter.md`
- `docs/ai/tasks/TASK-0024-google-chat-notifications.md`
- `docs/ai/tasks/TASK-0025-email-intake.md`
- `docs/ai/tasks/TASK-0026-google-chat-intake.md`
- `docs/ai/tasks/TASK-0027-auth-hardening.md`
- `docs/ai/tasks/TASK-0028-failure-and-recovery.md`
- `docs/ai/tasks/TASK-0029-rate-limiting.md`
- `docs/ai/tasks/TASK-0030-ai-cost-governance.md`
- `docs/ai/tasks/TASK-0031-post-distribution-lifecycle.md`
- `docs/ai/tasks/TASK-0032-input-validation-hardening.md`
- `docs/ai/tasks/TASK-0033-google-oauth.md`
- `docs/ai/tasks/TASK-0034-roster-integration.md`
- `docs/ai/tasks/TASK-0036-ai-provider-config-blank-env-fix.md`
- `docs/ai/tasks/TASK-0037-discovery-engine-ai-cost-reporting.md`
- `docs/ai/tasks/TASK-0038-monday-schema-verification.md`
- `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md`
- `docs/ai/tasks/TASK-0040-hardening-pass-truth-sync.md`
- `docs/ai/tasks/TASK-0041-production-deploy-and-self-healing.md`
- `docs/ai/tasks/TASK-0042-service-token-auth.md`

## Deployment Docs

- `docs/deployment/private-server-runtime.md`

## Decisions

- `docs/ai/decisions/ADR-0001-domain-first-monolith-foundation.md`
- `docs/ai/decisions/ADR-0002-portable-nestjs-ready-runtime.md`
- `docs/ai/decisions/ADR-0003-os-owned-orchestration-no-n8n.md`

## R&D Docs

- `docs/rd/README.md`
- `docs/rd/cost-estimate.md`
- `docs/rd/feasibility-analysis.md`
- `docs/rd/rnd-decision-memo.md`

## Integration Docs

- `docs/integrations/monday-mapping.md`
- `docs/integrations/roster-api.md`

## Security Docs

- `docs/security/compliance-and-retention.md`

## Product Specs

- `docs/product/product-overview.md`
- `docs/product/input-trigger-strategy.md`
- `docs/product/intake-analysis-schema.md`
- `docs/product/distribution-rules.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/ai-orchestration.md`
- `docs/product/project-type-registry.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/failure-and-recovery.md`
- `docs/product/ai-cost-governance.md`
- `docs/product/repository-and-naming.md`
- `docs/product/post-distribution-lifecycle.md`
- `docs/product/requirements-trace.md`

## Discovery Engine

- `docs/discovery_engine_spec.pdf` — Full product spec (v0.1, 2026-06-26): 8-stage pipeline, 12-dimension evaluation scaffold, state machine, UI design, handoff contract
- `docs/ai/tasks/TASK-DISCOVERY-PHASE1.md` — Phase 1: session, intent extraction, problem framing, confidence gating
- `docs/ai/tasks/TASK-DISCOVERY-PHASE2.md` — Phase 2: solution generation, clarification (dimension-guided), direction selection
- `docs/ai/tasks/TASK-DISCOVERY-PHASE3.md` — Phase 3: proposal composer, completeness gate, intake adapter, sendToEvaluation
- `docs/ai/tasks/TASK-DISCOVERY-PHASE4.md` — Phase 4: manifest generator, intent→action routing, Monday/GitHub manifest blocks
- `docs/ai/tasks/TASK-DISCOVERY-PHASE5.md` — Phase 5: NestJS DiscoveryModule, DiscoveryHttpController, 10 API routes
- `docs/ai/tasks/TASK-DISCOVERY-PHASE6.md` — Phase 6: Next.js frontend — session list, three-panel session view, all action handlers
