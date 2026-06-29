import { Module } from "@nestjs/common";
import type { ProjectIntakeStore } from "../../../../../src/application/types.js";
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
import { PROJECT_INTAKE_STORE } from "../../persistence/store.token.js";
import { PrismaDiscoverySessionStore } from "../../persistence/prisma-discovery-session-store.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { DiscoveryHttpController } from "./discovery.controller.js";
import { GlobalSettingsService } from "../admin/global-settings.service.js";
import { AdminModule } from "../admin/admin.module.js";

function buildOrchestrator(
  sessionStore: PrismaDiscoverySessionStore,
  intakeStore?: ProjectIntakeStore,
  settingsService?: GlobalSettingsService,
): DiscoveryController {
  let _seq = 0;
  const idFactory = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${++_seq}`;

  const store = sessionStore;

  const apiKey = process.env["OPENAI_API_KEY"] ?? "";
  const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
  const useOpenAI = process.env["AI_PROVIDER"] === "openai" && !!apiKey;

  const intentAgent = useOpenAI
    ? new OpenAIIntentExtractionAgent(apiKey, model)
    : new MockIntentExtractionAgent();

  const framingAgent = useOpenAI
    ? new OpenAIProblemFramingAgent(apiKey, model)
    : new MockProblemFramingAgent();

  const solutionAgent = useOpenAI
    ? new OpenAISolutionGenerationAgent(apiKey, model)
    : new MockSolutionGenerationAgent();

  const clarificationAgent = useOpenAI
    ? new OpenAIClarificationAgent(apiKey, model)
    : new MockClarificationAgent();

  const proposalAgent = useOpenAI
    ? new OpenAIProposalComposerAgent(apiKey, model)
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
      idFactory,
      appBaseUrl: process.env["INTAKE_APP_URL"],
      intakeStore,
      getConfidenceThreshold: settingsService
        ? () => settingsService.getConfidenceThreshold()
        : undefined,
    },
  );

  return new DiscoveryController(orchestrator);
}

@Module({
  imports: [AdminModule],
  controllers: [DiscoveryHttpController],
  providers: [
    PrismaDiscoverySessionStore,
    {
      provide: "DISCOVERY_CONTROLLER",
      inject: [PrismaDiscoverySessionStore, PROJECT_INTAKE_STORE, GlobalSettingsService],
      useFactory: (
        sessionStore: PrismaDiscoverySessionStore,
        intakeStore: ProjectIntakeStore,
        settings: GlobalSettingsService,
      ) => buildOrchestrator(sessionStore, intakeStore, settings),
    },
  ],
})
export class DiscoveryModule {}
