-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "sourceWidth" INTEGER,
ADD COLUMN     "sourceHeight" INTEGER;

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "sourceWidth" INTEGER,
ADD COLUMN     "sourceHeight" INTEGER;
