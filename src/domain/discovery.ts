// ─── Dimension Slot ───────────────────────────────────────────────────────────

/**
 * Wraps a discovery dimension value with confidence and provenance metadata.
 * null value = not yet surfaced; confidence 0 = unknown.
 * The evaluation orchestrator uses whichever dimensions are populated and
 * infers the rest as it does today.
 */
export interface DimensionSlot<T> {
  value: T | null;
  confidence: number; // 0.0 – 1.0
  source: "inferred" | "user_confirmed" | "assumed";
  notes?: string; // visible assumption text when source is "inferred" or "assumed"
}

function emptySlot<T>(): DimensionSlot<T> {
  return { value: null, confidence: 0, source: "inferred" };
}

// ─── Discovery Status ─────────────────────────────────────────────────────────

export const discoveryStatuses = [
  "draft",
  "conversation_started",
  "intent_detected",
  "problem_framed",
  "solutions_generated",
  "clarification_needed",
  "direction_selected",
  "proposal_generated",
  "evaluation_ready",
  "sent_to_evaluation",
] as const;

export type DiscoveryStatus = (typeof discoveryStatuses)[number];

export const discoverySideStatuses = [
  "duplicate_candidate",
  "not_a_project",
  "microtask_candidate",
  "needs_human_review",
  "parked",
  "abandoned",
] as const;

export type DiscoverySideStatus = (typeof discoverySideStatuses)[number];

// ─── Intent Type ──────────────────────────────────────────────────────────────

export const intentTypes = [
  "software_project",
  "automation",
  "dashboard_reporting",
  "ai_assistant",
  "process_improvement",
  "bug_fix",
  "microtask",
  "discovery_request",
  "duplicate",
  "not_a_project",
] as const;

export type IntentType = (typeof intentTypes)[number];

// ─── Confidence ───────────────────────────────────────────────────────────────

export interface DiscoveryConfidence {
  problemUnderstanding: number;
  solutionFit: number;
  scopeClarity: number;
  technicalFeasibility: number;
  stakeholderClarity: number;
  downstreamMapping: number;
}

export function emptyConfidence(): DiscoveryConfidence {
  return {
    problemUnderstanding: 0,
    solutionFit: 0,
    scopeClarity: 0,
    technicalFeasibility: 0,
    stakeholderClarity: 0,
    downstreamMapping: 0,
  };
}

export function overallConfidence(c: DiscoveryConfidence): number {
  const values = Object.values(c) as number[];
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Confidence gate — determines discovery behaviour based on overall score.
 */
export type ConfidenceTier =
  | "keep_discovering" // < 0.40
  | "rough_frame" // 0.40 – 0.65
  | "propose_with_assumptions" // 0.66 – 0.80
  | "recommend_evaluation"; // > 0.80

export function confidenceTier(c: DiscoveryConfidence, roughFrameMax = 0.65): ConfidenceTier {
  const score = overallConfidence(c);
  if (score <= 0.40) return "keep_discovering";
  if (score <= roughFrameMax) return "rough_frame";
  if (score <= 0.80) return "propose_with_assumptions";
  return "recommend_evaluation";
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  createdAt: string;
}

export interface DiscoveryTimelineEvent {
  status: DiscoveryStatus | DiscoverySideStatus;
  occurredAt: string;
  note?: string;
}

// ─── Problem Frame ────────────────────────────────────────────────────────────

export interface ProblemFrame {
  problemStatement: string;
  affectedUsers: string[];
  currentProcess: string;
  painPoints: string[];
  businessImpact: string;
  successCriteria: string[];
  assumptions: string[];
  unknowns: string[];
}

// ─── Intent Extraction Result ─────────────────────────────────────────────────

export interface IntentExtractionResult {
  intentType: IntentType;
  requestedSolution: string | null;
  underlyingProblem: string;
  solutionBiasDetected: boolean;
  solutionBiasNote?: string;
  confidence: number;
}

// ─── Clarification Question ───────────────────────────────────────────────────

export type ClarificationImpact = "blocking" | "important" | "deferred";

export interface ClarificationQuestion {
  id: string;
  question: string;
  impact: ClarificationImpact;
  affectedDimensions: Array<keyof DiscoveryConfidence>;
  answered: boolean;
  answer?: string;
}

// ─── Solution Option ──────────────────────────────────────────────────────────

export interface SolutionOption {
  id: string;
  title: string;
  summary: string;
  whenItFits: string;
  whenItIsWrong: string;
  complexity: "low" | "medium" | "high";
  dependencies: string[];
  risks: string[];
  expectedUpside: string;
  rank: number;
  isRecommended: boolean;
}

// ─── 12-Dimension Proposal Sections ──────────────────────────────────────────

export interface ProblemFrameSection {
  businessContext: string;
  successMatrix: string[];
  constraints: string[];
}

export interface RequirementsSection {
  functional: string[];
  nonFunctional: {
    performance: string | null;
    scale: string | null;
    reliability: string | null;
    security: string | null;
    maintainability: string | null;
    compliance: string | null;
  };
}

export interface ServiceArchitectureRecommendation {
  recommendation: "monolith" | "microservices" | "hybrid" | "undetermined";
  rationale: string;
}

export interface DataLayerSketch {
  databaseChoice: string | null;
  modelingNotes: string | null;
  consistencyRequirements: string | null;
  queryPlanningNotes: string | null;
}

export interface SystemDesignSketch {
  highLevelOverview: string;
  clientLayer: string | null;
  apiLayer: string | null;
  serviceArchitecture: ServiceArchitectureRecommendation;
  dataLayer: DataLayerSketch;
  messagingAsync: string | null;
  caching: string | null;
}

export interface ScalabilityProfile {
  trafficProfile: string | null;
  capacityEstimate: string | null;
  scalePattern: string | null;
}

export interface ReliabilityProfile {
  failureModeAnalysis: string[];
  disasterRecovery: string | null;
}

export interface InfrastructureProfile {
  cloud: string | null;
  infrastructureAsCode: boolean | null;
  containerization: string | null;
  ciCd: string | null;
}

export interface CostProfile {
  estimate: string | null;
  drivers: string[];
  optimizationOpportunities: string[];
}

export interface TradeoffItem {
  optionA: string;
  optionB: string;
  recommendation: string;
  rationale: string;
}

// ─── Project Proposal ─────────────────────────────────────────────────────────

export type ProposalStatus =
  | "draft"
  | "complete"
  | "evaluation_ready"
  | "sent_to_evaluation";

export interface ProjectProposal {
  id: string;
  discoverySessionId: string;
  selectedSolutionId: string | null;
  title: string;

  // 12 evaluation dimensions — each is a DimensionSlot so partial population is valid
  problemFrame: DimensionSlot<ProblemFrameSection>;
  requirements: DimensionSlot<RequirementsSection>;
  systemDesign: DimensionSlot<SystemDesignSketch>;
  scalability: DimensionSlot<ScalabilityProfile>;
  reliability: DimensionSlot<ReliabilityProfile>;
  observability: DimensionSlot<string>;
  securityDesign: DimensionSlot<string>;
  infrastructure: DimensionSlot<InfrastructureProfile>;
  costEngineering: DimensionSlot<CostProfile>;
  tradeoffs: DimensionSlot<TradeoffItem[]>;
  documentation: DimensionSlot<string[]>;

  // Downstream planning hints
  suggestedEpics: string[];
  suggestedTasks: string[];

  // Visible assumptions and unknowns surfaced to evaluators
  assumptions: string[];
  unknowns: string[];

  confidence: DiscoveryConfidence;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export function emptyProjectProposal(
  id: string,
  discoverySessionId: string,
  now: string,
): ProjectProposal {
  return {
    id,
    discoverySessionId,
    selectedSolutionId: null,
    title: "",
    problemFrame: emptySlot(),
    requirements: emptySlot(),
    systemDesign: emptySlot(),
    scalability: emptySlot(),
    reliability: emptySlot(),
    observability: emptySlot(),
    securityDesign: emptySlot(),
    infrastructure: emptySlot(),
    costEngineering: emptySlot(),
    tradeoffs: emptySlot(),
    documentation: emptySlot(),
    suggestedEpics: [],
    suggestedTasks: [],
    assumptions: [],
    unknowns: [],
    confidence: emptyConfidence(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Provisioning Manifest ────────────────────────────────────────────────────

// Monday board shared primitives
export type MondayProjectType =
  | "Web App"
  | "Chrome Extension"
  | "n8n Workflow"
  | "Dashboard"
  | "CRM"
  | "SaaS"
  | "Process Change"
  | "Other";

export type MondayProjectStatus =
  | "Conceptualization"
  | "Development"
  | "Testing"
  | "Complete"
  | "On Hold";

export type MondayHealth = "green" | "yellow" | "red";
export type MondaySprintGroup = "Current Sprint" | "Next Sprint" | "Backlog";
export type MondayOpsGroup = "This Week" | "Next Week" | "Someday";
export type MondayQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export type StoryPoints = 1 | 2 | 3 | 5 | 8 | 13;

// Board 2: Projects Portfolio — one row per whole deliverable
export interface MondayProjectsPortfolioItem {
  create: boolean;
  name: string;
  client: string | null;
  projectType: MondayProjectType;
  projectLead: string | null;
  status: MondayProjectStatus;
  health: MondayHealth;
  techStack: string[];
  startDate: string | null;
  targetLaunch: string | null;
  estimatedTotalSP: number | null;
}

// Board 3: Roadmap & Epics — one row per large chunk of a project
export interface MondayEpicItem {
  title: string;
  owner: string | null;
  status: "Not Started" | "In Progress" | "Complete" | "On Hold";
  quarter: MondayQuarter | null;
  targetDate: string | null;
  estimatedSP: StoryPoints | null;
}

// Board 4: Sprint Tasks — one row per concrete piece of work
export interface MondayTaskItem {
  title: string;
  type: "Feature" | "Bug" | "Chore" | "Research";
  epicTitle: string | null;
  status: "Not Started" | "In Progress" | "Blocked" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  estimatedSP: StoryPoints;
  sprint: MondaySprintGroup;
  unplanned: boolean;
  githubLink: string | null;
}

// Board 5: Credentials Vault — access register (not secret values)
export interface MondayCredentialItem {
  type: string;
  serviceProvider: string;
  owner: string | null;
  status: "Active" | "Needs Rotation" | "Expired";
  storedIn: string | null;
}

// Board 6: Microtasks & Ops — small one-offs outside sprints
export interface MondayMicrotaskItem {
  title: string;
  owner: string | null;
  category: string | null;
  priority: "Low" | "Medium" | "High";
  dueGroup: MondayOpsGroup;
  dueDate: string | null;
}

export interface MondayManifest {
  projectsPortfolio: MondayProjectsPortfolioItem | null;
  roadmapEpics: MondayEpicItem[];
  sprintTasks: MondayTaskItem[];
  credentialsVault: MondayCredentialItem[];
  microtasksOps: MondayMicrotaskItem[];
}

// GitHub manifest
export interface GitHubReadme {
  content: string; // markdown
}

export interface GitHubIssue {
  title: string;
  body: string | null;
  labels: string[];
}

export interface GitHubManifest {
  createRepo: boolean;
  repoName: string | null;
  labels: string[];
  readme: GitHubReadme | null;
  initialIssues: GitHubIssue[];
}

export interface ProvisioningManifest {
  manifestVersion: "1.0";
  source: "discovery_engine";
  proposalId: string;
  recommendedAction:
    | "create_project"
    | "create_epic"
    | "create_task"
    | "create_microtask"
    | "process_change"
    | "defer"
    | "archive";
  monday: MondayManifest;
  github: GitHubManifest;
  notifications: { sendApprovalSummary: boolean };
  readyForLiveAdapter: boolean;
  generatedAt: string;
}

// ─── Discovery Agent Usage ─────────────────────────────────────────────────────

export type DiscoveryAgentRole =
  | "intent_extraction"
  | "problem_framing"
  | "solution_generation"
  | "clarification"
  | "proposal_composition"
  | "manifest_generation";

export interface DiscoveryAgentUsageRecord {
  id: string;
  agentRole: DiscoveryAgentRole;
  provider: "mock" | "openai" | "anthropic" | "bedrock";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  createdAt: string;
}

// ─── Discovery Session ────────────────────────────────────────────────────────

export interface DiscoverySession {
  id: string;
  userId: string;
  status: DiscoveryStatus;
  sideStatus?: DiscoverySideStatus;

  messages: ConversationMessage[];
  timeline: DiscoveryTimelineEvent[];

  intent: IntentExtractionResult | null;
  problemFrame: ProblemFrame | null;
  solutionOptions: SolutionOption[];
  clarificationQuestions: ClarificationQuestion[];
  selectedSolutionId: string | null;

  proposal: ProjectProposal | null;
  manifest: ProvisioningManifest | null;

  confidence: DiscoveryConfidence;

  /** AI usage emitted by real (non-mock) discovery agents, for cost reporting. */
  usageRecords?: DiscoveryAgentUsageRecord[];

  createdAt: string;
  updatedAt: string;
}
