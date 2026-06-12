import OpenAI from "openai";
import { ProviderInvocationError, ProviderResponseValidationError } from "../errors.js";
import { validateIntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";
import { validateAnalysisDraftModelOutput, analysisDraftModelOutputJsonSchema } from "./analysis-draft-output-schema.js";
import { mapModelOutputToDraft } from "./draft-output-mapper.js";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompt-templates.js";
import { estimateCost } from "./token-cost.js";

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  inputCostPer1MTokens: number | null;
  outputCostPer1MTokens: number | null;
}

export class OpenAIIntakeAnalysisProvider implements IntakeAnalysisProvider {
  readonly name = "openai" as const;
  private readonly client: OpenAI;
  private readonly config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig, client?: OpenAI) {
    this.config = config;
    this.client = client ?? new OpenAI({ apiKey: config.apiKey });
  }

  async generateDraft(
    intake: ProjectIntakeRecord,
    options: AnalysisProviderOptions,
  ): Promise<AnalysisProviderResult> {
    const systemPrompt = buildAnalysisSystemPrompt();
    const userPrompt = buildAnalysisUserPrompt({
      intake,
      guidance: options.guidance,
      sourceInquiryText: options.sourceInquiryText,
      reviewerContext: options.reviewerContext,
      mode: options.mode,
    });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens,
        temperature: this.config.temperature,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "intake_analysis_draft",
            strict: true,
            schema: analysisDraftModelOutputJsonSchema as Record<string, unknown>,
          },
        },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (err) {
      throw new ProviderInvocationError("openai", err instanceof Error ? err.message : String(err));
    }

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new ProviderResponseValidationError("openai", "Empty response content.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ProviderResponseValidationError("openai", "Response is not valid JSON.");
    }

    if (!validateAnalysisDraftModelOutput(parsed)) {
      throw new ProviderResponseValidationError("openai", "Response does not match AnalysisDraftModelOutput schema.");
    }

    const draft = mapModelOutputToDraft(parsed, {
      intakeId: intake.id,
      provider: "openai",
      model: this.config.model,
      idFactory: options.idFactory,
      now: options.now,
      actor: options.actor,
    });

    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      throw new ProviderResponseValidationError("openai", `Draft failed validation: ${validation.errors.join(", ")}`);
    }

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    return {
      draft,
      metadata: {
        provider: "openai",
        model: this.config.model,
        requestId: response.id,
        finishReason: choice?.finish_reason ?? undefined,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
          estimatedCostUsd: estimateCost(inputTokens, outputTokens, {
            inputCostPer1MTokens: this.config.inputCostPer1MTokens,
            outputCostPer1MTokens: this.config.outputCostPer1MTokens,
          }),
        },
      },
    };
  }
}
