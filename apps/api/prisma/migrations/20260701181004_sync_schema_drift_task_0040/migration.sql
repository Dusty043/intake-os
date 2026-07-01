-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequestStatus" ADD VALUE 'in_progress';
ALTER TYPE "RequestStatus" ADD VALUE 'blocked';
ALTER TYPE "RequestStatus" ADD VALUE 'completed';
ALTER TYPE "RequestStatus" ADD VALUE 'canceled';

-- AlterTable
ALTER TABLE "ProvisioningRun" ADD COLUMN     "errorSummary" TEXT;

-- AlterTable
ALTER TABLE "ProvisioningTargetResult" ADD COLUMN     "deadLettered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deadLetteredAt" TIMESTAMP(3),
ADD COLUMN     "errorCategory" TEXT;

-- CreateIndex
CREATE INDEX "ProvisioningTargetResult_deadLettered_idx" ON "ProvisioningTargetResult"("deadLettered");
