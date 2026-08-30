-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'CONCORDANT', 'DISCORDANT');

-- CreateTable
CREATE TABLE "CaseVerification" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "verifierUserId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CaseVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseVerification_caseId_idx" ON "CaseVerification"("caseId");

-- CreateIndex
CREATE INDEX "CaseVerification_verifierUserId_status_idx" ON "CaseVerification"("verifierUserId", "status");

