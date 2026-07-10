import type {
  ClarificationQuestion,
  ConversationMessage,
  DiscoveryAgentRole,
  DiscoveryConfidence,
  DiscoverySession,
  IntentExtractionResult,
  ProblemFrame,
  ProjectProposal,
  ProvisioningManifest,
  SolutionOption,
} from "../../../domain/discovery.js";
import type { LlmClient, StructuredCompletionParams } from "../../llm-client.js";
import type { DiscoveryStreamEvent } from "../discovery-stream-registry.js";

// ─── Shared run context passed to every discovery agent ───────────────────────

export interface DiscoveryAgentContext {
  messages: ConversationMessage[];
  intent: IntentExtractionResult | null;
  problemFrame: ProblemFrame | null;
  currentConfidence: DiscoveryConfidence;
  existingQuestions?: ClarificationQuestion[];
}

/** Raw usage reported by a real (non-mock) discovery agent after an LLM call. */
export interface DiscoveryAgentUsageEvent {
  agentRole: DiscoveryAgentRole;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export interface DiscoveryAgentOptions {
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  idFactory: (prefix: string) => string;
  now: string;
  model?: string;
  appBaseUrl?: string;
  /** Org-level workspace context injected into agent system prompts for baseline assumptions. */
  orgContext?: string;
  /** Called by real agents after each LLM call so the orchestrator can log cost for reporting. */
  onUsage?: (usage: DiscoveryAgentUsageEvent) => void;
  /** Called around each LLM call (stage-start, token, stage-end, error) so the orchestrator can forward live progress to a DiscoveryStreamRegistry subscriber. Optional — omit for no live progress. */
  onStreamEvent?: (event: DiscoveryStreamEvent) => void;
}

/**
 * answerClarification stores follow-up messages as "<question>\nAnswer:
 * <answer>" (role "user") so agents get next-turn context. Mock agents do
 * naive keyword extraction over user message text — without stripping the
 * echoed question, a question that mentions a term to ask about it (e.g.
 * "internal staff, external customers, or both?") false-positive-matches
 * even when the answer rules that term out. Real (LLM-based) agents don't
 * need this: they read the full "Q\nAnswer: A" and correctly attribute
 * meaning to the answer.
 */
export function stripEchoedQuestion(content: string): string {
  const marker = "\nAnswer: ";
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  return content.slice(idx + marker.length);
}

/** Runs a structured LLM call, reports its usage via opts.onUsage, and brackets it with stage-start/token/stage-end/error events via opts.onStreamEvent. Shared by all real discovery agents. */
export async function completeWithUsage<T>(
  client: LlmClient,
  opts: DiscoveryAgentOptions,
  agentRole: DiscoveryAgentRole,
  model: string,
  params: Omit<StructuredCompletionParams, "model">,
): Promise<T> {
  const startedAt = Date.now();
  opts.onStreamEvent?.({ type: "stage-start", stage: agentRole });
  try {
    const { content, inputTokens, outputTokens } = await client.completeStructured<T>({
      ...params,
      model,
      onToken: (text) => opts.onStreamEvent?.({ type: "token", stage: agentRole, text }),
    });
    opts.onUsage?.({ agentRole, model, inputTokens, outputTokens, latencyMs: Date.now() - startedAt });
    opts.onStreamEvent?.({ type: "stage-end", stage: agentRole });
    return content;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    opts.onStreamEvent?.({ type: "error", stage: agentRole, message });
    throw err;
  }
}

// ─── Intent extraction ────────────────────────────────────────────────────────

export interface IIntentExtractionAgent {
  extractIntent(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<IntentExtractionResult>;
}

// ─── Problem framing ──────────────────────────────────────────────────────────

export interface IProblemFramingAgent {
  frameProblem(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<{ frame: ProblemFrame; confidence: DiscoveryConfidence }>;
}

// ─── Solution generation ──────────────────────────────────────────────────────

export interface ISolutionGenerationAgent {
  generateSolutions(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<SolutionOption[]>;
}

// ─── Clarification ────────────────────────────────────────────────────────────

export interface IClarificationAgent {
  planClarifications(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<ClarificationQuestion[]>;
}

// ─── Proposal composition ─────────────────────────────────────────────────────

export interface IProposalComposerAgent {
  composeProposal(
    session: DiscoverySession,
    opts: DiscoveryAgentOptions,
  ): Promise<ProjectProposal>;
}

// ─── Provisioning manifest ────────────────────────────────────────────────────

export interface IManifestGeneratorAgent {
  generateManifest(
    proposal: ProjectProposal,
    session: DiscoverySession,
    opts: DiscoveryAgentOptions,
  ): Promise<ProvisioningManifest>;
}
