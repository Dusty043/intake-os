import type { AgentRunRecord } from "../../../../../../src/application/evaluation-persistence.js";
import type {
  IntakeEvaluation,
  QualityScore,
} from "../../../../../../src/application/intake-evaluation.js";

export type EvaluationSummaryDto = {
  id: string;
  intakeId: string;
  depth: string;
  status: string;
  evaluationVersion: number;
  createdAt: string;
  createdBy: { id: string; name?: string; role: string };
  qualityScore?: QualityScore;
  sectionKinds: string[];
};

export type IntakeEvaluationDto = IntakeEvaluation;
export type AgentRunDto = AgentRunRecord;

export function toEvaluationSummaryDto(e: IntakeEvaluation): EvaluationSummaryDto {
  return {
    id: e.id,
    intakeId: e.intakeId,
    depth: e.depth,
    status: e.status,
    evaluationVersion: e.evaluationVersion,
    createdAt: e.createdAt,
    createdBy: {
      id: e.createdBy.id,
      name: e.createdBy.displayName,
      role: e.createdBy.role,
    },
    qualityScore: e.qualityScore,
    sectionKinds: e.sections.filter((s) => !s.supersededById).map((s) => s.kind),
  };
}
