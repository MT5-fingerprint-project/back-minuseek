-- CreateTable
CREATE TABLE "Matching" (
    "id" UUID NOT NULL,
    "traceId" UUID NOT NULL,
    "referencePrintId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "match" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matching_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Matching_traceId_referencePrintId_key" ON "Matching"("traceId", "referencePrintId");

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_referencePrintId_fkey" FOREIGN KEY ("referencePrintId") REFERENCES "ReferencePrint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
