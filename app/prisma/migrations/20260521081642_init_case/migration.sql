-- CreateEnum
CREATE TYPE "InvestigationCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED');

-- CreateTable
CREATE TABLE "InvestigationCase" (
    "id" UUID NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "pvNumber" TEXT NOT NULL,
    "description" TEXT,
    "status" "InvestigationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestigationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationCase_caseNumber_key" ON "InvestigationCase"("caseNumber");
