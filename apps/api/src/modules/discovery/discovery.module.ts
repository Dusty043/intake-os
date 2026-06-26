import { Module } from "@nestjs/common";
import {
  InMemoryDiscoverySessionStore,
  DiscoveryOrchestrator,
  DiscoveryController,
  MockIntentExtractionAgent,
  MockProblemFramingAgent,
  MockSolutionGenerationAgent,
  MockClarificationAgent,
  MockProposalComposerAgent,
  MockManifestGeneratorAgent,
} from "../../../../../src/application/discovery/index.js";
import { DiscoveryHttpController } from "./discovery.controller.js";

@Module({
  controllers: [DiscoveryHttpController],
  providers: [
    {
      provide: "DISCOVERY_CONTROLLER",
      useFactory: () => {
        let _seq = 0;
        const idFactory = (prefix: string) =>
          `${prefix}-${Date.now().toString(36)}-${++_seq}`;

        const store = new InMemoryDiscoverySessionStore();
        const orchestrator = new DiscoveryOrchestrator(
          store,
          new MockIntentExtractionAgent(),
          new MockProblemFramingAgent(),
          new MockSolutionGenerationAgent(),
          new MockClarificationAgent(),
          new MockProposalComposerAgent(),
          new MockManifestGeneratorAgent(),
          { idFactory },
        );

        return new DiscoveryController(orchestrator);
      },
    },
  ],
})
export class DiscoveryModule {}
