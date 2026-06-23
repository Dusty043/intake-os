import { buildMockIntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";
import type { RosterApiClient } from "../roster/index.js";
import { scoreMembers } from "../roster/index.js";

export class MockIntakeAnalysisProvider implements IntakeAnalysisProvider {
  readonly name = "mock" as const;
  private readonly rosterClient: RosterApiClient | undefined;

  constructor(rosterClient?: RosterApiClient) {
    this.rosterClient = rosterClient;
  }

  async generateDraft(
    intake: ProjectIntakeRecord,
    options: AnalysisProviderOptions,
  ): Promise<AnalysisProviderResult> {
    let rosterResult;
    if (this.rosterClient?.isConnected) {
      const members = await this.rosterClient.fetchRoster();
      if (members.length > 0) {
        const stackHint = options.sourceInquiryText
          ? options.sourceInquiryText.split(/\s+/).slice(0, 10)
          : [];
        rosterResult = scoreMembers(members, intake.projectType, stackHint);
      }
    }

    const draft = buildMockIntakeAnalysisDraft(intake, {
      idFactory: options.idFactory,
      now: options.now,
      actor: options.actor,
      rosterResult,
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
