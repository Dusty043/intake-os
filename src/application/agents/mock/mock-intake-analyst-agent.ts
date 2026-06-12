import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { IntakeBriefSectionContent } from "../../intake-evaluation.js";
import {
  normalizeText,
  summarize,
  containsAny,
  clamp,
} from "./mock-agent-helpers.js";

export class MockIntakeAnalystAgent implements EvaluationAgent<IntakeBriefSectionContent> {
  readonly role = "intake_brief" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<IntakeBriefSectionContent>> {
    const { intake } = ctx;
    const rawText = normalizeText(intake.description);
    const titleText = normalizeText(intake.title);
    const combined = `${titleText} ${rawText}`.toLowerCase();

    const rawSummary = rawText || `${intake.requester} has submitted a project request: ${titleText}.`;
    const normalizedSummary = summarize(rawSummary, 240);

    const statedGoals = extractGoals(combined, titleText);
    const successCriteria = extractSuccessCriteria(combined);
    const knownConstraints = extractConstraints(combined);

    const descLen = rawText.length;
    const confidence = clamp(
      65 + (descLen > 200 ? 15 : descLen > 80 ? 8 : 0) - (statedGoals.length === 0 ? 10 : 0),
      40, 90,
    ) / 100;

    const warnings: string[] = [];
    if (rawText.length < 50) warnings.push("Intake description is very short — normalization may be unreliable.");
    if (!titleText || titleText.length < 5) warnings.push("Intake title is missing or too short.");

    return {
      sectionKind: "intake_brief",
      content: {
        title: intake.title,
        requester: intake.requester,
        rawSummary,
        normalizedSummary,
        statedGoals,
        successCriteria,
        knownConstraints,
      },
      confidence,
      warnings,
    };
  }
}

function extractGoals(combined: string, title: string): string[] {
  const goals: string[] = [];

  const GOAL_SIGNALS: Array<[string[], string]> = [
    [["dashboard", "visualization", "chart", "kpi", "metric"], "Build data visualization and reporting capability"],
    [["automate", "automation", "trigger", "workflow"], "Automate repetitive workflows"],
    [["track", "tracking"], "Track progress or activity"],
    [["integrate", "integration", "connect", "sync"], "Integrate with external systems"],
    [["portal", "client", "external access"], "Provide external access for stakeholders"],
    [["api", "service", "endpoint"], "Expose a reliable service API"],
    [["report", "export", "send"], "Generate and distribute reports"],
    [["migrate", "migration", "import"], "Migrate or import existing data"],
  ];

  for (const [signals, goal] of GOAL_SIGNALS) {
    if (containsAny(combined, signals)) goals.push(goal);
  }

  if (goals.length === 0) goals.push(`Complete the ${title} project successfully`);
  return goals;
}

function extractSuccessCriteria(combined: string): string[] {
  const criteria: string[] = [];
  if (containsAny(combined, ["real-time", "live", "fast", "performance"])) criteria.push("Meets performance requirements");
  if (containsAny(combined, ["test", "qa", "quality"])) criteria.push("Passes QA review");
  if (containsAny(combined, ["deploy", "launch", "release", "production"])) criteria.push("Successfully deployed to production");
  if (containsAny(combined, ["user", "stakeholder"])) criteria.push("Accepted by key stakeholders");
  if (criteria.length === 0) criteria.push("Delivered and reviewed by stakeholders");
  return criteria;
}

function extractConstraints(combined: string): string[] {
  const constraints: string[] = [];
  if (containsAny(combined, ["deadline", "due", "by end", "asap", "urgent"])) constraints.push("Has a deadline or urgency requirement");
  if (containsAny(combined, ["security", "auth", "sso", "permission"])) constraints.push("Security and access control required");
  if (containsAny(combined, ["compliance", "hipaa", "gdpr", "regulated"])) constraints.push("Compliance constraints apply");
  if (containsAny(combined, ["budget", "cost", "cost limit"])) constraints.push("Budget constraints noted");
  return constraints;
}
