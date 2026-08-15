-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "Layer" ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "InvestigationCase_userId_idx" ON "InvestigationCase"("userId");
