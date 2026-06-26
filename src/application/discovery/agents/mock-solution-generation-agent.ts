import type { IntentType, ProblemFrame, SolutionOption } from "../../../domain/discovery.js";
import type {
  DiscoveryAgentContext,
  DiscoveryAgentOptions,
  ISolutionGenerationAgent,
} from "./discovery-agent-contract.js";

// ─── Solution templates keyed by intent type ──────────────────────────────────

interface SolutionTemplate {
  title: string;
  summary: string;
  whenItFits: string;
  whenItIsWrong: string;
  complexity: SolutionOption["complexity"];
  dependencies: string[];
  risks: string[];
  expectedUpside: string;
}

const SOLUTION_TEMPLATES: Record<IntentType, SolutionTemplate[]> = {
  automation: [
    {
      title: "Workflow Automation",
      summary: "Automate the manual steps using a workflow engine or integration platform.",
      whenItFits: "The process is repetitive, rule-based, and well-understood.",
      whenItIsWrong: "The process requires frequent human judgment or has many exceptions.",
      complexity: "medium",
      dependencies: ["Workflow platform (e.g. n8n, Make, Zapier, or custom)", "Source system API access"],
      risks: ["Exception handling complexity", "Dependency on source system stability"],
      expectedUpside: "Eliminate manual effort; reduce processing time significantly.",
    },
    {
      title: "Scheduled Script or Job",
      summary: "Write a scheduled script that performs the repetitive task on a fixed cadence.",
      whenItFits: "The task runs on a predictable schedule and has a clear input/output.",
      whenItIsWrong: "The task is event-driven or requires real-time response.",
      complexity: "low",
      dependencies: ["Execution environment (cron, cloud function, or task runner)", "Source system access"],
      risks: ["Brittle if source system changes", "No visibility without logging"],
      expectedUpside: "Low-cost, fast-to-build solution for simple recurring tasks.",
    },
    {
      title: "Process Redesign First",
      summary: "Redesign the manual process before automating — automation of a broken process produces automated problems.",
      whenItFits: "The current process has known inefficiencies or unclear ownership.",
      whenItIsWrong: "The process is already well-defined and just needs execution.",
      complexity: "low",
      dependencies: ["Process owner availability", "Stakeholder alignment"],
      risks: ["Organizational resistance to change", "Scope creep"],
      expectedUpside: "Cleaner foundation; automation built on solid ground is cheaper to maintain.",
    },
  ],

  dashboard_reporting: [
    {
      title: "Embedded Analytics Dashboard",
      summary: "Build a dashboard inside the existing product or portal using a charting library.",
      whenItFits: "Users are already in a product context and need data inline.",
      whenItIsWrong: "Stakeholders need a standalone, shareable, or scheduled report.",
      complexity: "medium",
      dependencies: ["Data source with query access", "Frontend framework"],
      risks: ["Data freshness requirements may push toward real-time pipeline", "Permission model for who sees what"],
      expectedUpside: "High visibility; reduces context-switching; actionable in workflow.",
    },
    {
      title: "BI Tool Integration",
      summary: "Connect an existing BI tool (e.g. Metabase, Looker, Power BI) to the data source.",
      whenItFits: "Business users need self-service exploration without engineering involvement.",
      whenItIsWrong: "Data is not yet structured or cleaned enough for BI consumption.",
      complexity: "low",
      dependencies: ["BI tool license", "Database read access", "Data model quality"],
      risks: ["Data quality issues become visible immediately", "BI tool limitations on custom logic"],
      expectedUpside: "Fast time-to-value; non-engineers can build their own views.",
    },
    {
      title: "Data Quality and Modeling First",
      summary: "Fix the underlying data model and quality before building any reporting layer.",
      whenItFits: "The root cause is unclear data, not missing visualisation.",
      whenItIsWrong: "Data is already clean and the problem is purely presentation.",
      complexity: "medium",
      dependencies: ["Data engineering access", "Source system documentation"],
      risks: ["Longer to value; stakeholders may want dashboards now"],
      expectedUpside: "Reports that can be trusted; no rework when data is later corrected.",
    },
  ],

  ai_assistant: [
    {
      title: "AI Knowledge Assistant",
      summary: "Build a conversational assistant that retrieves answers from approved internal content.",
      whenItFits: "Users need conversational access to a known, bounded knowledge set.",
      whenItIsWrong: "The knowledge base does not exist or is not approved/curated.",
      complexity: "medium",
      dependencies: ["Knowledge source (docs, FAQ, wiki)", "LLM API access", "Retrieval pipeline"],
      risks: ["Hallucination if knowledge base has gaps", "Content governance required"],
      expectedUpside: "Significant reduction in repetitive queries; 24/7 availability.",
    },
    {
      title: "Ticket Deflection Workflow",
      summary: "Intercept support tickets before human review and suggest answers automatically.",
      whenItFits: "Most questions arrive through a helpdesk or ticket system.",
      whenItIsWrong: "Questions require human judgment or sensitive data access.",
      complexity: "high",
      dependencies: ["Helpdesk API integration", "LLM API", "Escalation path to human agents"],
      risks: ["Wrong deflections damage user trust", "Complex escalation logic"],
      expectedUpside: "High-volume deflection rate; agents focus on complex issues only.",
    },
    {
      title: "Knowledge Base Cleanup First",
      summary: "Audit and structure the existing knowledge before adding AI on top.",
      whenItFits: "Answers exist but are scattered, outdated, or inconsistently formatted.",
      whenItIsWrong: "The knowledge base is already well-maintained and findable.",
      complexity: "low",
      dependencies: ["Content owners", "Wiki or knowledge management tool"],
      risks: ["Unglamorous work; may face resistance"],
      expectedUpside: "AI quality is directly proportional to knowledge quality — fix it first.",
    },
  ],

  process_improvement: [
    {
      title: "Process Mapping and Redesign",
      summary: "Map the current process end-to-end, identify waste, and design an improved version.",
      whenItFits: "The root cause is process inefficiency, not missing technology.",
      whenItIsWrong: "The process is already well-designed and the bottleneck is a specific tool.",
      complexity: "low",
      dependencies: ["Process owners", "Stakeholder time for workshops"],
      risks: ["Change management challenges", "May reveal deeper org issues"],
      expectedUpside: "Often eliminates the need for software entirely; cheapest path if it works.",
    },
    {
      title: "Lightweight Tooling Addition",
      summary: "Add a targeted tool (forms, checklists, templates) to remove friction from the existing process.",
      whenItFits: "The process is sound but lacks structure or shared access.",
      whenItIsWrong: "The process itself is broken — tools on a broken process amplify problems.",
      complexity: "low",
      dependencies: ["Tool selection", "User adoption"],
      risks: ["Low adoption if it doesn't fit the workflow", "Tool sprawl"],
      expectedUpside: "Fast, low-risk improvement; can be a stepping stone to automation.",
    },
    {
      title: "Full Process Automation",
      summary: "Automate the redesigned process end-to-end after validating the improved flow.",
      whenItFits: "The process is well-understood, high-volume, and the manual cost is significant.",
      whenItIsWrong: "The process is still being refined — automate only when it's stable.",
      complexity: "high",
      dependencies: ["Stable process definition", "API access to involved systems"],
      risks: ["Automation locks in the process — changes become expensive"],
      expectedUpside: "Maximum efficiency gain; scales without headcount.",
    },
  ],

  software_project: [
    {
      title: "Custom Build",
      summary: "Design and build a purpose-fit solution tailored to the specific requirements.",
      whenItFits: "No off-the-shelf product satisfies the core requirements.",
      whenItIsWrong: "A configurable SaaS product exists and would cover 80%+ of the need.",
      complexity: "high",
      dependencies: ["Engineering team", "Infrastructure", "Defined requirements"],
      risks: ["Build time", "Maintenance burden", "Scope creep"],
      expectedUpside: "Exact fit; full control; no vendor dependency.",
    },
    {
      title: "Configure or Extend Existing Platform",
      summary: "Extend or configure an existing internal or third-party platform rather than building from scratch.",
      whenItFits: "A platform already in use can be extended with plugins, APIs, or configuration.",
      whenItIsWrong: "The platform is too rigid or the extension cost equals a custom build.",
      complexity: "medium",
      dependencies: ["Platform API or plugin system", "Platform vendor support"],
      risks: ["Vendor roadmap dependency", "Extension limits may be hit later"],
      expectedUpside: "Faster delivery; inherits platform security and maintenance.",
    },
    {
      title: "Prototype First",
      summary: "Build a small throwaway prototype to validate the approach before committing to a full build.",
      whenItFits: "The requirements are unclear or the technical approach is uncertain.",
      whenItIsWrong: "Requirements are clear and the team has high confidence in the approach.",
      complexity: "low",
      dependencies: ["Access to a representative data set or environment"],
      risks: ["Prototype may be mistaken for production-ready"],
      expectedUpside: "De-risks the full investment; surfaces hidden complexity early.",
    },
  ],

  bug_fix: [
    {
      title: "Targeted Bug Fix",
      summary: "Identify the root cause and apply a minimal fix.",
      whenItFits: "The defect is isolated and well-understood.",
      whenItIsWrong: "The bug is a symptom of a deeper architectural problem.",
      complexity: "low",
      dependencies: ["Reproduction steps", "Test coverage for regression"],
      risks: ["Fix may introduce regression if untested"],
      expectedUpside: "Fast resolution; minimal risk if properly tested.",
    },
    {
      title: "Refactor the Affected Area",
      summary: "Use the bug as an opportunity to clean up the underlying code.",
      whenItFits: "The bug-prone area has accumulated tech debt that makes targeted fixes risky.",
      whenItIsWrong: "Timeline is tight; refactoring scope is uncertain.",
      complexity: "medium",
      dependencies: ["Test coverage for the refactored area"],
      risks: ["Scope expansion; regression risk"],
      expectedUpside: "Reduces future bug rate in this area.",
    },
  ],

  microtask: [
    {
      title: "Direct Execution",
      summary: "Complete the small task directly without a formal project.",
      whenItFits: "The task is self-contained, low-risk, and under a few hours of work.",
      whenItIsWrong: "The task has hidden complexity or dependencies that make it not actually small.",
      complexity: "low",
      dependencies: [],
      risks: ["May grow if not timeboxed"],
      expectedUpside: "Fastest path to done.",
    },
  ],

  discovery_request: [
    {
      title: "Structured Discovery Workshop",
      summary: "Run a facilitated session with stakeholders to map the problem and explore options.",
      whenItFits: "The ask is genuinely undefined and stakeholders have different views.",
      whenItIsWrong: "The problem is clear and discovery is a delay tactic.",
      complexity: "low",
      dependencies: ["Stakeholder availability"],
      risks: ["Workshop findings may still leave direction unclear"],
      expectedUpside: "Builds shared understanding; surfaces constraints early.",
    },
    {
      title: "Technical Spike",
      summary: "Run a short technical investigation to answer a specific feasibility question.",
      whenItFits: "A specific technical unknown is blocking the decision.",
      whenItIsWrong: "The unknown is business/product, not technical.",
      complexity: "low",
      dependencies: ["Access to relevant systems or APIs"],
      risks: ["Spike may uncover larger problems"],
      expectedUpside: "Removes a key decision blocker quickly.",
    },
  ],

  duplicate: [
    {
      title: "Link to Existing Work",
      summary: "This request overlaps with an existing project or task — link it rather than creating a new one.",
      whenItFits: "A matching project, epic, or task already exists.",
      whenItIsWrong: "The overlap is superficial but the underlying need is different.",
      complexity: "low",
      dependencies: [],
      risks: ["Silencing a duplicate may hide a real signal about process gaps"],
      expectedUpside: "Avoids duplication of effort and fragmented progress tracking.",
    },
  ],

  not_a_project: [
    {
      title: "Process or Policy Change",
      summary: "Address this through a change in process, documentation, or policy — no software needed.",
      whenItFits: "The root cause is a people or process problem, not a technology gap.",
      whenItIsWrong: "The process change itself requires tooling to be enforced.",
      complexity: "low",
      dependencies: ["Decision-maker authority"],
      risks: ["Process changes without tooling are hard to enforce"],
      expectedUpside: "Zero build cost; immediate impact if adopted.",
    },
    {
      title: "Park for Later",
      summary: "Acknowledge the idea but defer it — the timing or priority does not justify action now.",
      whenItFits: "The idea is valid but competing priorities make it low-urgency.",
      whenItIsWrong: "Parking is being used to avoid a hard prioritisation conversation.",
      complexity: "low",
      dependencies: [],
      risks: ["Parked items rarely resurface without a champion"],
      expectedUpside: "Preserves the idea without committing resources.",
    },
  ],
};

// ─── Ranking helpers ──────────────────────────────────────────────────────────

function pickRecommended(templates: SolutionTemplate[], frame: ProblemFrame): number {
  // Recommend lower-complexity options when unknowns are high
  if (frame.unknowns.length >= 3) {
    const lowIdx = templates.findIndex((t) => t.complexity === "low");
    if (lowIdx >= 0) return lowIdx;
  }
  // Otherwise recommend the first option (domain-ordered as most common fit)
  return 0;
}

// ─── Mock agent ───────────────────────────────────────────────────────────────

export class MockSolutionGenerationAgent implements ISolutionGenerationAgent {
  async generateSolutions(
    ctx: DiscoveryAgentContext,
    opts: DiscoveryAgentOptions,
  ): Promise<SolutionOption[]> {
    const intentType = ctx.intent?.intentType ?? "software_project";
    const frame = ctx.problemFrame ?? {
      problemStatement: "",
      affectedUsers: [],
      currentProcess: "",
      painPoints: [],
      businessImpact: "",
      successCriteria: [],
      assumptions: [],
      unknowns: [],
    };

    const templates = SOLUTION_TEMPLATES[intentType] ?? SOLUTION_TEMPLATES["software_project"];
    const recommendedIdx = pickRecommended(templates, frame);

    return templates.slice(0, 4).map((t, i) => ({
      id: opts.idFactory("sol"),
      title: t.title,
      summary: t.summary,
      whenItFits: t.whenItFits,
      whenItIsWrong: t.whenItIsWrong,
      complexity: t.complexity,
      dependencies: t.dependencies,
      risks: t.risks,
      expectedUpside: t.expectedUpside,
      rank: i + 1,
      isRecommended: i === recommendedIdx,
    }));
  }
}
