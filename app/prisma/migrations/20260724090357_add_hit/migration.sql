-- CreateTable
CREATE TABLE "Hit" (
    "id" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "referencePrintId" UUID NOT NULL,
    "declaredByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hit_traceId_referencePrintId_key" ON "Hit"("traceId", "referencePrintId");

-- AddForeignKey
ALTER TABLE "Hit" ADD CONSTRAINT "Hit_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hit" ADD CONSTRAINT "Hit_referencePrintId_fkey" FOREIGN KEY ("referencePrintId") REFERENCES "ReferencePrint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
