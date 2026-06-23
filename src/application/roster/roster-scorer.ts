import type { TeamMemberRosterRecord, ScoredRosterMember, RosterAssignmentResult } from "./roster-types.js";
import type { ProjectType } from "../../domain/types.js";

const AVAILABILITY_SCORES: Record<NonNullable<TeamMemberRosterRecord["availability"]>, number> = {
  available: 1.0,
  limited: 0.5,
  unavailable: -2.0,
  unknown: 0.3,
};

const CAPACITY_WEIGHT = 0.4;

export function scoreMembers(
  members: TeamMemberRosterRecord[],
  projectType: ProjectType,
  requiredSkills: readonly string[],
): RosterAssignmentResult {
  if (members.length === 0) {
    return { recommended: null, backup: null, rosterConnected: true, scoringSignals: ["No team members in roster"] };
  }

  const normalizedRequired = requiredSkills.map((s) => s.toLowerCase());
  const normalizedProjectType = projectType.toLowerCase().replace(/_/g, " ");

  const scored = members
    .map((member): ScoredRosterMember => {
      const memberSkills = member.skills.map((s) => s.toLowerCase());
      const matchedSkills = normalizedRequired.filter((s) => memberSkills.some((ms) => ms.includes(s) || s.includes(ms)));

      const memberProjectTypes = member.projectTypes.map((p) => p.toLowerCase().replace(/_/g, " "));
      const matchedProjectTypes = member.projectTypes.filter((p) =>
        p.toLowerCase().replace(/_/g, " ").includes(normalizedProjectType) ||
        normalizedProjectType.includes(p.toLowerCase().replace(/_/g, " "))
      );

      const skillScore = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0;
      const projectTypeScore = matchedProjectTypes.length > 0 ? 0.3 : 0;
      const availabilityScore = AVAILABILITY_SCORES[member.availability ?? "unknown"] ?? 0.3;

      let capacityScore = 0;
      if (member.maxCapacity != null && member.currentLoad != null) {
        const headroom = 1 - member.currentLoad / member.maxCapacity;
        capacityScore = Math.max(0, headroom) * CAPACITY_WEIGHT;
      }

      const riskPenalties: string[] = [];
      if (member.availability === "unavailable") riskPenalties.push("Member is unavailable");
      if (member.maxCapacity != null && member.currentLoad != null && member.currentLoad >= member.maxCapacity) {
        riskPenalties.push("At full capacity");
      }
      const penaltyScore = riskPenalties.length * 0.5;

      const score = skillScore + projectTypeScore + availabilityScore + capacityScore - penaltyScore;

      return { member, score, matchedSkills: matchedSkills, matchedProjectTypes, availabilityScore, capacityScore, riskPenalties };
    })
    .sort((a, b) => b.score - a.score);

  const eligible = scored.filter((s) => s.riskPenalties.every((p) => p !== "Member is unavailable"));
  const recommended = eligible[0] ?? null;
  const backup = eligible[1] ?? null;

  const scoringSignals: string[] = [
    `${members.length} team member(s) evaluated`,
    `${eligible.length} eligible (not unavailable)`,
  ];
  if (recommended) {
    scoringSignals.push(`Top match: ${recommended.member.name} (score ${recommended.score.toFixed(2)})`);
  }

  return { recommended, backup, rosterConnected: true, scoringSignals };
}
