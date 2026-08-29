-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "displayableSha256" CHAR(64);

-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "displayableSha256" CHAR(64);
