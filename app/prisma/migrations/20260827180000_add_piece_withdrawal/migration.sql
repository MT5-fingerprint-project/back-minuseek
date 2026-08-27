-- CreateEnum
CREATE TYPE "WithdrawalMotive" AS ENUM ('DUPLICATE', 'MISFILED', 'WRONG_ATTRIBUTION');

-- DropForeignKey
ALTER TABLE "Hit" DROP CONSTRAINT "Hit_referencePrintId_fkey";

-- DropForeignKey
ALTER TABLE "Hit" DROP CONSTRAINT "Hit_traceId_fkey";

-- DropForeignKey
ALTER TABLE "Matching" DROP CONSTRAINT "Matching_referencePrintId_fkey";

-- DropForeignKey
ALTER TABLE "Matching" DROP CONSTRAINT "Matching_traceId_fkey";

-- AlterTable
ALTER TABLE "Hit" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "withdrawalMotive" "WithdrawalMotive",
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "withdrawalMotive" "WithdrawalMotive",
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Hit" ADD CONSTRAINT "Hit_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hit" ADD CONSTRAINT "Hit_referencePrintId_fkey" FOREIGN KEY ("referencePrintId") REFERENCES "ReferencePrint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matching" ADD CONSTRAINT "Matching_referencePrintId_fkey" FOREIGN KEY ("referencePrintId") REFERENCES "ReferencePrint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une contrainte CHECK n'existe pas dans le schéma Prisma et n'entraîne pas de
-- dérive : le précédent est le trigger de 20260818160000_audit_event_append_only.
-- Une date de retrait sans motif, ou l'inverse, ne veut rien dire.
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_withdrawal_consistent"
  CHECK (("withdrawnAt" IS NULL) = ("withdrawalMotive" IS NULL));

ALTER TABLE "ReferencePrint" ADD CONSTRAINT "ReferencePrint_withdrawal_consistent"
  CHECK (("withdrawnAt" IS NULL) = ("withdrawalMotive" IS NULL));
