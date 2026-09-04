-- CreateTable
CREATE TABLE "MinutiaPair" (
    "id" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "referencePrintId" UUID NOT NULL,
    "traceMinutiaLayerId" UUID NOT NULL,
    "referenceMinutiaLayerId" UUID NOT NULL,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinutiaPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinutiaPair_traceId_referencePrintId_idx" ON "MinutiaPair"("traceId", "referencePrintId");

-- CreateIndex
CREATE UNIQUE INDEX "MinutiaPair_traceMinutiaLayerId_referencePrintId_key" ON "MinutiaPair"("traceMinutiaLayerId", "referencePrintId");

-- CreateIndex
CREATE UNIQUE INDEX "MinutiaPair_referenceMinutiaLayerId_traceId_key" ON "MinutiaPair"("referenceMinutiaLayerId", "traceId");

-- AddForeignKey
ALTER TABLE "MinutiaPair" ADD CONSTRAINT "MinutiaPair_traceMinutiaLayerId_fkey" FOREIGN KEY ("traceMinutiaLayerId") REFERENCES "Layer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutiaPair" ADD CONSTRAINT "MinutiaPair_referenceMinutiaLayerId_fkey" FOREIGN KEY ("referenceMinutiaLayerId") REFERENCES "Layer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les paires vivaient en calques d'annotation sans clé étrangère. Aucune n'a
-- d'équivalent à convertir : aucun tenant réel n'existe.
DELETE FROM "Layer" WHERE "type" = 'ANNOTATION' AND "settings"->>'type' = 'pair';
