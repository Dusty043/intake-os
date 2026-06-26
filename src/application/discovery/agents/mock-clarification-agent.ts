import type {
  ClarificationImpact,
  ClarificationQuestion,
  DiscoveryConfidence,
  IntentType,
} from "../../../domain/discovery.js";
import type {
  DiscoveryAgentContext,
  DiscoveryAgentOptions,
  IClarificationAgent,
} from "./discovery-agent-contract.js";

// ─── Dimension question bank ──────────────────────────────────────────────────
//
// Each entry targets a specific confidence dimension.
// The clarification agent scores each dimension, then asks only about the
// lowest-confidence dimensions that are decision-changing for this intent type.
// Max 2 questions per turn — one blocking, one important.

interface DimensionQuestion {
  question: string;
  impact: ClarificationImpact;
  affectedDimensions: Array<keyof DiscoveryConfidence>;
  // Intent types where this question is NOT relevant (skip it for these)
  irrelevantFor?: IntentType[];
}

const DIMENSION_QUESTIONS: DimensionQuestion[] = [
  // stakeholderClarity —————————————————————————————————————————————————————
  {
    question: "Are the people affected by this problem internal staff, external customers, or both? This changes the security model, access patterns, and approval path.",
    impact: "blocking",
    affectedDimensions: ["stakeholderClarity", "downstreamMapping"],
    irrelevantFor: ["microtask", "bug_fix"],
  },
  {
    question: "Who currently owns this process or area — which team or role?",
    impact: "important",
    affectedDimensions: ["stakeholderClarity", "scopeClarity"],
    irrelevantFor: ["microtask"],
  },

  // scopeClarity ————————————————————————————————————————————————————————————
  {
    question: "What would a successful outcome look like in concrete terms — what changes for someone doing this work every day?",
    impact: "blocking",
    affectedDimensions: ["scopeClarity", "problemUnderstanding"],
  },
  {
    question: "Is there anything that should explicitly stay out of scope — parts of this problem you don't want touched?",
    impact: "important",
    affectedDimensions: ["scopeClarity", "downstreamMapping"],
    irrelevantFor: ["microtask", "bug_fix"],
  },

  // problemUnderstanding ————————————————————————————————————————————————————
  {
    question: "How often does this problem occur and how many people are affected each time?",
    impact: "important",
    affectedDimensions: ["problemUnderstanding", "technicalFeasibility"],
  },
  {
    question: "What has been tried before to solve this — any partial solutions or workarounds currently in place?",
    impact: "important",
    affectedDimensions: ["problemUnderstanding", "solutionFit"],
    irrelevantFor: ["microtask", "bug_fix"],
  },

  // technicalFeasibility ————————————————————————————————————————————————————
  {
    question: "Which existing systems or tools are involved in this process — anything the solution needs to connect to or replace?",
    impact: "blocking",
    affectedDimensions: ["technicalFeasibility", "downstreamMapping"],
    irrelevantFor: ["process_improvement", "not_a_project", "microtask"],
  },
  {
    question: "Are there any known technical constraints — existing platforms that must be used, languages, or infrastructure requirements?",
    impact: "important",
    affectedDimensions: ["technicalFeasibility", "scopeClarity"],
    irrelevantFor: ["process_improvement", "not_a_project", "microtask", "discovery_request"],
  },

  // solutionFit —————————————————————————————————————————————————————————————
  {
    question: "Is there a specific solution already in mind, or are you open to the team recommending the best approach?",
    impact: "important",
    affectedDimensions: ["solutionFit", "scopeClarity"],
    irrelevantFor: ["bug_fix", "microtask"],
  },
  {
    question: "What is the most important thing this solution must get right — the one thing that, if wrong, makes it a failure?",
    impact: "blocking",
    affectedDimensions: ["solutionFit", "problemUnderstanding"],
  },

  // downstreamMapping ———————————————————————————————————————————————————————
  {
    question: "Is this expected to become a standalone project, or does it belong under an existing one?",
    impact: "important",
    affectedDimensions: ["downstreamMapping", "scopeClarity"],
    irrelevantFor: ["microtask", "bug_fix", "not_a_project"],
  },
  {
    question: "Is there a rough timeline or deadline driving this, or is timing flexible?",
    impact: "deferred",
    affectedDimensions: ["downstreamMapping", "scopeClarity"],
    irrelevantFor: ["microtask"],
  },
];

// ─── Scoring and selection ────────────────────────────────────────────────────

/**
 * Scores how well each confidence dimension is covered by existing answers.
 * Uses current per-dimension confidence scores as the signal.
 */
function dimensionCoverageScore(
  dim: keyof DiscoveryConfidence,
  confidence: DiscoveryConfidence,
): number {
  return confidence[dim];
}

/**
 * Picks up to `maxQuestions` questions, prioritising:
 * 1. Questions targeting the lowest-confidence dimensions
 * 2. Blocking before important before deferred
 * 3. Skipping questions irrelevant to this intent type
 * 4. Skipping questions whose dimension is already well-covered (>= 0.70)
 */
function selectQuestions(
  intentType: IntentType,
  confidence: DiscoveryConfidence,
  alreadyAnsweredIds: Set<string>,
  maxQuestions: number,
): DimensionQuestion[] {
  const COVERAGE_THRESHOLD = 0.70;

  const impactRank: Record<ClarificationImpact, number> = {
    blocking: 0,
    important: 1,
    deferred: 2,
  };

  const candidates = DIMENSION_QUESTIONS.filter((q) => {
    // Skip if irrelevant for this intent type
    if (q.irrelevantFor?.includes(intentType)) return false;
    // Skip if all affected dimensions are already well-covered
    const allCovered = q.affectedDimensions.every(
      (dim) => dimensionCoverageScore(dim, confidence) >= COVERAGE_THRESHOLD,
    );
    if (allCovered) return false;
    // Skip if already answered (matched by question text — mock uses text as ID)
    if (alreadyAnsweredIds.has(q.question)) return false;
    return true;
  });

  // Score each candidate by: lowest average dimension confidence (most needed)
  const scored = candidates.map((q) => {
    const avgDimScore =
      q.affectedDimensions.reduce((sum, d) => sum + dimensionCoverageScore(d, confidence), 0) /
      q.affectedDimensions.length;
    return { q, avgDimScore, impactRank: impactRank[q.impact] };
  });

  // Sort: blocking first, then by lowest coverage
  scored.sort((a, b) => {
    if (a.impactRank !== b.impactRank) return a.impactRank - b.impactRank;
    return a.avgDimScore - b.avgDimScore;
  });

  return scored.slice(0, maxQuestions).map((s) => s.q);
}

// ─── Mock agent ───────────────────────────────────────────────────────────────

const MAX_QUESTIONS_PER_TURN = 2;

export class MockClarificationAgent implements IClarificationAgent {
  async planClarifications(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<ClarificationQuestion[]> {
    const intentType = ctx.intent?.intentType ?? "software_project";
    const confidence = ctx.currentConfidence;

    // Build set of already-answered question texts
    const answeredTexts = new Set(
      (ctx.existingQuestions ?? [])
        .filter((q) => q.answered)
        .map((q) => q.question),
    );

    const selected = selectQuestions(intentType, confidence, answeredTexts, MAX_QUESTIONS_PER_TURN);

    return selected.map((q) => ({
      id: opts.idFactory("cq"),
      question: q.question,
      impact: q.impact,
      affectedDimensions: q.affectedDimensions,
      answered: false,
    }));
  }
}
