import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { LowCodePathSectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny } from "./mock-agent-helpers.js";

const LOW_CODE_VIABLE_SIGNALS = [
  "simple", "tracking", "form", "spreadsheet", "monday", "airtable",
  "no-code", "report", "dashboard only", "google sheets", "notify",
  "workflow automation", "approval flow", "status update",
];

const LOW_CODE_BLOCKING_SIGNALS = [
  "auth", "sso", "custom auth", "payment", "billing",
  "migration", "data pipeline", "etl", "infra", "infrastructure",
  "api", "backend", "server", "database schema", "complex", "multi-tenant",
];

export class MockNoCodeLowCodeAgent implements EvaluationAgent<LowCodePathSectionContent> {
  readonly role = "low_code_path" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<LowCodePathSectionContent>> {
    const { intake } = ctx;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const viableSignals = LOW_CODE_VIABLE_SIGNALS.filter((s) => text.includes(s));
    const blockingSignals = LOW_CODE_BLOCKING_SIGNALS.filter((s) => text.includes(s));

    const viable = viableSignals.length > 0 && blockingSignals.length === 0;

    const recommendedTools = viable ? inferLowCodeTools(text) : [];
    const fitReasoning = viable
      ? `The request contains low-code signals (${viableSignals.join(", ")}) and no complex technical requirements that block low-code delivery.`
      : blockingSignals.length > 0
        ? `Custom build signals were detected (${blockingSignals.join(", ")}) that prevent a viable low-code path.`
        : "No strong low-code signals were detected. Standard evaluation applies.";

    const limitations = viable
      ? buildLowCodeLimitations(text)
      : ["Not applicable — custom build is likely required."];

    const whenToRejectLowCode = [
      "When custom auth, complex permission models, or API authentication is required",
      "When schema-level data modeling or database migrations are needed",
      "When complex integrations require backend orchestration",
      "When performance, scale, or multi-tenancy requirements exceed platform limits",
    ];

    return {
      sectionKind: "low_code_path",
      content: {
        viable,
        recommendedTools,
        fitReasoning,
        limitations,
        whenToRejectLowCode,
      },
      confidence: viable ? 0.80 : 0.88,
      warnings: viable && viableSignals.length < 2 ? ["Viability is marginal — low-code signals are weak."] : [],
    };
  }
}

function inferLowCodeTools(text: string): string[] {
  const tools: string[] = [];
  if (containsAny(text, ["monday"])) tools.push("Monday.com native boards/workflows");
  if (containsAny(text, ["form", "intake", "survey"])) tools.push("Monday intake forms or Google Forms");
  if (containsAny(text, ["spreadsheet", "google sheets"])) tools.push("Google Sheets + AppScript");
  if (containsAny(text, ["notify", "email", "alert"])) tools.push("Monday automation recipes");
  if (tools.length === 0) tools.push("Monday.com boards and workflow automations");
  return tools;
}

function buildLowCodeLimitations(text: string): string[] {
  const limits = ["Limited customization compared to custom code."];
  if (containsAny(text, ["report", "dashboard"])) limits.push("Complex data transformations may require workarounds.");
  if (containsAny(text, ["user", "permission"])) limits.push("Fine-grained permission management may not be supported.");
  return limits;
}
