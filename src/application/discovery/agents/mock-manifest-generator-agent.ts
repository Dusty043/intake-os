import type {
  DiscoverySession,
  GitHubManifest,
  IntentType,
  MondayManifest,
  ProjectProposal,
  ProvisioningManifest,
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

    // Monday manifest
    const monday: MondayManifest = {
      projectsPortfolio: isProjectLevel
        ? { create: true, name: proposal.title }
        : null,
      roadmapEpics: isDeferred ? [] : proposal.suggestedEpics,
      sprintTasks: isDeferred ? [] : proposal.suggestedTasks,
      credentialsVault: [],
      microtasksOps: isMicrotask ? proposal.suggestedTasks : [],
    };

    // GitHub manifest
    const needsRepo =
      isProjectLevel &&
      intentType !== "process_improvement" &&
      intentType !== "microtask";

    const github: GitHubManifest = {
      createRepo: needsRepo,
      repoName: needsRepo ? slugify(proposal.title) : null,
      labels: intentType ? (LABELS_BY_INTENT[intentType] ?? ["discovery", "needs-scoping"]) : ["discovery"],
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
