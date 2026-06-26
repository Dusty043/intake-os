import { InMemoryProjectIntakeStore } from "./in-memory-store.js";
import { IntakeController } from "./intake-controller.js";
import { IntakeWorkflowService } from "./intake-workflow-service.js";
import {
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  DiscoveryController,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
} from "./discovery/index.js";

let _idCounter = 0;
function defaultIdFactory(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

export interface ApiCompositionRoot {
  store: InMemoryProjectIntakeStore;
  intakeWorkflowService: IntakeWorkflowService;
  intakeController: IntakeController;
  discoveryController: DiscoveryController;
}

export function createApiCompositionRoot(): ApiCompositionRoot {
  const store = new InMemoryProjectIntakeStore();
  const intakeWorkflowService = new IntakeWorkflowService({ store });
  const intakeController = new IntakeController(intakeWorkflowService);

  const discoverySessionStore = new InMemoryDiscoverySessionStore();
  const discoveryOrchestrator = new DiscoveryOrchestrator(
    discoverySessionStore,
    new MockIntentExtractionAgent(),
    new MockProblemFramingAgent(),
    new MockSolutionGenerationAgent(),
    new MockClarificationAgent(),
    new MockProposalComposerAgent(),
    { idFactory: defaultIdFactory },
  );
  const discoveryController = new DiscoveryController(discoveryOrchestrator);

  return {
    store,
    intakeWorkflowService,
    intakeController,
    discoveryController,
  };
}
