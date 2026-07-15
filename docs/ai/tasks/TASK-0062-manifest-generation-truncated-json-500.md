# TASK-0062: Fix "Unexpected application error" on select-direction / manifest generation

**Status:** Complete
**Date:** 2026-07-16

## Request

User reported: "unexpected application error on selecting direction" — with a
screenshot showing a red banner "Error: Unexpected application error." and a
Chrome DevTools network failure on `POST /api/discovery/{id}/manifest` (500).

## Investigation

Server logs (`docker logs intake-os-api-1`) showed zero errors across the
container's entire lifetime, including for this exact failure — the global
`ApplicationExceptionFilter` (`apps/api/src/common/application-exception.filter.ts`)
had no logging at all before returning its generic 500 fallback
("Unexpected application error."). Added `this.logger.error(error.message, error.stack)`
for any 500-classified error (diagnostic instrumentation, safe/non-behavioral),
deployed, then reproduced the bug directly via curl against the user's actual
session (`discovery-mrmfk0kz-1`, `X-Actor-Id: actor_admin` / `X-Actor-Role: admin`
— same headers as `dev_headers` auth mode uses, read from the proxy's own access
logs) rather than needing another browser round-trip:

```
curl -X POST http://localhost:8080/api/discovery/discovery-mrmfk0kz-1/manifest \
  -H "X-Actor-Id: actor_admin" -H "X-Actor-Role: admin" -H "X-Actor-Name: Admin"
```

Real error surfaced:
```
Error: OpenAI returned non-JSON for proposal_composition: {
  "apiLayer": "Versioned HTTP/WebSocket control-plane API for job submission, ...
    at OpenAiLlmClient.completeStructured (openai-llm-client.js:52)
    at completeWithUsage (discovery-agent-contract.js:23)
    at OpenAIProposalComposerAgent.composeProposal (openai-proposal-composer-agent.js:63)
    at DiscoveryOrchestrator.composeProposal / generateManifest
```

## Root Cause

Two compounding issues in `src/application/providers/openai-llm-client.ts`
(the shared `LlmClient` used by every OpenAI discovery *and* evaluation agent):

1. `OpenAIProposalComposerAgent`'s `proposal_composition` schema requires 18
   fields, several of them long free-text (`systemDesignOverview`,
   `architectureRationale`, `apiLayer`, etc.) plus multiple arrays. For a
   moderately complex project (the user's "Central Agent Control Plane /
   MicroVM Workers" request), the model's response exceeded the agent's
   `maxTokens: 3000` ceiling and got cut off mid-JSON before the closing
   brace — `JSON.parse` then throws on the incomplete string.
2. `openai-llm-client.ts` caught that parse failure and threw a **plain
   `Error`**, not one of this codebase's existing `ProviderInvocationError` /
   `ProviderResponseValidationError` classes (already used by
   `openai-intake-analysis-provider.ts`, `bedrock-intake-analysis-provider.ts`,
   and `anthropic-intake-analysis-provider.ts` for this exact failure shape).
   `ApplicationExceptionFilter`'s `toHttpError()` only recognizes those typed
   errors — a plain `Error` falls through to the generic
   `InternalServerErrorException("Unexpected application error.")`, hiding
   the real cause from both the client response and (until this task) the
   server logs.

## Fix

- `apps/api/src/common/application-exception.filter.ts`: log any 500-classified
  error server-side before responding (`this.logger.error(...)`) — this alone
  is a permanent observability fix, independent of the specific bug found.
- `src/application/providers/openai-llm-client.ts`: throw
  `ProviderResponseValidationError("openai", ...)` instead of a plain `Error`
  for both the empty-content and non-JSON-content cases, matching the
  established pattern in the other three provider files. When
  `finish_reason === "length"`, the message now explicitly says the response
  was truncated at the configured `maxTokens`, rather than implying
  malformed output. This routes through the filter's existing
  `ProviderResponseValidationError` branch → a real `502 Bad Gateway` with
  the actual cause in the response body, for every OpenAI agent using this
  shared client — not just the proposal composer.
- `src/application/discovery/agents/openai/openai-proposal-composer-agent.ts`:
  raised `maxTokens` from `3000` to `6000` so this specific schema stops
  truncating for realistic proposals in the first place.

## Tests

No new unit test added: `OpenAiLlmClient` constructs its own `OpenAI` SDK
client internally (`constructor(apiKey: string)`, no injection seam), unlike
`OpenAIIntakeAnalysisProvider` (which accepts an optional `client?: OpenAI` for
stubbing) — adding that DI seam is a larger, separately-scoped refactor, not
the smallest fix for this bug. Verified instead via the live reproduction
above (curl against the real failing session) both before and after the fix.
`npm run build:core` clean. `npm test` — 791/791 pass, no regressions.

## Deploy

Committed and pushed directly to `main` (confirmed workflow for this session),
pulled + rebuilt + restarted on oreochiserver, healthcheck passed. Re-ran the
same curl reproduction post-deploy: manifest generation completed successfully
(see BUILD_LOG entry for confirmation details).

## Follow-up

- Consider adding the same `client?: OpenAI` injection seam to `OpenAiLlmClient`
  that `OpenAIIntakeAnalysisProvider` already has, so this class becomes
  unit-testable without hitting the real API. Not logged as a numbered open
  question — it's a testability nice-to-have, not a product decision.
