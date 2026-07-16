-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN "operatorId" UUID;

-- CreateIndex
CREATE INDEX "InvestigationCase_operatorId_idx" ON "InvestigationCase"("operatorId");
