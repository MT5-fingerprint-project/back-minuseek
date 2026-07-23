-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('CLOSE_ASSOCIATE', 'PERSON_OF_INTEREST');

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
    "type" "SubjectType" NOT NULL,
    "color" TEXT,
    "caseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subject_caseId_idx" ON "Subject"("caseId");

-- AlterTable
ALTER TABLE "ReferencePrint" ADD COLUMN     "subjectId" UUID,
ADD COLUMN     "position" "FingerPosition";
