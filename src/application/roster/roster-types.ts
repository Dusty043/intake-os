export interface TeamMemberRosterRecord {
  id: string;
  name: string;
  email?: string;
  role?: string;
  skills: string[];
  projectTypes: string[];
  seniority?: "junior" | "mid" | "senior" | "lead";
  availability?: "available" | "limited" | "unavailable" | "unknown";
  currentLoad?: number;
  maxCapacity?: number;
  activeProjectCount?: number;
  githubUsername?: string;
  mondayUserId?: string;
}

export interface ScoredRosterMember {
  member: TeamMemberRosterRecord;
  score: number;
  matchedSkills: string[];
  matchedProjectTypes: string[];
  availabilityScore: number;
  capacityScore: number;
  riskPenalties: string[];
}

export interface RosterAssignmentResult {
  recommended: ScoredRosterMember | null;
  backup: ScoredRosterMember | null;
  rosterConnected: boolean;
  scoringSignals: string[];
}
