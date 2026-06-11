-- CreateEnum
CREATE TYPE "TraceStatus" AS ENUM ('RECEIVED', 'EXPLOITABLE', 'NOT_EXPLOITABLE');

-- CreateTable
CREATE TABLE "ReferencePrint" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "caseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencePrint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "status" "TraceStatus" NOT NULL DEFAULT 'RECEIVED',
    "score" INTEGER,
    "caseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);
