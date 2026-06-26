import type {
  ConversationMessage,
  DiscoverySession,
  DiscoveryStatus,
  DiscoveryTimelineEvent,
} from "../../domain/discovery.js";
import {
  confidenceTier,
  emptyConfidence,
} from "../../domain/discovery.js";
import type { ProjectIntakeRecord } from "../types.js";
import type { IDiscoverySessionStore } from "./discovery-session-store.js";
import type {
  IClarificationAgent,
  IIntentExtractionAgent,
  IManifestGeneratorAgent,
  IProblemFramingAgent,
  IProposalComposerAgent,
  ISolutionGenerationAgent,
  DiscoveryAgentOptions,
} from "./agents/discovery-agent-contract.js";
import { proposalToIntakeRecord } from "./proposal-to-intake-adapter.js";

// ─── Public input/output types ────────────────────────────────────────────────

export interface StartDiscoveryInput {
  userId: string;
  rawMessage: string;
}

export interface AddMessageInput {
  sessionId: string;
  content: string;
}

export interface AnswerClarificationInput {
  sessionId: string;
  questionId: string;
  answer: string;
}

export interface SelectDirectionInput {
  sessionId: string;
  solutionId: string;
}

export interface SendToEvaluationResult {
  session: DiscoverySession;
  intakeRecord: ProjectIntakeRecord;
}

export interface DiscoveryOrchestratorOptions {
  provider?: DiscoveryAgentOptions["provider"];
  model?: string;
  idFactory: (prefix: string) => string;
  now?: () => string;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class DiscoveryOrchestrator {
  private readonly provider: DiscoveryAgentOptions["provider"];
  private readonly idFactory: (prefix: string) => string;
  private readonly nowFn: () => string;

  constructor(
    private readonly store: IDiscoverySessionStore,
    private readonly intentAgent: IIntentExtractionAgent,
    private readonly framingAgent: IProblemFramingAgent,
    private readonly solutionAgent: ISolutionGenerationAgent,
    private readonly clarificationAgent: IClarificationAgent,
    private readonly proposalComposerAgent: IProposalComposerAgent,
    private readonly manifestGeneratorAgent: IManifestGeneratorAgent,
    opts: DiscoveryOrchestratorOptions,
  ) {
    this.provider = opts.provider ?? "mock";
    this.idFactory = opts.idFactory;
    this.nowFn = opts.now ?? (() => new Date().toISOString());
  }

  // ─── Start a new discovery session ───────────────────────────────────────

  async startDiscovery(input: StartDiscoveryInput): Promise<DiscoverySession> {
    const now = this.nowFn();
    const sessionId = this.idFactory("discovery");
    const messageId = this.idFactory("msg");

    const firstMessage: ConversationMessage = {
      id: messageId,
      role: "user",
      content: input.rawMessage,
      createdAt: now,
    };

    const session = await this.store.create({
      id: sessionId,
      userId: input.userId,
      status: "conversation_started",
      messages: [firstMessage],
      timeline: [this.event("conversation_started", now)],
      intent: null,
      problemFrame: null,
      solutionOptions: [],
      clarificationQuestions: [],
      selectedSolutionId: null,
      proposal: null,
      manifest: null,
      confidence: emptyConfidence(),
      createdAt: now,
      updatedAt: now,
    });

    return this.runAnalysis(session);
  }

  // ─── Add a follow-up message and re-analyse ───────────────────────────────

  async addMessage(input: AddMessageInput): Promise<DiscoverySession> {
    const now = this.nowFn();
    const session = await this.store.getById(input.sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${input.sessionId}`);

    const newMessage: ConversationMessage = {
      id: this.idFactory("msg"),
      role: "user",
      content: input.content,
      createdAt: now,
    };

    const updated = await this.store.update(session.id, {
      messages: [...session.messages, newMessage],
      updatedAt: now,
    });

    return this.runAnalysis(updated);
  }

  // ─── Read operations ─────────────────────────────────────────────────────

  async getSession(sessionId: string) {
    const session = await this.store.getById(sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${sessionId}`);
    return session;
  }

  async listSessions(userId: string) {
    return this.store.listByUser(userId);
  }

  // ─── Generate solution options ────────────────────────────────────────────

  async generateSolutions(sessionId: string): Promise<DiscoverySession> {
    const now = this.nowFn();
    const session = await this.store.getById(sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${sessionId}`);

    const agentOpts: DiscoveryAgentOptions = { provider: this.provider, idFactory: this.idFactory, now };
    const ctx = {
      messages: session.messages,
      intent: session.intent,
      problemFrame: session.problemFrame,
      currentConfidence: session.confidence,
      existingQuestions: session.clarificationQuestions,
    };

    const solutions = await this.solutionAgent.generateSolutions(ctx, agentOpts);
    const clarifications = await this.clarificationAgent.planClarifications(ctx, agentOpts);

    const nextStatus = this.resolveStatus(session.status, "solutions_generated");
    const newEvents: DiscoveryTimelineEvent[] = [];
    if (nextStatus !== session.status) newEvents.push(this.event(nextStatus, now));
    if (clarifications.length > 0) newEvents.push(this.event("clarification_needed", now));

    return this.store.update(session.id, {
      solutionOptions: solutions,
      clarificationQuestions: [...session.clarificationQuestions, ...clarifications],
      status: clarifications.length > 0 ? "clarification_needed" : nextStatus,
      timeline: [...session.timeline, ...newEvents],
      updatedAt: now,
    });
  }

  // ─── Answer a clarification question ─────────────────────────────────────

  async answerClarification(input: AnswerClarificationInput): Promise<DiscoverySession> {
    const now = this.nowFn();
    const session = await this.store.getById(input.sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${input.sessionId}`);

    const question = session.clarificationQuestions.find((q) => q.id === input.questionId);
    if (!question) throw new Error(`ClarificationQuestion not found: ${input.questionId}`);

    // Mark the question answered
    const updatedQuestions = session.clarificationQuestions.map((q) =>
      q.id === input.questionId ? { ...q, answered: true, answer: input.answer } : q,
    );

    // Append answer as a user message so framing re-runs with new context
    const answerMessage = {
      id: this.idFactory("msg"),
      role: "user" as const,
      content: `${question.question} — ${input.answer}`,
      createdAt: now,
    };

    const withAnswer = await this.store.update(session.id, {
      messages: [...session.messages, answerMessage],
      clarificationQuestions: updatedQuestions,
      updatedAt: now,
    });

    // Re-run analysis to recompute confidence with the new information
    const reanalysed = await this.runAnalysis(withAnswer);

    // If all blocking questions are answered, plan next round of clarifications
    const openBlocking = reanalysed.clarificationQuestions.filter(
      (q) => !q.answered && q.impact === "blocking",
    );

    if (openBlocking.length > 0) {
      return reanalysed;
    }

    // Plan next clarification round if confidence still low
    const agentOpts: DiscoveryAgentOptions = { provider: this.provider, idFactory: this.idFactory, now };
    const ctx = {
      messages: reanalysed.messages,
      intent: reanalysed.intent,
      problemFrame: reanalysed.problemFrame,
      currentConfidence: reanalysed.confidence,
      existingQuestions: reanalysed.clarificationQuestions,
    };
    const newClarifications = await this.clarificationAgent.planClarifications(ctx, agentOpts);

    if (newClarifications.length === 0) {
      return this.store.update(reanalysed.id, {
        status: this.resolveStatus(reanalysed.status, confidenceTier(reanalysed.confidence)),
        updatedAt: now,
      });
    }

    return this.store.update(reanalysed.id, {
      clarificationQuestions: [...reanalysed.clarificationQuestions, ...newClarifications],
      status: "clarification_needed",
      updatedAt: now,
    });
  }

  // ─── Select direction ─────────────────────────────────────────────────────

  async selectDirection(input: SelectDirectionInput): Promise<DiscoverySession> {
    const now = this.nowFn();
    const session = await this.store.getById(input.sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${input.sessionId}`);

    const solution = session.solutionOptions.find((s) => s.id === input.solutionId);
    if (!solution) throw new Error(`SolutionOption not found: ${input.solutionId}`);

    const nextStatus = this.resolveStatus(session.status, "direction_selected");
    const newEvents: DiscoveryTimelineEvent[] = [];
    if (nextStatus !== session.status) newEvents.push(this.event(nextStatus, now));

    return this.store.update(session.id, {
      selectedSolutionId: input.solutionId,
      status: nextStatus,
      timeline: [...session.timeline, ...newEvents],
      updatedAt: now,
    });
  }

  // ─── Compose proposal ────────────────────────────────────────────────────

  async composeProposal(sessionId: string): Promise<DiscoverySession> {
    const now = this.nowFn();
    const session = await this.store.getById(sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${sessionId}`);
    if (!session.selectedSolutionId) {
      throw new Error(`No solution selected for session: ${sessionId} — call selectDirection first`);
    }

    const agentOpts: DiscoveryAgentOptions = { provider: this.provider, idFactory: this.idFactory, now };
    const proposal = await this.proposalComposerAgent.composeProposal(session, agentOpts);

    const nextStatus = this.resolveStatus(
      session.status,
      proposal.status === "evaluation_ready" ? "evaluation_ready" : "proposal_generated",
    );
    const newEvents: DiscoveryTimelineEvent[] = [];
    if (nextStatus !== session.status) newEvents.push(this.event(nextStatus, now));

    return this.store.update(session.id, {
      proposal,
      status: nextStatus,
      timeline: [...session.timeline, ...newEvents],
      updatedAt: now,
    });
  }

  // ─── Send to evaluation ───────────────────────────────────────────────────

  async sendToEvaluation(sessionId: string): Promise<SendToEvaluationResult> {
    const now = this.nowFn();

    let session = await this.store.getById(sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${sessionId}`);
    if (!session.selectedSolutionId) {
      throw new Error(`No solution selected for session: ${sessionId} — call selectDirection first`);
    }

    // Compose proposal if not yet done
    if (!session.proposal || session.proposal.status === "draft") {
      session = await this.composeProposal(sessionId);
    }

    if (!session.proposal) {
      throw new Error(`Proposal composition failed for session: ${sessionId}`);
    }

    const intakeRecord = proposalToIntakeRecord(
      session.proposal,
      session,
      this.idFactory,
      now,
    );

    const nextStatus = this.resolveStatus(session.status, "sent_to_evaluation");
    const newEvents: DiscoveryTimelineEvent[] = [];
    if (nextStatus !== session.status) newEvents.push(this.event(nextStatus, now));

    const updatedSession = await this.store.update(session.id, {
      status: nextStatus,
      timeline: [...session.timeline, ...newEvents],
      updatedAt: now,
    });

    return { session: updatedSession, intakeRecord };
  }

  // ─── Generate provisioning manifest ──────────────────────────────────────

  async generateManifest(sessionId: string): Promise<DiscoverySession> {
    const now = this.nowFn();

    let session = await this.store.getById(sessionId);
    if (!session) throw new Error(`DiscoverySession not found: ${sessionId}`);
    if (!session.selectedSolutionId) {
      throw new Error(`No solution selected for session: ${sessionId} — call selectDirection first`);
    }

    // Auto-compose proposal if not yet done
    if (!session.proposal || session.proposal.status === "draft") {
      session = await this.composeProposal(sessionId);
    }

    if (!session.proposal) {
      throw new Error(`Proposal composition failed for session: ${sessionId}`);
    }

    const agentOpts: DiscoveryAgentOptions = { provider: this.provider, idFactory: this.idFactory, now };
    const manifest = await this.manifestGeneratorAgent.generateManifest(
      session.proposal,
      session,
      agentOpts,
    );

    return this.store.update(session.id, {
      manifest,
      updatedAt: now,
    });
  }

  // ─── Core analysis pipeline ───────────────────────────────────────────────

  private async runAnalysis(session: DiscoverySession): Promise<DiscoverySession> {
    const now = this.nowFn();
    const agentOpts: DiscoveryAgentOptions = {
      provider: this.provider,
      idFactory: this.idFactory,
      now,
    };

    // Stage 1 — intent extraction
    const agentCtx = {
      messages: session.messages,
      intent: session.intent,
      problemFrame: session.problemFrame,
      currentConfidence: session.confidence,
    };

    const intent = await this.intentAgent.extractIntent(agentCtx, agentOpts);

    // Stage 2 — problem framing (uses intent result)
    const framingCtx = { ...agentCtx, intent };
    const { frame, confidence } = await this.framingAgent.frameProblem(framingCtx, agentOpts);

    // Determine next status based on confidence tier
    const tier = confidenceTier(confidence);
    const nextStatus = this.resolveStatus(session.status, tier);

    const newEvents: DiscoveryTimelineEvent[] = [];
    if (nextStatus !== session.status) {
      newEvents.push(this.event(nextStatus, now));
    }

    return this.store.update(session.id, {
      intent,
      problemFrame: frame,
      confidence,
      status: nextStatus,
      timeline: [...session.timeline, ...newEvents],
      updatedAt: now,
    });
  }

  // ─── Status resolution ────────────────────────────────────────────────────

  private resolveStatus(
    current: DiscoveryStatus,
    tierOrTarget: ReturnType<typeof confidenceTier> | DiscoveryStatus,
  ): DiscoveryStatus {
    const rank: Record<DiscoveryStatus, number> = {
      draft: 0,
      conversation_started: 1,
      intent_detected: 2,
      problem_framed: 3,
      solutions_generated: 4,
      clarification_needed: 4,
      direction_selected: 5,
      proposal_generated: 6,
      evaluation_ready: 7,
      sent_to_evaluation: 8,
    };

    // If a concrete status is passed, use it directly
    if (tierOrTarget in rank) {
      const target = tierOrTarget as DiscoveryStatus;
      return rank[target] > rank[current] ? target : current;
    }

    // Otherwise map confidence tier → status
    const candidates: Record<ReturnType<typeof confidenceTier>, DiscoveryStatus> = {
      keep_discovering: "conversation_started",
      rough_frame: "intent_detected",
      propose_with_assumptions: "problem_framed",
      recommend_evaluation: "problem_framed",
    };
    const candidate = candidates[tierOrTarget as ReturnType<typeof confidenceTier>];
    return rank[candidate] > rank[current] ? candidate : current;
  }

  private event(
    status: DiscoveryStatus,
    occurredAt: string,
  ): DiscoveryTimelineEvent {
    return { status, occurredAt };
  }
}
