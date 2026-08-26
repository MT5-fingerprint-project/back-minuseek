-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN     "operatorUserId" UUID;

-- CreateIndex
CREATE INDEX "InvestigationCase_operatorUserId_idx" ON "InvestigationCase"("operatorUserId");
