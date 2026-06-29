import OpenAI from "openai";
import type { ProjectProposal } from "../../../../domain/discovery.js";
import { emptyProjectProposal } from "../../../../domain/discovery.js";
import type { DiscoveryAgentOptions, IProposalComposerAgent } from "../discovery-agent-contract.js";
import type { DiscoverySession } from "../../../../domain/discovery.js";
import { callStructured, makeClient } from "./openai-discovery-client.js";
import { orgContextBlock } from "../org-context.js";

const schema = {
  type: "object",
  required: ["title", "problemStatement", "businessContext", "successCriteria", "functionalRequirements", "nonFunctionalNotes", "systemDesignOverview", "clientLayer", "apiLayer", "architectureRecommendation", "architectureRationale", "dataLayer", "infrastructure", "suggestedEpics", "suggestedTasks", "assumptions", "unknowns", "status"],
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    problemStatement: { type: "string" },
    businessContext: { type: "string" },
    successCriteria: { type: "array", items: { type: "string" } },
    functionalRequirements: { type: "array", items: { type: "string" } },
    nonFunctionalNotes: { type: "string" },
    systemDesignOverview: { type: "string" },
    clientLayer: { type: ["string", "null"] },
    apiLayer: { type: ["string", "null"] },
    architectureRecommendation: { type: "string", enum: ["monolith", "microservices", "hybrid", "undetermined"] },
    architectureRationale: { type: "string" },
    dataLayer: { type: ["string", "null"] },
    infrastructure: { type: ["string", "null"] },
    suggestedEpics: { type: "array", items: { type: "string" } },
    suggestedTasks: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    status: { type: "string", enum: ["draft", "evaluation_ready"] },
  },
} as const;

type Output = {
  title: string;
  problemStatement: string;
  businessContext: string;
  successCriteria: string[];
  functionalRequirements: string[];
  nonFunctionalNotes: string;
  systemDesignOverview: string;
  clientLayer: string | null;
  apiLayer: string | null;
  architectureRecommendation: "monolith" | "microservices" | "hybrid" | "undetermined";
  architectureRationale: string;
  dataLayer: string | null;
  infrastructure: string | null;
  suggestedEpics: string[];
  suggestedTasks: string[];
  assumptions: string[];
  unknowns: string[];
  status: "draft" | "evaluation_ready";
};

const BASE_SYSTEM = `You are a technical product manager. Compose a detailed project proposal from the discovery conversation.

Guidelines:
- suggestedEpics: 3–6 high-level chunks (e.g. "Requirements & Design", "Core Implementation", "Integration & Testing", "QA & Launch")
- suggestedTasks: 5–15 concrete work items derived from the solution
- status: use "evaluation_ready" if requirements are clear enough to evaluate; "draft" if key information is still missing
- Be specific and actionable — avoid vague language
- architectureRecommendation: choose "monolith" for most internal tools and dashboards; "microservices" only when independently deployable services are clearly needed
- Story points: use only values 1, 2, 3, 5, 8, 13 (Fibonacci scale) — never other values`;

export class OpenAIProposalComposerAgent implements IProposalComposerAgent {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = makeClient({ apiKey, model });
    this.model = model;
  }

  async composeProposal(session: DiscoverySession, opts: DiscoveryAgentOptions): Promise<ProjectProposal> {
    const conversation = session.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

    const selectedSolution = session.selectedSolutionId
      ? session.solutionOptions.find(s => s.id === session.selectedSolutionId)
      : null;

    const solutionBlock = selectedSolution
      ? `Selected solution: ${selectedSolution.title}\n${selectedSolution.summary}\n`
      : "";

    const frameBlock = session.problemFrame
      ? `Problem: ${session.problemFrame.problemStatement}\n`
      : "";

    const answeredQuestions = session.clarificationQuestions
      .filter(q => q.answered && q.answer)
      .map(q => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n");

    const clarBlock = answeredQuestions ? `Clarifications:\n${answeredQuestions}\n` : "";

    const userPrompt = `${frameBlock}${solutionBlock}${clarBlock}\nFull conversation:\n${conversation}\n\nCompose the project proposal.`;

    const system = BASE_SYSTEM + orgContextBlock(opts.orgContext);
    const out = await callStructured<Output>(
      this.client, this.model,
      system, userPrompt,
      "proposal_composition", schema as unknown as Record<string, unknown>,
      3000,
    );

    const now = opts.now;
    const proposal = emptyProjectProposal(opts.idFactory("proposal"), session.id, now);

    proposal.title = out.title;
    proposal.selectedSolutionId = session.selectedSolutionId;

    proposal.problemFrame = {
      value: {
        businessContext: out.businessContext,
        successMatrix: out.successCriteria,
        constraints: [],
      },
      confidence: 0.7,
      source: "inferred",
    };

    proposal.requirements = {
      value: {
        functional: out.functionalRequirements,
        nonFunctional: {
          performance: null,
          scale: null,
          reliability: null,
          security: null,
          maintainability: null,
          compliance: null,
        },
      },
      confidence: 0.7,
      source: "inferred",
      notes: out.nonFunctionalNotes || undefined,
    };

    proposal.systemDesign = {
      value: {
        highLevelOverview: out.systemDesignOverview,
        clientLayer: out.clientLayer,
        apiLayer: out.apiLayer,
        serviceArchitecture: {
          recommendation: out.architectureRecommendation,
          rationale: out.architectureRationale,
        },
        dataLayer: {
          databaseChoice: out.dataLayer,
          modelingNotes: null,
          consistencyRequirements: null,
          queryPlanningNotes: null,
        },
        messagingAsync: null,
        caching: null,
      },
      confidence: 0.6,
      source: "inferred",
    };

    proposal.infrastructure = {
      value: {
        cloud: null,
        infrastructureAsCode: null,
        containerization: out.infrastructure,
        ciCd: null,
      },
      confidence: 0.5,
      source: "inferred",
    };

    proposal.suggestedEpics = out.suggestedEpics;
    proposal.suggestedTasks = out.suggestedTasks;
    proposal.assumptions = out.assumptions;
    proposal.unknowns = out.unknowns;
    proposal.status = out.status;
    proposal.updatedAt = now;

    return proposal;
  }
}
