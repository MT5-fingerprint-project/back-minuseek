-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN     "caseAgainst" TEXT,
ADD COLUMN     "interventionDate" DATE,
ADD COLUMN     "offenseDateFrom" DATE,
ADD COLUMN     "offenseDateTo" DATE,
ADD COLUMN     "offenseLocation" TEXT,
ADD COLUMN     "offenseNature" TEXT,
ADD COLUMN     "requestDate" DATE,
ADD COLUMN     "requesterName" TEXT,
ADD COLUMN     "requesterQuality" TEXT,
ADD COLUMN     "requesterService" TEXT;
