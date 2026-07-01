-- CreateTable
CREATE TABLE "GlobalSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSetting_pkey" PRIMARY KEY ("key")
);

-- Seed default discovery settings
INSERT INTO "GlobalSetting" ("key", "value", "updatedAt")
VALUES ('discovery.confidence_threshold', '0.65', NOW())
ON CONFLICT ("key") DO NOTHING;
