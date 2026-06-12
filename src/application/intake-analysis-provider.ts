import type { IntakeAnalysisDraft } from "./intake-analysis.js";
import type { ProjectIntakeRecord } from "./types.js";
import type { Actor } from "../domain/types.js";

export type AnalysisProviderName = "mock" | "openai" | "anthropic" | "bedrock";

export interface AnalysisProviderOptions {
  actor: Actor;
  idFactory: (prefix: string) => string;
  now: string;
  guidance?: string;
  sourceInquiryText?: string;
  reviewerContext?: string;
  mode: "initial_generation" | "guided_regeneration";
}

export interface AnalysisProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number | null;
}

export interface AnalysisProviderMetadata {
  provider: AnalysisProviderName;
  model?: string;
  requestId?: string;
  finishReason?: string;
  usage?: AnalysisProviderUsage;
  warnings?: string[];
}

export interface AnalysisProviderResult {
  draft: IntakeAnalysisDraft;
  metadata: AnalysisProviderMetadata;
}

export interface IntakeAnalysisProvider {
  readonly name: AnalysisProviderName;

  generateDraft(
    intake: ProjectIntakeRecord,
    options: AnalysisProviderOptions,
  ): Promise<AnalysisProviderResult>;
}
