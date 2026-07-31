import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import type {
  DiscoverySession,
  PhaseZeroDocument,
  PhaseZeroPacket,
  PhaseZeroSourceSnapshot,
} from "../../domain/discovery.js";
import {
  getSection,
  type ArchitectureSectionContent,
  type ClarificationQuestionsSectionContent,
  type CostEffortSectionContent,
  type CustomBuildSectionContent,
  type IntakeBriefSectionContent,
  type IntakeEvaluation,
  type LowCodePathSectionContent,
  type QualityReviewSectionContent,
  type RiskSecuritySectionContent,
  type SynthesisSectionContent,
  type WorkBreakdownSectionContent,
} from "../intake-evaluation.js";

type DocumentSpec = {
  id: string;
  path: string;
  mediaType: PhaseZeroDocument["mediaType"];
};

export const PHASE_ZERO_DOCUMENT_SPECS: readonly DocumentSpec[] = [
  { id: "executive-summary", path: "00 Executive Summary/Executive Summary.md", mediaType: "text/markdown" },
  { id: "product-vision", path: "01 Vision/Product Vision.md", mediaType: "text/markdown" },
  { id: "business-goals", path: "01 Vision/Business Goals.md", mediaType: "text/markdown" },
  { id: "success-metrics", path: "01 Vision/Success Metrics.md", mediaType: "text/markdown" },
  { id: "prd", path: "02 Product/PRD.md", mediaType: "text/markdown" },
  { id: "user-stories", path: "02 Product/User Stories.md", mediaType: "text/markdown" },
  { id: "personas", path: "02 Product/Personas.md", mediaType: "text/markdown" },
  { id: "scope", path: "02 Product/Scope.md", mediaType: "text/markdown" },
  { id: "non-goals", path: "02 Product/Non-goals.md", mediaType: "text/markdown" },
  { id: "wireframes", path: "03 Design/Wireframes.svg", mediaType: "image/svg+xml" },
  { id: "figma-handoff", path: "03 Design/Figma Handoff.md", mediaType: "text/markdown" },
  { id: "ux-flows", path: "03 Design/UX Flows.mmd", mediaType: "text/plain" },
  { id: "component-specs", path: "03 Design/Component Specs.md", mediaType: "text/markdown" },
  { id: "technical-design", path: "04 Engineering/Technical Design Document.md", mediaType: "text/markdown" },
  { id: "system-architecture", path: "04 Engineering/System Architecture.mmd", mediaType: "text/plain" },
  { id: "adrs", path: "04 Engineering/ADRs.md", mediaType: "text/markdown" },
  { id: "api-spec", path: "04 Engineering/API Spec.md", mediaType: "text/markdown" },
  { id: "database-design", path: "04 Engineering/Database Design.md", mediaType: "text/markdown" },
  { id: "infrastructure", path: "04 Engineering/Infrastructure.md", mediaType: "text/markdown" },
  { id: "security-review", path: "04 Engineering/Security Review.md", mediaType: "text/markdown" },
  { id: "milestones", path: "05 Implementation/Milestones.md", mediaType: "text/markdown" },
  { id: "wbs", path: "05 Implementation/Work Breakdown Structure.md", mediaType: "text/markdown" },
  { id: "ticket-mapping", path: "05 Implementation/Ticket Mapping.md", mediaType: "text/markdown" },
  { id: "estimates", path: "05 Implementation/Estimates.md", mediaType: "text/markdown" },
  { id: "dependencies", path: "05 Implementation/Dependencies.md", mediaType: "text/markdown" },
  { id: "test-plan", path: "06 Testing/Test Plan.md", mediaType: "text/markdown" },
  { id: "acceptance-criteria", path: "06 Testing/Acceptance Criteria.md", mediaType: "text/markdown" },
  { id: "qa-checklist", path: "06 Testing/QA Checklist.md", mediaType: "text/markdown" },
  { id: "performance-plan", path: "06 Testing/Performance Plan.md", mediaType: "text/markdown" },
  { id: "deployment-guide", path: "07 Deployment/Deployment Guide.md", mediaType: "text/markdown" },
  { id: "rollback-plan", path: "07 Deployment/Rollback Plan.md", mediaType: "text/markdown" },
  { id: "feature-flags", path: "07 Deployment/Feature Flags.md", mediaType: "text/markdown" },
  { id: "release-notes", path: "07 Deployment/Release Notes.md", mediaType: "text/markdown" },
  { id: "monitoring", path: "08 Operations/Monitoring.md", mediaType: "text/markdown" },
  { id: "dashboards", path: "08 Operations/Dashboards.md", mediaType: "text/markdown" },
  { id: "alerts", path: "08 Operations/Alerts.md", mediaType: "text/markdown" },
  { id: "runbooks", path: "08 Operations/Runbooks.md", mediaType: "text/markdown" },
  { id: "readme", path: "09 Documentation/README.md", mediaType: "text/markdown" },
  { id: "api-docs", path: "09 Documentation/API Docs.md", mediaType: "text/markdown" },
  { id: "user-guide", path: "09 Documentation/User Guide.md", mediaType: "text/markdown" },
  { id: "developer-guide", path: "09 Documentation/Developer Guide.md", mediaType: "text/markdown" },
  { id: "glossary", path: "10 Appendix/Glossary.md", mediaType: "text/markdown" },
  { id: "decisions", path: "10 Appendix/Decisions.md", mediaType: "text/markdown" },
  { id: "assumptions", path: "10 Appendix/Assumptions and Open Questions.md", mediaType: "text/markdown" },
  { id: "research", path: "10 Appendix/Research.md", mediaType: "text/markdown" },
  { id: "references", path: "10 Appendix/References.md", mediaType: "text/markdown" },
] as const;

type PacketContext = ReturnType<typeof packetContext>;

export function capturePhaseZeroSource(session: DiscoverySession, capturedAt: string): PhaseZeroSourceSnapshot {
  if (!session.proposal) throw new Error("A completed Discovery proposal is required before Phase 0 generation.");
  return structuredClone({
    capturedAt,
    confidence: session.confidence,
    messages: session.messages,
    problemFrame: session.problemFrame,
    selectedSolution: session.solutionOptions.find((option) => option.id === session.selectedSolutionId) ?? null,
    proposal: session.proposal,
    clarifications: session.clarificationQuestions,
  });
}

export function buildPhaseZeroPacket(
  source: PhaseZeroSourceSnapshot,
  evaluation: IntakeEvaluation,
  generatedAt: string,
): PhaseZeroPacket {
  const context = packetContext(source, evaluation);
  const documents = PHASE_ZERO_DOCUMENT_SPECS.map((spec) => buildDocument(spec, context));
  validatePhaseZeroDocuments(documents);

  const score = evaluation.qualityScore?.overall;
  const warnings = unique([
    ...(context.quality?.content.weaknesses ?? []),
    ...(context.quality?.content.requiredRevisions ?? []),
    ...(context.quality?.content.reviewerWarnings ?? []),
    ...(score === undefined ? ["The evaluation critic did not return a quality score."] : []),
  ]);

  return {
    version: "1.0",
    state: score !== undefined && score >= 90 ? "ready" : "ready_with_warnings",
    source,
    evaluationId: evaluation.id,
    qualityScore: score,
    assumptions: context.assumptions,
    warnings,
    documents,
    generatedAt,
  };
}

export function buildPhaseZeroZip(packet: PhaseZeroPacket): Uint8Array {
  if (packet.state !== "ready" && packet.state !== "ready_with_warnings") {
    throw new Error(`Phase 0 packet is not downloadable while state is ${packet.state}.`);
  }

  validatePhaseZeroDocuments(packet.documents);
  const files: Record<string, Uint8Array> = {};
  for (const document of packet.documents) files[document.path] = strToU8(document.content);
  files["PACKET-MANIFEST.json"] = strToU8(JSON.stringify({
    version: packet.version,
    classification: "AI-generated, unapproved Phase 0 planning material",
    sourceCapturedAt: packet.source.capturedAt,
    generatedAt: packet.generatedAt,
    evaluationId: packet.evaluationId,
    qualityScore: packet.qualityScore,
    state: packet.state,
    assumptions: packet.assumptions,
    warnings: packet.warnings,
    documents: packet.documents.map(({ content: _content, ...metadata }) => metadata),
  }, null, 2));
  return zipSync(files, { level: 6 });
}

export function validatePhaseZeroDocuments(documents: readonly PhaseZeroDocument[]): void {
  const expected = PHASE_ZERO_DOCUMENT_SPECS.map((spec) => spec.path).sort();
  const actual = documents.map((document) => document.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Phase 0 packet document paths do not match the required static tree.");
  }
  for (const document of documents) {
    if (!document.content.trim()) throw new Error(`Phase 0 document is empty: ${document.path}`);
    if (sha256(document.content) !== document.sha256) {
      throw new Error(`Phase 0 document hash mismatch: ${document.path}`);
    }
  }
}

function packetContext(source: PhaseZeroSourceSnapshot, evaluation: IntakeEvaluation) {
  const brief = getSection<IntakeBriefSectionContent>(evaluation, "intake_brief");
  const architecture = getSection<ArchitectureSectionContent>(evaluation, "architecture");
  const lowCode = getSection<LowCodePathSectionContent>(evaluation, "low_code_path");
  const customBuild = getSection<CustomBuildSectionContent>(evaluation, "custom_build");
  const risk = getSection<RiskSecuritySectionContent>(evaluation, "risk_security");
  const cost = getSection<CostEffortSectionContent>(evaluation, "cost_effort");
  const work = getSection<WorkBreakdownSectionContent>(evaluation, "work_breakdown");
  const synthesis = getSection<SynthesisSectionContent>(evaluation, "synthesis");
  const quality = getSection<QualityReviewSectionContent>(evaluation, "quality_review");
  const clarification = getSection<ClarificationQuestionsSectionContent>(evaluation, "clarification_questions");
  const proposal = source.proposal;
  const frame = source.problemFrame;
  const assumptions = unique([
    ...(frame?.assumptions.map((item) => `${item.assumption} — ${item.rationale}`) ?? []),
    ...proposal.assumptions.map((item) => `${item.assumption} — ${item.rationale}`),
    ...proposal.unknowns.map((item) => `Open question: ${item}`),
    ...(architecture?.content.assumptions ?? []),
    ...(clarification?.content.questions.map((item) => `Unanswered: ${item.question}`) ?? []),
  ]);
  const confidence = average(Object.values(source.confidence));
  const evidence = unique([
    `Discovery conversation: ${source.messages.filter((message) => message.role === "user").length} requester message(s)`,
    `Selected direction: ${source.selectedSolution?.title ?? "No named direction"}`,
    `Evaluation: ${evaluation.id} (${evaluation.depth})`,
  ]);
  return { source, evaluation, proposal, frame, brief, architecture, lowCode, customBuild, risk, cost, work, synthesis, quality, clarification, assumptions, confidence, evidence };
}

function buildDocument(spec: DocumentSpec, context: PacketContext): PhaseZeroDocument {
  const applicability = isApplicable(spec.id, context);
  const content = applicability.applicable
    ? generatedContent(spec, context)
    : markdown(specTitle(spec), context, `## Not Applicable\n\n${applicability.reason}\n\n## Revisit When\n\n${applicability.revisit}`);
  return {
    ...spec,
    status: applicability.applicable ? "generated" : "not_applicable",
    content,
    evidence: context.evidence,
    assumptions: context.assumptions,
    confidence: context.confidence,
    sha256: sha256(content),
  };
}

function generatedContent(spec: DocumentSpec, c: PacketContext): string {
  if (spec.id === "wireframes") return wireframeSvg(c);
  if (spec.id === "ux-flows") return uxFlowMermaid(c);
  if (spec.id === "system-architecture") return architectureMermaid(c);

  const title = specTitle(spec);
  const goals = c.brief?.content.statedGoals ?? c.frame?.successCriteria ?? [];
  const success = c.brief?.content.successCriteria ?? c.frame?.successCriteria ?? [];
  const tasks = c.work?.content.subtasks ?? [];
  const risks = c.risk?.content.risks ?? [];
  const architecture = c.architecture?.content;
  const summary = c.synthesis?.content.executiveSummary ?? c.brief?.content.normalizedSummary ?? c.frame?.problemStatement ?? c.proposal.title;
  const direction = c.synthesis?.content.recommendedPath ?? c.source.selectedSolution?.summary ?? architecture?.recommendation ?? "Use the selected Discovery direction.";

  const body: Record<string, string> = {
    "executive-summary": `${summary}\n\n## Recommended Direction\n\n${direction}\n\n${list("Success Measures", success)}\n\n${list("Material Risks", risks.map((risk) => `${risk.title}: ${risk.mitigation}`))}`,
    "product-vision": `## Vision\n\n${summary}\n\n## Intended Outcome\n\n${direction}`,
    "business-goals": list("Business Goals", goals),
    "success-metrics": list("Success Metrics", success),
    prd: `## Problem\n\n${c.frame?.problemStatement ?? summary}\n\n${list("Goals", goals)}\n\n${list("Functional Requirements", c.proposal.requirements.value?.functional ?? [])}\n\n${list("Constraints", c.proposal.problemFrame.value?.constraints ?? c.brief?.content.knownConstraints ?? [])}`,
    "user-stories": list("User Stories", tasks.map((task) => `As a ${task.suggestedOwnerRole ?? "project stakeholder"}, I want ${lowerFirst(task.title)} so that ${task.description}`)),
    personas: list("Personas", (c.frame?.affectedUsers ?? ["Project stakeholder"]).map((user) => `${user}: needs a clear, reliable path through the proposed solution.`)),
    scope: `${list("In Scope", tasks.map((task) => task.title))}\n\n${list("Dependencies", c.work?.content.dependencies ?? [])}`,
    "non-goals": list("Non-goals", ["Production implementation during Phase 0", "Unreviewed external system changes", "Capabilities not supported by the captured Discovery evidence"]),
    "figma-handoff": `## Purpose\n\nTranslate the approved wireframe and UX flow into a design file without inventing new product behavior.\n\n${list("Required Frames", ["Primary workflow", "Loading and generation states", "Empty state", "Failure and retry state", "Responsive narrow viewport"])}\n\n${list("Design Inputs", c.frame?.affectedUsers ?? [])}`,
    "component-specs": `${list("Primary Components", tasks.map((task) => task.title))}\n\n${list("Required States", ["default", "hover", "focus", "disabled", "loading", "error", "success"])}\n\n## Accessibility\n\nKeyboard access, visible focus, semantic labels, and WCAG AA contrast are required.`,
    "technical-design": `## Recommended Architecture\n\n${architecture?.recommendation ?? direction}\n\n${list("Technology", architecture?.recommendedTechStack ?? [])}\n\n${list("Integrations", architecture?.integrationPoints ?? [])}\n\n${list("Deployment Notes", architecture?.deploymentNotes ?? [])}`,
    adrs: `${list("Decisions", c.synthesis?.content.keyDecisions ?? [direction])}\n\n## Decision Status\n\nThese are proposed Phase 0 decisions. Implementation owners must confirm them before build work begins.`,
    "api-spec": `${list("API Responsibilities", c.customBuild?.content.backendNeeds ?? [])}\n\n${list("Integration Points", architecture?.integrationPoints ?? [])}\n\n## Contract Rule\n\nDefine request/response schemas, authentication, validation, idempotency, and error responses before implementation.`,
    "database-design": `${list("Data Stores", architecture?.dataStores ?? [])}\n\n## Modeling Guidance\n\n${c.proposal.systemDesign.value?.dataLayer.modelingNotes ?? "Derive entities and retention rules from the approved product requirements."}\n\n## Consistency\n\n${c.proposal.systemDesign.value?.dataLayer.consistencyRequirements ?? "Confirm transactional boundaries during implementation planning."}`,
    infrastructure: `${list("Infrastructure Needs", c.customBuild?.content.infrastructureNeeds ?? architecture?.deploymentNotes ?? [])}\n\n${list("Cost Drivers", c.cost?.content.costDrivers ?? [])}`,
    "security-review": `${list("Risks and Mitigations", risks.map((risk) => `[${risk.severity}] ${risk.title}: ${risk.mitigation}`))}\n\n## Review Requirement\n\n${c.risk?.content.securityReviewRequired ? "A human security review is required before implementation." : "No dedicated review was identified, but implementation must validate authentication, authorization, secrets, and data handling."}`,
    milestones: list("Milestones", c.work?.content.milestones ?? tasks.map((task) => task.title)),
    wbs: tasks.length > 0 ? tasks.map((task, index) => `## ${index + 1}. ${task.title}\n\n${task.description}\n\n${list("Acceptance Criteria", task.acceptanceCriteria)}`).join("\n\n") : list("Work Breakdown", ["Confirm requirements", "Implement selected direction", "Validate and hand off"]),
    "ticket-mapping": table(["Ticket", "Owner", "Estimate"], tasks.map((task, index) => [`P0-${String(index + 1).padStart(3, "0")}: ${task.title}`, task.suggestedOwnerRole ?? "Unassigned", task.estimatedHours ? `${task.estimatedHours}h` : "To refine"])),
    estimates: `## Overall\n\nComplexity: **${c.cost?.content.complexity ?? "unknown"}**  \nEstimated story points: **${c.cost?.content.estimatedStoryPoints ?? "not estimated"}**  \nEstimated engineering days: **${c.cost?.content.estimatedEngineeringDays ?? "not estimated"}**\n\n${list("Estimate Assumptions", c.cost?.content.costAssumptions ?? [])}`,
    dependencies: list("Dependencies", unique([...(c.work?.content.dependencies ?? []), ...(c.source.selectedSolution?.dependencies ?? [])])),
    "test-plan": `${list("Test Areas", tasks.map((task) => task.title))}\n\n${list("Required Layers", ["Unit tests for non-trivial domain behavior", "Integration tests for system boundaries", "End-to-end validation of the primary user workflow", "Accessibility and failure-state checks"])}`,
    "acceptance-criteria": list("Acceptance Criteria", unique(tasks.flatMap((task) => task.acceptanceCriteria).concat(success))),
    "qa-checklist": list("QA Checklist", ["Primary workflow completes", "Loading, empty, error, and retry states are usable", "Permissions and trust boundaries are enforced", "No unresolved critic revision is silently ignored", ...(c.quality?.content.requiredRevisions ?? [])].map((item) => `- [ ] ${item}`), false),
    "performance-plan": `${list("Performance Expectations", [c.proposal.requirements.value?.nonFunctional.performance ?? "Establish representative latency and throughput budgets before implementation.", c.proposal.scalability.value?.capacityEstimate ?? "Measure with representative data volume."])}\n\n${list("Validation", ["Baseline the primary workflow", "Load-test external boundaries", "Monitor regression against the agreed budget"])}`,
    "deployment-guide": `${list("Deployment Notes", architecture?.deploymentNotes ?? [])}\n\n${list("Sequence", ["Validate configuration", "Apply backward-compatible changes", "Run smoke checks", "Observe health before expanding access"])}`,
    "rollback-plan": `${list("Rollback Triggers", risks.filter((risk) => risk.severity === "high").map((risk) => risk.title))}\n\n${list("Rollback Steps", ["Stop new traffic or disable the release", "Restore the last known-good artifact and configuration", "Verify data integrity", "Record the incident and follow-up actions"])}`,
    "feature-flags": `${list("Candidate Flags", tasks.map((task) => `phase0_${slug(task.title)}`))}\n\n## Policy\n\nEvery flag needs an owner, default, rollout plan, and removal date.`,
    "release-notes": `## Phase 0\n\nPlanning package generated for **${c.proposal.title}**. No production implementation or external provisioning is included.`,
    monitoring: `${list("Signals", ["Availability", "Latency", "Error rate", "Job failures", "External integration health"])}\n\n## Ownership\n\nAssign each signal an owner and response expectation before launch.`,
    dashboards: list("Dashboard Views", ["Service health", "Primary workflow success", "Background job outcomes", "Cost and capacity"]),
    alerts: list("Alert Conditions", risks.filter((risk) => risk.severity !== "low").map((risk) => `${risk.title}: alert when the mitigation control fails.`)),
    runbooks: `${list("Runbooks", risks.map((risk) => `${risk.title}: detect, contain, recover, verify, and document.`))}\n\n## Minimum Contents\n\nOwner, symptoms, diagnostics, safe actions, escalation, rollback, and verification.`,
    readme: `## Overview\n\n${summary}\n\n## Direction\n\n${direction}\n\n${list("Milestones", c.work?.content.milestones ?? [])}\n\n## Status\n\nPhase 0 planning only; implementation has not started.`,
    "api-docs": `## Audience\n\nDevelopers integrating with the proposed system.\n\n${list("Document", ["Authentication", "Endpoints and schemas", "Errors", "Rate limits", "Idempotency", "Examples"])}`,
    "user-guide": `${list("Primary Workflow", ["Open the product", "Complete the primary task", "Review the result", "Recover from errors or request support"])}\n\n${list("Users", c.frame?.affectedUsers ?? [])}`,
    "developer-guide": `${list("Start Here", ["Read the PRD and technical design", "Confirm ADRs and assumptions", "Set up the documented toolchain", "Run checks before changing behavior"])}\n\n${list("Technology", architecture?.recommendedTechStack ?? [])}`,
    glossary: table(["Term", "Meaning"], [["Phase 0", "Planning and design work before implementation"], ["Discovery", "The captured source conversation and structured proposal"], ["Packet", "This unapproved planning document bundle"], ["Assumption", "An inferred statement that requires human validation"]]),
    decisions: list("Proposed Decisions", c.synthesis?.content.keyDecisions ?? [direction]),
    assumptions: `${list("Assumptions", c.assumptions)}\n\n${list("Open Questions", c.proposal.unknowns)}`,
    research: `${list("Evaluated Paths", [c.lowCode?.content.viable ? `Low-code: ${c.lowCode.content.fitReasoning}` : "Low-code path was not recommended", c.customBuild?.content.required ? `Custom build: ${c.customBuild.content.rationale}` : "Custom build was not required"])}\n\n${list("Trade-offs", c.proposal.tradeoffs.value?.map((item) => `${item.optionA} vs ${item.optionB}: ${item.recommendation} — ${item.rationale}`) ?? [])}`,
    references: `${list("Source References", c.evidence)}\n\n## Note\n\nNo external sources were introduced beyond the captured Discovery and generated evaluation.`,
  };

  return markdown(title, c, body[spec.id] ?? `## Purpose\n\n${title} for ${c.proposal.title}.`);
}

function isApplicable(id: string, c: PacketContext): { applicable: boolean; reason: string; revisit: string } {
  if (id === "api-spec" || id === "api-docs") {
    const applicable = (c.customBuild?.content.backendNeeds.length ?? 0) > 0 || Boolean(c.proposal.systemDesign.value?.apiLayer);
    return { applicable, reason: "No API requirement was identified in the captured Discovery evidence.", revisit: "An implementation introduces a service boundary or external integration." };
  }
  if (id === "database-design") {
    const applicable = (c.architecture?.content.dataStores.length ?? 0) > 0 || Boolean(c.proposal.systemDesign.value?.dataLayer.databaseChoice);
    return { applicable, reason: "No persistent data store was identified.", revisit: "The solution begins storing durable or queryable data." };
  }
  if (id === "feature-flags") {
    return { applicable: c.customBuild?.content.required === true, reason: "The recommended direction does not currently require a custom software rollout.", revisit: "Custom code is introduced or rollout risk requires controlled exposure." };
  }
  if (id === "dashboards" || id === "alerts") {
    const applicable = Boolean(c.proposal.observability.value) || c.customBuild?.content.required === true;
    return { applicable, reason: "The captured direction has no standing operational service to observe.", revisit: "A deployed service or scheduled automation is introduced." };
  }
  return { applicable: true, reason: "", revisit: "" };
}

function markdown(title: string, c: PacketContext, body: string): string {
  return `# ${title}\n\n> AI-generated, unapproved Phase 0 planning material. Discovery confidence: ${Math.round(c.confidence * 100)}%.\n\n${body.trim()}\n\n## Evidence\n\n${bullets(c.evidence)}\n\n## Assumptions and Unresolved Risks\n\n${bullets(c.assumptions.length > 0 ? c.assumptions : ["No explicit assumptions were recorded; human validation is still required."])}\n`;
}

function wireframeSvg(c: PacketContext): string {
  const title = xml(c.proposal.title);
  const direction = xml(c.source.selectedSolution?.title ?? "Selected direction");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
  <title id="title">Wireframe for ${title}</title><desc id="desc">Phase 0 wireframe based on the selected Discovery direction.</desc>
  <rect width="1200" height="720" fill="#f8fafc"/><rect x="40" y="36" width="1120" height="648" rx="16" fill="#ffffff" stroke="#cbd5e1"/>
  <rect x="40" y="36" width="220" height="648" rx="16" fill="#172033"/><text x="72" y="88" fill="#ffffff" font-family="system-ui" font-size="22" font-weight="700">${title}</text>
  <text x="72" y="128" fill="#a5b4fc" font-family="system-ui" font-size="15">Primary workspace</text>
  <rect x="292" y="72" width="824" height="68" rx="10" fill="#eef2ff"/><text x="324" y="113" fill="#312e81" font-family="system-ui" font-size="22" font-weight="650">${direction}</text>
  <rect x="292" y="172" width="520" height="456" rx="12" fill="#ffffff" stroke="#cbd5e1"/><text x="324" y="214" fill="#0f172a" font-family="system-ui" font-size="18" font-weight="650">Primary task</text>
  <rect x="844" y="172" width="272" height="220" rx="12" fill="#f8fafc" stroke="#cbd5e1"/><text x="872" y="214" fill="#0f172a" font-family="system-ui" font-size="17" font-weight="650">Context</text>
  <rect x="844" y="420" width="272" height="208" rx="12" fill="#f8fafc" stroke="#cbd5e1"/><text x="872" y="462" fill="#0f172a" font-family="system-ui" font-size="17" font-weight="650">Status and actions</text>
</svg>`;
}

function uxFlowMermaid(c: PacketContext): string {
  return `%% AI-generated, unapproved Phase 0 planning material\nflowchart LR\n  A["${mermaid(c.frame?.affectedUsers[0] ?? "User")}"] --> B["Open ${mermaid(c.proposal.title)}"]\n  B --> C["Complete primary task"]\n  C --> D{"Valid result?"}\n  D -->|Yes| E["Review outcome"]\n  D -->|No| F["Correct input or retry"]\n  F --> C\n  E --> G["Handoff"]\n`;
}

function architectureMermaid(c: PacketContext): string {
  const style = c.architecture?.content.architectureStyle ?? c.proposal.systemDesign.value?.serviceArchitecture.recommendation ?? "system";
  const store = c.architecture?.content.dataStores[0] ?? c.proposal.systemDesign.value?.dataLayer.databaseChoice ?? "Data store";
  return `%% AI-generated, unapproved Phase 0 planning material\nflowchart LR\n  U["User"] --> C["${mermaid(c.proposal.systemDesign.value?.clientLayer ?? "Client")}"]\n  C --> A["${mermaid(c.proposal.systemDesign.value?.apiLayer ?? style)}"]\n  A --> D["${mermaid(store)}"]\n  A --> I["External integrations"]\n`;
}

function list(title: string, items: readonly string[], prefix = true): string {
  const safe = items.filter(Boolean);
  return `## ${title}\n\n${safe.length > 0 ? (prefix ? bullets(safe) : safe.join("\n")) : "- Not established from the available Discovery evidence."}`;
}

function bullets(items: readonly string[]): string {
  return items.map((item) => item.startsWith("- ") ? item : `- ${item}`).join("\n");
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const normalized = rows.length > 0 ? rows : [["Not established", ...headers.slice(1).map(() => "—")]];
  return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${normalized.map((row) => `| ${row.join(" | ")} |`).join("\n")}`;
}

function specTitle(spec: DocumentSpec): string {
  return spec.path.split("/").at(-1)!.replace(/\.(md|mmd|svg)$/, "");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "feature";
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function mermaid(value: string): string {
  return value.replace(/["\n\r]/g, " ").trim().slice(0, 100);
}
