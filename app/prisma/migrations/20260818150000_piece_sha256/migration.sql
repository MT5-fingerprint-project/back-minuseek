-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "sha256" CHAR(64);

-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "sha256" CHAR(64);
