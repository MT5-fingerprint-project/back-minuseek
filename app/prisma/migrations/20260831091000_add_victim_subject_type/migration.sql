-- AlterEnum
ALTER TYPE "SubjectType" ADD VALUE 'VICTIM';

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "birthDate" DROP NOT NULL,
ALTER COLUMN "birthPlace" DROP NOT NULL;
