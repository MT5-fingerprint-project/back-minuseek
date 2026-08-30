ALTER TABLE "InvestigationCase" ADD COLUMN "lastTraceNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Trace" ADD COLUMN "number" INTEGER;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "caseId" ORDER BY "createdAt", id) AS rank
  FROM "Trace"
)
UPDATE "Trace" SET "number" = ranked.rank FROM ranked WHERE "Trace".id = ranked.id;

UPDATE "InvestigationCase" c
SET "lastTraceNumber" = COALESCE((SELECT MAX(t."number") FROM "Trace" t WHERE t."caseId" = c.id), 0);

ALTER TABLE "Trace" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "Trace_caseId_number_key" ON "Trace"("caseId", "number");
