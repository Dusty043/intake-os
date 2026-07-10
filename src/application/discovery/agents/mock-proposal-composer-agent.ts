import type {
  DiscoverySession,
  DimensionSlot,
  ProblemFrameSection,
  RequirementsSection,
  SystemDesignSketch,
  ScalabilityProfile,
  ReliabilityProfile,
  InfrastructureProfile,
  CostProfile,
  TradeoffItem,
  IntentType,
  ProjectProposal,
} from "../../../domain/discovery.js";
import { emptyProjectProposal } from "../../../domain/discovery.js";
import type { DiscoveryAgentOptions, IProposalComposerAgent } from "./discovery-agent-contract.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slot<T>(
  value: T,
  confidence: number,
  source: DimensionSlot<T>["source"],
  notes?: string,
): DimensionSlot<T> {
  const s: DimensionSlot<T> = { value, confidence, source };
  if (notes) s.notes = notes;
  return s;
}

/** Truncates at a word boundary with an ellipsis, instead of cutting mid-word. */
function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

// ─── NFR hints keyed by intent type ──────────────────────────────────────────

type NfrHints = Partial<RequirementsSection["nonFunctional"]>;

const NFR_BY_INTENT: Partial<Record<IntentType, NfrHints>> = {
  ai_assistant: {
    performance: "p95 AI inference < 3s; degrade gracefully on provider timeout",
    security: "User conversations may contain PII — apply data retention and access controls",
    reliability: "Fallback to human escalation when AI confidence is low",
  },
  automation: {
    reliability: "Idempotent jobs with dead-letter queue; max 3 retries",
    performance: "Background tasks must complete within scheduled window",
  },
  dashboard_reporting: {
    performance: "Dashboard load < 2s; query p95 < 500ms",
    maintainability: "Report schema changes must not require code deploys",
  },
  software_project: {
    reliability: "99.9% uptime SLO for user-facing paths",
    security: "OWASP Top 10 compliance; authenticated access required",
  },
};

function nfr(intentType: IntentType | undefined): RequirementsSection["nonFunctional"] {
  const hints = intentType ? (NFR_BY_INTENT[intentType] ?? {}) : {};
  return {
    performance: hints.performance ?? null,
    scale: null,
    reliability: hints.reliability ?? null,
    security: hints.security ?? null,
    maintainability: hints.maintainability ?? null,
    compliance: null,
  };
}

function trafficProfile(intentType: IntentType | undefined): string | null {
  if (intentType === "microtask" || intentType === "bug_fix") return "Minimal — internal users only";
  if (intentType === "dashboard_reporting") return "Read-heavy, low-concurrency internal usage";
  if (intentType === "software_project") return "Unknown — establish baseline during beta";
  if (intentType === "ai_assistant") return "Burst-sensitive — AI inference latency affects UX";
  return null;
}

function serviceArch(complexity: string) {
  if (complexity === "low") {
    return {
      recommendation: "monolith" as const,
      rationale: "Low complexity — a single deployable is simpler to operate",
    };
  }
  if (complexity === "high") {
    return {
      recommendation: "microservices" as const,
      rationale: "High complexity — domain separation recommended",
    };
  }
  return {
    recommendation: "undetermined" as const,
    rationale: "Complexity undetermined — defer architecture decision to engineering",
  };
}

// ─── Mock proposal composer ───────────────────────────────────────────────────

export class MockProposalComposerAgent implements IProposalComposerAgent {
  async composeProposal(
    session: DiscoverySession,
    opts: DiscoveryAgentOptions,
  ): Promise<ProjectProposal> {
    const proposal = emptyProjectProposal(opts.idFactory("proposal"), session.id, opts.now);

    const pf = session.problemFrame;
    const intent = session.intent;
    const selected = session.solutionOptions.find((s) => s.id === session.selectedSolutionId);
    const conf = session.confidence;

    // ── Title ─────────────────────────────────────────────────────────────
    proposal.title = selected
      ? `${selected.title} — ${truncateAtWord(intent?.underlyingProblem ?? "", 60)}`
      : truncateAtWord(pf?.problemStatement ?? "Untitled Discovery Proposal", 80);

    // ── 1. Problem Frame ──────────────────────────────────────────────────
    if (pf) {
      const confirmedProblem = session.clarificationQuestions.filter(
        (q) => q.answered && q.affectedDimensions.includes("problemUnderstanding"),
      );
      const problemSource: DimensionSlot<ProblemFrameSection>["source"] =
        confirmedProblem.length > 0 ? "user_confirmed" : "inferred";

      proposal.problemFrame = slot<ProblemFrameSection>(
        {
          businessContext: pf.problemStatement,
          successMatrix: pf.successCriteria.length > 0
            ? pf.successCriteria
            : ["TBD — success criteria not yet defined"],
          constraints: pf.assumptions,
        },
        Math.min(conf.problemUnderstanding + 0.10, 0.95),
        problemSource,
        pf.unknowns.length > 0 ? `Unknowns: ${pf.unknowns.join("; ")}` : undefined,
      );
    }

    // ── 2. Requirements ───────────────────────────────────────────────────
    if (selected) {
      const functional: string[] = [
        selected.summary,
        ...selected.dependencies.map((d) => `Requires: ${d}`),
      ];
      const confirmedReqs = session.clarificationQuestions.filter(
        (q) => q.answered && q.affectedDimensions.includes("solutionFit"),
      );
      const reqSource: DimensionSlot<RequirementsSection>["source"] =
        confirmedReqs.length > 0 ? "user_confirmed" : "inferred";

      proposal.requirements = slot<RequirementsSection>(
        { functional, nonFunctional: nfr(intent?.intentType) },
        Math.min(conf.solutionFit + 0.05, 0.90),
        reqSource,
      );
    }

    // ── 3. System Design ──────────────────────────────────────────────────
    if (selected) {
      const complexity = selected.complexity;
      const confirmedTech = session.clarificationQuestions.filter(
        (q) => q.answered && q.affectedDimensions.includes("technicalFeasibility"),
      );
      const techSource: DimensionSlot<SystemDesignSketch>["source"] =
        confirmedTech.length > 0 ? "user_confirmed" : "inferred";

      proposal.systemDesign = slot<SystemDesignSketch>(
        {
          highLevelOverview: selected.summary,
          clientLayer: intent?.intentType === "dashboard_reporting" ? "Web UI (React/Vue)" : null,
          apiLayer: complexity !== "low" ? "REST or GraphQL API" : null,
          serviceArchitecture: serviceArch(complexity),
          dataLayer: {
            databaseChoice: null,
            modelingNotes: null,
            consistencyRequirements: null,
            queryPlanningNotes: null,
          },
          messagingAsync: intent?.intentType === "automation" ? "Queue-based async processing" : null,
          caching: null,
        },
        Math.min(conf.technicalFeasibility + 0.05, 0.85),
        techSource,
        "System design is a rough sketch — detailed decisions deferred to engineering",
      );
    }

    // ── 4. Scalability ────────────────────────────────────────────────────
    proposal.scalability = slot<ScalabilityProfile>(
      {
        trafficProfile: trafficProfile(intent?.intentType),
        capacityEstimate: null,
        scalePattern: null,
      },
      conf.scopeClarity * 0.6,
      "assumed",
      "Scalability requirements not surfaced — establish baseline during beta",
    );

    // ── 5. Reliability ────────────────────────────────────────────────────
    const failureModes = selected?.risks ?? [];
    proposal.reliability = slot<ReliabilityProfile>(
      {
        failureModeAnalysis: failureModes.length > 0
          ? failureModes
          : ["Failure modes not yet analysed"],
        disasterRecovery: null,
      },
      0.40,
      "inferred",
      "Reliability analysis based on identified solution risks",
    );

    // ── 6. Observability ──────────────────────────────────────────────────
    proposal.observability = slot<string>(
      "Basic logging, error tracking, and uptime monitoring assumed. Tooling (Datadog, Sentry, CloudWatch) to be decided.",
      0.30,
      "assumed",
    );

    // ── 7. Security Design ────────────────────────────────────────────────
    const secNote =
      NFR_BY_INTENT[intent?.intentType as IntentType]?.security ??
      "Authentication and authorisation required; input validation on all endpoints";
    proposal.securityDesign = slot<string>(secNote, 0.35, "assumed");

    // ── 8. Infrastructure ─────────────────────────────────────────────────
    if (selected) {
      const c = selected.complexity;
      const infraValue: InfrastructureProfile =
        c === "low"
          ? { cloud: "managed cloud (AWS/GCP/Azure)", infrastructureAsCode: null, containerization: "optional", ciCd: "GitHub Actions" }
          : c === "high"
          ? { cloud: "cloud-agnostic", infrastructureAsCode: true, containerization: "Docker + Kubernetes", ciCd: "GitHub Actions + ArgoCD" }
          : { cloud: "managed cloud", infrastructureAsCode: null, containerization: "Docker", ciCd: "GitHub Actions" };

      proposal.infrastructure = slot<InfrastructureProfile>(
        infraValue, 0.35, "assumed", "Infrastructure profile inferred from solution complexity",
      );

      // ── 9. Cost Engineering ────────────────────────────────────────────
      const costValue: CostProfile =
        c === "low"
          ? { estimate: "<$500/month", drivers: ["hosting", "API usage"], optimizationOpportunities: ["serverless scaling"] }
          : c === "high"
          ? { estimate: "$2,000+/month", drivers: ["compute", "storage", "API costs"], optimizationOpportunities: ["right-sizing", "reserved instances"] }
          : { estimate: "$500–$2,000/month", drivers: ["hosting", "third-party APIs"], optimizationOpportunities: ["usage monitoring"] };

      proposal.costEngineering = slot<CostProfile>(
        costValue, 0.25, "assumed", "Rough order-of-magnitude estimate",
      );
    }

    // ── 10. Tradeoffs ─────────────────────────────────────────────────────
    if (session.solutionOptions.length >= 2) {
      const [first, second] = session.solutionOptions;
      const tradeoffs: TradeoffItem[] = [
        {
          optionA: first.title,
          optionB: second.title,
          recommendation: selected?.id === first.id ? first.title : second.title,
          rationale: selected
            ? `${selected.title} recommended: ${selected.expectedUpside}`
            : first.whenItFits,
        },
      ];
      proposal.tradeoffs = slot<TradeoffItem[]>(tradeoffs, 0.65, "inferred");
    }

    // ── 11. Documentation ─────────────────────────────────────────────────
    proposal.documentation = slot<string[]>(
      ["README", "Architecture Decision Record (ADR)", "API documentation", "Deployment runbook"],
      0.30,
      "assumed",
    );

    // ── Epics, tasks, assumptions, unknowns ───────────────────────────────
    // Dependencies (people/prerequisites, e.g. "Engineering team") aren't
    // epics (units of work) — always use a generic breakdown, matching the
    // real (LLM-based) agent's guidance.
    proposal.suggestedEpics = [
      "Epic: Requirements & Design",
      "Epic: Core Implementation",
      "Epic: Integration & Testing",
      "Epic: QA & Launch",
    ];

    proposal.suggestedTasks = selected?.risks.length
      ? selected.risks.map((r) => `Mitigate: ${r}`)
      : ["Define acceptance criteria", "Set up CI/CD pipeline"];

    proposal.assumptions = pf?.assumptions ?? [];
    proposal.unknowns = pf?.unknowns ?? [];
    proposal.confidence = session.confidence;

    // ── Completeness gate ─────────────────────────────────────────────────
    const hasProblemFrame = proposal.problemFrame.value !== null;
    const hasFunctionalReqs = (proposal.requirements.value?.functional.length ?? 0) >= 1;
    const hasEpics = proposal.suggestedEpics.length >= 1;

    proposal.status = hasProblemFrame && hasFunctionalReqs && hasEpics
      ? "evaluation_ready"
      : "complete";

    return proposal;
  }
}
