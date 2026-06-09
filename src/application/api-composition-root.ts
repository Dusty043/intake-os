import { InMemoryProjectIntakeStore } from "./in-memory-store.js";
import { IntakeController } from "./intake-controller.js";
import { IntakeWorkflowService } from "./intake-workflow-service.js";

export interface ApiCompositionRoot {
  store: InMemoryProjectIntakeStore;
  intakeWorkflowService: IntakeWorkflowService;
  intakeController: IntakeController;
}

export function createApiCompositionRoot(): ApiCompositionRoot {
  const store = new InMemoryProjectIntakeStore();
  const intakeWorkflowService = new IntakeWorkflowService({ store });
  const intakeController = new IntakeController(intakeWorkflowService);

  return {
    store,
    intakeWorkflowService,
    intakeController,
  };
}
