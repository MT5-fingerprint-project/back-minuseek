-- CreateEnum
CREATE TYPE "LayerType" AS ENUM ('ANNOTATION', 'FILTER');

-- CreateTable
CREATE TABLE "Layer" (
    "id" UUID NOT NULL,
    "fingerprintId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "LayerType" NOT NULL,
    "zIndex" INTEGER NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Layer_pkey" PRIMARY KEY ("id")
);
