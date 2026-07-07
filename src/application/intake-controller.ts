import type { Actor } from "../domain/types.js";
import { normalizeBitrix24IntakePayload } from "./bitrix24-adapter.js";
import type {
  ApprovalDecisionInput,
  CompleteDiscoveryInput,
  CreateIntakeInput,
  GenerateMockAnalysisDraftInput,
  GenerateProvisioningPlanInput,
} from "./types.js";
import type { IntakeWorkflowService } from "./intake-workflow-service.js";

export class IntakeController {
  constructor(private readonly workflowService: IntakeWorkflowService) {}

  list(actor: Actor) {
    return this.workflowService.listIntakes(actor);
  }

  get(id: string, actor: Actor) {
    return this.workflowService.getIntake(id, actor);
  }

  create(body: CreateIntakeInput, actor: Actor) {
    return this.workflowService.createIntake(body, actor);
  }

  submit(id: string, actor: Actor) {
    return this.workflowService.submitIntake(id, actor);
  }

  completeDiscovery(id: string, body: CompleteDiscoveryInput, actor: Actor) {
    return this.workflowService.completeDiscovery(id, body, actor);
  }

  generateMockAnalysisDraft(id: string, body: GenerateMockAnalysisDraftInput, actor: Actor) {
    return this.workflowService.generateMockAnalysisDraft(id, body, actor);
  }

  approve(id: string, body: ApprovalDecisionInput, actor: Actor) {
    return this.workflowService.recordApproval(id, body, actor);
  }

  reject(id: string, reason: string, actor: Actor) {
    return this.workflowService.rejectApproval(id, actor, reason);
  }

  generateProvisioningPlan(id: string, body: GenerateProvisioningPlanInput, actor: Actor) {
    return this.workflowService.generateProvisioningPlan(id, body, actor);
  }

  markReadyForProvisioning(id: string, actor: Actor) {
    return this.workflowService.markReadyForProvisioning(id, actor);
  }

  audit(id: string, actor: Actor) {
    return this.workflowService.getAuditTrail(id, actor);
  }

  previewBitrix24Intake(payload: Record<string, unknown>) {
    return normalizeBitrix24IntakePayload(payload);
  }

  createFromBitrix24(payload: Record<string, unknown>, actor: Actor) {
    return this.workflowService.createIntake(normalizeBitrix24IntakePayload(payload), actor);
  }
}
