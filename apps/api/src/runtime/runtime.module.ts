import { Global, Logger, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DynamoJobStatusStore } from "../../../../src/infrastructure/dynamo-job-status-store.js";
import type { JobStatusStore } from "../../../../src/application/job-status-store.js";
import { EvaluationOrchestrator } from "../../../../src/application/evaluation-orchestrator.js";
import { IntakeWorkflowService } from "../../../../src/application/intake-workflow-service.js";
import { createAllMockEvaluationAgents } from "../../../../src/application/agents/mock/index.js";
import { createAllOpenAIEvaluationAgents } from "../../../../src/application/agents/openai/index.js";
import { loadAnalysisProviderConfig } from "../../../../src/application/providers/analysis-provider-config.js";
import { AnalysisProviderRouter } from "../../../../src/application/providers/analysis-provider-router.js";
import { ProvisioningRegistry } from "../../../../src/application/provisioning/provisioning-executor.js";
import { createMockRegistry } from "../../../../src/application/provisioning/mock-executor.js";
import type { MockExecutorMode } from "../../../../src/application/provisioning/mock-executor.js";
import { GoogleChatNotifier } from "../../../../src/application/notifications/google-chat-notifier.js";
import { loadGoogleChatConfig } from "../../../../src/application/notifications/google-chat-config.js";
import { RosterApiClient } from "../../../../src/application/roster/index.js";
import { ANALYSIS_PROVIDER } from "../ai/provider.token.js";
import { ApplicationExceptionFilter } from "../common/application-exception.filter.js";
import { PrismaProjectIntakeStore } from "../persistence/prisma-project-intake-store.js";
import { PROJECT_INTAKE_STORE } from "../persistence/store.token.js";
import { PrismaService } from "../prisma/prisma.service.js";

const logger = new Logger("RuntimeModule");

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PROJECT_INTAKE_STORE,
      useClass: PrismaProjectIntakeStore,
    },
    {
      provide: ANALYSIS_PROVIDER,
      useFactory: () => {
        const config = loadAnalysisProviderConfig();
        const router = new AnalysisProviderRouter(config);
        logger.log(`AI provider: ${router.name}`);
        return router;
      },
    },
    {
      provide: IntakeWorkflowService,
      inject: [PROJECT_INTAKE_STORE, ANALYSIS_PROVIDER, EvaluationOrchestrator],
      useFactory: (
        store: PrismaProjectIntakeStore,
        analysisProvider: AnalysisProviderRouter,
        orchestrator: EvaluationOrchestrator,
      ) => {
        const useOrchestrator = process.env["ANALYSIS_ENGINE"] === "orchestrator";
        if (useOrchestrator) {
          logger.log("Analysis engine: orchestrator");
        } else {
          logger.log("Analysis engine: legacy provider");
        }

        const executorMode = (process.env["PROVISIONING_EXECUTOR_MODE"] as MockExecutorMode | undefined) ?? "success";
        const provisioningRegistry = new ProvisioningRegistry();
        for (const executor of createMockRegistry(executorMode)) {
          provisioningRegistry.register(executor);
        }
        logger.log(`Provisioning executor: mock (mode=${executorMode})`);

        const chatConfig = loadGoogleChatConfig();
        const notifier = new GoogleChatNotifier(chatConfig.webhookUrl, chatConfig.intakeBaseUrl);
        if (notifier.isEnabled) {
          logger.log("Google Chat notifications: enabled");
        } else {
          logger.log("Google Chat notifications: disabled (GOOGLE_CHAT_WEBHOOK_URL not set)");
        }

        const rosterClient = new RosterApiClient({
          baseUrl: process.env["ROSTER_API_URL"],
          apiKey: process.env["ROSTER_API_KEY"],
        });
        if (rosterClient.isConnected) {
          logger.log(`Roster API: ${process.env["ROSTER_API_URL"]}`);
        } else {
          logger.log("Roster API: not configured (ROSTER_API_URL not set)");
        }

        return new IntakeWorkflowService({
          store,
          analysisProvider,
          orchestrator: useOrchestrator ? orchestrator : undefined,
          provisioningRegistry,
          notifier,
          rosterClient,
        });
      },
    },
    {
      provide: EvaluationOrchestrator,
      useFactory: () => {
        let _seq = 0;
        const idFactory = (prefix: string) =>
          `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(++_seq).padStart(6, "0")}`;

        const apiKey = process.env["OPENAI_API_KEY"] ?? "";
        const model = process.env["OPENAI_TASKS_MODEL"] ?? process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
        const useOpenAI = process.env["AI_PROVIDER"] === "openai" && !!apiKey;

        const agents = useOpenAI
          ? createAllOpenAIEvaluationAgents(apiKey, model)
          : createAllMockEvaluationAgents();

        if (useOpenAI) {
          logger.log(`Evaluation orchestrator: openai (${model})`);
        } else {
          logger.log("Evaluation orchestrator: mock agents");
        }

        return new EvaluationOrchestrator({
          agents,
          idFactory,
          now: () => new Date().toISOString(),
        });
      },
    },
    {
      provide: "JOB_STATUS_STORE",
      useFactory: (): JobStatusStore | null => {
        const tableName = process.env["DYNAMODB_JOB_STATUS_TABLE"];
        if (!tableName) {
          logger.log("Job status store: disabled (DYNAMODB_JOB_STATUS_TABLE not set)");
          return null;
        }
        logger.log(`Job status store: DynamoDB table="${tableName}"`);
        return new DynamoJobStatusStore(tableName);
      },
    },
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionFilter,
    },
  ],
  exports: [PrismaService, PROJECT_INTAKE_STORE, IntakeWorkflowService, ANALYSIS_PROVIDER, EvaluationOrchestrator, "JOB_STATUS_STORE"],
})
export class RuntimeModule {}
