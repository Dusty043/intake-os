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
- `docs/ai/tasks/TASK-0043-fix-stale-discovery-tests.md`
- `docs/ai/tasks/TASK-0044-service-tokens-provisioned.md`
- `docs/ai/tasks/TASK-0045-monday-adapter-build-plan.md`
- `docs/ai/tasks/TASK-0046-prisma-discovery-session-store-tests.md`
- `docs/ai/tasks/TASK-0047-security-review-fixes.md`
- `docs/ai/tasks/TASK-0048-discovery-live-streaming.md`
- `docs/ai/tasks/TASK-0049-discovery-sse-controller.md`
- `docs/ai/tasks/TASK-0050-discovery-stream-wiring.md`
- `docs/ai/tasks/TASK-0051-discovery-frontend-stream-consumer.md`
- `docs/ai/tasks/TASK-0052-discovery-stream-caddy-heartbeat.md`
- `docs/ai/tasks/TASK-0053-discovery-initial-message-solutions-gap.md` — fix: first Discovery message never auto-chained to generateSolutions, stranding new sessions at problem_framed
- `docs/ai/tasks/TASK-0054-discovery-auto-artifacts-and-clarification-drawer.md` — UI: automatic proposal/manifest generation moved to center chat panel, clarification questions collapsed by default
- `docs/ai/tasks/TASK-0055-discovery-to-intake-transfer-fixes.md` — fix: mock proposal title truncation, fake epics-from-dependencies, false-positive stakeholder extraction; added always-visible "From Discovery" context on the intake Overview tab
- `docs/ai/tasks/TASK-0056-model-tiering-gpt-5-6-sol-terra.md` — models updated to gpt-5.6-sol (higher)/gpt-5.6-terra (lesser), wired real per-agent tiering (previously specified in ai-cost-governance.md but never implemented — every agent shared one model)
- `docs/ai/tasks/TASK-0057-discovery-to-intake-draft-race-fix.md` — fix: `generateMockAnalysisDraft` threw `InvalidTransitionError` when called after the draft was already ready (background auto-draft job racing a manual "Generate Mock AI Draft" click); added an idempotency guard so a second call is a no-op instead of a crash
- `docs/ai/tasks/TASK-0058-concurrency-hardening-q-conc-1-2.md` — added compare-and-swap to `ProjectIntakeStore.saveIntake`, wired into `applyTransitionToRecord` (the sole choke point for every workflow transition); added `linkedIntakeId` to `DiscoverySession` so `sendToEvaluation()` no longer creates a duplicate intake on a repeat call
- `docs/ai/tasks/TASK-0059-openai-strict-schema-required-fields.md` — fix: 6 of 13 OpenAI agent schemas violated Structured Outputs' strict-mode rule (every `properties` key must be in `required`, optional fields nullable), silently breaking the entire real evaluation pipeline in production; intakes stuck at `evaluating` forever with no visible error
- `docs/ai/tasks/TASK-0060-distribution-planner-board-group-fix.md` — fix: `MockDistributionPlannerAgent`'s Monday board/group names predated the Q-0005 schema correction (invented board names, made-up groups); now always suggests "Projects Portfolio" and maps to real `MondayProjectType` groups. Surfaced Q-DIST-1 (unresolved): GitHub-optional default narrowing + real-world category taxonomy mismatch
- `docs/ai/tasks/TASK-0061-discovery-clarification-reblocking-fix.md` — fix: `OpenAIClarificationQuestionsAgent` never read `ctx.priorClarifications` (unlike the mock agent), so Discovery-originated intakes got re-blocked at evaluation — landing at `clarification_needed` instead of `intake_review`, with no AI draft ever generated. Added the same "prior answers resolve blocking" rule the mock agent already had. Surfaced Q-DISC-1 (unresolved): the other 12 OpenAI evaluation agents still don't read discovery context
- `docs/ai/tasks/TASK-0062-manifest-generation-truncated-json-500.md` — fix: proposal composition truncated mid-JSON at `maxTokens: 3000` (bumped to 6000) and the shared `OpenAiLlmClient` threw a plain `Error` instead of `ProviderResponseValidationError`, so `ApplicationExceptionFilter` couldn't classify it and returned an opaque "Unexpected application error." Also added logging to the filter itself — it had none, so no bug reaching it was ever visible in server logs
- `docs/ai/tasks/TASK-0063-eval-failed-retry-and-maxtokens-default.md` — fix: closed Q-EVAL-1 — `generateEvaluation` now reverts a failed intake to `submitted` (retryable) instead of leaving it stuck at `evaluating` forever; raised the shared `OpenAiLlmClient` default `maxTokens` 2500→4000 after `custom_build` hit the same truncation class TASK-0062 fixed for proposal composition
- `docs/ai/tasks/HANDOFF-0023D-monday-credentials.md`

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
- `docs/ai/tasks/TASK-0064-custom-build-verbosity-bound.md` — fix: `custom_build` agent kept truncating even at the raised maxTokens default; added an explicit brevity constraint to its system prompt (bounds output size at the source) plus more headroom
- `docs/ai/tasks/TASK-0065-classifier-projecttype-taxonomy-mismatch.md` — fix: `OpenAIProjectClassifierAgent` used a completely different, made-up `projectType` enum than the canonical `ProjectType` registry — broke provisioning-plan generation for every real evaluation. Now imports the canonical enum directly; added a validate-or-fallback guard in `evaluation-draft-mapper.ts` too
