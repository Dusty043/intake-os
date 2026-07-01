-- AlterTable
ALTER TABLE "ProvisioningRun" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'initial',
ADD COLUMN     "retryOfRunId" TEXT;

-- AlterTable
ALTER TABLE "ProvisioningTargetResult" ADD COLUMN     "retryable" BOOLEAN NOT NULL DEFAULT true;
