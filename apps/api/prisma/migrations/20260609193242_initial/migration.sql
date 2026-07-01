-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'submitted', 'evaluating', 'clarification_required', 'intake_review', 'devops_review', 'approved', 'provisioning', 'distributed', 'provisioning_failed', 'archived');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('n8n_automation', 'data_sync_integration', 'internal_dashboard', 'internal_tool', 'client_portal', 'saas_platform', 'api_service', 'ai_workflow_tool', 'discovery_research', 'reporting_automation');

-- CreateEnum
CREATE TYPE "IntakeSourceSystem" AS ENUM ('manual', 'bitrix24', 'monday', 'email', 'other');

-- CreateEnum
CREATE TYPE "ApprovalGate" AS ENUM ('gate_1', 'gate_2');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "ProvisioningPlanStatus" AS ENUM ('draft', 'ready_for_provisioning');

-- CreateTable
CREATE TABLE "ProjectIntake" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "department" TEXT,
    "projectType" "ProjectType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "sourceSystem" "IntakeSourceSystem" NOT NULL DEFAULT 'manual',
    "sourceExternalId" TEXT,
    "sourceExternalUrl" TEXT,
    "sourceRawPayload" JSONB,
    "distributionPackage" JSONB,
    "analysisDrafts" JSONB,
    "latestAnalysisDraft" JSONB,
    "recordSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdByName" TEXT,

    CONSTRAINT "ProjectIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRecord" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "stakeholders" JSONB NOT NULL,
    "expectedUsers" JSONB NOT NULL,
    "systemsTouched" JSONB NOT NULL,
    "dataSensitivity" TEXT NOT NULL,
    "infraNeeds" JSONB NOT NULL,
    "estimatedComplexity" TEXT NOT NULL,
    "requiresGithub" BOOLEAN,
    "requiresMonday" BOOLEAN,
    "relatedToBitrix24" BOOLEAN,
    "notes" TEXT,
    "completedById" TEXT NOT NULL,
    "completedByRole" TEXT NOT NULL,
    "completedByName" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "gate" "ApprovalGate" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT,
    "comment" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningPlan" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "status" "ProvisioningPlanStatus" NOT NULL DEFAULT 'draft',
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedByRole" TEXT NOT NULL,
    "generatedByName" TEXT,
    "repository" JSONB,
    "githubRequirement" TEXT NOT NULL,
    "evaluationDepth" TEXT NOT NULL,
    "distributionMode" TEXT NOT NULL,
    "validation" JSONB NOT NULL,
    "approvedForExecutionAt" TIMESTAMP(3),
    "approvedForExecutionById" TEXT,
    "approvedForExecutionByRole" TEXT,
    "approvedForExecutionByName" TEXT,
    "planSnapshot" JSONB NOT NULL,

    CONSTRAINT "ProvisioningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningPlanAction" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "requiresCredential" BOOLEAN NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "ProvisioningPlanAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLink" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromState" "RequestStatus",
    "toState" "RequestStatus",
    "reason" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectIntake_status_updatedAt_idx" ON "ProjectIntake"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectIntake_sourceSystem_sourceExternalId_idx" ON "ProjectIntake"("sourceSystem", "sourceExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRecord_intakeId_key" ON "DiscoveryRecord"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_intakeId_gate_key" ON "ApprovalRecord"("intakeId", "gate");

-- CreateIndex
CREATE INDEX "ProvisioningPlan_intakeId_generatedAt_idx" ON "ProvisioningPlan"("intakeId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningPlanAction_idempotencyKey_key" ON "ProvisioningPlanAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExternalLink_provider_externalId_idx" ON "ExternalLink"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AuditEvent_intakeId_timestamp_idx" ON "AuditEvent"("intakeId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEvent_action_timestamp_idx" ON "AuditEvent"("action", "timestamp");

-- AddForeignKey
ALTER TABLE "DiscoveryRecord" ADD CONSTRAINT "DiscoveryRecord_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningPlan" ADD CONSTRAINT "ProvisioningPlan_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningPlanAction" ADD CONSTRAINT "ProvisioningPlanAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProvisioningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalLink" ADD CONSTRAINT "ExternalLink_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
