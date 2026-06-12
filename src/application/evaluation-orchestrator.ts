import type { Actor, EvaluationDepth } from "../domain/types.js";
import type {
  ClarificationQuestionsSectionContent,
  ClassificationSectionContent,
  EvaluationSection,
  EvaluationSectionKind,
  IntakeBriefSectionContent,
  IntakeEvaluation,
  IntakeEvaluationStatus,
  QualityReviewSectionContent,
  QualityScore,
} from "./intake-evaluation.js";
import type {
  AgentOutput,
  AgentRunContext,
  AgentRunOptions,
  EvaluationAgent,
} from "./agents/agent-contract.js";
import type { ProjectIntakeRecord } from "./types.js";
import {
  EVALUATION_DEPTH_ROUTING_TABLE,
  validateEvaluationSection,
  validateIntakeEvaluation,
} from "./intake-evaluation.js";
import { ConfigurationError } from "./errors.js";

// ─── Stage constants ──────────────────────────────────────────────────────────

const STAGE_1_KINDS: EvaluationSectionKind[] = [
  "intake_brief",
  "clarification_questions",
  "classification",
];

const STAGE_3_KINDS: EvaluationSectionKind[] = ["synthesis", "quality_review"];

const REQUIRED_CONSTRUCTION_KINDS: EvaluationSectionKind[] = [
  "intake_brief",
  "clarification_questions",
  "classification",
  "synthesis",
  "quality_review",
];

const DEPTH_RANK: Record<EvaluationDepth, number> = { light: 0, standard: 1, full: 2 };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EvaluationOrchestratorOptions {
  agents: EvaluationAgent[];
  idFactory: (prefix: string) => string;
  now: () => string;
}

export interface EvaluationOrchestrationOptions {
  actor: Actor;
  depth: EvaluationDepth;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  discoveryNotes?: string[];
  priorClarifications?: Array<{ question: string; answer: string }>;
  allowDepthUpgrade?: boolean;
}

export interface ClarificationOutcome {
  intakeId: string;
  depth: EvaluationDepth;
  generatedAt: string;
  createdBy: Actor;
  intakeBriefSection: EvaluationSection<IntakeBriefSectionContent>;
  clarificationSection: EvaluationSection<ClarificationQuestionsSectionContent>;
  questions: ClarificationQuestionsSectionContent["questions"];
  missingFields: string[];
  warnings: string[];
}

export interface EvaluationReadyResult {
  kind: "evaluation_ready";
  evaluation: IntakeEvaluation;
}

export interface ClarificationRequiredResult {
  kind: "clarification_required";
  clarification: ClarificationOutcome;
}

export type EvaluationOrchestrationResult = EvaluationReadyResult | ClarificationRequiredResult;

// ─── Error types ──────────────────────────────────────────────────────────────

export class EvaluationOrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationOrchestrationError";
  }
}

export class AgentOutputValidationError extends EvaluationOrchestrationError {
  constructor(kind: EvaluationSectionKind, reason: string) {
    super(`Agent output validation failed for "${kind}": ${reason}`);
    this.name = "AgentOutputValidationError";
  }
}

export class MissingEvaluationAgentError extends ConfigurationError {
  constructor(kind: EvaluationSectionKind) {
    super(`Missing required evaluation agent for section kind: "${kind}"`);
    this.name = "MissingEvaluationAgentError";
  }
}

// ─── EvaluationOrchestrator ───────────────────────────────────────────────────

export class EvaluationOrchestrator {
  private readonly registry: Map<EvaluationSectionKind, EvaluationAgent>;
  private readonly idFactory: (prefix: string) => string;
  private readonly getNow: () => string;

  constructor(options: EvaluationOrchestratorOptions) {
    this.registry = buildRegistry(options.agents);
    this.idFactory = options.idFactory;
    this.getNow = options.now;
  }

  async orchestrate(
    intake: ProjectIntakeRecord,
    options: EvaluationOrchestrationOptions,
  ): Promise<EvaluationOrchestrationResult> {
    const runNow = this.getNow();
    const evaluationId = this.idFactory("eval");
    const allowDepthUpgrade = options.allowDepthUpgrade ?? true;

    const agentOpts: AgentRunOptions = {
      actor: options.actor,
      provider: options.provider,
      model: options.model,
      idFactory: this.idFactory,
      now: runNow,
    };

    const sections: Partial<Record<EvaluationSectionKind, EvaluationSection>> = {};

    // ── Stage 1: Serial intake understanding ─────────────────────────────────

    const intakeBriefResult = await this.runAgent(
      "intake_brief",
      evaluationId,
      buildCtx(intake, options.depth, sections, options),
      agentOpts,
    );
    sections.intake_brief = intakeBriefResult.section;

    // clarification_questions only runs when in the requested depth route
    const requestedRoute = EVALUATION_DEPTH_ROUTING_TABLE[options.depth];
    if (requestedRoute.includes("clarification_questions")) {
      if (!this.registry.has("clarification_questions")) {
        throw new MissingEvaluationAgentError("clarification_questions");
      }

      const clarResult = await this.runAgent(
        "clarification_questions",
        evaluationId,
        buildCtx(intake, options.depth, sections, options),
        agentOpts,
      );

      const clarContent = clarResult.section.content as ClarificationQuestionsSectionContent;
      const isBlocking =
        clarResult.output.isClarificationBlocking === true || clarContent.isBlocking === true;

      if (isBlocking) {
        return {
          kind: "clarification_required",
          clarification: {
            intakeId: intake.id,
            depth: options.depth,
            generatedAt: runNow,
            createdBy: options.actor,
            intakeBriefSection:
              intakeBriefResult.section as EvaluationSection<IntakeBriefSectionContent>,
            clarificationSection:
              clarResult.section as EvaluationSection<ClarificationQuestionsSectionContent>,
            questions: clarContent.questions,
            missingFields: clarContent.missingFields,
            warnings: clarResult.section.provenance.warnings ?? [],
          },
        };
      }

      sections.clarification_questions = clarResult.section;
    }

    const classResult = await this.runAgent(
      "classification",
      evaluationId,
      buildCtx(intake, options.depth, sections, options),
      agentOpts,
    );
    sections.classification = classResult.section;

    const classContent = classResult.section.content as ClassificationSectionContent;
    const effectiveDepth = resolveDepth(
      options.depth,
      classContent.recommendedDepth,
      allowDepthUpgrade,
    );

    // ── Stage 2: Parallel specialist analysis ────────────────────────────────

    const effectiveRoute = EVALUATION_DEPTH_ROUTING_TABLE[effectiveDepth];
    const stage2Kinds = effectiveRoute.filter(
      (k) => !STAGE_1_KINDS.includes(k) && !STAGE_3_KINDS.includes(k),
    );

    for (const kind of stage2Kinds) {
      if (!this.registry.has(kind)) throw new MissingEvaluationAgentError(kind);
    }

    // All Stage 2 agents receive the same frozen Stage 1 snapshot so that
    // parallel execution is order-independent and deterministic.
    const stage1Snapshot = { ...sections };

    const stage2Results = await Promise.all(
      stage2Kinds.map((kind) =>
        this.runAgent(
          kind,
          evaluationId,
          buildCtx(intake, effectiveDepth, stage1Snapshot, options),
          agentOpts,
        ),
      ),
    );

    // Merge in routing-table order — never rely on Promise.all resolution order.
    for (let i = 0; i < stage2Kinds.length; i++) {
      sections[stage2Kinds[i]] = stage2Results[i].section;
    }

    // ── Stage 3: Serial synthesis and quality review ──────────────────────────

    if (!this.registry.has("synthesis")) throw new MissingEvaluationAgentError("synthesis");
    if (!this.registry.has("quality_review")) throw new MissingEvaluationAgentError("quality_review");

    const synthResult = await this.runAgent(
      "synthesis",
      evaluationId,
      buildCtx(intake, effectiveDepth, sections, options),
      agentOpts,
    );
    sections.synthesis = synthResult.section;

    const qualityResult = await this.runAgent(
      "quality_review",
      evaluationId,
      buildCtx(intake, effectiveDepth, sections, options),
      agentOpts,
    );
    sections.quality_review = qualityResult.section;

    // ── Assemble final evaluation ─────────────────────────────────────────────

    const orderedSections = effectiveRoute
      .filter((kind) => sections[kind] !== undefined)
      .map((kind) => sections[kind]!);

    const qualityContent = qualityResult.section.content as QualityReviewSectionContent;
    const qualityScore: QualityScore = qualityContent.qualityScore;
    const status = deriveStatus(qualityScore);

    const evaluation: IntakeEvaluation = {
      id: evaluationId,
      intakeId: intake.id,
      depth: effectiveDepth,
      sections: orderedSections,
      qualityScore,
      status,
      evaluationVersion: 1,
      createdAt: runNow,
      createdBy: options.actor,
    };

    validateIntakeEvaluation(evaluation);

    return { kind: "evaluation_ready", evaluation };
  }

  private async runAgent(
    kind: EvaluationSectionKind,
    evaluationId: string,
    ctx: AgentRunContext,
    opts: AgentRunOptions,
  ): Promise<{ section: EvaluationSection; output: AgentOutput }> {
    const agent = this.registry.get(kind);
    if (!agent) throw new MissingEvaluationAgentError(kind);

    const startMs = Date.now();
    const output = await agent.run(ctx, opts);
    const latencyMs = Date.now() - startMs;

    validateAgentOutput(kind, output);

    const section: EvaluationSection = {
      id: opts.idFactory("SECTION"),
      evaluationId,
      kind: output.sectionKind,
      content: output.content,
      version: 1,
      provenance: {
        provider: opts.provider,
        model: opts.model,
        agentRole: output.sectionKind,
        generatedAt: opts.now,
        confidence: output.confidence,
        warnings: output.warnings.length > 0 ? output.warnings : undefined,
        inputTokens: output.usage?.inputTokens,
        outputTokens: output.usage?.outputTokens,
        totalTokens: output.usage?.totalTokens,
        latencyMs,
        estimatedCostUsd: output.usage?.estimatedCostUsd,
      },
    };

    validateEvaluationSection(section);

    return { section, output };
  }
}

// ─── Module-private helpers ───────────────────────────────────────────────────

function buildRegistry(
  agents: EvaluationAgent[],
): Map<EvaluationSectionKind, EvaluationAgent> {
  const registry = new Map<EvaluationSectionKind, EvaluationAgent>();

  for (const agent of agents) {
    if (registry.has(agent.role)) {
      throw new ConfigurationError(`Duplicate evaluation agent role: "${agent.role}"`);
    }
    registry.set(agent.role, agent);
  }

  for (const kind of REQUIRED_CONSTRUCTION_KINDS) {
    if (!registry.has(kind)) {
      throw new MissingEvaluationAgentError(kind);
    }
  }

  return registry;
}

function buildCtx(
  intake: ProjectIntakeRecord,
  depth: EvaluationDepth,
  sections: Partial<Record<EvaluationSectionKind, EvaluationSection>>,
  options: Pick<EvaluationOrchestrationOptions, "discoveryNotes" | "priorClarifications">,
): AgentRunContext {
  return {
    intake,
    depth,
    sections: { ...sections },
    discoveryNotes: options.discoveryNotes,
    priorClarifications: options.priorClarifications,
    projectTypeClassification: sections.classification?.content as
      | ClassificationSectionContent
      | undefined,
  };
}

function resolveDepth(
  requested: EvaluationDepth,
  recommended: EvaluationDepth,
  allowUpgrade: boolean,
): EvaluationDepth {
  if (!allowUpgrade) return requested;
  return DEPTH_RANK[recommended] > DEPTH_RANK[requested] ? recommended : requested;
}

function validateAgentOutput(kind: EvaluationSectionKind, output: AgentOutput): void {
  if (output.sectionKind !== kind) {
    throw new AgentOutputValidationError(
      kind,
      `expected sectionKind "${kind}" but got "${output.sectionKind}"`,
    );
  }
  if (typeof output.confidence !== "number") {
    throw new AgentOutputValidationError(kind, "confidence must be a number");
  }
  if (output.confidence < 0 || output.confidence > 100) {
    throw new AgentOutputValidationError(
      kind,
      `confidence ${output.confidence} is out of range [0, 100]`,
    );
  }
  if (!Array.isArray(output.warnings)) {
    throw new AgentOutputValidationError(kind, "warnings must be an array");
  }
  if (output.content === null || output.content === undefined || typeof output.content !== "object") {
    throw new AgentOutputValidationError(kind, "content must be an object");
  }
}

function deriveStatus(qualityScore: QualityScore): IntakeEvaluationStatus {
  const band = qualityScore.readinessBand;
  if (band === "ready" || band === "usable") return "ready_for_review";
  if (band === "needs_revision") return "needs_revision";
  return "not_ready";
}
