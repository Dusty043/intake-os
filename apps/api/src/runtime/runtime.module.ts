import { Global, Logger, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { IntakeWorkflowService } from "../../../../src/application/intake-workflow-service.js";
import { loadAnalysisProviderConfig } from "../../../../src/application/providers/analysis-provider-config.js";
import { AnalysisProviderRouter } from "../../../../src/application/providers/analysis-provider-router.js";
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
      inject: [PROJECT_INTAKE_STORE, ANALYSIS_PROVIDER],
      useFactory: (store: PrismaProjectIntakeStore, analysisProvider: AnalysisProviderRouter) =>
        new IntakeWorkflowService({ store, analysisProvider }),
    },
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionFilter,
    },
  ],
  exports: [PrismaService, PROJECT_INTAKE_STORE, IntakeWorkflowService, ANALYSIS_PROVIDER],
})
export class RuntimeModule {}
