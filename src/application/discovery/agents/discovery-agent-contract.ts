import type {
  ClarificationQuestion,
  ConversationMessage,
  DiscoveryConfidence,
  DiscoverySession,
  IntentExtractionResult,
  ProblemFrame,
  ProjectProposal,
  ProvisioningManifest,
  SolutionOption,
} from "../../../domain/discovery.js";

// ─── Shared run context passed to every discovery agent ───────────────────────

export interface DiscoveryAgentContext {
  messages: ConversationMessage[];
  intent: IntentExtractionResult | null;
  problemFrame: ProblemFrame | null;
  currentConfidence: DiscoveryConfidence;
  existingQuestions?: ClarificationQuestion[];
}

export interface DiscoveryAgentOptions {
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  idFactory: (prefix: string) => string;
  now: string;
  model?: string;
  appBaseUrl?: string;
  /** Org-level workspace context injected into agent system prompts for baseline assumptions. */
  orgContext?: string;
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
