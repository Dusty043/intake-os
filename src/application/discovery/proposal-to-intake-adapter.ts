import type { DiscoveryRecord, IntakeSourceReference, PriorClarification, ProjectIntakeRecord } from "../types.js";
import type { DiscoverySession, IntentType, ProjectProposal } from "../../domain/discovery.js";
import type { ProjectType } from "../../domain/types.js";

// ─── Intent → project type mapping ───────────────────────────────────────────

const INTENT_TO_PROJECT_TYPE: Record<IntentType, ProjectType> = {
  ai_assistant: "ai_workflow_tool",
  automation: "n8n_automation",
  dashboard_reporting: "internal_dashboard",
  process_improvement: "internal_tool",
  bug_fix: "internal_tool",
  microtask: "internal_tool",
  discovery_request: "discovery_research",
  software_project: "saas_platform",
  duplicate: "internal_tool",
  not_a_project: "internal_tool",
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Maps a completed ProjectProposal + its DiscoverySession into a
 * ProjectIntakeRecord ready for the evaluation orchestrator.
 * The caller is responsible for persisting the returned record.
 */
export function proposalToIntakeRecord(
  proposal: ProjectProposal,
  session: DiscoverySession,
  idFactory: (prefix: string) => string,
  now: string,
): ProjectIntakeRecord {
  const intentType = session.intent?.intentType;
  const projectType: ProjectType = intentType
    ? (INTENT_TO_PROJECT_TYPE[intentType] ?? "internal_tool")
    : "internal_tool";

  const selectedSolution = session.solutionOptions.find(
    (s) => s.id === session.selectedSolutionId,
  );

  const problemSummary =
    proposal.problemFrame.value?.businessContext ??
    session.problemFrame?.problemStatement ??
    proposal.title;

  const solutionSummary = selectedSolution
    ? `\n\nProposed direction: ${selectedSolution.summary}`
    : "";

  const source: IntakeSourceReference = {
    system: "other",
    rawPayload: {
      origin: "discovery_engine",
      discoverySessionId: session.id,
      proposalId: proposal.id,
    },
  };

  const priorClarifications: PriorClarification[] = session.clarificationQuestions
    .filter((q) => q.answered && q.answer != null)
    .map((q) => ({ question: q.question, answer: q.answer! }));

  const estimatedComplexity: DiscoveryRecord["estimatedComplexity"] =
    selectedSolution?.complexity === "low"
      ? "low"
      : selectedSolution?.complexity === "high"
      ? "high"
      : "medium";

  const discoveryRecord: DiscoveryRecord = {
    problemStatement:
      session.problemFrame?.problemStatement ?? problemSummary,
    stakeholders: session.problemFrame?.affectedUsers ?? [],
    expectedUsers: session.problemFrame?.affectedUsers ?? [],
    systemsTouched: [],
    dataSensitivity: "unknown",
    infraNeeds: [],
    estimatedComplexity,
    requiresGithub:
      intentType !== "microtask" &&
      intentType !== "bug_fix" &&
      intentType !== "not_a_project",
    // Unknowns carry a recommended default from discovery — safe for Intake
    // to treat as already resolved. Assumptions are things discovery guessed
    // FOR the user without confirmation — labeled separately so Intake's
    // clarification agent (and the final-clarification-check gate, TASK-0075)
    // knows to actively confirm these rather than silently accept them
    // (TASK-0076: unconfirmed assumptions were previously dropped entirely).
    notes:
      [
        proposal.unknowns.length > 0
          ? `Open unknowns from discovery: ${proposal.unknowns.join("; ")}`
          : null,
        proposal.assumptions.length > 0
          ? `Unconfirmed assumptions discovery made without asking the user: ${proposal.assumptions
              .map((a) => `${a.assumption} (Rationale: ${a.rationale})`)
              .join("; ")}`
          : null,
      ]
        .filter((part): part is string => part !== null)
        .join("\n\n") || undefined,
    completedBy: { id: session.userId, role: "request_creator" },
    completedAt: now,
  };

  const record: ProjectIntakeRecord = {
    id: idFactory("intake"),
    title: proposal.title,
    description: `${problemSummary}${solutionSummary}`,
    requester: session.userId,
    projectType,
    source,
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    createdBy: { id: session.userId, role: "request_creator" },
    discovery: discoveryRecord,
    externalLinks: [],
    ...(priorClarifications.length > 0 ? { priorClarifications } : {}),
  };

  return record;
}
