import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MockIntakeAnalystAgent,
  MockClarificationQuestionsAgent,
  MockProjectClassifierAgent,
  MockSolutionsArchitectAgent,
  MockNoCodeLowCodeAgent,
  MockCustomBuildAgent,
  MockRiskSecurityAgent,
  MockCostEffortAgent,
  MockWorkBreakdownAgent,
  MockDistributionPlannerAgent,
  MockFinalSynthesisAgent,
  MockCriticQAAgent,
} from "../dist/src/application/agents/mock/index.js";
import { evaluationSectionKinds } from "../dist/src/application/intake-evaluation.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

const NOW = "2026-06-12T00:00:00.000Z";
const ACTOR = { id: "USER-001", email: "test@example.com", name: "Test User", role: "admin" };

let _counter = 0;
const testIdFactory = (prefix) => `${prefix}-${String(++_counter).padStart(3, "0")}`;
const baseOpts = { actor: ACTOR, provider: "mock", idFactory: testIdFactory, now: NOW };

function makeIntake(overrides = {}) {
  return {
    id: "INTAKE-001",
    title: "Build a KPI dashboard for the sales team",
    description: "We need an internal dashboard showing real-time sales KPIs. Should integrate with Salesforce and display charts for revenue, pipeline, and forecast. The dashboard must be accessible to the sales team with role-based access. Deploy to Vercel.",
    requester: "alice@example.com",
    department: "Sales",
    projectType: "internal_dashboard",
    status: "submitted",
    createdAt: NOW,
    createdBy: ACTOR,
    source: { channel: "manual" },
    externalLinks: [],
    ...overrides,
  };
}

function makeCtx(intake, sectionOverrides = {}) {
  return {
    intake,
    depth: "standard",
    sections: {},
    ...sectionOverrides,
  };
}

async function runAgent(agent, intakeOverrides = {}, ctxOverrides = {}) {
  const intake = makeIntake(intakeOverrides);
  const ctx = makeCtx(intake, ctxOverrides);
  return agent.run(ctx, baseOpts);
}

// ─── All 12 agents instantiate ────────────────────────────────────────────────

describe("all 12 mock agents instantiate", () => {
  const ALL_AGENTS = [
    [new MockIntakeAnalystAgent(), "intake_brief"],
    [new MockClarificationQuestionsAgent(), "clarification_questions"],
    [new MockProjectClassifierAgent(), "classification"],
    [new MockSolutionsArchitectAgent(), "architecture"],
    [new MockNoCodeLowCodeAgent(), "low_code_path"],
    [new MockCustomBuildAgent(), "custom_build"],
    [new MockRiskSecurityAgent(), "risk_security"],
    [new MockCostEffortAgent(), "cost_effort"],
    [new MockWorkBreakdownAgent(), "work_breakdown"],
    [new MockDistributionPlannerAgent(), "distribution_plan"],
    [new MockFinalSynthesisAgent(), "synthesis"],
    [new MockCriticQAAgent(), "quality_review"],
  ];

  for (const [agent, expectedRole] of ALL_AGENTS) {
    it(`${expectedRole} agent has correct role`, () => {
      assert.equal(agent.role, expectedRole);
    });

    it(`${expectedRole} agent role is a valid EvaluationSectionKind`, () => {
      assert.ok(evaluationSectionKinds.includes(agent.role));
    });
  }
});

// ─── Agent 1: MockIntakeAnalystAgent ─────────────────────────────────────────

describe("MockIntakeAnalystAgent", () => {
  it("returns intake_brief sectionKind", async () => {
    const output = await runAgent(new MockIntakeAnalystAgent());
    assert.equal(output.sectionKind, "intake_brief");
  });

  it("content has rawSummary and normalizedSummary", async () => {
    const output = await runAgent(new MockIntakeAnalystAgent());
    assert.ok(output.content.rawSummary.length > 0);
    assert.ok(output.content.normalizedSummary.length > 0);
  });

  it("content has statedGoals array", async () => {
    const output = await runAgent(new MockIntakeAnalystAgent());
    assert.ok(Array.isArray(output.content.statedGoals));
    assert.ok(output.content.statedGoals.length > 0);
  });

  it("confidence is between 0 and 1", async () => {
    const output = await runAgent(new MockIntakeAnalystAgent());
    assert.ok(output.confidence >= 0 && output.confidence <= 1);
  });

  it("warns for very short description", async () => {
    const output = await runAgent(new MockIntakeAnalystAgent(), { description: "short" });
    assert.ok(output.warnings.some((w) => w.toLowerCase().includes("short")));
  });

  it("higher confidence for detailed description", async () => {
    const shortOutput = await runAgent(new MockIntakeAnalystAgent(), { description: "short" });
    const longOutput = await runAgent(new MockIntakeAnalystAgent(), {
      description: "We need to build a comprehensive internal KPI dashboard that integrates with Salesforce. The dashboard should show revenue, pipeline, and forecast metrics. Role-based access is required for sales team members.",
    });
    assert.ok(longOutput.confidence > shortOutput.confidence);
  });
});

// ─── Agent 2: MockClarificationQuestionsAgent ─────────────────────────────────

describe("MockClarificationQuestionsAgent", () => {
  it("returns clarification_questions sectionKind", async () => {
    const output = await runAgent(new MockClarificationQuestionsAgent());
    assert.equal(output.sectionKind, "clarification_questions");
  });

  it("isBlocking true for missing description", async () => {
    const output = await runAgent(new MockClarificationQuestionsAgent(), {
      description: "short",
    });
    assert.equal(output.content.isBlocking, true);
    assert.equal(output.isClarificationBlocking, true);
  });

  it("isBlocking false for detailed intake", async () => {
    const output = await runAgent(new MockClarificationQuestionsAgent(), {
      title: "Build a sales KPI dashboard",
      description: "We need an internal dashboard showing KPIs for the sales team. The goal is to track revenue and pipeline. Integrate with Salesforce. Timeline: Q3 2026.",
    });
    assert.equal(output.content.isBlocking, false);
  });

  it("questions have id, question, reason, required", async () => {
    const output = await runAgent(new MockClarificationQuestionsAgent());
    for (const q of output.content.questions) {
      assert.ok(q.id);
      assert.ok(q.question.length > 0);
      assert.ok(q.reason.length > 0);
      assert.equal(typeof q.required, "boolean");
    }
  });

  it("missingFields is an array", async () => {
    const output = await runAgent(new MockClarificationQuestionsAgent());
    assert.ok(Array.isArray(output.content.missingFields));
  });
});

// ─── Agent 3: MockProjectClassifierAgent ─────────────────────────────────────

describe("MockProjectClassifierAgent", () => {
  it("returns classification sectionKind", async () => {
    const output = await runAgent(new MockProjectClassifierAgent());
    assert.equal(output.sectionKind, "classification");
  });

  it("recommendedDepth is light/standard/full", async () => {
    const output = await runAgent(new MockProjectClassifierAgent());
    assert.ok(["light", "standard", "full"].includes(output.content.recommendedDepth));
  });

  it("classifies simple dashboard as light depth", async () => {
    const output = await runAgent(new MockProjectClassifierAgent(), {
      title: "Simple sales report",
      description: "A simple dashboard to track KPIs. Read-only.",
    });
    assert.ok(["light", "standard"].includes(output.content.recommendedDepth));
  });

  it("classifies migration/infra as full depth", async () => {
    const output = await runAgent(new MockProjectClassifierAgent(), {
      title: "Database migration",
      description: "Migrate all production data from legacy system to new infra. Compliance and security required.",
    });
    assert.equal(output.content.recommendedDepth, "full");
  });

  it("content has confidence, reasoning, and signals", async () => {
    const output = await runAgent(new MockProjectClassifierAgent());
    assert.ok(typeof output.content.confidence === "number");
    assert.ok(output.content.reasoning.length > 0);
    assert.ok(Array.isArray(output.content.signals));
  });
});

// ─── Agent 4: MockSolutionsArchitectAgent ────────────────────────────────────

describe("MockSolutionsArchitectAgent", () => {
  it("returns architecture sectionKind", async () => {
    const output = await runAgent(new MockSolutionsArchitectAgent());
    assert.equal(output.sectionKind, "architecture");
  });

  it("content has recommendation and tech stack", async () => {
    const output = await runAgent(new MockSolutionsArchitectAgent());
    assert.ok(output.content.recommendation.length > 0);
    assert.ok(output.content.recommendedTechStack.length > 0);
  });

  it("detects Salesforce integration point", async () => {
    const output = await runAgent(new MockSolutionsArchitectAgent());
    assert.ok(output.content.integrationPoints.some((p) => p.toLowerCase().includes("salesforce")));
  });

  it("detects PostgreSQL as data store", async () => {
    const output = await runAgent(new MockSolutionsArchitectAgent(), {
      description: "Build a backend API with PostgreSQL database.",
    });
    assert.ok(output.content.dataStores.some((d) => d.toLowerCase().includes("postgres")));
  });
});

// ─── Agent 5: MockNoCodeLowCodeAgent ─────────────────────────────────────────

describe("MockNoCodeLowCodeAgent", () => {
  it("returns low_code_path sectionKind", async () => {
    const output = await runAgent(new MockNoCodeLowCodeAgent());
    assert.equal(output.sectionKind, "low_code_path");
  });

  it("viable true for simple tracking/workflow", async () => {
    const output = await runAgent(new MockNoCodeLowCodeAgent(), {
      title: "Simple Monday tracking form",
      description: "A simple tracking form in Monday to manage approval workflows. No code needed.",
    });
    assert.equal(output.content.viable, true);
  });

  it("viable false for custom auth or API project", async () => {
    const output = await runAgent(new MockNoCodeLowCodeAgent(), {
      title: "Custom auth API",
      description: "We need a custom backend API with SSO auth and a PostgreSQL database.",
    });
    assert.equal(output.content.viable, false);
  });

  it("whenToRejectLowCode has entries", async () => {
    const output = await runAgent(new MockNoCodeLowCodeAgent());
    assert.ok(output.content.whenToRejectLowCode.length > 0);
  });
});

// ─── Agent 6: MockCustomBuildAgent ───────────────────────────────────────────

describe("MockCustomBuildAgent", () => {
  it("returns custom_build sectionKind", async () => {
    const output = await runAgent(new MockCustomBuildAgent());
    assert.equal(output.sectionKind, "custom_build");
  });

  it("required true for custom API/auth project", async () => {
    const output = await runAgent(new MockCustomBuildAgent(), {
      description: "Build a backend REST API with OAuth SSO and PostgreSQL. Dashboard frontend needed.",
    });
    assert.equal(output.content.required, true);
  });

  it("has rationale string", async () => {
    const output = await runAgent(new MockCustomBuildAgent());
    assert.ok(output.content.rationale.length > 0);
  });
});

// ─── Agent 7: MockRiskSecurityAgent ──────────────────────────────────────────

describe("MockRiskSecurityAgent", () => {
  it("returns risk_security sectionKind", async () => {
    const output = await runAgent(new MockRiskSecurityAgent());
    assert.equal(output.sectionKind, "risk_security");
  });

  it("risks is an array", async () => {
    const output = await runAgent(new MockRiskSecurityAgent());
    assert.ok(Array.isArray(output.content.risks));
    assert.ok(output.content.risks.length > 0);
  });

  it("flags securityReviewRequired for auth/payment keywords", async () => {
    const output = await runAgent(new MockRiskSecurityAgent(), {
      description: "Build a payment system with SSO auth and customer data.",
    });
    assert.equal(output.content.securityReviewRequired, true);
  });

  it("risk items have title, severity, category, mitigation", async () => {
    const output = await runAgent(new MockRiskSecurityAgent());
    for (const risk of output.content.risks) {
      assert.ok(risk.title.length > 0);
      assert.ok(["low", "medium", "high"].includes(risk.severity));
      assert.ok(["security", "privacy", "delivery", "technical", "operational", "compliance"].includes(risk.category));
      assert.ok(risk.mitigation.length > 0);
    }
  });

  it("increases cost estimate for migration/security/integration", async () => {
    const simpleOutput = await runAgent(new MockCostEffortAgent(), {
      title: "Simple report",
      description: "A simple dashboard report. Read-only.",
    });
    const complexOutput = await runAgent(new MockCostEffortAgent(), {
      description: "Migrate all data from legacy system using ETL pipeline. Needs SSO auth and compliance review. Also external API integration.",
    });
    assert.ok(complexOutput.content.estimatedStoryPoints > simpleOutput.content.estimatedStoryPoints);
  });
});

// ─── Agent 8: MockCostEffortAgent ────────────────────────────────────────────

describe("MockCostEffortAgent", () => {
  it("returns cost_effort sectionKind", async () => {
    const output = await runAgent(new MockCostEffortAgent());
    assert.equal(output.sectionKind, "cost_effort");
  });

  it("estimatedStoryPoints >= 1", async () => {
    const output = await runAgent(new MockCostEffortAgent());
    assert.ok(output.content.estimatedStoryPoints >= 1);
  });

  it("complexity is low/medium/high", async () => {
    const output = await runAgent(new MockCostEffortAgent());
    assert.ok(["low", "medium", "high"].includes(output.content.complexity));
  });
});

// ─── Agent 9: MockWorkBreakdownAgent ─────────────────────────────────────────

describe("MockWorkBreakdownAgent", () => {
  it("returns work_breakdown sectionKind", async () => {
    const output = await runAgent(new MockWorkBreakdownAgent());
    assert.equal(output.sectionKind, "work_breakdown");
  });

  it("subtasks array has at least 2 items", async () => {
    const output = await runAgent(new MockWorkBreakdownAgent());
    assert.ok(output.content.subtasks.length >= 2);
  });

  it("each subtask has title, description, and acceptanceCriteria", async () => {
    const output = await runAgent(new MockWorkBreakdownAgent());
    for (const t of output.content.subtasks) {
      assert.ok(t.title.length > 0);
      assert.ok(t.description.length > 0);
      assert.ok(Array.isArray(t.acceptanceCriteria));
      assert.ok(t.acceptanceCriteria.length > 0);
    }
  });

  it("milestones is a non-empty array", async () => {
    const output = await runAgent(new MockWorkBreakdownAgent());
    assert.ok(output.content.milestones.length > 0);
  });

  it("includes discovery subtask", async () => {
    const output = await runAgent(new MockWorkBreakdownAgent());
    assert.ok(output.content.subtasks.some((t) => t.title.toLowerCase().includes("discovery")));
  });
});

// ─── Agent 10: MockDistributionPlannerAgent ───────────────────────────────────

describe("MockDistributionPlannerAgent", () => {
  it("returns distribution_plan sectionKind", async () => {
    const output = await runAgent(new MockDistributionPlannerAgent());
    assert.equal(output.sectionKind, "distribution_plan");
  });

  it("dryRunOnly is always true", async () => {
    const output = await runAgent(new MockDistributionPlannerAgent());
    assert.equal(output.content.dryRunOnly, true);
  });

  it("monday.required is true", async () => {
    const output = await runAgent(new MockDistributionPlannerAgent());
    assert.equal(output.content.monday.required, true);
  });

  it("distributionNotes is a non-empty array", async () => {
    const output = await runAgent(new MockDistributionPlannerAgent());
    assert.ok(output.content.distributionNotes.length > 0);
  });

  it("github.required true for code/backend projects", async () => {
    const output = await runAgent(new MockDistributionPlannerAgent(), {
      description: "Build a backend API service with authentication and PostgreSQL.",
    });
    assert.equal(output.content.github.required, true);
  });
});

// ─── Agent 11: MockFinalSynthesisAgent ───────────────────────────────────────

describe("MockFinalSynthesisAgent", () => {
  it("returns synthesis sectionKind", async () => {
    const output = await runAgent(new MockFinalSynthesisAgent());
    assert.equal(output.sectionKind, "synthesis");
  });

  it("executiveSummary is non-empty", async () => {
    const output = await runAgent(new MockFinalSynthesisAgent());
    assert.ok(output.content.executiveSummary.length > 0);
  });

  it("reads prior sections from context", async () => {
    const intake = makeIntake();
    const ctx = makeCtx(intake, {
      sections: {
        intake_brief: {
          id: "SEC-1", evaluationId: "EVAL-1", kind: "intake_brief", version: 1,
          content: {
            title: "KPI Dashboard", rawSummary: "Sales KPI tracking",
            normalizedSummary: "Build a KPI dashboard for sales", statedGoals: ["Track revenue"],
            successCriteria: [], knownConstraints: [],
          },
          provenance: { provider: "mock", agentRole: "intake_brief", generatedAt: NOW },
        },
      },
    });
    const output = await (new MockFinalSynthesisAgent()).run(ctx, baseOpts);
    assert.ok(output.content.executiveSummary.length > 0);
  });

  it("keyDecisions is an array", async () => {
    const output = await runAgent(new MockFinalSynthesisAgent());
    assert.ok(Array.isArray(output.content.keyDecisions));
  });

  it("approvalReadinessSummary is non-empty", async () => {
    const output = await runAgent(new MockFinalSynthesisAgent());
    assert.ok(output.content.approvalReadinessSummary.length > 0);
  });
});

// ─── Agent 12: MockCriticQAAgent ─────────────────────────────────────────────

describe("MockCriticQAAgent", () => {
  it("returns quality_review sectionKind", async () => {
    const output = await runAgent(new MockCriticQAAgent());
    assert.equal(output.sectionKind, "quality_review");
  });

  it("qualityScore has 6 dimensions all 0–100", async () => {
    const output = await runAgent(new MockCriticQAAgent());
    const dims = output.content.qualityScore.dimensions;
    for (const [key, val] of Object.entries(dims)) {
      assert.ok(val >= 0 && val <= 100, `dimension ${key} out of range: ${val}`);
    }
  });

  it("qualityScore.overall is 0–100", async () => {
    const output = await runAgent(new MockCriticQAAgent());
    assert.ok(output.content.qualityScore.overall >= 0);
    assert.ok(output.content.qualityScore.overall <= 100);
  });

  it("readinessBand is one of the valid bands", async () => {
    const output = await runAgent(new MockCriticQAAgent());
    assert.ok(["ready", "usable", "needs_revision", "not_ready"].includes(output.content.qualityScore.readinessBand));
  });

  it("returns not_ready for blocking clarification", async () => {
    const intake = makeIntake({ title: "x", description: "y" });
    const ctx = makeCtx(intake, {
      sections: {
        clarification_questions: {
          id: "SEC-1", evaluationId: "EVAL-1", kind: "clarification_questions", version: 1,
          content: {
            isBlocking: true,
            questions: [{ id: "Q1", question: "What is the goal?", reason: "Missing", required: true }],
            missingFields: ["description", "business_goal"],
          },
          provenance: { provider: "mock", agentRole: "clarification_questions", generatedAt: NOW },
        },
      },
    });
    const output = await (new MockCriticQAAgent()).run(ctx, baseOpts);
    assert.ok(["not_ready", "needs_revision"].includes(output.content.qualityScore.readinessBand));
  });

  it("returns usable/ready for complete section set", async () => {
    const intake = makeIntake();
    const ctx = makeCtx(intake, {
      sections: {
        intake_brief: {
          id: "S1", evaluationId: "E1", kind: "intake_brief", version: 1,
          content: {
            title: "KPI Dashboard", rawSummary: "Build KPI", normalizedSummary: "Build KPI dashboard",
            statedGoals: ["Track KPIs", "Integrate Salesforce"], successCriteria: ["Accepted"], knownConstraints: [],
          },
          provenance: { provider: "mock", agentRole: "intake_brief", generatedAt: NOW },
        },
        work_breakdown: {
          id: "S2", evaluationId: "E1", kind: "work_breakdown", version: 1,
          content: {
            subtasks: [
              { title: "Task 1", description: "Do it", acceptanceCriteria: ["Done"], estimatedHours: 4 },
              { title: "Task 2", description: "Do more", acceptanceCriteria: ["Done"], estimatedHours: 8 },
              { title: "Task 3", description: "Deploy", acceptanceCriteria: ["Deployed"], estimatedHours: 4 },
            ],
            milestones: ["Delivered"], dependencies: [],
          },
          provenance: { provider: "mock", agentRole: "work_breakdown", generatedAt: NOW },
        },
        risk_security: {
          id: "S3", evaluationId: "E1", kind: "risk_security", version: 1,
          content: {
            risks: [
              { title: "Scope creep", severity: "low", category: "delivery", mitigation: "Lock scope early" },
              { title: "Auth risk", severity: "medium", category: "security", mitigation: "Use OAuth" },
            ],
            dataSensitivity: "internal", securityReviewRequired: false,
          },
          provenance: { provider: "mock", agentRole: "risk_security", generatedAt: NOW },
        },
        architecture: {
          id: "S4", evaluationId: "E1", kind: "architecture", version: 1,
          content: {
            recommendation: "Next.js + NestJS + PostgreSQL",
            architectureStyle: "layered monolith",
            recommendedTechStack: ["Next.js", "NestJS", "PostgreSQL", "Prisma"],
            integrationPoints: ["Salesforce API"],
            dataStores: ["PostgreSQL"],
            deploymentNotes: ["Deploy to Vercel"],
            assumptions: ["Team knows Next.js"],
          },
          provenance: { provider: "mock", agentRole: "architecture", generatedAt: NOW },
        },
      },
    });
    const output = await (new MockCriticQAAgent()).run(ctx, baseOpts);
    assert.ok(["usable", "ready"].includes(output.content.qualityScore.readinessBand));
  });
});
