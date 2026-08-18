-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "captureDeviceModel" TEXT,
ADD COLUMN     "captureFocalLength" DOUBLE PRECISION,
ADD COLUMN     "captureHeight" INTEGER,
ADD COLUMN     "captureOrientation" INTEGER,
ADD COLUMN     "captureQuality" JSONB,
ADD COLUMN     "captureWidth" INTEGER,
ADD COLUMN     "capturedAt" TIMESTAMP(3);
