import type { EvaluationAgent, AgentOutput } from "../agent-contract.js";
import type { AgentRunContext, AgentRunOptions } from "../agent-contract.js";
import type { RiskSecuritySectionContent } from "../../intake-evaluation.js";
import { normalizeText, containsAny } from "./mock-agent-helpers.js";

type RiskItem = RiskSecuritySectionContent["risks"][number];
type Severity = "low" | "medium" | "high";
type Category = "security" | "privacy" | "delivery" | "technical" | "operational" | "compliance";

export class MockRiskSecurityAgent implements EvaluationAgent<RiskSecuritySectionContent> {
  readonly role = "risk_security" as const;

  async run(ctx: AgentRunContext, opts: AgentRunOptions): Promise<AgentOutput<RiskSecuritySectionContent>> {
    const { intake } = ctx;
    const text = normalizeText(`${intake.title} ${intake.description}`).toLowerCase();

    const risks = buildRisks(text);
    const dataSensitivity = inferDataSensitivity(text);
    const securityReviewRequired = requiresSecurityReview(text);

    const warnings: string[] = [];
    if (dataSensitivity === "unknown") {
      warnings.push("Data sensitivity could not be determined — classify before security review.");
    }
    if (securityReviewRequired) {
      warnings.push("Security review is flagged as required before distribution.");
    }

    return {
      sectionKind: "risk_security",
      content: {
        risks,
        dataSensitivity,
        securityReviewRequired,
      },
      confidence: risks.length > 0 ? 0.82 : 0.70,
      warnings,
    };
  }
}

function buildRisks(text: string): RiskItem[] {
  const risks: RiskItem[] = [];

  if (containsAny(text, ["auth", "sso", "oauth", "login", "session", "permission", "rbac"])) {
    risks.push({
      title: "Authentication and authorization implementation risk",
      severity: "high",
      category: "security",
      mitigation: "Implement using established auth patterns (e.g. OAuth2, session tokens). Conduct security review before launch.",
    });
  }

  if (containsAny(text, ["customer", "user data", "personal", "pii", "email", "phone"])) {
    risks.push({
      title: "Personal data / PII handling",
      severity: "high",
      category: "privacy",
      mitigation: "Identify all PII fields. Apply access controls, encryption at rest, and data retention policy.",
    });
  }

  if (containsAny(text, ["payment", "billing", "stripe", "credit card", "financial"])) {
    risks.push({
      title: "Payment data handling",
      severity: "high",
      category: "security",
      mitigation: "Use PCI-compliant payment processor (e.g. Stripe). Never store card data directly.",
    });
  }

  if (containsAny(text, ["migration", "import", "data move", "etl", "export all"])) {
    risks.push({
      title: "Data migration integrity risk",
      severity: "medium",
      category: "technical",
      mitigation: "Run migration in stages with validation gates. Maintain rollback plan and keep source data intact until verified.",
    });
  }

  if (containsAny(text, ["deadline", "urgent", "asap", "rush", "by end of"])) {
    risks.push({
      title: "Delivery timeline pressure",
      severity: "medium",
      category: "delivery",
      mitigation: "Negotiate scope reduction for MVP. Surface timeline constraints early with stakeholders.",
    });
  }

  if (containsAny(text, ["external api", "third-party", "vendor", "integration"])) {
    risks.push({
      title: "Third-party dependency risk",
      severity: "low",
      category: "operational",
      mitigation: "Abstract integrations behind internal interfaces. Build error handling and fallback behavior.",
    });
  }

  if (containsAny(text, ["compliance", "hipaa", "gdpr", "baa", "regulated", "audit"])) {
    risks.push({
      title: "Regulatory compliance requirement",
      severity: "high",
      category: "compliance",
      mitigation: "Engage compliance officer before design phase. Document data flows and access controls.",
    });
  }

  if (containsAny(text, ["production", "live system", "infra change", "deploy"])) {
    risks.push({
      title: "Production system impact",
      severity: "medium",
      category: "operational",
      mitigation: "Use staging environments. Review deployment plan with DevOps before cutover.",
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: "General scope or requirements ambiguity",
      severity: "low",
      category: "delivery",
      mitigation: "Resolve clarification questions before starting implementation.",
    });
  }

  return risks;
}

function inferDataSensitivity(text: string): RiskSecuritySectionContent["dataSensitivity"] {
  if (containsAny(text, ["hipaa", "baa", "phi", "regulated", "compliance", "gdpr"])) return "regulated";
  if (containsAny(text, ["confidential", "secret", "private", "sensitive"])) return "confidential";
  if (containsAny(text, ["customer", "personal", "pii", "email", "payment"])) return "confidential";
  if (containsAny(text, ["internal", "employee", "staff", "team"])) return "internal";
  if (containsAny(text, ["public", "open", "no sensitive"])) return "low";
  return "unknown";
}

function requiresSecurityReview(text: string): boolean {
  return containsAny(text, [
    "auth", "sso", "oauth", "login",
    "payment", "billing", "stripe",
    "customer", "pii", "personal data",
    "hipaa", "gdpr", "compliance",
    "production infra", "deploy to prod",
    "regulated",
  ]);
}
