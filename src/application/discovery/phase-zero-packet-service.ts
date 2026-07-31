import type { Actor } from "../../domain/types.js";
import { overallConfidence, type DiscoverySession, type PhaseZeroPacket } from "../../domain/discovery.js";
import type { AnalysisProviderName } from "../intake-analysis-provider.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { IntakeWorkflowService } from "../intake-workflow-service.js";
import type { DiscoveryController } from "./discovery-controller.js";
import type { IDiscoverySessionStore } from "./discovery-session-store.js";
import type { DiscoveryStreamRegistry } from "./discovery-stream-registry.js";
import { buildPhaseZeroPacket, buildPhaseZeroZip, capturePhaseZeroSource } from "./phase-zero-packet.js";

const SYSTEM_ACTOR: Actor = {
  id: "discovery-engine",
  role: "intake_owner",
  displayName: "Discovery Engine",
};

export interface PhaseZeroPacketServiceOptions {
  provider: AnalysisProviderName;
  now?: () => string;
  streamRegistry?: DiscoveryStreamRegistry;
}

export class PhaseZeroPacketService {
  // ponytail: process-local lock matches the current single-instance runtime;
  // use a durable unique job key when generation moves to a shared worker.
  private readonly active = new Set<string>();
  private readonly now: () => string;

  constructor(
    private readonly discovery: DiscoveryController,
    private readonly store: IDiscoverySessionStore,
    private readonly workflow: IntakeWorkflowService,
    private readonly options: PhaseZeroPacketServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async queue(sessionId: string, force = false): Promise<DiscoverySession> {
    let session = await this.requireSession(sessionId);
    const currentState = session.phaseZeroPacket?.state;
    if (currentState === "ready" || currentState === "ready_with_warnings" || this.active.has(sessionId)) {
      return session;
    }
    if (currentState === "failed" && !force) return session;
    if (!session.selectedSolutionId) {
      throw new ValidationError("Select a Discovery direction before generating the Phase 0 packet.");
    }
    if (!force && overallConfidence(session.confidence) <= 0.8) return session;

    this.active.add(sessionId);
    try {
      if (!session.proposal || session.proposal.status === "draft") {
        session = await this.discovery.composeProposal(sessionId);
      }
      const handoff = await this.discovery.sendToEvaluation(sessionId, { nonBlockingClarifications: true });
      if (!handoff.intakeRecord) throw new ConflictError("Discovery could not create its internal evaluation record.");
      session = handoff.session;
      const queuedAt = this.now();
      const source = capturePhaseZeroSource(session, queuedAt);
      const queued: PhaseZeroPacket = {
        version: "1.0",
        state: "queued",
        source,
        assumptions: source.proposal.assumptions.map((item) => `${item.assumption} — ${item.rationale}`),
        warnings: [],
        documents: [],
      };
      const updated = await this.store.update(sessionId, {
        phaseZeroPacket: queued,
        updatedAt: queuedAt,
      });
      void this.generate(sessionId, handoff.intakeRecord.id, queued).finally(() => {
        this.active.delete(sessionId);
      });
      return updated;
    } catch (error) {
      this.active.delete(sessionId);
      throw error;
    }
  }

  async getPacket(sessionId: string): Promise<PhaseZeroPacket> {
    const session = await this.requireSession(sessionId);
    if (!session.phaseZeroPacket) throw new NotFoundError("PhaseZeroPacket", sessionId);
    return session.phaseZeroPacket;
  }

  async download(sessionId: string): Promise<Uint8Array> {
    return buildPhaseZeroZip(await this.getPacket(sessionId));
  }

  private async generate(sessionId: string, intakeId: string, queued: PhaseZeroPacket): Promise<void> {
    try {
      this.publish(sessionId, { type: "stage-start", stage: "phase_zero_evaluation" });
      await this.store.update(sessionId, {
        phaseZeroPacket: { ...queued, state: "generating" },
        updatedAt: this.now(),
      });

      let { evaluation } = await this.workflow.getLatestEvaluationForIntake(intakeId);
      if (!evaluation || evaluation.depth !== "full") {
        await this.workflow.generateEvaluation(intakeId, {
          depth: "full",
          provider: this.options.provider,
          allowDepthUpgrade: false,
          nonBlockingClarifications: true,
          discoveryContext: queued.source,
        }, SYSTEM_ACTOR);
        ({ evaluation } = await this.workflow.getLatestEvaluationForIntake(intakeId));
      }
      if (!evaluation) throw new Error("Full evaluation completed without a persisted result.");
      this.publish(sessionId, { type: "stage-end", stage: "phase_zero_evaluation" });

      if ((evaluation.qualityScore?.overall ?? 0) < 90) {
        await this.store.update(sessionId, {
          phaseZeroPacket: { ...queued, state: "repairing", evaluationId: evaluation.id },
          updatedAt: this.now(),
        });
      }
      this.publish(sessionId, { type: "stage-start", stage: "phase_zero_packet" });
      const packet = buildPhaseZeroPacket(queued.source, evaluation, this.now());
      await this.store.update(sessionId, { phaseZeroPacket: packet, updatedAt: this.now() });
      this.publish(sessionId, { type: "stage-end", stage: "phase_zero_packet" });
    } catch (error) {
      const message = "The evaluator could not complete this packet. Retry generation to continue.";
      await this.store.update(sessionId, {
        phaseZeroPacket: {
          ...queued,
          state: "failed",
          error: message,
          warnings: unique([...queued.warnings, "Generation failed before the packet was complete."]),
        },
        updatedAt: this.now(),
      });
      this.publish(sessionId, { type: "error", stage: "phase_zero_packet", message });
    }
  }

  private publish(sessionId: string, event: Parameters<DiscoveryStreamRegistry["publish"]>[1]): void {
    this.options.streamRegistry?.publish(sessionId, event);
  }

  private async requireSession(sessionId: string): Promise<DiscoverySession> {
    const session = await this.store.getById(sessionId);
    if (!session) throw new NotFoundError("DiscoverySession", sessionId);
    return session;
  }
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}
