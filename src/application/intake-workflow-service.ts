import { canApproveGate1, canApproveGate2, canTriggerProvisioning, hasPermission } from "../domain/permissions.js";
import { getProjectTypeDefinition } from "../domain/project-type-registry.js";
import type { Actor, ApprovalGate, AuditEvent, RequestStatus, WorkflowAction } from "../domain/types.js";
import { applyWorkflowTransition, isApprovalComplete } from "../domain/workflow.js";
import type { LifecycleAction } from "../domain/lifecycle-transitions.js";
import { validateLifecycleTransition } from "../domain/lifecycle-transitions.js";
import { createAuditEvent } from "./audit.js";
import { evaluationToLegacyDraft } from "./evaluation-draft-mapper.js";
import { agentRunsFromEvaluation } from "./evaluation-persistence.js";
import type { AgentRunRecord } from "./evaluation-persistence.js";
import type { IntakeEvaluation } from "./intake-evaluation.js";
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
  ProvisioningContext,
  ProvisioningExecutor,
  ProvisioningRegistry,
} from "./provisioning/provisioning-executor.js";
import type {
  ProvisioningRun,
  ProvisioningRunStatus,
  ProvisioningTargetKind,
  ProvisioningTargetResult,
} from "../domain/provisioning.js";
import type { GoogleChatNotifier } from "./notifications/google-chat-notifier.js";
import { isAutoRetryable, normalizeProvisioningError } from "../domain/error-categories.js";
import { calculateBackoffMs, sleep } from "./provisioning/backoff.js";
import type { RosterApiClient } from "./roster/index.js";
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
  provisioningRegistry?: ProvisioningRegistry;
  notifier?: GoogleChatNotifier;
  rosterClient?: RosterApiClient;
}

export class IntakeWorkflowService {
  private readonly store: ProjectIntakeStore;
  private readonly clock: () => string;
  private readonly idFactory: (prefix: string) => string;
  private readonly analysisProvider: IntakeAnalysisProvider;
  private readonly orchestrator?: EvaluationOrchestrator;
  private readonly provisioningRegistry?: ProvisioningRegistry;
  private readonly notifier?: GoogleChatNotifier;

  constructor(options: IntakeWorkflowServiceOptions) {
    this.store = options.store;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? createReadableId;
    this.analysisProvider = options.analysisProvider ?? new MockIntakeAnalysisProvider(options.rosterClient);
    this.orchestrator = options.orchestrator;
    this.provisioningRegistry = options.provisioningRegistry;
    this.notifier = options.notifier;
  }

  private static readonly DEAD_LETTER_CEILING = 3;
  private static readonly AUTO_RETRY_MAX = 3;
  // Q-FAR-1: per-target override. Empty until DevOps asks for a different retry
  // tolerance for a specific target kind (e.g. { github_repo: 5 }); falls back to
  // AUTO_RETRY_MAX for any kind not listed here.
  private static readonly AUTO_RETRY_MAX_BY_TARGET_KIND: Partial<Record<ProvisioningTargetKind, number>> = {};

  private static maxAttemptsFor(targetKind: ProvisioningTargetKind): number {
    return (
      IntakeWorkflowService.AUTO_RETRY_MAX_BY_TARGET_KIND[targetKind] ??
      IntakeWorkflowService.AUTO_RETRY_MAX
    );
  }

  get activeProviderName(): string {
    return this.analysisProvider.name;
  }

  private async attemptOnce(
    executor: ProvisioningExecutor,
    ctx: ProvisioningContext,
    attempt: number,
  ): Promise<ProvisioningTargetResult> {
    const result = await executor.execute({ ...ctx });
    if (result.status === "succeeded") return result;

    const normalized = normalizeProvisioningError(result.errorMessage ?? "unknown error");
    // Annotate the error category but preserve the executor's retryable signal — the
    // manual retry path depends on it. Auto-retry is determined solely by category.
    return { ...result, errorCategory: normalized.category, attemptCount: attempt };
  }

  // `errorCategory` is stored as a loose `string` on the domain type (matches the Prisma
  // column), but `attemptOnce` only ever writes it from `normalizeProvisioningError`'s
  // narrow union — safe to narrow back here for the one place that needs to branch on it.
  private isAutoRetryableResult(result: ProvisioningTargetResult): boolean {
    return (
      result.status !== "succeeded" &&
      result.errorCategory !== undefined &&
      isAutoRetryable(result.errorCategory as Parameters<typeof isAutoRetryable>[0])
    );
  }

  // Q-FAR-3: runs every executor once synchronously. A target that fails with an
  // auto-retryable category and has attempts remaining is NOT retried inline (that would
  // block the caller on backoff sleep, "v1" behavior) — instead it's returned as
  // "pending_retry" and the remaining attempts continue as a detached background
  // continuation (settleBackgroundRetry). ponytail: this continuation lives only in this
  // process's event loop, not a persisted+swept job — if the process restarts mid-backoff
  // the retry is lost, same durability as the old blocking version (an in-flight
  // `await sleep()` is also lost on crash). Upgrade to a persisted nextRetryAt + cron sweep
  // only if that gap actually bites in practice.
  private async executeTargetsAndFinalize(
    executors: readonly ProvisioningExecutor[],
    ctx: ProvisioningContext,
    run: ProvisioningRun,
  ): Promise<ProvisioningRun> {
    const attempts = await Promise.all(
      executors.map(async (executor) => {
        const maxAttempts = IntakeWorkflowService.maxAttemptsFor(executor.targetKind);
        const first = await this.attemptOnce(executor, ctx, 1);
        const canAutoRetry = this.isAutoRetryableResult(first) && maxAttempts > 1;
        if (!canAutoRetry) return first;

        void this.settleBackgroundRetry(executor, ctx, first, maxAttempts);
        return { ...first, status: "pending_retry" as const };
      }),
    );

    const interimRun: ProvisioningRun = { ...run, targets: attempts };
    await this.store.saveProvisioningRun(interimRun);

    if (attempts.some((t) => t.status === "pending_retry")) {
      return interimRun; // still executing — settleBackgroundRetry finalizes once resolved
    }
    return this.finalizeProvisioningRun(interimRun, ctx.actor);
  }

  private async settleBackgroundRetry(
    executor: ProvisioningExecutor,
    ctx: ProvisioningContext,
    firstResult: ProvisioningTargetResult,
    maxAttempts: number,
  ): Promise<void> {
    let last = firstResult;
    for (let attempt = 2; attempt <= maxAttempts; attempt++) {
      await sleep(calculateBackoffMs(attempt - 1));
      last = await this.attemptOnce(executor, ctx, attempt);
      const canAutoRetry = this.isAutoRetryableResult(last) && attempt < maxAttempts;
      if (!canAutoRetry) break;
    }

    const run = await this.store.getProvisioningRun(ctx.intakeId, ctx.runId);
    if (!run) return; // defensive — run should always exist by the time backoff settles

    const updatedTargets = run.targets.map((t) => (t.targetKind === executor.targetKind ? last : t));
    const updatedRun: ProvisioningRun = { ...run, targets: updatedTargets };

    if (updatedTargets.some((t) => t.status === "pending_retry")) {
      // another target is still backing off — persist this one's outcome and wait for it too
      await this.store.saveProvisioningRun(updatedRun);
      return;
    }

    await this.finalizeProvisioningRun(updatedRun, ctx.actor);
  }

  // Shared tail for executeDistribution and retryFailedProvisioningTargets — also the
  // completion path for a background-settled retry (settleBackgroundRetry above). Computes
  // final run status, applies the dead-letter ceiling, transitions workflow status, audits,
  // and notifies. `allRuns` is filtered to exclude `run.id` when counting prior failures so
  // this behaves identically whether `run` has already been interim-saved or not.
  private async finalizeProvisioningRun(run: ProvisioningRun, actor: Actor): Promise<ProvisioningRun> {
    const intakeId = run.intakeId;
    const priorRuns = (await this.store.listProvisioningRuns(intakeId)).filter((r) => r.id !== run.id);
    const deadLetteredNow = this.clock();

    const targetResults = run.targets.map((result) => {
      if (result.status !== "failed" || result.deadLettered) return result;
      const failCount =
        priorRuns.reduce(
          (n, r) => n + r.targets.filter((t) => t.targetKind === result.targetKind && t.status === "failed").length,
          0,
        ) + 1; // +1 for this run's own failure of this target kind
      if (failCount < IntakeWorkflowService.DEAD_LETTER_CEILING) return result;
      return { ...result, retryable: false, deadLettered: true, deadLetteredAt: deadLetteredNow };
    });

    const record = await this.requireIntake(intakeId);
    for (const result of targetResults) {
      if (result.deadLettered && result.deadLetteredAt === deadLetteredNow) {
        await this.notifier?.notify({
          eventType: "provisioning_dead_lettered",
          intakeId,
          title: record.title,
          requester: record.requester,
          detail: `Target "${result.targetKind}" has failed repeatedly and is now dead-lettered. Manual intervention required.`,
        });
      }
    }

    const allSucceeded = targetResults.every((t) => t.status === "succeeded");
    const allFailed = targetResults.every((t) => t.status === "failed");
    const runStatus: ProvisioningRunStatus = allSucceeded ? "completed" : allFailed ? "failed" : "partial_success";

    const completedNow = this.clock();
    const completedRun: ProvisioningRun = {
      ...run,
      status: runStatus,
      completedAt: completedNow,
      targets: targetResults,
    };
    await this.store.saveProvisioningRun(completedRun);

    const latestRecord = await this.requireIntake(intakeId);
    const nextAction: WorkflowAction = runStatus === "completed" ? "success" : "failure";
    await this.applyTransitionToRecord(latestRecord, nextAction, actor, completedNow);

    const isRetryRun = run.kind === "retry";
    await this.audit({
      record: latestRecord,
      actor,
      action: runStatus === "completed"
        ? (isRetryRun ? "DISTRIBUTION_RETRY_COMPLETED" : "DISTRIBUTION_EXECUTION_COMPLETED")
        : (isRetryRun ? "DISTRIBUTION_RETRY_FAILED" : "DISTRIBUTION_EXECUTION_FAILED"),
      timestamp: completedNow,
      fromState: "provisioning",
      toState: runStatus === "completed" ? "distributed" : "provisioning_failed",
      metadata: {
        runId: run.id,
        planId: run.planId,
        runStatus,
        succeeded: targetResults.filter((t) => t.status === "succeeded").length,
        failed: targetResults.filter((t) => t.status === "failed").length,
        ...(isRetryRun && run.retryOfRunId ? { originalRunId: run.retryOfRunId } : {}),
      },
    });

    await this.notifyProvisioningOutcome(latestRecord, runStatus, targetResults);
    return completedRun;
  }

  async listIntakes(pagination?: { take?: number; skip?: number }): Promise<readonly ProjectIntakeRecord[]> {
    return this.store.listIntakes(pagination);
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

  async resubmitIntake(
    id: string,
    actor: Actor,
    answers?: readonly { question: string; answer: string }[],
  ): Promise<ProjectIntakeRecord> {
    let record = await this.requireIntake(id);
    if (record.status !== "clarification_required") {
      throw new ValidationError(`Resubmit is only available when intake is in clarification_required status. Current: ${record.status}.`);
    }
    if (answers && answers.length > 0) {
      const withAnswers: ProjectIntakeRecord = {
        ...record,
        priorClarifications: answers,
        pendingClarification: undefined,
        updatedAt: this.clock(),
      };
      record = await this.store.saveIntake(withAnswers);
    }
    return this.transition(id, "resubmit", actor, {
      reason: "Resubmitted after clarification.",
      metadata: { answerCount: answers?.length ?? 0 },
    });
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
      priorClarifications: record.priorClarifications ? [...record.priorClarifications] : undefined,
      allowDepthUpgrade: input.allowDepthUpgrade ?? true,
    };

    const result = await this.orchestrator.orchestrate(record, orchestrationOptions);

    if (result.kind === "clarification_required") {
      const withPending: ProjectIntakeRecord = {
        ...record,
        pendingClarification: {
          questions: result.clarification.questions.map((q) => ({
            id: q.id,
            question: q.question,
            required: q.required,
            reason: q.reason,
          })),
          missingFields: result.clarification.missingFields,
        },
        updatedAt: now,
      };
      await this.store.saveIntake(withPending);
      await this.audit({
        record: withPending,
        actor,
        action: "EVALUATION_CLARIFICATION_REQUIRED",
        timestamp: now,
        metadata: {
          missingFields: result.clarification.missingFields,
          questionCount: result.clarification.questions.length,
          depth,
        },
      });
      const withClarification = await this.applyTransitionToRecord(withPending, "clarification_needed", actor, now, {
        reason: "Clarification required before evaluation can proceed.",
        metadata: { questionCount: result.clarification.questions.length },
      });
      await this.notifier?.notify({
        eventType: "clarification_required",
        intakeId: withClarification.id,
        title: withClarification.title,
        requester: withClarification.requester,
        detail: `${result.clarification.questions.length} question(s) need answers before evaluation.`,
      });
      return withClarification;
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
      pendingClarification: undefined,
      priorClarifications: undefined,
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

    const readyForReview = await this.applyTransitionToRecord(saved, "success", actor, now, {
      reason: "AI evaluation complete, draft ready for human review.",
      metadata: { evaluationId: evaluation.id, draftId: draft.id },
    });
    await this.notifier?.notify({
      eventType: "intake_review",
      intakeId: readyForReview.id,
      title: readyForReview.title,
      requester: readyForReview.requester,
    });
    return readyForReview;
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
    // If the intake is already at "evaluating" (e.g. a prior attempt transitioned the status
    // but crashed before writing the draft), skip the transition and resume from where it left off.
    if (record.status !== "evaluating") {
      record = await this.applyTransitionToRecord(record, "generate_evaluation", actor, now, {
        reason: "AI analysis started.",
        metadata: { provider: this.analysisProvider.name, draftOnly: true },
      });
    }

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

    const draftReady = await this.applyTransitionToRecord(saved, "success", actor, now, {
      reason: "AI analysis draft generated for human review.",
      metadata: { draftId: draft.id, draftOnly: true },
    });
    await this.notifier?.notify({
      eventType: "intake_review",
      intakeId: draftReady.id,
      title: draftReady.title,
      requester: draftReady.requester,
    });
    return draftReady;
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

    if (this.orchestrator) {
      const orchResult = await this.orchestrator.orchestrate(record, {
        actor,
        depth: "standard",
        provider: "mock",
        discoveryNotes: [input.guidance],
        allowDepthUpgrade: false,
      });

      if (orchResult.kind === "clarification_required") {
        throw new ConflictError("Re-evaluation halted: clarification required. Provide more complete guidance.");
      }

      const { evaluation } = orchResult;
      await this.store.saveEvaluation({ evaluation, agentRuns: agentRunsFromEvaluation(evaluation) });

      const newDraft = evaluationToLegacyDraft(evaluation, { idFactory: this.idFactory, now });
      const evalValidation = validateIntakeAnalysisDraft(newDraft);
      if (!evalValidation.valid) {
        throw new ValidationError(`Regenerated evaluation draft failed validation: ${evalValidation.errors.join(", ")}`);
      }

      const regenDrafts = [
        ...(record.analysisDrafts ?? []).map((d) => (d.id === currentDraft.id ? supersededDraft : d)),
        newDraft,
      ];

      const regenRecord: ProjectIntakeRecord = {
        ...record,
        analysisDrafts: regenDrafts,
        latestAnalysisDraft: newDraft,
        analysisDraftRegenerationCount: regenCount + 1,
        updatedAt: now,
      };

      const regenSaved = await this.store.saveIntake(regenRecord);
      await this.audit({
        record: regenSaved,
        actor,
        action: "EVALUATION_REGENERATED",
        timestamp: now,
        metadata: {
          previousDraftId: currentDraft.id,
          newDraftId: newDraft.id,
          evaluationId: evaluation.id,
          guidance: input.guidance.slice(0, 500),
          regenerationCount: regenCount + 1,
          requestedBy: input.requestedBy,
          qualityScore: evaluation.qualityScore?.overall,
        },
      });
      return regenSaved;
    }

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

    const updated = await this.transition(id, "approve", actor, { reason: input.comment ?? `${gate} approved.` });
    if (updated.status === "devops_review") {
      await this.notifier?.notify({
        eventType: "devops_review",
        intakeId: updated.id,
        title: updated.title,
        requester: updated.requester,
        detail: "Gate 1 approved. DevOps review now required.",
      });
    }
    return updated;
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

  async overrideAssignment(
    id: string,
    actor: Actor,
    developerName: string,
    reason: string,
    developerId?: string,
  ): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "generate_evaluation");
    const record = await this.requireIntake(id);
    const now = this.clock();
    const updated: ProjectIntakeRecord = {
      ...record,
      assignmentOverride: {
        developerId,
        developerName,
        reason,
        overriddenAt: now,
        overriddenBy: actor,
      },
      updatedAt: now,
    };
    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "ASSIGNMENT_OVERRIDDEN",
      timestamp: now,
      metadata: { developerName, developerId, reason },
    });
    return saved;
  }

  async clearAssignmentOverride(id: string, actor: Actor): Promise<ProjectIntakeRecord> {
    ensurePermission(actor, "generate_evaluation");
    const record = await this.requireIntake(id);
    const now = this.clock();
    const { assignmentOverride: _removed, ...rest } = record;
    const updated: ProjectIntakeRecord = { ...rest, updatedAt: now };
    const saved = await this.store.saveIntake(updated);
    await this.audit({
      record: saved,
      actor,
      action: "ASSIGNMENT_OVERRIDE_CLEARED",
      timestamp: now,
      metadata: {},
    });
    return saved;
  }

  async executeDistribution(id: string, actor: Actor): Promise<ProvisioningRun> {
    const record = await this.requireIntake(id);

    if (record.status !== "approved") {
      throw new ValidationError(`Distribution execution requires approved status. Current status: ${record.status}.`);
    }

    if (!isApprovalComplete(record, "gate_1")) {
      throw new ValidationError("Gate 1 approval is not complete.");
    }

    if (!isApprovalComplete(record, "gate_2")) {
      throw new ValidationError("Gate 2 approval is not complete.");
    }

    if (!record.provisioningPlan || record.provisioningPlan.status !== "ready_for_provisioning") {
      throw new ValidationError("A provisioning plan marked ready_for_provisioning is required before execution.");
    }

    if (!this.provisioningRegistry || this.provisioningRegistry.size === 0) {
      throw new ValidationError("No provisioning executors are registered.");
    }

    const existingRuns = await this.store.listProvisioningRuns(id);
    if (existingRuns.some((r) => r.status === "executing")) {
      throw new ConflictError("A provisioning run is already in progress.");
    }

    if (!record.reviewedProjectPackage) {
      throw new ValidationError("A ReviewedProjectPackage is required before distribution execution.");
    }

    const now = this.clock();
    const runId = this.idFactory("run");
    const planId = record.provisioningPlan.id;

    const run: ProvisioningRun = {
      id: runId,
      intakeId: id,
      planId,
      status: "executing",
      kind: "initial",
      triggeredById: actor.id,
      triggeredByRole: actor.role,
      triggeredByName: actor.displayName,
      startedAt: now,
      targets: [],
    };

    await this.store.saveProvisioningRun(run);
    await this.applyTransitionToRecord(record, "start_provisioning", actor, now);
    await this.audit({
      record,
      actor,
      action: "DISTRIBUTION_EXECUTION_STARTED",
      timestamp: now,
      fromState: "approved",
      toState: "provisioning",
      metadata: { runId, planId },
    });

    const executors = this.provisioningRegistry.getAll();
    const ctx: ProvisioningContext = {
      intakeId: id,
      planId,
      runId,
      actor,
      reviewedPackage: record.reviewedProjectPackage!,
      isRetry: false,
    };
    return this.executeTargetsAndFinalize(executors, ctx, run);
  }

  async listProvisioningRuns(intakeId: string): Promise<ProvisioningRun[]> {
    return this.store.listProvisioningRuns(intakeId);
  }

  async retryFailedProvisioningTargets(
    intakeId: string,
    originalRunId: string,
    actor: Actor,
  ): Promise<ProvisioningRun> {
    const record = await this.requireIntake(intakeId);

    if (record.status !== "provisioning_failed") {
      throw new ValidationError(
        `Retry requires provisioning_failed status. Current status: ${record.status}.`,
      );
    }

    if (!isApprovalComplete(record, "gate_1")) {
      throw new ValidationError("Gate 1 approval is not complete.");
    }

    if (!isApprovalComplete(record, "gate_2")) {
      throw new ValidationError("Gate 2 approval is not complete.");
    }

    if (!record.provisioningPlan || record.provisioningPlan.status !== "ready_for_provisioning") {
      throw new ValidationError("A provisioning plan marked ready_for_provisioning is required.");
    }

    if (!this.provisioningRegistry || this.provisioningRegistry.size === 0) {
      throw new ValidationError("No provisioning executors are registered.");
    }

    const existingRuns = await this.store.listProvisioningRuns(intakeId);
    if (existingRuns.some((r) => r.status === "executing")) {
      throw new ConflictError("A provisioning run is already in progress.");
    }

    const originalRun = await this.store.getProvisioningRun(intakeId, originalRunId);
    if (!originalRun) {
      throw new NotFoundError("Provisioning run", originalRunId);
    }

    if (originalRun.status === "executing") {
      throw new ConflictError("Cannot retry a run that is still executing.");
    }

    const retryableTargets = originalRun.targets.filter(
      (t) => t.status === "failed" && t.retryable,
    );

    if (retryableTargets.length === 0) {
      throw new ValidationError("No retryable failed targets found in the specified run.");
    }

    if (!record.reviewedProjectPackage) {
      throw new ValidationError("A ReviewedProjectPackage is required before distribution execution.");
    }

    const now = this.clock();
    const retryRunId = this.idFactory("run");
    const planId = record.provisioningPlan.id;

    const retryRun: ProvisioningRun = {
      id: retryRunId,
      intakeId,
      planId,
      status: "executing",
      kind: "retry",
      retryOfRunId: originalRunId,
      triggeredById: actor.id,
      triggeredByRole: actor.role,
      triggeredByName: actor.displayName,
      startedAt: now,
      targets: [],
    };

    await this.store.saveProvisioningRun(retryRun);
    await this.applyTransitionToRecord(record, "retry", actor, now);
    await this.audit({
      record,
      actor,
      action: "DISTRIBUTION_RETRY_STARTED",
      timestamp: now,
      fromState: "provisioning_failed",
      toState: "provisioning",
      metadata: { retryRunId, originalRunId, planId, retryableCount: retryableTargets.length },
    });

    const retryableKinds = new Set(retryableTargets.map((t) => t.targetKind));
    const executors = this.provisioningRegistry
      .getAll()
      .filter((e) => retryableKinds.has(e.targetKind));

    const ctx: ProvisioningContext = {
      intakeId,
      planId,
      runId: retryRunId,
      actor,
      reviewedPackage: record.reviewedProjectPackage!,
      isRetry: true,
    };
    return this.executeTargetsAndFinalize(executors, ctx, retryRun);
  }

  private async notifyProvisioningOutcome(
    record: ProjectIntakeRecord,
    runStatus: "completed" | "failed" | "partial_success",
    targetResults: readonly { status: string; targetKind: string }[],
  ): Promise<void> {
    if (runStatus === "completed") {
      await this.notifier?.notify({
        eventType: "distributed",
        intakeId: record.id,
        title: record.title,
        requester: record.requester,
      });
    } else {
      const failedKinds = targetResults
        .filter((t) => t.status === "failed")
        .map((t) => t.targetKind)
        .join(", ");
      await this.notifier?.notify({
        eventType: "provisioning_failed",
        intakeId: record.id,
        title: record.title,
        requester: record.requester,
        detail: `Failed targets: ${failedKinds}`,
      });
    }
  }

  async markProvisioningTargetResolved(
    intakeId: string,
    targetId: string,
    actor: Actor,
    note?: string,
  ): Promise<void> {
    const record = await this.requireIntake(intakeId);
    const now = this.clock();

    await this.store.updateProvisioningTargetResult(targetId, {
      status: "succeeded",
      retryable: false,
      deadLettered: false,
      completedAt: now,
    });

    await this.audit({
      record,
      actor,
      action: "PROVISIONING_TARGET_MANUALLY_RESOLVED",
      timestamp: now,
      metadata: { targetId, note },
    });
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

  // ─── Evaluation read methods ─────────────────────────────────────────────

  async listEvaluationsForIntake(intakeId: string): Promise<IntakeEvaluation[]> {
    return this.store.listEvaluationsForIntake(intakeId);
  }

  async getLatestEvaluationForIntake(
    intakeId: string,
  ): Promise<{ evaluation: IntakeEvaluation | null; agentRuns: AgentRunRecord[] }> {
    const evaluation = await this.store.getLatestEvaluationForIntake(intakeId);
    if (!evaluation) return { evaluation: null, agentRuns: [] };
    const agentRuns = await this.store.listAgentRuns(evaluation.id);
    return { evaluation, agentRuns };
  }

  async getEvaluationForIntake(
    intakeId: string,
    evaluationId: string,
  ): Promise<{ evaluation: IntakeEvaluation; agentRuns: AgentRunRecord[] }> {
    const evaluation = await this.store.getEvaluation(intakeId, evaluationId);
    if (!evaluation) throw new NotFoundError("Evaluation", evaluationId);
    const agentRuns = await this.store.listAgentRuns(evaluationId);
    return { evaluation, agentRuns };
  }

  async executeLifecycleTransition(
    id: string,
    action: LifecycleAction,
    actor: Actor,
    input: {
      note?: string;
      blockedReason?: string;
      completedNote?: string;
      canceledReason?: string;
    } = {},
  ): Promise<ProjectIntakeRecord> {
    const record = await this.requireIntake(id);
    const result = validateLifecycleTransition(action, record.status);
    if (!result.ok) {
      throw new ValidationError(result.reason);
    }

    const now = this.clock();
    const lifecycleMeta: Partial<ProjectIntakeRecord> = {};

    if (action === "mark_started") {
      if (input.note) lifecycleMeta.lifecycleNote = input.note;
    } else if (action === "mark_blocked") {
      lifecycleMeta.blockedAt = now;
      if (input.blockedReason) lifecycleMeta.blockedReason = input.blockedReason;
    } else if (action === "unblock") {
      lifecycleMeta.unblockedAt = now;
      lifecycleMeta.blockedReason = undefined;
    } else if (action === "mark_completed") {
      lifecycleMeta.completedAt = now;
      if (input.completedNote) lifecycleMeta.completedNote = input.completedNote;
    } else if (action === "mark_canceled") {
      lifecycleMeta.canceledAt = now;
      if (input.canceledReason) lifecycleMeta.canceledReason = input.canceledReason;
    } else if (action === "archive") {
      lifecycleMeta.archivedAt = now;
    }

    const updated: ProjectIntakeRecord = {
      ...record,
      ...lifecycleMeta,
      status: result.toStatus,
      updatedAt: now,
    };

    const saved = await this.store.saveIntake(updated);

    await this.audit({
      record: saved,
      actor,
      action,
      timestamp: now,
      fromState: record.status,
      toState: result.toStatus,
      metadata: input.note
        ? { note: input.note }
        : input.blockedReason
          ? { blockedReason: input.blockedReason }
          : input.canceledReason
            ? { canceledReason: input.canceledReason }
            : undefined,
    });

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
