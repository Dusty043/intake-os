-- CreateTable
CREATE TABLE "IntakeEvaluation" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "depth" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "qualityScore" JSONB,
    "evaluationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdByEmail" TEXT,
    "createdByRole" TEXT NOT NULL,

    CONSTRAINT "IntakeEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationSection" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "sectionKind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "provenance" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "sectionId" TEXT,
    "agentRole" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "estimatedCostUsd" DECIMAL(65,30),
    "finishReason" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningRun" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredById" TEXT NOT NULL,
    "triggeredByRole" TEXT NOT NULL,
    "triggeredByName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProvisioningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningTargetResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProvisioningTargetResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntakeEvaluation_intakeId_idx" ON "IntakeEvaluation"("intakeId");

-- CreateIndex
CREATE INDEX "IntakeEvaluation_status_idx" ON "IntakeEvaluation"("status");

-- CreateIndex
CREATE INDEX "IntakeEvaluation_depth_idx" ON "IntakeEvaluation"("depth");

-- CreateIndex
CREATE INDEX "IntakeEvaluation_createdAt_idx" ON "IntakeEvaluation"("createdAt");

-- CreateIndex
CREATE INDEX "EvaluationSection_evaluationId_idx" ON "EvaluationSection"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationSection_sectionKind_idx" ON "EvaluationSection"("sectionKind");

-- CreateIndex
CREATE INDEX "EvaluationSection_supersededById_idx" ON "EvaluationSection"("supersededById");

-- CreateIndex
CREATE INDEX "AgentRun_evaluationId_idx" ON "AgentRun"("evaluationId");

-- CreateIndex
CREATE INDEX "AgentRun_sectionId_idx" ON "AgentRun"("sectionId");

-- CreateIndex
CREATE INDEX "AgentRun_agentRole_idx" ON "AgentRun"("agentRole");

-- CreateIndex
CREATE INDEX "AgentRun_provider_idx" ON "AgentRun"("provider");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "ProvisioningRun_intakeId_startedAt_idx" ON "ProvisioningRun"("intakeId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningTargetResult_idempotencyKey_key" ON "ProvisioningTargetResult"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProvisioningTargetResult_runId_idx" ON "ProvisioningTargetResult"("runId");

-- CreateIndex
CREATE INDEX "ProvisioningTargetResult_idempotencyKey_idx" ON "ProvisioningTargetResult"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_provider_providerSubject_key" ON "AuthUser"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "IntakeEvaluation" ADD CONSTRAINT "IntakeEvaluation_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSection" ADD CONSTRAINT "EvaluationSection_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "IntakeEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "IntakeEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningRun" ADD CONSTRAINT "ProvisioningRun_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ProjectIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningRun" ADD CONSTRAINT "ProvisioningRun_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProvisioningPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningTargetResult" ADD CONSTRAINT "ProvisioningTargetResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProvisioningRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
