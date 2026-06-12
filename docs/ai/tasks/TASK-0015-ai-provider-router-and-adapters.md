# TASK-0015 — AI Provider Router & Real Provider Adapters

## Status: Complete

## Objective

Add a real AI provider layer behind the `IntakeAnalysisProvider` interface so that `IntakeWorkflowService` can route to OpenAI, Anthropic, Bedrock, or mock based on environment configuration. No governance changes. No silent fallback. Provider selected at startup from `AI_PROVIDER` env var.

## What Was Built

### New application layer files

| File | Purpose |
|------|---------|
| `src/application/intake-analysis-provider.ts` | `IntakeAnalysisProvider` interface, `AnalysisProviderOptions`, `AnalysisProviderResult`, `AnalysisProviderMetadata` |
| `src/application/providers/analysis-draft-output-schema.ts` | `AnalysisDraftModelOutput` interface, JSON schema, `validateAnalysisDraftModelOutput()` |
| `src/application/providers/prompt-templates.ts` | `buildAnalysisSystemPrompt()`, `buildAnalysisUserPrompt()` — guidance injected as reviewer context |
| `src/application/providers/token-cost.ts` | `estimateCost()` — null when rates not configured |
| `src/application/providers/analysis-provider-config.ts` | `loadAnalysisProviderConfig()` — reads env, throws `ConfigurationError` for missing keys |
| `src/application/providers/mock-intake-analysis-provider.ts` | `MockIntakeAnalysisProvider` — wraps `buildMockIntakeAnalysisDraft` |
| `src/application/providers/draft-output-mapper.ts` | `mapModelOutputToDraft()` — maps AI output to `IntakeAnalysisDraft`, assigns governance fields from ctx |
| `src/application/providers/openai-intake-analysis-provider.ts` | OpenAI via `json_schema` structured output |
| `src/application/providers/anthropic-intake-analysis-provider.ts` | Anthropic via forced `tool_use` |
| `src/application/providers/bedrock-intake-analysis-provider.ts` | Bedrock via Converse API + `toolChoice.tool` |
| `src/application/providers/analysis-provider-router.ts` | `AnalysisProviderRouter` — builds correct provider from config |

### NestJS wiring

| File | Change |
|------|--------|
| `apps/api/src/ai/provider.token.ts` | `ANALYSIS_PROVIDER = Symbol("ANALYSIS_PROVIDER")` — shared injection token |
| `apps/api/src/runtime/runtime.module.ts` | Factory: `loadAnalysisProviderConfig()` + `AnalysisProviderRouter`, logged at startup, exported globally |
| `apps/api/src/modules/health/health.controller.ts` | Injects `ANALYSIS_PROVIDER`, `/health` returns `ai.provider` + `ai.enabled` |

### Tests (127 total, all pass)

| Test file | Coverage |
|-----------|---------|
| `tests/analysis-provider-config.test.mjs` | Config loading, defaults, error cases for each provider |
| `tests/analysis-provider-router.test.mjs` | Router construction, missing config errors, provider name |
| `tests/mock-intake-analysis-provider.test.mjs` | Draft generation, metadata, guidance incorporation |
| `tests/openai-intake-analysis-provider.test.mjs` | Success, invocation error, empty content, invalid JSON, bad schema, null cost |
| `tests/anthropic-intake-analysis-provider.test.mjs` | Success, invocation error, missing tool_use block, bad schema, null cost |
| `tests/bedrock-intake-analysis-provider.test.mjs` | Success, invocation error, missing tool_use block, bad schema, null cost |

All real provider tests use injected stub clients — no live API calls.

### Other changes

- `src/index.ts` — exports new provider interface, config, router, mock provider
- `.env.example` and `.env.server.example` — AI provider env vars documented
- `scripts/smoke-ai-provider.mjs` + `npm run smoke:ai-provider` — end-to-end smoke test
- `package.json` — `smoke:ai-provider` script added

## Design Decisions

- **No silent fallback**: `AI_PROVIDER=openai` without `OPENAI_API_KEY` throws `ConfigurationError` at startup. No fallback to mock.
- **Governance fields never from AI**: `id`, `status`, `actor`, timestamps always come from `mapModelOutputToDraft` ctx, never from AI output.
- **Guidance as reviewer context**: Injected into the user prompt only; system prompt explicitly says AI must not let guidance override the required schema or governance rules.
- **Constructor-injected SDK clients**: All three real providers accept an optional `client` in their constructor, enabling full unit testing with stub clients.
- **Bedrock `ToolInputSchema` cast**: `analysisDraftModelOutputJsonSchema` is cast via `as unknown as ToolInputSchema` due to `readonly` tuple incompatibility with Smithy's `DocumentType`.

## Test Results

```
127 tests passed, 0 failed
npm run smoke:ai-provider (mock) — passed
npm run api:build — passed
```

## Follow-up

- TASK-0016: Wire Anthropic/OpenAI provider in server `.env.server` and verify via `/health` endpoint on live server.
- TASK-0017: AI cost tracking and usage audit log events.
- Add `reviewerContext` from `sourceInquiryText` field once that field is defined.
