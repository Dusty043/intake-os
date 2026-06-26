import type { DiscoveryOrchestrator } from "./discovery-orchestrator.js";

// ─── Request/response shapes (framework-neutral) ──────────────────────────────

export interface StartDiscoveryRequest {
  userId: string;
  message: string;
}

export interface AddMessageRequest {
  message: string;
}

export interface AnswerClarificationRequest {
  questionId: string;
  answer: string;
}

export interface SelectDirectionRequest {
  solutionId: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * Framework-neutral discovery controller.
 * The NestJS (or Express) adapter layer wraps these methods with HTTP routing.
 *
 * POST /discovery                           → startDiscovery
 * POST /discovery/:id/message               → addMessage
 * POST /discovery/:id/solutions             → generateSolutions
 * POST /discovery/:id/clarifications/answer → answerClarification
 * POST /discovery/:id/direction             → selectDirection
 * POST /discovery/:id/proposal             → composeProposal
 * POST /discovery/:id/manifest             → generateManifest
 * POST /discovery/:id/send-to-evaluation   → sendToEvaluation
 * GET  /discovery/:id                       → getSession
 * GET  /discovery?userId=…                  → listSessions
 */
export class DiscoveryController {
  constructor(private readonly orchestrator: DiscoveryOrchestrator) {}

  startDiscovery(body: StartDiscoveryRequest) {
    return this.orchestrator.startDiscovery({
      userId: body.userId,
      rawMessage: body.message,
    });
  }

  addMessage(sessionId: string, body: AddMessageRequest) {
    return this.orchestrator.addMessage({ sessionId, content: body.message });
  }

  generateSolutions(sessionId: string) {
    return this.orchestrator.generateSolutions(sessionId);
  }

  answerClarification(sessionId: string, body: AnswerClarificationRequest) {
    return this.orchestrator.answerClarification({
      sessionId,
      questionId: body.questionId,
      answer: body.answer,
    });
  }

  selectDirection(sessionId: string, body: SelectDirectionRequest) {
    return this.orchestrator.selectDirection({
      sessionId,
      solutionId: body.solutionId,
    });
  }

  getSession(sessionId: string) {
    return this.orchestrator.getSession(sessionId);
  }

  listSessions(userId: string) {
    return this.orchestrator.listSessions(userId);
  }

  composeProposal(sessionId: string) {
    return this.orchestrator.composeProposal(sessionId);
  }

  generateManifest(sessionId: string) {
    return this.orchestrator.generateManifest(sessionId);
  }

  sendToEvaluation(sessionId: string) {
    return this.orchestrator.sendToEvaluation(sessionId);
  }
}
