import { Module } from "@nestjs/common";
import type { ProjectIntakeStore } from "../../../../../src/application/types.js";
import type { IDiscoverySessionStore } from "../../../../../src/application/discovery/discovery-session-store.js";
import {
  DiscoveryOrchestrator,
  DiscoveryController,
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
import { loadAnalysisProviderConfig } from "../../../../../src/application/providers/analysis-provider-config.js";
import { createLlmClient, resolveModel } from "../../../../../src/application/providers/llm-client-factory.js";
import { DISCOVERY_SESSION_STORE, PROJECT_INTAKE_STORE } from "../../persistence/store.token.js";
import { DiscoveryHttpController } from "./discovery.controller.js";
import { GlobalSettingsService } from "../admin/global-settings.service.js";
import { AdminModule } from "../admin/admin.module.js";

function buildOrchestrator(
  sessionStore: IDiscoverySessionStore,
  intakeStore?: ProjectIntakeStore,
  settingsService?: GlobalSettingsService,
): DiscoveryController {
  let _seq = 0;
  const idFactory = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${++_seq}`;

  const store = sessionStore;

  const config = loadAnalysisProviderConfig();
  const isMock = config.provider === "mock";
  const model = resolveModel(config);
  const llmClient = isMock ? null : createLlmClient(config);

  const intentAgent = llmClient
    ? new OpenAIIntentExtractionAgent(llmClient, model)
    : new MockIntentExtractionAgent();

  const framingAgent = llmClient
    ? new OpenAIProblemFramingAgent(llmClient, model)
    : new MockProblemFramingAgent();

  const solutionAgent = llmClient
    ? new OpenAISolutionGenerationAgent(llmClient, model)
    : new MockSolutionGenerationAgent();

  const clarificationAgent = llmClient
    ? new OpenAIClarificationAgent(llmClient, model)
    : new MockClarificationAgent();

  const proposalAgent = llmClient
    ? new OpenAIProposalComposerAgent(llmClient, model)
    : new MockProposalComposerAgent();

  const manifestAgent = new MockManifestGeneratorAgent();

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
    },
  );

  return new DiscoveryController(orchestrator);
}

@Module({
  imports: [AdminModule],
  controllers: [DiscoveryHttpController],
  providers: [
    {
      provide: "DISCOVERY_CONTROLLER",
      inject: [DISCOVERY_SESSION_STORE, PROJECT_INTAKE_STORE, GlobalSettingsService],
      useFactory: (
        sessionStore: IDiscoverySessionStore,
        intakeStore: ProjectIntakeStore,
        settings: GlobalSettingsService,
      ) => buildOrchestrator(sessionStore, intakeStore, settings),
    },
  ],
})
export class DiscoveryModule {}
