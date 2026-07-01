-- CreateTable
CREATE TABLE "DiscoverySessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoverySessionRecord_userId_updatedAt_idx" ON "DiscoverySessionRecord"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "DiscoverySessionRecord_status_idx" ON "DiscoverySessionRecord"("status");
