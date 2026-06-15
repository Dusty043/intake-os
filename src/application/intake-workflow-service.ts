import { canApproveGate1, canApproveGate2, canTriggerProvisioning, hasPermission } from "../domain/permissions.js";
import { getProjectTypeDefinition } from "../domain/project-type-registry.js";
import type { Actor, ApprovalGate, AuditEvent, RequestStatus, WorkflowAction } from "../domain/types.js";
import { applyWorkflowTransition, isApprovalComplete } from "../domain/workflow.js";
import { createAuditEvent } from "./audit.js";
import { evaluationToLegacyDraft } from "./evaluation-draft-mapper.js";
import { agentRunsFromEvaluation } from "./evaluation-persistence.js";
import type {
  EvaluationOrchestrationOptions,
  EvaluationOrchestrator,
} from "./evaluation-orchestrator.js";
import { ConflictError, NotFoundError, PermissionDeniedError, ValidationError } from "./errors.js";
import type { IntakeAnalysisProvider } from "./intake-analysis-provider.js";
import { validateIntakeAnalysisDraft } from "./intake-analysis.js";
import { MockIntakeAnalysisProvider } from "./providers/mock-intake-analysis-provider.js";
import { buildDryRunProvisioningPlan, resolveDistributionSource } from "./provisioning-plan.js";
import type {
  AcceptAnalysisDraftInput,
  ApprovalDecisionInput,
  CompleteDiscoveryInput,
  CreateIntakeInput,
  GenerateEvaluationInput,
  GenerateMockAnalysisDraftInput,
  GenerateProvisioningPlanInput,
  ProjectIntakeRecord,
  ProjectIntakeStore,
  RejectAnalysisDraftInput,
  RegenerateAnalysisDraftInput,
  ReviewedProjectPackage,
  ReviseAnalysisDraftInput,
} from "./types.js";

export interface IntakeWorkflowServiceOptions {
  store: ProjectIntakeStore;
  clock?: () => string;
  idFactory?: (prefix: string) => string;
  analysisProvider?: IntakeAnalysisProvider;
  orchestrator?: EvaluationOrchestrator;
}

export class IntakeWorkflowService {
  private readonly store: ProjectIntakeStore;
  private readonly clock: () => string;
  private readonly idFactory: (prefix: string) => string;
  private readonly analysisProvider: IntakeAnalysisProvider;
  private readonly orchestrator?: EvaluationOrchestrator;

  constructor(options: IntakeWorkflowServiceOptions) {
    this.store = options.store;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? createReadableId;
    this.analysisProvider = options.analysisProvider ?? new MockIntakeAnalysisProvider();
    this.orchestrator = options.orchestrator;
  }

  get activeProviderName(): string {
    return this.analysisProvider.name;
  }

  async listIntakes(): Promise<readonly ProjectIntakeRecord[]> {
    return this.store.listIntakes();
  }

  async getIntake(id: string): Promise<ProjectIntakeRecord> {
    return this.requireIntake(id);
  }

  async getAuditTrail(id: string): Promise<readonly AuditEvent[]> {
    await this.requireIntake(id);
    return this.store.listAuditEvents(id);
  }

  async createIntake(input: CreateIntakeInput, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "create_request");
    ensureNonEmpty(input.title, "title");
    ensureNonEmpty(input.description, "description");
    ensureNonEmpty(input.requester, "requester");
    getProjectTypeDefinition(input.projectType);

    const now = this.clock();
    const record: ProjectIntakeRecord = {
      id: this.idFactory("REQ"),
      title: input.title.trim(),
      description: input.description.trim(),
      requester: input.requester.trim(),
      department: input.department?.trim() || undefined,
      projectType: input.projectType,
      source: input.source ?? { system: "manual" },
      status: "draft",
      approvals: {},
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      externalLinks: [],
    };

    const saved = await this.store.saveIntake(record);
    await this.audit({ record: saved, actor, action: "INTAKE_CREATED", timestamp: now });
    return saved;
  }

  async submitIntake(id: string, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "submit_request");
    return this.transition(id, "submit", actor, { reason: "Submitted for discovery." });
  }

  async resubmitIntake(id: string, actor: Actor): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    if (record.status !== "clarification_required") {
      throw new ValidationError(`Resubmit is only available when intake is in clarification_required status. Current: ${record.status}.`);
    }
    return this.transition(id, "resubmit", actor, { reason: "Resubmitted after clarification." });
  }

  async completeDiscovery(id: string, input: CompleteDiscoveryInput, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "generate_evaluation");
    ensureNonEmpty(input.problemStatement, "problemStatement");

    let record = await this.requireIntake(id);
    const now = this.clock();
    record = await this.applyTransitionToRecord(record, "generate_evaluation", actor, now, {
      reason: "Discovery started.",
    });

    const withDiscovery: ProjectIntakeRecord = {
      ...record,
      discovery: {
        problemStatement: input.problemStatement.trim(),
        stakeholders: input.stakeholders ?? [],
        expectedUsers: input.expectedUsers ?? [],
        systemsTouched: input.systemsTouched ?? [],
        dataSensitivity: input.dataSensitivity ?? "unknown",
        infraNeeds: input.infraNeeds ?? [],
        estimatedComplexity: input.estimatedComplexity ?? "unknown",
        requiresGithub: input.requiresGithub,
        requiresMonday: input.requiresMonday,
        relatedToBitrix24: input.relatedToBitrix24,
        notes: input.notes,
        completedBy: actor,
        completedAt: now,
      },
      updatedAt: now,
    };

    await this.store.saveIntake(withDiscovery);
    await this.audit({
      record: withDiscovery,
      actor,
      action: "DISCOVERY_COMPLETED",
      timestamp: now,
      metadata: {
        systemsTouched: withDiscovery.discovery?.systemsTouched ?? [],
        estimatedComplexity: withDiscovery.discovery?.estimatedComplexity ?? "unknown",
      },
    });

    return this.applyTransitionToRecord(withDiscovery, "success", actor, now, {
      reason: "Discovery completed without AI evaluation layer.",
    });
  }

  async generateEvaluation(
    id: string,
    input: GenerateEvaluationInput,
    actor: Actor,
  ): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "generate_evaluation");
    if (!this.orchestrator) {
      throw new ValidationError("Evaluation orchestrator is not configured. Set ANALYSIS_ENGINE=orchestrator.");
    }

    let record = await this.requireIntake(id);
    const now = this.clock();
    const depth = input.depth ?? "standard";
    const provider = input.provider ?? "mock";

    record = await this.applyTransitionToRecord(record, "generate_evaluation", actor, now, {
      reason: "AI evaluation started.",
      metadata: { engine: "orchestrator", depth },
    });

    const orchestrationOptions: EvaluationOrchestrationOptions = {
      actor,
      depth,
      provider,
      model: input.model,
      discoveryNotes: record.discovery?.notes ? [record.discovery.notes] : undefined,
      allowDepthUpgrade: input.allowDepthUpgrade ?? true,
    };

    const result = await this.orchestrator.orchestrate(record, orchestrationOptions);

    if (result.kind === "clarification_required") {
      await this.audit({
        record,
        actor,
        action: "EVALUATION_CLARIFICATION_REQUIRED",
        timestamp: now,
        metadata: {
          missingFields: result.clarification.missingFields,
          questionCount: result.clarification.questions.length,
          depth,
        },
      });
      return this.applyTransitionToRecord(record, "clarification_needed", actor, now, {
        reason: "Clarification required before evaluation can proceed.",
        metadata: { questionCount: result.clarification.questions.length },
      });
    }

    // evaluation_ready path
    const { evaluation } = result;

    await this.store.saveEvaluation({
      evaluation,
      agentRuns: agentRunsFromEvaluation(evaluation),
    });

    const draft = evaluationToLegacyDraft(evaluation, { idFactory: this.idFactory, now });
    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(`Evaluation draft failed validation: ${validation.errors.join(", ")}`);
    }

    const withDraft: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: [...(record.analysisDrafts ?? []), draft],
      latestAnalysisDraft: draft,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(withDraft);
    await this.audit({
      record: saved,
      actor,
      action: "EVALUATION_GENERATED",
      timestamp: now,
      metadata: {
        evaluationId: evaluation.id,
        draftId: draft.id,
        depth: evaluation.depth,
        qualityScore: evaluation.qualityScore?.overall,
        sectionCount: evaluation.sections.length,
      },
    });

    return this.applyTransitionToRecord(saved, "success", actor, now, {
      reason: "AI evaluation complete, draft ready for human review.",
      metadata: { evaluationId: evaluation.id, draftId: draft.id },
    });
  }

  async generateMockAnalysisDraft(
    id: string,
    input: GenerateMockAnalysisDraftInput,
    actor: Actor,
  ): Promise<ProjectIntakeRecord> {
    if (this.orchestrator) {
      return this.generateEvaluation(id, { depth: "standard", provider: "mock" }, actor);
    }

    ensurePermission(actor, "generate_evaluation");

    let record = await this.requireIntake(id);
    const now = this.clock();
    record = await this.applyTransitionToRecord(record, "generate_evaluation", actor, now, {
      reason: "AI analysis started.",
      metadata: { provider: this.analysisProvider.name, draftOnly: true },
    });

    const result = await this.analysisProvider.generateDraft(record, {
      actor,
      idFactory: this.idFactory,
      now,
      sourceInquiryText: input.sourceInquiryText,
      reviewerContext: input.reviewerContext,
      mode: "initial_generation",
    });

    const { draft, metadata } = result;
    const validation = validateIntakeAnalysisDraft(draft);
    if (!validation.valid) {
      throw new ValidationError(`Analysis draft failed validation: ${validation.errors.join(", ")}`);
    }

    const withDraft: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: [...(record.analysisDrafts ?? []), draft],
      latestAnalysisDraft: draft,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(withDraft);
    await this.audit({
      record: saved,
      actor,
      action: "ANALYSIS_DRAFT_GENERATED",
      timestamp: now,
      metadata: {
        draftId: draft.id,
        aiProvider: metadata.provider,
        aiModel: metadata.model,
        aiRequestId: metadata.requestId,
        aiFinishReason: metadata.finishReason,
        aiUsage: metadata.usage,
        schemaVersion: draft.schemaVersion,
        confidence: draft.confidence,
        estimatedStoryPoints: draft.estimatedStoryPoints,
        missingInformationCount: draft.missingInformation.length,
        draftOnly: true,
      },
    });

    return this.applyTransitionToRecord(saved, "success", actor, now, {
      reason: "AI analysis draft generated for human review.",
      metadata: { draftId: draft.id, draftOnly: true },
    });
  }

  async regenerateAnalysisDraft(
    id: string,
    input: RegenerateAnalysisDraftInput,
    actor: Actor,
  ): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "steer_analysis_draft");

    if (!input.guidance || input.guidance.trim().length < 10) {
      throw new ValidationError("Guidance must be at least 10 characters.");
    }

    const record = await this.requireIntake(id);

    if (record.status !== "intake_review") {
      throw new ConflictError(`Regeneration is only allowed when intake is in intake_review status. Current status: ${record.status}.`);
    }

    const currentDraft = record.latestAnalysisDraft;
    if (!currentDraft || (currentDraft.reviewStatus !== "draft" && currentDraft.reviewStatus !== "rejected")) {
      throw new ConflictError(
        "No draft available for regeneration. The current draft must be awaiting review or have been rejected.",
      );
    }

    const regenLimit = 5;
    const regenCount = record.analysisDraftRegenerationCount ?? 0;
    if (regenCount >= regenLimit) {
      throw new ConflictError(`Regeneration limit of ${regenLimit} has been reached for this intake.`);
    }

    const now = this.clock();
    const supersededDraft = { ...currentDraft, reviewStatus: "superseded" as const };

    const result = await this.analysisProvider.generateDraft(record, {
      actor,
      idFactory: this.idFactory,
      now,
      guidance: input.guidance,
      mode: "guided_regeneration",
    });

    const { draft: newDraft, metadata } = result;
    const validation = validateIntakeAnalysisDraft(newDraft);
    if (!validation.valid) {
      throw new ValidationError(`Regenerated analysis draft failed validation: ${validation.errors.join(", ")}`);
    }

    const updatedDrafts = [
      ...(record.analysisDrafts ?? []).map((d) => (d.id === currentDraft.id ? supersededDraft : d)),
      newDraft,
    ];

    const updatedRecord: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: updatedDrafts,
      latestAnalysisDraft: newDraft,
      analysisDraftRegenerationCount: regenCount + 1,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updatedRecord);
    await this.audit({
      record: saved,
      actor,
      action: "ANALYSIS_DRAFT_REGENERATED",
      timestamp: now,
      metadata: {
        previousDraftId: currentDraft.id,
        newDraftId: newDraft.id,
        guidance: input.guidance.slice(0, 500),
        regenerationCount: regenCount + 1,
        requestedBy: input.requestedBy,
        aiProvider: metadata.provider,
        aiModel: metadata.model,
        aiRequestId: metadata.requestId,
        aiFinishReason: metadata.finishReason,
        aiUsage: metadata.usage,
      },
    });

    return saved;
  }

  async acceptAnalysisDraft(input: AcceptAnalysisDraftInput, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "review_analysis_draft");
    const record = await this.requireIntake(input.intakeId);
    const draft = requireDraft(record, input.draftId);
    requireDraftPendingReview(draft);

    const now = this.clock();
    const pkg: ReviewedProjectPackage = {
      id: this.idFactory("RPKG"),
      sourceDraftId: draft.id,
      intakeId: record.id,
      reviewedBy: actor.id,
      reviewedAt: now,
      reviewDecision: "accepted",
      reviewerNotes: input.reviewerNotes,
      projectType: draft.projectType,
      complexity: draft.complexity === "unknown" ? "medium" : draft.complexity,
      estimatedStoryPoints: draft.estimatedStoryPoints,
      recommendedTechStack: [...draft.recommendedTechStack],
      infrastructureRequirements: draft.infrastructureRequirements.map((r) => r.description),
      brief: {
        problem: draft.brief.problemStatement,
        solution: draft.brief.proposedSolution,
        scope: [...draft.brief.scope],
        outOfScope: [...draft.brief.outOfScope],
      },
      subtasks: draft.subtasks.map((t) => ({
        title: t.title,
        description: t.description,
        storyPoints: t.storyPoints,
      })),
      assignmentRecommendation: draft.assignmentRecommendation.developerId
        ? {
            recommendedDeveloperId: draft.assignmentRecommendation.developerId,
            recommendedDeveloperName: draft.assignmentRecommendation.displayName,
            reason: draft.assignmentRecommendation.reason,
            confidence: draft.assignmentRecommendation.confidence,
          }
        : undefined,
      missingInformation: [...draft.missingInformation],
    };

    const updatedDraft = { ...draft, reviewStatus: "accepted" as const };
    const updated: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: record.analysisDrafts?.map((d) => (d.id === draft.id ? updatedDraft : d)) ?? [updatedDraft],
      latestAnalysisDraft: updatedDraft,
      reviewedProjectPackage: pkg,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "ANALYSIS_DRAFT_ACCEPTED",
      timestamp: now,
      metadata: { draftId: draft.id, reviewerNotes: input.reviewerNotes },
    });
    await this.audit({
      record: saved,
      actor,
      action: "REVIEWED_PROJECT_PACKAGE_CREATED",
      timestamp: now,
      metadata: { packageId: pkg.id, sourceDraftId: draft.id, reviewDecision: "accepted" },
    });
    return saved;
  }

  async rejectAnalysisDraft(input: RejectAnalysisDraftInput, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "review_analysis_draft");
    const record = await this.requireIntake(input.intakeId);
    const draft = requireDraft(record, input.draftId);
    requireDraftPendingReview(draft);

    const now = this.clock();
    const updatedDraft = { ...draft, reviewStatus: "rejected" as const };
    const updated: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: record.analysisDrafts?.map((d) => (d.id === draft.id ? updatedDraft : d)) ?? [updatedDraft],
      latestAnalysisDraft: updatedDraft,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "ANALYSIS_DRAFT_REJECTED",
      timestamp: now,
      metadata: { draftId: draft.id, reason: input.reason },
    });
    return saved;
  }

  async reviseAnalysisDraft(input: ReviseAnalysisDraftInput, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "review_analysis_draft");
    const record = await this.requireIntake(input.intakeId);
    const draft = requireDraft(record, input.draftId);
    requireDraftPendingReview(draft);

    const now = this.clock();
    const pkg: ReviewedProjectPackage = {
      id: this.idFactory("RPKG"),
      sourceDraftId: draft.id,
      intakeId: record.id,
      reviewedBy: actor.id,
      reviewedAt: now,
      reviewDecision: "revised",
      reviewerNotes: input.reviewerNotes,
      ...input.reviewedPackage,
    };

    const supersededDraft = { ...draft, reviewStatus: "superseded" as const };
    const updated: ProjectIntakeRecord = {
      ...record,
      analysisDrafts: record.analysisDrafts?.map((d) => (d.id === draft.id ? supersededDraft : d)) ?? [supersededDraft],
      latestAnalysisDraft: supersededDraft,
      reviewedProjectPackage: pkg,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "ANALYSIS_DRAFT_REVISED",
      timestamp: now,
      metadata: { draftId: draft.id, reviewerNotes: input.reviewerNotes },
    });
    await this.audit({
      record: saved,
      actor,
      action: "REVIEWED_PROJECT_PACKAGE_CREATED",
      timestamp: now,
      metadata: { packageId: pkg.id, sourceDraftId: draft.id, reviewDecision: "revised" },
    });
    return saved;
  }

  async recordApproval(id: string, input: ApprovalDecisionInput, actor: Actor): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    const inferredGate = inferApprovalGate(record.status);
    const gate = input.gate ?? inferredGate;

    if (gate !== inferredGate) {
      throw new ValidationError(`Approval gate ${gate} cannot be recorded while request is in ${record.status}.`);
    }

    if (gate === "gate_1" && !canApproveGate1(actor)) {
      throw new PermissionDeniedError("approve_gate_1");
    }

    if (gate === "gate_2" && !canApproveGate2(actor, record)) {
      throw new PermissionDeniedError("approve_gate_2");
    }

    if (gate === "gate_1" && (record.analysisDrafts?.length ?? 0) > 0 && !record.reviewedProjectPackage) {
      throw new ValidationError(
        "Cannot approve intake review until an analysis draft has been accepted or revised into a reviewed project package.",
      );
    }

    return this.transition(id, "approve", actor, { reason: input.comment ?? `${gate} approved.` });
  }

  async rejectApproval(id: string, actor: Actor, reason: string): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    if (record.status !== "intake_review" && record.status !== "devops_review") {
      throw new ValidationError(`Cannot reject a request while it is in ${record.status}.`);
    }

    if (record.status === "intake_review" && !canApproveGate1(actor)) {
      throw new PermissionDeniedError("approve_gate_1");
    }

    if (record.status === "devops_review" && !hasPermission(actor.role, "approve_gate_2")) {
      throw new PermissionDeniedError("approve_gate_2");
    }

    return this.transition(id, "reject", actor, { reason });
  }

  async requestChanges(id: string, actor: Actor, reason: string): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    if (record.status !== "devops_review") {
      throw new ValidationError(`Request changes is only available during DevOps review. Current status: ${record.status}.`);
    }
    if (!hasPermission(actor.role, "approve_gate_2")) {
      throw new PermissionDeniedError("approve_gate_2");
    }
    return this.transition(id, "request_changes", actor, { reason });
  }

  async generateProvisioningPlan(
    id: string,
    input: GenerateProvisioningPlanInput,
    actor: Actor,
  ): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "trigger_provisioning");
    const record = await this.requireIntake(id);

    if (record.status !== "approved") {
      throw new ValidationError(`Provisioning plans can only be generated after approval. Current status: ${record.status}.`);
    }

    if (!isApprovalComplete(record, "gate_1") || !isApprovalComplete(record, "gate_2")) {
      throw new ValidationError("Provisioning plan generation requires both approval gates to be complete.");
    }

    const now = this.clock();
    const source = resolveDistributionSource(record);
    const plan = buildDryRunProvisioningPlan(record, input, actor, {
      now,
      idFactory: this.idFactory,
    });

    const updated: ProjectIntakeRecord = {
      ...record,
      provisioningPlan: plan,
      distributionPackage: plan.validation.valid
        ? {
            validated: true,
            validationId: plan.id,
            validatedAt: now,
          }
        : {
            validated: false,
          },
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "PROVISIONING_PLAN_GENERATED",
      timestamp: now,
      metadata: {
        planId: plan.id,
        actionCount: plan.actions.length,
        valid: plan.validation.valid,
        errors: plan.validation.errors,
        sourceType: source.type,
        sourceId: source.sourceId,
      },
    });

    return saved;
  }

  async markReadyForProvisioning(id: string, actor: Actor): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);

    if (!record.provisioningPlan) {
      throw new ValidationError("A dry-run provisioning plan must be generated before marking the intake ready.");
    }

    if (!record.provisioningPlan.validation.valid) {
      throw new ValidationError(`Provisioning plan is invalid: ${record.provisioningPlan.validation.errors.join(", ")}`);
    }

    if (!canTriggerProvisioning(actor, record)) {
      throw new PermissionDeniedError("trigger_provisioning");
    }

    const now = this.clock();
    const updated: ProjectIntakeRecord = {
      ...record,
      provisioningPlan: {
        ...record.provisioningPlan,
        status: "ready_for_provisioning",
        approvedForExecutionAt: now,
        approvedForExecutionBy: actor,
      },
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "PROVISIONING_READY_MARKED",
      timestamp: now,
      metadata: {
        planId: updated.provisioningPlan?.id,
        dryRunOnly: true,
      },
    });

    return saved;
  }

  async transition(
    id: string,
    action: WorkflowAction,
    actor: Actor,
    options: { reason?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    return this.applyTransitionToRecord(record, action, actor, this.clock(), options);
  }

  private async requireIntake(id: string): Promise<ProjectIntakeRecord> {
    const record = await this.store.getIntake(id);
    if (!record) {
      throw new NotFoundError("Project intake", id);
    }
    return record;
  }

  private async applyTransitionToRecord(
    record: ProjectIntakeRecord,
    action: WorkflowAction,
    actor: Actor,
    now: string,
    options: { reason?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<ProjectIntakeRecord> {
    const result = applyWorkflowTransition(record, action, actor, {
      now,
      reason: options.reason,
      metadata: options.metadata,
    });

    const updated = {
      ...record,
      ...result.request,
    } satisfies ProjectIntakeRecord;

    const saved = await this.store.saveIntake(updated);
    await this.store.appendAuditEvent(result.auditEvent);
    return saved;
  }

  private async audit(input: {
    record: ProjectIntakeRecord;
    actor: Actor;
    action: string;
    timestamp: string;
    fromState?: RequestStatus;
    toState?: RequestStatus;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.store.appendAuditEvent(
      createAuditEvent({
        requestId: input.record.id,
        actor: input.actor,
        action: input.action,
        timestamp: input.timestamp,
        fromState: input.fromState,
        toState: input.toState,
        metadata: input.metadata,
      }),
    );
  }
}

function createReadableId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function ensurePermission(actor: Actor, action: Parameters<typeof hasPermission>[1]): void {
  if (!hasPermission(actor.role, action)) {
    throw new PermissionDeniedError(action);
  }
}

function ensureNonEmpty(value: string, fieldName: string): void {
  if (!value.trim()) {
    throw new ValidationError(`${fieldName} is required.`);
  }
}

function inferApprovalGate(status: RequestStatus): ApprovalGate {
  if (status === "intake_review") {
    return "gate_1";
  }

  if (status === "devops_review") {
    return "gate_2";
  }

  throw new ValidationError(`No approval gate is open while request is in ${status}.`);
}

function requireDraft(record: ProjectIntakeRecord, draftId: string) {
  const draft = record.analysisDrafts?.find((d) => d.id === draftId);
  if (!draft) {
    throw new NotFoundError("Analysis draft", draftId);
  }
  return draft;
}

function requireDraftPendingReview(draft: { id: string; reviewStatus: string }) {
  if (draft.reviewStatus !== "draft") {
    throw new ValidationError(`Draft ${draft.id} is not pending review (status: ${draft.reviewStatus}).`);
  }
}
