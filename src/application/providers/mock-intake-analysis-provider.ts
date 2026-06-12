import { buildMockIntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";

export class MockIntakeAnalysisProvider implements IntakeAnalysisProvider {
  readonly name = "mock" as const;

  async generateDraft(
    intake: ProjectIntakeRecord,
    options: AnalysisProviderOptions,
  ): Promise<AnalysisProviderResult> {
    const draft = buildMockIntakeAnalysisDraft(intake, {
      idFactory: options.idFactory,
      now: options.now,
      actor: options.actor,
      input: {
        guidance: options.guidance,
        sourceInquiryText: options.sourceInquiryText,
        reviewerContext: options.reviewerContext,
      },
    });

    return {
      draft,
      metadata: {
        provider: "mock",
        model: "mock-deterministic",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
      },
    };
  }
}
