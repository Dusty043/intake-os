import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { IntakeWorkflowService } from "../../../../src/application/intake-workflow-service.js";
import { ApplicationExceptionFilter } from "../common/application-exception.filter.js";
import { PrismaProjectIntakeStore } from "../persistence/prisma-project-intake-store.js";
import { PROJECT_INTAKE_STORE } from "../persistence/store.token.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PROJECT_INTAKE_STORE,
      useClass: PrismaProjectIntakeStore,
    },
    {
      provide: IntakeWorkflowService,
      inject: [PROJECT_INTAKE_STORE],
      useFactory: (store: PrismaProjectIntakeStore) => new IntakeWorkflowService({ store }),
    },
    {
      provide: APP_FILTER,
      useClass: ApplicationExceptionFilter,
    },
  ],
  exports: [PrismaService, PROJECT_INTAKE_STORE, IntakeWorkflowService],
})
export class RuntimeModule {}
