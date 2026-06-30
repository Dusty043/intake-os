import type { IntentType, IntentExtractionResult } from "../../../domain/discovery.js";
import type {
  DiscoveryAgentContext,
  DiscoveryAgentOptions,
  IIntentExtractionAgent,
} from "./discovery-agent-contract.js";

// ─── Keyword signal tables ────────────────────────────────────────────────────

// More specific signals are listed first — first match wins.
// "chatbot" must be checked before generic "automation" so "chatbot + automatically"
// resolves to ai_assistant, not automation.
const INTENT_SIGNALS: Array<[string[], IntentType]> = [
  [["chatbot", "llm", "gpt", "claude", "copilot", "knowledge base", "ai assistant"], "ai_assistant"],
  [["dashboard", "report", "analytics", "chart", "kpi", "metric", "visualization", "insights"], "dashboard_reporting"],
  [["bug", "fix", "broken", "crash", "regression", "failing"], "bug_fix"],
  [["quick", "small", "minor", "simple", "one-off", "microtask", "tweak"], "microtask"],
  [["explore", "discovery", "understand", "research", "investigate", "not sure", "unclear"], "discovery_request"],
  [["automate", "automation", "trigger", "schedule", "workflow", "cron", "automatically"], "automation"],
  [["process", "improve", "streamline", "efficiency", "manual", "pain", "friction", "bottleneck"], "process_improvement"],
];

const SOLUTION_BIAS_SIGNALS: Array<[string[], string]> = [
  [["we need a chatbot", "build a chatbot", "add a chatbot"], "Chatbot requested — underlying need may be support deflection, knowledge access, or ticket routing."],
  [["we need a dashboard", "build a dashboard", "add a dashboard"], "Dashboard requested — underlying need may be visibility, data quality, or KPI alignment."],
  [["we need an app", "build an app", "create an app"], "App requested — underlying business problem not yet specified."],
  [["automate this", "just automate"], "Automation assumed — business process details not yet captured."],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function detectIntent(text: string): IntentType {
  for (const [terms, type] of INTENT_SIGNALS) {
    if (terms.some((t) => text.includes(t))) return type;
  }
  return "software_project";
}

function detectSolutionBias(text: string): { detected: boolean; note?: string } {
  for (const [phrases, note] of SOLUTION_BIAS_SIGNALS) {
    if (phrases.some((p) => text.includes(p))) {
      return { detected: true, note };
    }
  }
  return { detected: false };
}

function extractUnderlyingProblem(text: string, intentType: IntentType): string {
  // Extract a short problem statement by trimming solution-forward phrasing
  const cleaned = text
    .replace(/\b(we need|build|create|add|make|implement|develop)\s+(a|an)\s+/gi, "")
    .trim();
  if (cleaned.length < 10) {
    return `Unspecified ${intentType.replace(/_/g, " ")} need`;
  }
  return cleaned.length > 200 ? `${cleaned.slice(0, 200)}…` : cleaned;
}

// ─── Mock agent ───────────────────────────────────────────────────────────────

export class MockIntentExtractionAgent implements IIntentExtractionAgent {
  async extractIntent(
    ctx: DiscoveryAgentContext,
    _opts: DiscoveryAgentOptions,
  ): Promise<IntentExtractionResult> {
    const userMessages = ctx.messages.filter((m) => m.role === "user");
    // Only use substantive messages (>15 chars) so short conversational turns
    // ("yes", "exactly", "ok let's go") don't pollute the extracted problem.
    const substantiveMessages = userMessages.filter((m) => m.content.trim().length > 15);
    const sourceMessages = substantiveMessages.length > 0 ? substantiveMessages : userMessages;
    const rawText = sourceMessages.map((m) => m.content).join(" ");

    const text = normalize(rawText);
    const intentType = detectIntent(text);
    const bias = detectSolutionBias(text);
    const underlyingProblem = extractUnderlyingProblem(rawText, intentType);

    // Confidence based on message length and signal clarity
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const confidence =
      wordCount >= 30 ? 0.78 : wordCount >= 15 ? 0.62 : wordCount >= 5 ? 0.45 : 0.28;

    // Extract what the user explicitly requested (solution surface)
    const requestedSolution = bias.detected ? rawText.slice(0, 120) : null;

    return {
      intentType,
      requestedSolution,
      underlyingProblem,
      solutionBiasDetected: bias.detected,
      solutionBiasNote: bias.note,
      confidence,
    };
  }
}
