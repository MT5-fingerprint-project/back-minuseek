-- DropForeignKey
ALTER TABLE "Matching" DROP CONSTRAINT "Matching_traceId_fkey";

-- DropForeignKey
ALTER TABLE "Matching" DROP CONSTRAINT "Matching_referencePrintId_fkey";

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_referencePrintId_fkey" FOREIGN KEY ("referencePrintId") REFERENCES "ReferencePrint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
