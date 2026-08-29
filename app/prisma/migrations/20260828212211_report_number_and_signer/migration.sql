-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "number" TEXT,
ADD COLUMN     "sequence" INTEGER,
ADD COLUMN     "signerUserId" UUID;

UPDATE "Report" r
SET "sequence" = rang.rang
FROM (
  SELECT id, row_number() OVER (PARTITION BY "caseId" ORDER BY "createdAt", id) AS rang
  FROM "Report"
) rang
WHERE rang.id = r.id;

UPDATE "Report" r
SET "number" = c."caseNumber" || '-R' || r."sequence"
FROM "InvestigationCase" c
WHERE c.id = r."caseId";

UPDATE "Report" r
SET "signerUserId" = u.id
FROM "User" u
WHERE u."identityProviderId" = r."generatedBy"->>'sub';

ALTER TABLE "Report" ALTER COLUMN "number" SET NOT NULL,
ALTER COLUMN "sequence" SET NOT NULL,
ALTER COLUMN "signerUserId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Report_caseId_sequence_key" ON "Report"("caseId", "sequence");
