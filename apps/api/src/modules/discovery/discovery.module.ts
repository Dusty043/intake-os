import { Module } from "@nestjs/common";
import type { ProjectIntakeStore } from "../../../../../src/application/types.js";
import type { IDiscoverySessionStore } from "../../../../../src/application/discovery/discovery-session-store.js";
import {
  DiscoveryOrchestrator,
  DiscoveryController,
  DiscoveryStreamRegistry,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
  OpenAIIntentExtractionAgent,
  OpenAIProblemFramingAgent,
  OpenAISolutionGenerationAgent,
  OpenAIClarificationAgent,
  OpenAIProposalComposerAgent,
} from "../../../../../src/application/discovery/index.js";
import { MockClarificationQuestionsAgent } from "../../../../../src/application/agents/mock/index.js";
import { OpenAIClarificationQuestionsAgent } from "../../../../../src/application/agents/openai/index.js";
import { loadAnalysisProviderConfig } from "../../../../../src/application/providers/analysis-provider-config.js";
import { createLlmClient, resolveModel, resolveTasksModel } from "../../../../../src/application/providers/llm-client-factory.js";
import { DISCOVERY_SESSION_STORE, PROJECT_INTAKE_STORE } from "../../persistence/store.token.js";
import { DiscoveryHttpController } from "./discovery.controller.js";
import { GlobalSettingsService } from "../admin/global-settings.service.js";
import { AdminModule } from "../admin/admin.module.js";

function buildOrchestrator(
  sessionStore: IDiscoverySessionStore,
  streamRegistry: DiscoveryStreamRegistry,
  intakeStore?: ProjectIntakeStore,
  settingsService?: GlobalSettingsService,
): DiscoveryController {
  let _seq = 0;
  const idFactory = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${++_seq}`;

  const store = sessionStore;

  const config = loadAnalysisProviderConfig();
  const isMock = config.provider === "mock";
  // Higher tier: solution generation and proposal composition — architecture,
  // trade-offs, and system design reasoning. Lower tier: intent extraction,
  // problem framing, and clarification — extraction/classification-shaped
  // tasks. See ai-cost-governance.md's model tiering table.
  const model = resolveModel(config);
  const tasksModel = resolveTasksModel(config);
  const llmClient = isMock ? null : createLlmClient(config);

  const intentAgent = llmClient
    ? new OpenAIIntentExtractionAgent(llmClient, tasksModel)
    : new MockIntentExtractionAgent();

  const framingAgent = llmClient
    ? new OpenAIProblemFramingAgent(llmClient, tasksModel)
    : new MockProblemFramingAgent();

  const solutionAgent = llmClient
    ? new OpenAISolutionGenerationAgent(llmClient, model)
    : new MockSolutionGenerationAgent();

  const clarificationAgent = llmClient
    ? new OpenAIClarificationAgent(llmClient, tasksModel)
    : new MockClarificationAgent();

  const proposalAgent = llmClient
    ? new OpenAIProposalComposerAgent(llmClient, model)
    : new MockProposalComposerAgent();

  const manifestAgent = new MockManifestGeneratorAgent();

  // Same agent Intake evaluation uses to decide isBlocking — reused here so
  // Discovery's exit gate can't hand off something Intake would immediately
  // re-block on (TASK-0075). Lower-cost tier: same extraction/classification
  // shape as the other clarification check.
  const finalClarificationCheckAgent = llmClient
    ? new OpenAIClarificationQuestionsAgent(llmClient, tasksModel)
    : new MockClarificationQuestionsAgent();

  const orchestrator = new DiscoveryOrchestrator(
    store,
    intentAgent,
    framingAgent,
    solutionAgent,
    clarificationAgent,
    proposalAgent,
    manifestAgent,
    {
      provider: isMock ? "mock" : config.provider,
      idFactory,
      appBaseUrl: process.env["INTAKE_APP_URL"],
      intakeStore,
      getConfidenceThreshold: settingsService
        ? () => settingsService.getConfidenceThreshold()
        : undefined,
      getOrgContext: settingsService
        ? () => settingsService.getOrgContext()
        : undefined,
      streamRegistry,
      finalClarificationCheckAgent,
    },
  );

  return new DiscoveryController(orchestrator);
}

@Module({
  imports: [AdminModule],
  controllers: [DiscoveryHttpController],
  providers: [
    DiscoveryStreamRegistry,
    {
      provide: "DISCOVERY_CONTROLLER",
      inject: [DISCOVERY_SESSION_STORE, DiscoveryStreamRegistry, PROJECT_INTAKE_STORE, GlobalSettingsService],
      useFactory: (
        sessionStore: IDiscoverySessionStore,
        streamRegistry: DiscoveryStreamRegistry,
        intakeStore: ProjectIntakeStore,
        settings: GlobalSettingsService,
      ) => buildOrchestrator(sessionStore, streamRegistry, intakeStore, settings),
    },
  ],
})
export class DiscoveryModule {}
