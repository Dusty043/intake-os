import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
  type Tool,
  type ToolConfiguration,
  type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import { ProviderInvocationError, ProviderResponseValidationError } from "../errors.js";
import { validateIntakeAnalysisDraft } from "../intake-analysis.js";
import type { AnalysisProviderOptions, AnalysisProviderResult, IntakeAnalysisProvider } from "../intake-analysis-provider.js";
import type { ProjectIntakeRecord } from "../types.js";
import { validateAnalysisDraftModelOutput, analysisDraftModelOutputJsonSchema } from "./analysis-draft-output-schema.js";
import { mapModelOutputToDraft } from "./draft-output-mapper.js";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "./prompt-templates.js";
import { estimateCost } from "./token-cost.js";

export interface BedrockProviderConfig {
  region: string;
  modelId: string;
  maxOutputTokens: number;
  temperature: number;
  inputCostPer1MTokens: number | null;
  outputCostPer1MTokens: number | null;
}

const TOOL_NAME = "emit_intake_analysis_draft";

export class BedrockIntakeAnalysisProvider implements IntakeAnalysisProvider {
  readonly name = "bedrock" as const;
  private readonly client: BedrockRuntimeClient;
  private readonly config: BedrockProviderConfig;

  constructor(config: BedrockProviderConfig, client?: BedrockRuntimeClient) {
    this.config = config;
    this.client = client ?? new BedrockRuntimeClient({ region: config.region });
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

    const tool: Tool = {
      toolSpec: {
        name: TOOL_NAME,
        description: "Emit a structured intake analysis draft.",
        inputSchema: { json: analysisDraftModelOutputJsonSchema as unknown } as ToolInputSchema,
      },
    };

    const toolConfig: ToolConfiguration = {
      tools: [tool],
      toolChoice: { tool: { name: TOOL_NAME } },
    };

    const input: ConverseCommandInput = {
      modelId: this.config.modelId,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: {
        maxTokens: this.config.maxOutputTokens,
        temperature: this.config.temperature,
      },
      toolConfig,
    };

    let response: ConverseCommandOutput;
    try {
      response = await this.client.send(new ConverseCommand(input));
    } catch (err) {
      throw new ProviderInvocationError("bedrock", err instanceof Error ? err.message : String(err));
    }

    const toolUseBlock = response.output?.message?.content?.find(
      (block) => block.toolUse?.name === TOOL_NAME,
    );

    if (!toolUseBlock?.toolUse?.input) {
      throw new ProviderResponseValidationError(
        "bedrock",
        `Expected tool_use block "${TOOL_NAME}" not found in response.`,
      );
    }

    const parsed: unknown = toolUseBlock.toolUse.input;
    if (!validateAnalysisDraftModelOutput(parsed)) {
      throw new ProviderResponseValidationError("bedrock", "Tool input does not match AnalysisDraftModelOutput schema.");
    }

    const draft = mapModelOutputToDraft(parsed, {
      intakeId: intake.id,
      provider: "bedrock",
      model: this.config.modelId,
      idFactory: options.idFactory,
      now: options.now,
      actor: options.actor,
    });

    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      throw new ProviderResponseValidationError("bedrock", `Draft failed validation: ${validation.errors.join(", ")}`);
    }

    const inputTokens = response.usage?.inputTokens ?? 0;
    const outputTokens = response.usage?.outputTokens ?? 0;

    return {
      draft,
      metadata: {
        provider: "bedrock",
        model: this.config.modelId,
        finishReason: response.stopReason ?? undefined,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: response.usage?.totalTokens ?? inputTokens + outputTokens,
          estimatedCostUsd: estimateCost(inputTokens, outputTokens, {
            inputCostPer1MTokens: this.config.inputCostPer1MTokens,
            outputCostPer1MTokens: this.config.outputCostPer1MTokens,
          }),
        },
      },
    };
  }
}
