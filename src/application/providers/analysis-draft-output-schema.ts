/**
 * AnalysisDraftModelOutput — what the AI model returns.
 *
 * Governance-owned fields (id, status, actor, timestamps) are intentionally
 * absent. The provider adapter maps this onto IntakeAnalysisDraft after adding
 * those fields from workflow context.
 */
export interface AnalysisDraftModelOutput {
  summary: string;
  problemStatement: string;
  proposedSolution: string;
  scope: {
    inScope: string[];
    outOfScope: string[];
  };
  deliverables: string[];
  assumptions: string[];
  complianceNotes: string[];
  recommendedSubtasks: Array<{
    title: string;
    description: string;
    storyPoints: number;
    acceptanceCriteria: string[];
  }>;
  recommendedTechStack: string[];
  infrastructureRequirements: Array<{
    kind: string;
    required: boolean;
    description: string;
    rationale: string;
  }>;
  risks: string[];
  complexity: "low" | "medium" | "high" | "unknown";
  estimatedStoryPoints: number;
  confidenceScore: number;
  missingInformation: string[];
  warnings: string[];
  projectType: string;
}

/** JSON Schema object for use with OpenAI structured output and Anthropic tool schemas. */
export const analysisDraftModelOutputJsonSchema = {
  type: "object",
  required: [
    "summary",
    "problemStatement",
    "proposedSolution",
    "scope",
    "deliverables",
    "assumptions",
    "complianceNotes",
    "recommendedSubtasks",
    "recommendedTechStack",
    "infrastructureRequirements",
    "risks",
    "complexity",
    "estimatedStoryPoints",
    "confidenceScore",
    "missingInformation",
    "warnings",
    "projectType",
  ],
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    problemStatement: { type: "string" },
    proposedSolution: { type: "string" },
    scope: {
      type: "object",
      required: ["inScope", "outOfScope"],
      additionalProperties: false,
      properties: {
        inScope: { type: "array", items: { type: "string" } },
        outOfScope: { type: "array", items: { type: "string" } },
      },
    },
    deliverables: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    complianceNotes: { type: "array", items: { type: "string" } },
    recommendedSubtasks: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "description", "storyPoints", "acceptanceCriteria"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          storyPoints: { type: "number" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
        },
      },
    },
    recommendedTechStack: { type: "array", items: { type: "string" } },
    infrastructureRequirements: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "required", "description", "rationale"],
        additionalProperties: false,
        properties: {
          kind: { type: "string" },
          required: { type: "boolean" },
          description: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    complexity: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    estimatedStoryPoints: { type: "number" },
    confidenceScore: { type: "number" },
    missingInformation: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    projectType: { type: "string" },
  },
} as const;

export function validateAnalysisDraftModelOutput(output: unknown): output is AnalysisDraftModelOutput {
  if (typeof output !== "object" || output === null) return false;
  const o = output as Record<string, unknown>;

  const requiredStrings = ["summary", "problemStatement", "proposedSolution", "projectType"];
  for (const key of requiredStrings) {
    if (typeof o[key] !== "string" || !(o[key] as string).trim()) return false;
  }

  if (typeof o["scope"] !== "object" || o["scope"] === null) return false;
  const scope = o["scope"] as Record<string, unknown>;
  if (!Array.isArray(scope["inScope"]) || !Array.isArray(scope["outOfScope"])) return false;

  const requiredArrays = ["deliverables", "assumptions", "complianceNotes", "recommendedSubtasks",
    "recommendedTechStack", "infrastructureRequirements", "risks", "missingInformation", "warnings"];
  for (const key of requiredArrays) {
    if (!Array.isArray(o[key])) return false;
  }

  if (!["low", "medium", "high", "unknown"].includes(o["complexity"] as string)) return false;
  if (typeof o["estimatedStoryPoints"] !== "number" || (o["estimatedStoryPoints"] as number) < 1) return false;
  if (typeof o["confidenceScore"] !== "number") return false;

  const subtasks = o["recommendedSubtasks"] as unknown[];
  for (const st of subtasks) {
    if (typeof st !== "object" || st === null) return false;
    const s = st as Record<string, unknown>;
    if (typeof s["title"] !== "string" || typeof s["description"] !== "string") return false;
    if (typeof s["storyPoints"] !== "number" || (s["storyPoints"] as number) < 1) return false;
    if (!Array.isArray(s["acceptanceCriteria"])) return false;
  }

  return true;
}
