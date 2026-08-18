-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('TECHNICAL', 'TRACEABILITY');

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "ReportType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "generatedBy" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_caseId_idx" ON "Report"("caseId");
