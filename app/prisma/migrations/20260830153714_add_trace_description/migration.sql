-- CreateEnum
CREATE TYPE "TraceOrigin" AS ENUM ('DIGITAL', 'PALMAR');

-- CreateEnum
CREATE TYPE "RevelationTechnique" AS ENUM ('OPTICAL_PROCESS', 'FINGERPRINT_POWDER', 'DFO', 'NINHYDRIN');

-- AlterTable
ALTER TABLE "Trace" ADD COLUMN     "location" TEXT,
ADD COLUMN     "origin" "TraceOrigin",
ADD COLUMN     "revelationTechnique" "RevelationTechnique";
