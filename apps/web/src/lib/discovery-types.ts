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

export type DiscoveryManifest = {
  recommendedAction: string;
  monday: {
    roadmapEpics: string[];
    sprintTasks: string[];
    projectsPortfolio: unknown;
  };
  github: {
    createRepo: boolean;
    repoName: string | null;
    labels: string[];
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
};
