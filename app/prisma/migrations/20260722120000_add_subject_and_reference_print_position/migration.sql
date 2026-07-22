-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('KNOWN_ASSOCIATE', 'SUSPECT');

-- CreateEnum
CREATE TYPE "FingerPosition" AS ENUM ('RIGHT_THUMB', 'RIGHT_INDEX', 'RIGHT_MIDDLE', 'RIGHT_RING', 'RIGHT_LITTLE', 'LEFT_THUMB', 'LEFT_INDEX', 'LEFT_MIDDLE', 'LEFT_RING', 'LEFT_LITTLE', 'RIGHT_PALM', 'LEFT_PALM', 'OTHER');

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "firstParentName" TEXT,
    "secondParentName" TEXT,
    "phoneNumber" TEXT,
    "sex" "Sex" NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectCase" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "SubjectType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCase_subjectId_caseId_key" ON "SubjectCase"("subjectId", "caseId");

-- AddForeignKey
ALTER TABLE "SubjectCase" ADD CONSTRAINT "SubjectCase_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "subjectId" UUID,
ADD COLUMN     "position" "FingerPosition";
