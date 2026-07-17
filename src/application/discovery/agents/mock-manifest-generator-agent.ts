import type {
  DiscoverySession,
  GitHubIssue,
  GitHubManifest,
  GitHubReadme,
  IntentType,
  MondayCredentialItem,
  MondayEpicItem,
  MondayManifest,
  MondayMicrotaskItem,
  MondayProjectType,
  MondayProjectsPortfolioItem,
  MondayQuarter,
  MondaySprintGroup,
  MondayTaskItem,
  ProjectProposal,
  ProvisioningManifest,
  StoryPoints,
} from "../../../domain/discovery.js";
import type { DiscoveryAgentOptions, IManifestGeneratorAgent } from "./discovery-agent-contract.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function quarterFromIso(isoDate: string): MondayQuarter {
  const month = new Date(isoDate).getUTCMonth() + 1;
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function nextQuarter(q: MondayQuarter): MondayQuarter {
  return q === "Q4" ? "Q1" : (`Q${Number(q[1]) + 1}` as MondayQuarter);
}

// SP scale: 1 2 3 5 8 13
const EPIC_SP_BY_INDEX: StoryPoints[] = [8, 13, 8, 5, 5];
const TASK_SP_DEFAULT: StoryPoints = 3;

// ─── Recommended action ───────────────────────────────────────────────────────

type RecommendedAction = ProvisioningManifest["recommendedAction"];

const ACTION_BY_INTENT: Record<IntentType, RecommendedAction> = {
  ai_assistant: "create_project",
  software_project: "create_project",
  dashboard_reporting: "create_project",
  automation: "create_project",
  process_improvement: "process_change",
  bug_fix: "create_task",
  microtask: "create_microtask",
  discovery_request: "defer",
  not_a_project: "archive",
  duplicate: "archive",
};

function recommendedAction(intentType: IntentType | undefined): RecommendedAction {
  return intentType ? (ACTION_BY_INTENT[intentType] ?? "create_project") : "create_project";
}

// ─── Monday project type ──────────────────────────────────────────────────────

const PROJECT_TYPE_BY_INTENT: Partial<Record<IntentType, MondayProjectType>> = {
  ai_assistant: "Web App",
  software_project: "Web App",
  dashboard_reporting: "Dashboard",
  automation: "n8n Workflow",
  process_improvement: "Process Change",
};

function projectType(intentType: IntentType | undefined): MondayProjectType {
  return (intentType ? PROJECT_TYPE_BY_INTENT[intentType] : undefined) ?? "Other";
}

// ─── GitHub labels by intent ──────────────────────────────────────────────────

const LABELS_BY_INTENT: Partial<Record<IntentType, string[]>> = {
  ai_assistant: ["discovery", "ai-workflow", "needs-scoping"],
  automation: ["discovery", "automation", "needs-scoping"],
  dashboard_reporting: ["discovery", "dashboard", "needs-scoping"],
  software_project: ["discovery", "software-project", "needs-scoping"],
  process_improvement: ["discovery", "process", "needs-scoping"],
  bug_fix: ["bug", "needs-scoping"],
  microtask: ["microtask"],
};

// ─── Tech stack extraction ────────────────────────────────────────────────────

function techStackFrom(proposal: ProjectProposal): string[] {
  const sd = proposal.systemDesign.value;
  const infra = proposal.infrastructure.value;
  const stack: string[] = [];

  if (sd?.clientLayer) stack.push(sd.clientLayer);
  if (sd?.apiLayer) stack.push(sd.apiLayer);
  if (sd?.messagingAsync) stack.push(sd.messagingAsync);
  if (infra?.containerization && infra.containerization !== "optional") {
    stack.push(infra.containerization);
  }
  if (infra?.ciCd) stack.push(infra.ciCd);

  return stack.length > 0 ? stack : [];
}

// ─── README generation ────────────────────────────────────────────────────────

function generateReadme(proposal: ProjectProposal, session: DiscoverySession, appBaseUrl?: string): GitHubReadme {
  const lines: string[] = [];

  lines.push(`# ${proposal.title}`);
  lines.push("");

  const pf = session.problemFrame;
  if (pf?.problemStatement) {
    lines.push(`> ${pf.problemStatement}`);
    lines.push("");
  }

  // Requirements
  const functional = proposal.requirements.value?.functional ?? [];
  if (functional.length > 0) {
    lines.push("## Key Requirements");
    lines.push("");
    for (const req of functional) {
      lines.push(`- ${req}`);
    }
    lines.push("");
  }

  // Tech stack
  const stack = techStackFrom(proposal);
  if (stack.length > 0) {
    lines.push("## Tech Stack");
    lines.push("");
    for (const tech of stack) {
      lines.push(`- ${tech}`);
    }
    lines.push("");
  }

  // Architecture note
  const arch = proposal.systemDesign.value?.serviceArchitecture;
  if (arch && arch.recommendation !== "undetermined") {
    lines.push("## Architecture");
    lines.push("");
    lines.push(`${arch.recommendation.charAt(0).toUpperCase() + arch.recommendation.slice(1)} — ${arch.rationale}`);
    lines.push("");
  }

  // Epics
  if (proposal.suggestedEpics.length > 0) {
    lines.push("## Epics");
    lines.push("");
    for (const epic of proposal.suggestedEpics) {
      lines.push(`- ${epic}`);
    }
    lines.push("");
  }

  // Assumptions
  if (proposal.assumptions.length > 0) {
    lines.push("## Assumptions");
    lines.push("");
    for (const a of proposal.assumptions) {
      lines.push(`- ${a.assumption} (Rationale: ${a.rationale})`);
    }
    lines.push("");
  }

  // Unknowns
  if (proposal.unknowns.length > 0) {
    lines.push("## Open Questions");
    lines.push("");
    for (const u of proposal.unknowns) {
      lines.push(`- ${u}`);
    }
    lines.push("");
  }

  lines.push("## Links");
  lines.push("");
  const intakeUrl = appBaseUrl
    ? `${appBaseUrl.replace(/\/$/, "")}/discovery/${session.id}`
    : "_TBD after intake is created_";
  lines.push(`- Project Intake OS: ${intakeUrl}`);
  lines.push("");
  lines.push("---");
  lines.push("_Generated by Project Intake OS · Discovery Engine_");

  return { content: lines.join("\n") };
}

// ─── Monday builder helpers ───────────────────────────────────────────────────

function estimateTargetLaunch(startIso: string, totalSP: number): string {
  // Rough heuristic: 1 SP ≈ 1 day, team velocity ~10 SP/sprint (2 weeks)
  // Add 2 sprints minimum buffer; cap estimate at 26 sprints (1 year)
  const sprints = Math.min(26, Math.max(2, Math.ceil(totalSP / 10) + 2));
  const ms = sprints * 14 * 24 * 60 * 60 * 1000;
  return new Date(new Date(startIso).getTime() + ms).toISOString().slice(0, 10);
}

function buildProjectsPortfolio(
  proposal: ProjectProposal,
  _session: DiscoverySession,
  intentType: IntentType | undefined,
  totalSP: number,
  startDate: string,
): MondayProjectsPortfolioItem {
  return {
    create: true,
    name: proposal.title,
    client: null,
    projectType: projectType(intentType),
    projectLead: null,
    status: "Conceptualization",
    health: "green",
    techStack: techStackFrom(proposal),
    startDate,
    targetLaunch: totalSP > 0 ? estimateTargetLaunch(startDate, totalSP) : null,
    estimatedTotalSP: totalSP > 0 ? totalSP : null,
  };
}

function buildEpics(
  proposal: ProjectProposal,
  planningQuarter: MondayQuarter,
): MondayEpicItem[] {
  return proposal.suggestedEpics.map((title, i) => ({
    title,
    owner: null,
    status: "Not Started" as const,
    quarter: planningQuarter,
    targetDate: null,
    estimatedSP: (EPIC_SP_BY_INDEX[i] ?? 5) as StoryPoints,
  }));
}

function buildTasks(
  proposal: ProjectProposal,
  epicTitle: string | null,
  sprint: MondaySprintGroup,
): MondayTaskItem[] {
  return proposal.suggestedTasks.map((title) => ({
    title,
    type: "Feature" as const,
    epicTitle,
    status: "Not Started" as const,
    priority: "Medium" as const,
    estimatedSP: TASK_SP_DEFAULT,
    sprint,
    unplanned: false,
    githubLink: null,
  }));
}

function buildMicrotasks(proposal: ProjectProposal): MondayMicrotaskItem[] {
  return proposal.suggestedTasks.map((title) => ({
    title,
    owner: null,
    category: "Development",
    priority: "Medium" as const,
    dueGroup: "This Week" as const,
    dueDate: null,
  }));
}

function buildInitialIssues(proposal: ProjectProposal, labels: string[]): GitHubIssue[] {
  return proposal.suggestedTasks.map((title) => ({
    title,
    body: null,
    labels,
  }));
}

// ─── Mock manifest generator ──────────────────────────────────────────────────

export class MockManifestGeneratorAgent implements IManifestGeneratorAgent {
  async generateManifest(
    proposal: ProjectProposal,
    session: DiscoverySession,
    opts: DiscoveryAgentOptions,
  ): Promise<ProvisioningManifest> {
    const intentType = session.intent?.intentType;
    const action = recommendedAction(intentType);
    const isProjectLevel = action === "create_project";
    const isMicrotask = action === "create_microtask" || action === "create_task";
    const isDeferred = action === "defer" || action === "archive" || action === "process_change";

    const currentQuarter = quarterFromIso(opts.now);
    const planningQuarter = nextQuarter(currentQuarter);

    const issueLabels = intentType
      ? (LABELS_BY_INTENT[intentType] ?? ["discovery", "needs-scoping"])
      : ["discovery"];

    // ── Monday ───────────────────────────────────────────────────────────────

    const epics: MondayEpicItem[] = isDeferred ? [] : buildEpics(proposal, planningQuarter);
    const epicSPTotal = epics.reduce((sum, e) => sum + (e.estimatedSP ?? 0), 0);

    const firstEpicTitle = epics[0]?.title ?? null;
    const sprintGroup: MondaySprintGroup = "Backlog";
    const tasks: MondayTaskItem[] = isDeferred
      ? []
      : buildTasks(proposal, firstEpicTitle, sprintGroup);

    const microtasks: MondayMicrotaskItem[] = isMicrotask
      ? buildMicrotasks(proposal)
      : [];

    const credentialsVault: MondayCredentialItem[] = [];

    const startDate = opts.now.slice(0, 10);

    const monday: MondayManifest = {
      projectsPortfolio: isProjectLevel
        ? buildProjectsPortfolio(proposal, session, intentType, epicSPTotal, startDate)
        : null,
      roadmapEpics: epics,
      sprintTasks: tasks,
      credentialsVault,
      microtasksOps: microtasks,
    };

    // ── GitHub ────────────────────────────────────────────────────────────────

    const needsRepo =
      isProjectLevel &&
      intentType !== "process_improvement" &&
      intentType !== "microtask";

    const github: GitHubManifest = {
      createRepo: needsRepo,
      repoName: needsRepo ? slugify(proposal.title) : null,
      labels: issueLabels,
      readme: needsRepo ? generateReadme(proposal, session, opts.appBaseUrl) : null,
      initialIssues: needsRepo ? buildInitialIssues(proposal, issueLabels) : [],
    };

    return {
      manifestVersion: "1.0",
      source: "discovery_engine",
      proposalId: proposal.id,
      recommendedAction: action,
      monday,
      github,
      notifications: { sendApprovalSummary: isProjectLevel },
      readyForLiveAdapter: false,
      generatedAt: opts.now,
    };
  }
}
