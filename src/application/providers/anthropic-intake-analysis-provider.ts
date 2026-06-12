import Anthropic from "@anthropic-ai/sdk";
import { ProviderInvocationError, ProviderResponseValidationError } from "../errors.js";
import { validateIntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";
import { validateAnalysisDraftModelOutput, analysisDraftModelOutputJsonSchema } from "./analysis-draft-output-schema.js";
import { mapModelOutputToDraft } from "./draft-output-mapper.js";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompt-templates.js";
import { estimateCost } from "./token-cost.js";

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  inputCostPer1MTokens: number | null;
  outputCostPer1MTokens: number | null;
}

const TOOL_NAME = "emit_intake_analysis_draft";

export class AnthropicIntakeAnalysisProvider implements IntakeAnalysisProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;
  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig, client?: Anthropic) {
    this.config = config;
    this.client = client ?? new Anthropic({ apiKey: config.apiKey });
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

    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        tools: [
          {
            name: TOOL_NAME,
            description: "Emit a structured intake analysis draft.",
            input_schema: analysisDraftModelOutputJsonSchema as unknown as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (err) {
      throw new ProviderInvocationError("anthropic", err instanceof Error ? err.message : String(err));
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME,
    );

    if (!toolUse) {
      throw new ProviderResponseValidationError("anthropic", `Expected tool_use block "${TOOL_NAME}" not found in response.`);
    }

    const parsed: unknown = toolUse.input;
    if (!validateAnalysisDraftModelOutput(parsed)) {
      throw new ProviderResponseValidationError("anthropic", "Tool input does not match AnalysisDraftModelOutput schema.");
    }

    const draft = mapModelOutputToDraft(parsed, {
      intakeId: intake.id,
      provider: "anthropic",
      model: this.config.model,
      idFactory: options.idFactory,
      now: options.now,
      actor: options.actor,
    });

    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      throw new ProviderResponseValidationError("anthropic", `Draft failed validation: ${validation.errors.join(", ")}`);
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      draft,
      metadata: {
        provider: "anthropic",
        model: this.config.model,
        requestId: response.id,
        finishReason: response.stop_reason ?? undefined,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: estimateCost(inputTokens, outputTokens, {
            inputCostPer1MTokens: this.config.inputCostPer1MTokens,
            outputCostPer1MTokens: this.config.outputCostPer1MTokens,
          }),
        },
      },
    };
  }
}
