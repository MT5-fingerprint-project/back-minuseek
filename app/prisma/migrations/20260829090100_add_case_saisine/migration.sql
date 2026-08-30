-- AlterTable
ALTER TABLE "CaseExpertise" ADD COLUMN     "biologicalPrecautions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "magistrateName" TEXT,
ADD COLUMN     "magistrateTitle" TEXT,
ADD COLUMN     "missionObject" TEXT,
ADD COLUMN     "ordinanceDate" TIMESTAMP(3),
ADD COLUMN     "prorogationDeadline" TIMESTAMP(3),
ADD COLUMN     "prorogationOrdinanceDate" TIMESTAMP(3),
ADD COLUMN     "sealCount" INTEGER;

-- CreateTable
CREATE TABLE "CaseExpertiseAssistant" (
    "id" UUID NOT NULL,
    "expertiseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "task" TEXT NOT NULL,

    CONSTRAINT "CaseExpertiseAssistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseExpertiseAssistant_expertiseId_idx" ON "CaseExpertiseAssistant"("expertiseId");

-- AddForeignKey
ALTER TABLE "CaseExpertiseAssistant" ADD CONSTRAINT "CaseExpertiseAssistant_expertiseId_fkey" FOREIGN KEY ("expertiseId") REFERENCES "CaseExpertise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
