/**
 * smoke-ai-provider.mjs
 *
 * Smoke-tests the active AI provider configuration (from env).
 *
 * Usage:
 *   AI_PROVIDER=mock npm run smoke:ai-provider
 *   AI_PROVIDER=openai OPENAI_API_KEY=sk-... npm run smoke:ai-provider
 *   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run smoke:ai-provider
 *   AI_PROVIDER=bedrock BEDROCK_MODEL_ID=... AWS_REGION=... npm run smoke:ai-provider
 *
 * Exits 0 on success, 1 on failure.
 */

import {
  InMemoryProjectIntakeStore,
  IntakeWorkflowService,
} from "../dist/src/index.js";
import { loadAnalysisProviderConfig } from "../dist/src/application/providers/analysis-provider-config.js";
import { AnalysisProviderRouter } from "../dist/src/application/providers/analysis-provider-router.js";

const actor = { id: "smoke-test-actor", role: "intake_owner", displayName: "Smoke Test Actor" };
let counter = 0;

function log(msg) {
  process.stdout.write(msg + "\n");
}

function pass(msg) {
  log(`  ✓ ${msg}`);
}

function fail(msg, err) {
  log(`  ✗ ${msg}`);
  if (err) log(`    ${err.message ?? err}`);
  process.exit(1);
}

async function main() {
  // 1. Load config
  let config;
  try {
    config = loadAnalysisProviderConfig(process.env);
  } catch (err) {
    fail("loadAnalysisProviderConfig", err);
  }

  log(`\nSmoke test: AI provider = ${config.provider}\n`);

  // 2. Build router
  let analysisProvider;
  try {
    analysisProvider = new AnalysisProviderRouter(config);
  } catch (err) {
    fail("AnalysisProviderRouter constructor", err);
  }
  pass(`Router created — provider.name = ${analysisProvider.name}`);

  // 3. Create service
  const store = new InMemoryProjectIntakeStore();
  const service = new IntakeWorkflowService({ store, analysisProvider });
  pass("IntakeWorkflowService created with provider");

  // 4. Create and submit intake
  const intake = await service.createIntake(
    {
      title: "Smoke Test: AI Provider Integration",
      description:
        "Verify that the AI provider integration generates a valid analysis draft end-to-end. " +
        "This smoke test confirms that the provider config, prompt templates, response validation, " +
        "and draft mapping all work correctly together.",
      requester: "QA Team",
      department: "Engineering",
      projectType: "api_service",
    },
    actor,
  );
  await service.submitIntake(intake.id, actor);
  pass(`Intake submitted — id=${intake.id}`);

  // 5. Generate draft
  let draftResult;
  try {
    await service.generateMockAnalysisDraft(intake.id, {}, actor);
    const updated = await store.getIntake(intake.id);
    draftResult = updated?.analysisDrafts?.[0];
  } catch (err) {
    fail(`generateMockAnalysisDraft (provider=${config.provider})`, err);
  }

  if (!draftResult) fail("Draft was not stored on the intake record");
  pass(`Draft generated — id=${draftResult.id} provider=${draftResult.provider}`);

  // 6. Validate draft fields
  if (!draftResult.brief?.problemStatement) fail("Draft missing problemStatement");
  pass(`brief.problemStatement = ${draftResult.brief.problemStatement.slice(0, 60)}...`);

  if (!draftResult.estimatedStoryPoints || draftResult.estimatedStoryPoints < 1) {
    fail(`Draft estimatedStoryPoints invalid: ${draftResult.estimatedStoryPoints}`);
  }
  pass(`estimatedStoryPoints = ${draftResult.estimatedStoryPoints}`);

  if (!draftResult.complexity) fail("Draft missing complexity");
  pass(`complexity = ${draftResult.complexity}`);

  if (!Array.isArray(draftResult.subtasks) || draftResult.subtasks.length === 0) {
    fail("Draft has no subtasks");
  }
  pass(`subtasks = ${draftResult.subtasks.length}`);

  // 7. Regenerate with guidance (only meaningful if provider is mock or real)
  if (config.provider !== "manual") {
    try {
      await service.regenerateAnalysisDraft(
        intake.id,
        {
          guidance: "Please increase story point estimates. This is a high-complexity financial system.",
          requestedBy: actor.displayName,
        },
        actor,
      );
      const updated2 = await store.getIntake(intake.id);
      const v2 = updated2?.analysisDrafts?.find((d) => d.reviewStatus === "draft");
      if (!v2 || v2.id === draftResult.id) fail("Regeneration did not produce a new draft");
      pass(`Regenerated draft — id=${v2.id}`);
    } catch (err) {
      fail("regenerateAnalysisDraft", err);
    }
  }

  log(`\nAll checks passed. Provider "${config.provider}" is working correctly.\n`);
}

main().catch((err) => {
  log(`\nUnexpected error: ${err.message ?? err}\n`);
  process.exit(1);
});
