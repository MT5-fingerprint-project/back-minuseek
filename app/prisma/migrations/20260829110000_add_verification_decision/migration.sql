-- CreateEnum
CREATE TYPE "VerificationExploitability" AS ENUM ('EXPLOITABLE', 'NOT_EXPLOITABLE');

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('CONCORDANT', 'DISCORDANT');

-- CreateTable
CREATE TABLE "VerificationDecision" (
    "id" UUID NOT NULL,
    "verificationId" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "exploitability" "VerificationExploitability" NOT NULL,
    "identifiedReferencePrintId" UUID,
    "outcome" "DecisionOutcome",
    "statedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationDecision_verificationId_traceId_key" ON "VerificationDecision"("verificationId", "traceId");

