-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "sequence" INTEGER NOT NULL,
ADD COLUMN     "signerUserId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Report_caseId_sequence_key" ON "Report"("caseId", "sequence");
