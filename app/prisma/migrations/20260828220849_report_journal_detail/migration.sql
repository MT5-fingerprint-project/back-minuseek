-- CreateEnum
CREATE TYPE "JournalDetail" AS ENUM ('SUMMARY', 'FULL');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "journalDetail" "JournalDetail" NOT NULL DEFAULT 'SUMMARY';
