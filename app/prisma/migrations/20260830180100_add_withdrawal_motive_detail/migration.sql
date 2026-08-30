-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "withdrawalMotiveDetail" TEXT;

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "withdrawalMotiveDetail" TEXT;

-- La précision n'a de sens que pour 'OTHER', et 'OTHER' n'a de sens qu'avec elle :
-- sans cette contrainte, le rapport imprimerait « autre motif » sans jamais dire lequel.
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_withdrawal_detail_consistent"
  CHECK (("withdrawalMotive" IS NOT DISTINCT FROM 'OTHER') = ("withdrawalMotiveDetail" IS NOT NULL));

ALTER TABLE "ReferencePrint" ADD CONSTRAINT "ReferencePrint_withdrawal_detail_consistent"
  CHECK (("withdrawalMotive" IS NOT DISTINCT FROM 'OTHER') = ("withdrawalMotiveDetail" IS NOT NULL));
