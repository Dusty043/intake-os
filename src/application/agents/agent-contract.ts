import type { Actor, EvaluationDepth } from "../../domain/types.js";
import type {
  ClassificationSectionContent,
  EvaluationSection,
  EvaluationSectionContent,
  EvaluationSectionKind,
} from "../intake-evaluation.js";
import type { ProjectIntakeRecord } from "../types.js";

// ─── Shared Context Object ────────────────────────────────────────────────────

export interface AgentRunContext {
  intake: ProjectIntakeRecord;
  discoveryNotes?: string[];
  priorClarifications?: Array<{
    question: string;
    answer: string;
  }>;
  depth: EvaluationDepth;
  projectTypeClassification?: ClassificationSectionContent;
  sections: Partial<Record<EvaluationSectionKind, EvaluationSection>>;
}

// ─── Run Options ──────────────────────────────────────────────────────────────

export interface AgentRunOptions {
  actor: Actor;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  idFactory: (prefix: string) => string;
  now: string;
}

// ─── Agent Output ─────────────────────────────────────────────────────────────

export interface AgentOutput<TContent = EvaluationSectionContent> {
  sectionKind: EvaluationSectionKind;
  content: TContent;
  confidence: number;
  warnings: string[];
  isClarificationBlocking?: boolean;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number | null;
    latencyMs?: number;
  };
}

// ─── Agent Interface ──────────────────────────────────────────────────────────

export interface EvaluationAgent<TContent = EvaluationSectionContent> {
  readonly role: EvaluationSectionKind;

  run(
    ctx: AgentRunContext,
    opts: AgentRunOptions,
  ): Promise<AgentOutput<TContent>>;
}
