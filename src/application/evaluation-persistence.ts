import type { EvaluationDepth } from "../domain/types.js";
import type { UserRole } from "../domain/types.js";
import type {
  EvaluationSection,
  EvaluationSectionContent,
  EvaluationSectionKind,
  EvaluationSectionProvenance,
  IntakeEvaluation,
  IntakeEvaluationStatus,
  QualityScore,
} from "./intake-evaluation.js";
import {
  assertEvaluationSectionKind,
  validateIntakeEvaluation,
} from "./intake-evaluation.js";

// ─── AgentRunRecord ───────────────────────────────────────────────────────────

export interface AgentRunRecord {
  id: string;
  evaluationId: string;
  sectionId?: string;
  agentRole: EvaluationSectionKind;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  finishReason?: string;
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ─── EvaluationPersistenceBundle ──────────────────────────────────────────────

export interface EvaluationPersistenceBundle {
  evaluation: IntakeEvaluation;
  agentRuns?: AgentRunRecord[];
}

// ─── agentRunsFromEvaluation ──────────────────────────────────────────────────

export function agentRunsFromEvaluation(evaluation: IntakeEvaluation): AgentRunRecord[] {
  return evaluation.sections.map((section) => {
    const p = section.provenance;
    return {
      id: `RUN-${section.id}`,
      evaluationId: evaluation.id,
      sectionId: section.id,
      agentRole: section.kind,
      provider: p.provider,
      model: p.model,
      inputTokens: p.inputTokens,
      outputTokens: p.outputTokens,
      totalTokens: p.totalTokens,
      latencyMs: p.latencyMs,
      estimatedCostUsd: p.estimatedCostUsd,
      status: "success" as const,
      createdAt: p.generatedAt,
      completedAt: p.generatedAt,
    };
  });
}

// ─── Persistence row shapes (structural interfaces for DB/test compat) ────────

export interface SectionPersistenceRow {
  id: string;
  evaluationId: string;
  sectionKind: string;
  content: unknown;
  provenance: unknown;
  version: number;
  supersededById: string | null;
  createdAt: { toISOString(): string };
}

export interface AgentRunPersistenceRow {
  id: string;
  evaluationId: string;
  sectionId: string | null;
  agentRole: string;
  provider: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  estimatedCostUsd: { toNumber(): number } | null;
  finishReason: string | null;
  status: string;
  errorMessage: string | null;
  startedAt: { toISOString(): string } | null;
  completedAt: { toISOString(): string } | null;
  createdAt: { toISOString(): string };
}

export interface EvaluationPersistenceRow {
  id: string;
  intakeId: string;
  depth: string;
  status: string;
  qualityScore: unknown;
  evaluationVersion: number;
  createdAt: { toISOString(): string };
  createdById: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdByRole: string;
  sections: SectionPersistenceRow[];
}

// ─── Mapper: row → domain ─────────────────────────────────────────────────────

export function fromEvaluationRow(row: EvaluationPersistenceRow): IntakeEvaluation {
  const evaluation: IntakeEvaluation = {
    id: row.id,
    intakeId: row.intakeId,
    depth: row.depth as EvaluationDepth,
    status: row.status as IntakeEvaluationStatus,
    qualityScore: row.qualityScore ? fromJson<QualityScore>(row.qualityScore) : undefined,
    evaluationVersion: row.evaluationVersion,
    sections: row.sections.map(fromSectionRow),
    createdAt: row.createdAt.toISOString(),
    createdBy: {
      id: row.createdById,
      role: row.createdByRole as UserRole,
      ...(row.createdByName ? { displayName: row.createdByName } : {}),
    },
  };
  validateIntakeEvaluation(evaluation);
  return evaluation;
}

export function fromSectionRow(row: SectionPersistenceRow): EvaluationSection {
  const kind = assertEvaluationSectionKind(row.sectionKind);
  const fallbackProvenance: EvaluationSectionProvenance = {
    provider: "mock",
    agentRole: kind,
    generatedAt: row.createdAt.toISOString(),
  };
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    kind,
    content: fromJson<EvaluationSectionContent>(row.content),
    version: row.version,
    supersededById: row.supersededById ?? undefined,
    provenance: row.provenance
      ? fromJson<EvaluationSectionProvenance>(row.provenance)
      : fallbackProvenance,
  };
}

export function fromAgentRunRow(row: AgentRunPersistenceRow): AgentRunRecord {
  return {
    id: row.id,
    evaluationId: row.evaluationId,
    sectionId: row.sectionId ?? undefined,
    agentRole: row.agentRole as EvaluationSectionKind,
    provider: row.provider as AgentRunRecord["provider"],
    model: row.model ?? undefined,
    inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    totalTokens: row.totalTokens ?? undefined,
    latencyMs: row.latencyMs ?? undefined,
    estimatedCostUsd: row.estimatedCostUsd !== null ? row.estimatedCostUsd.toNumber() : null,
    finishReason: row.finishReason ?? undefined,
    status: row.status as AgentRunRecord["status"],
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt ? row.startedAt.toISOString() : undefined,
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function fromJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
