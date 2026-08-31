-- AlterTable
ALTER TABLE "InvestigationCase" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- Les dossiers déjà clos n'ont leur date de clôture que dans le journal : sans
-- ce remplissage, ils resteraient à NULL et sortiraient des chiffres du service.
-- Un dossier clos plusieurs fois garde la dernière clôture, et un dossier
-- rouvert n'est plus au statut CLOSED, donc il n'est pas touché.
UPDATE "InvestigationCase" AS "investigation_case"
SET "closedAt" = "closure"."closedAt"
FROM (
  SELECT "caseId", max("occurredAt") AS "closedAt"
  FROM "AuditEvent"
  WHERE "eventType" = 'CASE_STATUS_CHANGED'
    AND "payload" ->> 'newStatus' = 'CLOSED'
    AND "caseId" IS NOT NULL
  GROUP BY "caseId"
) AS "closure"
WHERE "investigation_case"."id" = "closure"."caseId"
  AND "investigation_case"."status" = 'CLOSED';
