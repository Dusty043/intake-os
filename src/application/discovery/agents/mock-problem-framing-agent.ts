import type { ProblemFrame, DiscoveryConfidence } from "../../../domain/discovery.js";
import type {
  DiscoveryAgentContext,
  DiscoveryAgentOptions,
  IProblemFramingAgent,
} from "./discovery-agent-contract.js";
import { stripEchoedQuestion } from "./discovery-agent-contract.js";

// ─── Dimension scoring helpers ────────────────────────────────────────────────

/**
 * Each dimension is scored independently based on signals in the conversation.
 * The clarification agent uses low-confidence dimensions to target questions.
 */

function scoreWordPresence(text: string, terms: string[]): number {
  const hits = terms.filter((t) => text.includes(t)).length;
  return Math.min(hits / terms.length, 1);
}

function scoreProblemUnderstanding(text: string, wordCount: number): number {
  const signals = ["because", "when", "every time", "currently", "problem", "issue", "pain", "slow", "manual", "broken"];
  const base = scoreWordPresence(text, signals);
  const lengthBonus = wordCount >= 40 ? 0.2 : wordCount >= 20 ? 0.1 : 0;
  return Math.min(base + 0.4 + lengthBonus, 1.0);
}

function scoreSolutionFit(text: string, intentConf: number): number {
  const solutionSignals = ["so that", "would help", "instead of", "could", "should", "outcome", "goal"];
  const base = scoreWordPresence(text, solutionSignals);
  return Math.min(base * 0.5 + intentConf * 0.5, 1.0);
}

function scoreScopeClarity(text: string): number {
  const inScope = ["include", "cover", "handle", "manage", "support"];
  const outScope = ["not include", "out of scope", "won't", "will not", "exclude"];
  const inHits = inScope.filter((t) => text.includes(t)).length;
  const outHits = outScope.filter((t) => text.includes(t)).length;
  return Math.min((inHits + outHits * 1.5) * 0.15, 0.85);
}

function scoreTechnicalFeasibility(text: string): number {
  const techSignals = ["api", "database", "system", "integration", "service", "platform", "cloud", "backend", "frontend"];
  return Math.min(scoreWordPresence(text, techSignals) * 1.2, 0.75);
}

function scoreStakeholderClarity(text: string): number {
  const stakeholderSignals = ["team", "user", "client", "customer", "staff", "manager", "internal", "external", "department"];
  return Math.min(scoreWordPresence(text, stakeholderSignals) * 1.3, 0.85);
}

function scoreDownstreamMapping(intentConf: number, scopeScore: number): number {
  return Math.min((intentConf + scopeScore) / 2 * 0.9, 0.80);
}

// ─── Frame builders ───────────────────────────────────────────────────────────

function extractAffectedUsers(text: string): string[] {
  const matches: string[] = [];
  const groups = [
    ["support team", "support staff", "support agents"],
    ["customers", "clients", "external users"],
    ["internal staff", "employees", "internal team"],
    ["managers", "leadership", "executives"],
    ["developers", "engineers", "dev team"],
    ["finance team", "accounting"],
    ["operations team", "ops"],
  ];
  for (const synonyms of groups) {
    if (synonyms.some((s) => text.includes(s))) {
      matches.push(synonyms[0]);
    }
  }
  return matches.length > 0 ? matches : ["Unspecified users"];
}

function extractPainPoints(text: string): string[] {
  const painMap: Array<[string[], string]> = [
    [["slow", "takes forever", "too long", "delayed"], "Slow process or response time"],
    [["manual", "by hand", "copy-paste", "repetitive", "same questions"], "Repetitive manual work"],
    [["error", "mistake", "wrong", "incorrect", "inconsistent"], "Inconsistency or errors"],
    [["lost", "missing", "can't find", "no visibility"], "Lack of visibility or lost information"],
    [["expensive", "cost", "too much"], "High cost"],
    [["frustrating", "annoying", "painful", "hate", "tedious"], "User frustration"],
  ];
  return painMap.filter(([terms]) => terms.some((t) => text.includes(t))).map(([, label]) => label);
}

function buildProblemStatement(text: string, underlyingProblem: string): string {
  if (underlyingProblem && underlyingProblem.length > 20) {
    return `${underlyingProblem.charAt(0).toUpperCase()}${underlyingProblem.slice(1)}.`;
  }
  const trimmed = text.length > 180 ? `${text.slice(0, 180)}…` : text;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function extractUnknowns(text: string): string[] {
  const unknowns: string[] = [];
  if (!text.includes("audience") && !text.includes("user") && !text.includes("team")) {
    unknowns.push("Who are the primary users or affected stakeholders?");
  }
  if (!text.includes("volume") && !text.includes("how many") && !text.includes("scale")) {
    unknowns.push("What is the scale or volume of the problem (users, records, frequency)?");
  }
  if (!text.includes("deadline") && !text.includes("timeline") && !text.includes("urgent")) {
    unknowns.push("What is the urgency or timeline for resolution?");
  }
  if (!text.includes("budget") && !text.includes("cost") && !text.includes("resource")) {
    unknowns.push("Are there budget or resource constraints?");
  }
  return unknowns;
}

// ─── Mock agent ───────────────────────────────────────────────────────────────

export class MockProblemFramingAgent implements IProblemFramingAgent {
  async frameProblem(
    ctx: DiscoveryAgentContext,
    _opts: DiscoveryAgentOptions,
  ): Promise<{ frame: ProblemFrame; confidence: DiscoveryConfidence }> {
    const userMessages = ctx.messages.filter((m) => m.role === "user");
    const substantiveMessages = userMessages.filter((m) => m.content.trim().length > 15);
    const rawText = (substantiveMessages.length > 0 ? substantiveMessages : userMessages)
      .map((m) => stripEchoedQuestion(m.content))
      .join(" ");

    const text = rawText.toLowerCase();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const intentConf = ctx.intent?.confidence ?? 0.4;
    const underlyingProblem = ctx.intent?.underlyingProblem ?? rawText;

    const scopeScore = scoreScopeClarity(text);

    const confidence: DiscoveryConfidence = {
      problemUnderstanding: scoreProblemUnderstanding(text, wordCount),
      solutionFit: scoreSolutionFit(text, intentConf),
      scopeClarity: scopeScore,
      technicalFeasibility: scoreTechnicalFeasibility(text),
      stakeholderClarity: scoreStakeholderClarity(text),
      downstreamMapping: scoreDownstreamMapping(intentConf, scopeScore),
    };

    const frame: ProblemFrame = {
      problemStatement: buildProblemStatement(rawText, underlyingProblem),
      affectedUsers: extractAffectedUsers(text),
      currentProcess: "Not yet described",
      painPoints: extractPainPoints(text),
      businessImpact: "Not yet quantified",
      successCriteria: [],
      assumptions: ctx.intent?.solutionBiasDetected
        ? [`User requested a specific solution: "${ctx.intent.requestedSolution}" — underlying problem may differ.`]
        : [],
      unknowns: extractUnknowns(text),
    };

    return { frame, confidence };
  }
}
