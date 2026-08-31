-- CreateEnum
CREATE TYPE "ExportedImageKind" AS ENUM ('TRACE', 'REFERENCE_PRINT');

-- CreateTable
CREATE TABLE "ExportedImage" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "sourcePieceId" UUID NOT NULL,
    "sourceKind" "ExportedImageKind" NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportedImage_sourcePieceId_idx" ON "ExportedImage"("sourcePieceId");
