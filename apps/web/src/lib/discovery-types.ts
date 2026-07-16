// ─── Discovery Engine Types ───────────────────────────────────────────────────

export type DiscoveryStatus =
  | "draft"
  | "conversation_started"
  | "intent_detected"
  | "problem_framed"
  | "solutions_generated"
  | "clarification_needed"
  | "direction_selected"
  | "proposal_generated"
  | "evaluation_ready"
  | "sent_to_evaluation";

export type DiscoveryMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  createdAt: string;
};

export type DiscoveryTimelineEvent = {
  status: string;
  occurredAt: string;
  note?: string;
};

export type DiscoveryIntent = {
  intentType: string;
  underlyingProblem: string;
  solutionBiasDetected: boolean;
  solutionBiasNote?: string;
  confidence: number;
};

export type DiscoveryProblemFrame = {
  problemStatement: string;
  affectedUsers: string[];
  painPoints: string[];
  businessImpact: string;
  successCriteria: string[];
  unknowns: string[];
};

export type SolutionOption = {
  id: string;
  title: string;
  summary: string;
  whenItFits: string;
  whenItIsWrong: string;
  complexity: "low" | "medium" | "high";
  isRecommended: boolean;
  rank: number;
  expectedUpside: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  impact: "blocking" | "important" | "deferred";
  answered: boolean;
  answer?: string;
};

export type DiscoveryProposal = {
  title: string;
  problemFrame: { value: unknown; confidence: number; source: string } | null;
  requirements: unknown;
  suggestedEpics: string[];
  suggestedTasks: string[];
  assumptions: string[];
  unknowns: string[];
  status: string;
};

// Monday board item types (mirror src/domain/discovery.ts)

export type MondayProjectType =
  | "Web App"
  | "Chrome Extension"
  | "n8n Workflow"
  | "Dashboard"
  | "CRM"
  | "SaaS"
  | "Process Change"
  | "Other";

export type MondaySprintGroup = "Current Sprint" | "Next Sprint" | "Backlog";
export type MondayOpsGroup = "This Week" | "Next Week" | "Someday";
export type MondayQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export type StoryPoints = 1 | 2 | 3 | 5 | 8 | 13;

export type MondayProjectsPortfolioItem = {
  create: boolean;
  name: string;
  client: string | null;
  projectType: MondayProjectType;
  projectLead: string | null;
  status: "Conceptualization" | "Development" | "Testing" | "Complete" | "On Hold";
  health: "green" | "yellow" | "red";
  techStack: string[];
  startDate: string | null;
  targetLaunch: string | null;
  estimatedTotalSP: number | null;
};

export type MondayEpicItem = {
  title: string;
  owner: string | null;
  status: "Not Started" | "In Progress" | "Complete" | "On Hold";
  quarter: MondayQuarter | null;
  targetDate: string | null;
  estimatedSP: StoryPoints | null;
};

export type MondayTaskItem = {
  title: string;
  type: "Feature" | "Bug" | "Chore" | "Research";
  epicTitle: string | null;
  status: "Not Started" | "In Progress" | "Blocked" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  estimatedSP: StoryPoints;
  sprint: MondaySprintGroup;
  unplanned: boolean;
  githubLink: string | null;
};

export type MondayMicrotaskItem = {
  title: string;
  owner: string | null;
  category: string | null;
  priority: "Low" | "Medium" | "High";
  dueGroup: MondayOpsGroup;
  dueDate: string | null;
};

export type DiscoveryManifest = {
  recommendedAction: string;
  monday: {
    projectsPortfolio: MondayProjectsPortfolioItem | null;
    roadmapEpics: MondayEpicItem[];
    sprintTasks: MondayTaskItem[];
    credentialsVault: unknown[];
    microtasksOps: MondayMicrotaskItem[];
  };
  github: {
    createRepo: boolean;
    repoName: string | null;
    labels: string[];
    readme: { content: string } | null;
    initialIssues: { title: string; body: string | null; labels: string[] }[];
  };
  readyForLiveAdapter: boolean;
};

export type DiscoveryConfidence = {
  problemUnderstanding: number;
  solutionFit: number;
  scopeClarity: number;
  technicalFeasibility: number;
  stakeholderClarity: number;
  downstreamMapping: number;
};

export type DiscoverySession = {
  id: string;
  userId: string;
  status: DiscoveryStatus;
  messages: DiscoveryMessage[];
  timeline: DiscoveryTimelineEvent[];
  intent: DiscoveryIntent | null;
  problemFrame: DiscoveryProblemFrame | null;
  solutionOptions: SolutionOption[];
  clarificationQuestions: ClarificationQuestion[];
  selectedSolutionId: string | null;
  proposal: DiscoveryProposal | null;
  manifest: DiscoveryManifest | null;
  confidence: DiscoveryConfidence;
  linkedIntakeId?: string | null;
};
